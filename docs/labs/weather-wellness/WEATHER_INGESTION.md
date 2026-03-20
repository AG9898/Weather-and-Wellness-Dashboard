# WEATHER_INGESTION.md — UBC EOS Daily Weather Ingestion

> Canonical spec for the UBC EOS weather ingestion feature (Phase 2).
> This document defines the scraper sources, data model, day-linking rules,
> idempotency guarantees, and scheduler/security behavior.
>
> Related docs:
> - API contract: `docs/API.md` (Weather section)
> - Planned schema additions: `docs/SCHEMA.md` (Planned Additions section)
> - Deployment boundaries: `docs/ARCHITECTURE.md` (Scheduled Jobs section)
> - Historical gap-fill spec: `docs/HISTORICAL_WEATHER_BACKFILL.md`

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

## Historical Weather Backfill via Open-Meteo (Planned)

When the live UBC EOS scraper was not yet running (before the study started using `POST /weather/ingest/ubc-eos`) and no legacy import data exists for a date, `weather_daily` rows for that period have no data. To make the dashboard's weather trend graph continuous from the beginning of 2025, a one-time (and re-runnable) backfill fetches data from the Open-Meteo Archive API.

`POST /weather/backfill/historical` (LabMember JWT required) implements this backfill:

### Data source

- **API:** Open-Meteo Archive — `https://archive-api.open-meteo.com/v1/archive`
- **Coordinates:** `latitude=49.2606`, `longitude=-123.2460` (UBC main campus, ~2 km from EOS station 3510)
- **No API key required.** Free tier allows 10 000 calls/day; the full 2025-to-present range is a single request.
- **Timezone:** `timezone=America/Vancouver` is passed in the request. Open-Meteo returns `daily.time` strings (e.g. `"2025-01-15"`) anchored to the local Vancouver calendar day, matching `date_local` in `study_days` and `weather_daily` exactly. No conversion is needed.
- **Data lag:** Open-Meteo typically provides data up to ~2–5 days before the current date.

### Fields fetched and their `weather_daily` mappings

| Open-Meteo variable | Column | Notes |
|---|---|---|
| `temperature_2m_mean` | `current_temp_c` | Daily mean temperature (°C) |
| `temperature_2m_max` | `forecast_high_c` | Daily high (°C) |
| `temperature_2m_min` | `forecast_low_c` | Daily low (°C) |
| `relative_humidity_2m_mean` | `current_relative_humidity_pct` | Cast to integer |
| `precipitation_sum` | `current_precip_today_mm` | Daily total (mm) |
| `sunshine_duration` | `sunshine_duration_hours` | Seconds ÷ 3600; new column (see `docs/SCHEMA.md`) |

### Precedence rules

For each date in the requested range, the existing `weather_daily` row (if any) is checked via its linked `weather_ingest_runs.parser_version`:

| Existing state | Action | Counter |
|---|---|---|
| No row for station 3510 | Full insert of all 6 fields + audit run row | `days_inserted` |
| Import row (`parser_version="legacy-import-v1"`) | Update only null fields: `current_relative_humidity_pct`, `sunshine_duration_hours`, `forecast_high_c`, `forecast_low_c`. **Never overwrites** `current_temp_c` or `current_precip_today_mm` from the import | `days_enhanced` |
| Live UBC row (`parser_version="ubc-eos-v1"`) | Skipped entirely | `days_skipped` |

### Audit trail

- One `weather_ingest_runs` row is written per **affected** day (insert or enhance).
- `requested_via = "historical_api_backfill"`, `parser_version = "open-meteo-v1"`.
- `source_primary_url` = the Open-Meteo URL used for that batch.
- Idempotent: a second call with the same range returns `days_inserted=0, days_enhanced=0, days_skipped=N`.

See `docs/HISTORICAL_WEATHER_BACKFILL.md` for the complete spec and API contract.

---

## Legacy Import Backfill (Phase 4, T56 — implemented 2026-03-01; updated 2026-03-03)

When legacy sessions are imported (Phase 3 admin import), we may not have UBC-ingested weather for the historical study days.

`POST /admin/backfill/legacy-weather` (RA-protected) implements this backfill. The service computes mean `temperature_c` and `precipitation_mm` from `imported_session_measures` rows per `date_local` and writes to `weather_daily` with the following precedence:

| Existing row | Action | Counter |
|---|---|---|
| No row | Insert partial `weather_daily` (temp + precip only; JSONB NOT-NULL columns set to `[]`/`{}`) | `days_inserted` |
| `parser_version="open-meteo-v1"` | **Overwrite** `current_temp_c` and `current_precip_today_mm` with import values; preserve existing humidity/sunshine; update `source_run_id` | `days_updated` |
| `parser_version="ubc-eos-v1"` | Skip — live station measurements are the highest-quality source | `days_skipped` |
| `parser_version="legacy-import-v1"` | No-op — import values already in place (idempotent) | — |

**Data quality rationale:** actual temperature and precipitation recorded during study sessions (from the XLSX import) take priority over ERA5 satellite reanalysis data (Open-Meteo). The legacy backfill deliberately overwrites Open-Meteo temp/precip for import dates while preserving the Open-Meteo humidity and sunshine values it filled in.

- Writes one `weather_ingest_runs` audit row per affected day: `parser_version="legacy-import-v1"`, `requested_via="legacy_backfill"`.
- Idempotent: after overwriting open-meteo rows, `source_run_id` is updated to the new `legacy-import-v1` run. Subsequent calls see `legacy-import-v1` rows and skip them.
- Implemented in `backend/app/services/weather_backfill_service.py` and exposed via `backend/app/routers/admin.py`.
- Combined script: `backend/app/scripts/weather_backfill.py` runs legacy backfill then Open-Meteo in the correct order.

**Recommended run order:** always run the legacy import backfill **before** the Open-Meteo backfill. If Open-Meteo was run first (e.g., to fill the full date range), run the legacy backfill afterward to overwrite temp/precip for import dates. See `docs/HISTORICAL_WEATHER_BACKFILL.md` for full details.

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
