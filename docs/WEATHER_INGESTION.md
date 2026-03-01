# WEATHER_INGESTION.md — UBC EOS Daily Weather Ingestion

> Canonical spec for the UBC EOS weather ingestion feature (Phase 2).
> This document defines the scraper sources, data model, day-linking rules,
> idempotency guarantees, and scheduler/security behavior.
>
> Related docs:
> - API contract: `docs/API.md` (Weather section)
> - Planned schema additions: `docs/SCHEMA.md` (Planned Additions section)
> - Deployment boundaries: `docs/ARCHITECTURE.md` (Scheduled Jobs section)

---

## Goal

Ingest daily weather data for UBC EOS station `location=3510` by scraping HTML (no API key),
persist structured numeric fields into Supabase Postgres, and provide:

1. Automated scheduler via **GitHub Actions only**
2. Manual fallback “Update Weather” trigger in the RA frontend (LabMember protected)

## Non-goals (explicit)

- Do not use Supabase `pg_cron` in this phase.
- Do not scrape chart images or rely on chart-rendered values.
- Do not build weather-specific CSV export or bulk export endpoints (admin Import/Export is a separate Phase 3 feature).

---

## Sources

Station: `location=3510` (required).

- Primary:
  - `https://weather.eos.ubc.ca/wxfcst/users/Guest/custom.php?location=3510`
- Secondary:
  - `https://weather.eos.ubc.ca/wxfcst/users/Guest/ubcrs_withicons/index.php?location=3510`

The ingester fetches both, parses what it can from each, and merges into one canonical payload.

---

## Day Linking Rule (Sessions ↔ Weather)

**Key principle:** the experiment is day-level. Hour/minute precision is kept only for
display/debug; analytics joins are by **local day**.

### Canonical day key
- `date_local`: `DATE` in timezone `America/Vancouver`.
- All daily weather is keyed by a `study_days` row (`study_day_id`) with unique `date_local`.

### Why use `study_days` (dimension table)
This provides a stable relational key for:
- `sessions.study_day_id -> study_days.study_day_id`
- `weather_daily.study_day_id -> study_days.study_day_id`

This avoids fragile “join by computed date” patterns, and keeps sessions linkable even if
weather ingestion is missing for a day (the day row can still exist).

### Session day definition (for analyses)
Default: the “session day” is set when a session becomes `complete` and is derived from
`completed_at` in `America/Vancouver`.

Documented alternative (if the study later defines the day at activation): derive from
an `activated_at` timestamp if/when introduced.

### Example join query (day-level)
If linking by `study_day_id` (preferred):
```sql
SELECT s.session_id, s.participant_uuid, d.date_local, w.current_temp_c
FROM sessions s
JOIN study_days d ON d.study_day_id = s.study_day_id
LEFT JOIN weather_daily w ON w.study_day_id = d.study_day_id AND w.station_id = 3510
WHERE s.status = 'complete';
```

If linking by derivation (acceptable fallback, no FK):
```sql
SELECT s.session_id, s.participant_uuid, w.current_temp_c
FROM sessions s
LEFT JOIN weather_daily w
  ON w.station_id = 3510
 AND w.date_local = (timezone('America/Vancouver', s.completed_at))::date
WHERE s.status = 'complete';
```

---

## Data Model

### Tables

- `study_days` (dimension, one row per local day in `America/Vancouver`)
- `weather_daily` (one row per station per study day; idempotent upsert target)
- `weather_ingest_runs` (append-only audit/debug record for every ingest attempt)

See `docs/SCHEMA.md` for the column-level schema.

### Timestamp policy
- Keep ingest/observation timestamps as metadata only:
  - `weather_ingest_runs.ingested_at` (debug/ops)
  - optional `weather_daily.current_observed_at` (display-only if parseable)
- Do not attempt to store a full hourly time series in this iteration.

---

## Legacy Import Backfill (Phase 4, T56 — implemented 2026-03-01)

When legacy sessions are imported (Phase 3 admin import), we may not have UBC-ingested weather for the historical study days.

`POST /admin/backfill/legacy-weather` (RA-protected) implements this backfill:
- For each study day that has imported session data but **no** existing `weather_daily` row for station 3510:
  - Computes mean `temperature_c` and mean `precipitation_mm` from `imported_session_measures` rows for that `date_local`.
  - Inserts a partial `weather_daily` row with only `current_temp_c` and `current_precip_today_mm` populated. All other fields remain null/empty (no fabricated forecast data). The JSONB-NOT-NULL `forecast_periods` and `structured_json` columns are set to `[]` and `{}` respectively.
  - Writes one `weather_ingest_runs` audit row per backfilled day: `parser_version="legacy-import-v1"`, `requested_via="legacy_backfill"`.
- Existing `weather_daily` rows are **never overwritten** (`on_conflict_do_nothing`).
- Idempotent: safe to call multiple times; subsequent calls return `days_backfilled=0, days_skipped=N`.
- Implemented in `backend/app/services/weather_backfill_service.py` and exposed via `backend/app/routers/admin.py`.

**Verified 2026-03-01:** backfilled 109 days from reference XLSX data; second call returned `days_backfilled=0, days_skipped=109`.

**Important:** day-level linking is always by `study_days.date_local` (America/Vancouver). Metadata timestamps like `weather_daily.updated_at` and `weather_daily.current_observed_at` must not be treated as the analytic join key.

---

## Parsing & Normalization

### Parsed outputs
The parser should capture:
- Current conditions (as many numeric fields as reliably parseable)
- Forecast blocks/periods (structured list)

### parse_status
Stored on every ingest run:
- `success`: fetched at least one source and parsed at least one “current” numeric field
  and at least one forecast day/period.
- `partial`: some useful fields parsed, but key blocks missing (e.g., no forecast periods).
- `fail`: nothing useful parsed (or both fetches failed).

### parse_errors (for troubleshooting)
Stored as an array of objects (JSONB), e.g.:
```json
[
  { "code": "PRIMARY_MISSING_TABLE", "message": "Could not find current conditions table", "source": "primary" }
]
```

Upstream HTML changes are expected; raw HTML and hashes are stored in `weather_ingest_runs`
to make failures diagnosable.

---

## Idempotency, Cooldown, Concurrency

### Idempotent daily upsert
`weather_daily` is upserted by unique key `(station_id, study_day_id)` (or `(station_id, date_local)`
only if `study_days` is temporarily skipped).

### Cooldown (abuse control)
Per station, reject ingestion if the most recent `weather_ingest_runs.ingested_at` is within
the last 10 minutes. Return `429` with a retry-after hint.

### Concurrency protection
Use a per-station Postgres advisory lock to prevent concurrent ingestion from:
- GitHub Actions cron
- RA manual trigger

If lock is held, return `409` (“Ingestion already in progress”).

---

## Auth Model

The `POST /weather/ingest/ubc-eos` endpoint accepts **either** of two auth methods:

| Path | Header | Value |
|------|--------|-------|
| RA manual trigger | `Authorization` | `Bearer <supabase-jwt>` (LabMember JWT) |
| GitHub Actions scheduler | `X-WW-Weather-Ingest-Secret` | Shared secret (plain string) |

Rules:
- The endpoint checks for a valid LabMember JWT first; if absent it falls back to the shared secret header.
- The shared secret is compared against all values in `WEATHER_INGEST_SHARED_SECRETS` (comma-separated) to allow rotation.
- **Shared secrets must never be included in the RA dashboard HTML/JS** — the frontend triggers ingest via the LabMember JWT path only.
- If neither auth method is valid, return `401`.

---

## Scheduler (GitHub Actions Only)

GitHub Actions is the primary and only scheduler in this phase.

- Schedule: once per day at a stable UTC time.
- Implement retries (Render cold starts / transient failures).
- Auth: shared secret header (`X-WW-Weather-Ingest-Secret`); never a LabMember JWT.

See `docs/ARCHITECTURE.md` for secret ownership boundaries and required GitHub secrets.
