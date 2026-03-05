# devSteps.md — Developer Setup and Verification Steps

> This guide lists the steps only the developer can perform locally (env config,
> Supabase setup, installs, and running servers). Each step includes related task IDs.
> For deployment boundaries and env ownership, see `docs/ARCHITECTURE.md` and
> `docs/CONVENTIONS.md`.

---

## Prereqs

- Python 3.11+ and Node.js 18+ installed
- Supabase project created (Phase 1)

---
## Verification Checklist

- `alembic upgrade head` completes without errors against your Supabase DB. (T02–T05)
- `alembic current -v` reports `Rev: 20260228_000008 (head)` after applying all migrations. (T02–T05, T29, T47, T47a)
- Backend starts cleanly and exposes `/health`. (T01)
- Frontend dev server starts without Next.js compile errors. (T01)
- Participant/session endpoints return expected status codes once T07/T08 are fixed. (T07–T08)

---

## Frontend Runbook — Vercel + Upstash Cache (T41, T71)

This runbook covers the optional Redis cache layer used to reduce perceived cold-start latency for RA dashboard reads.

### 1) Vercel environment variables

The cache Route Handlers are server-only and require one of the following env var pairs to exist in Vercel:

- **Preferred (Vercel KV / Upstash integration):** `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- **Fallback (direct Upstash REST):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

JWT verification in Route Handlers requires one of:
- `SUPABASE_URL` (server-only), or
- `NEXT_PUBLIC_SUPABASE_URL` (already needed by the frontend auth client)

### 2) What is cached

- `GET /api/ra/dashboard?mode=cached|live` caches a bundle of dashboard summary KPIs + today’s weather.
- `GET /api/ra/weather/range?mode=cached|live&date_from=...&date_to=...` caches weather-only range data for the trend chart.

### 3) Smoke test checklist (browser)

1) Login as an RA and open `/dashboard`.
2) In DevTools → Network, inspect:
   - `/api/ra/dashboard?mode=cached` → response header `x-ww-cache: hit|miss|disabled`
   - (if a cache miss occurred) `/api/ra/dashboard?mode=live` → `x-ww-cache: refresh`
   - `/api/ra/weather/range?...&mode=cached` → `x-ww-cache: hit|miss|disabled`
3) Reload `/dashboard`:
   - `/api/ra/dashboard?mode=cached` should become `x-ww-cache: hit` after the cache has been populated.

Troubleshooting:
- `x-ww-cache: disabled` → Upstash/Vercel KV env vars are missing in Vercel.
- Repeated `miss` even after a `live` call → confirm the Upstash integration is connected to the project and env vars are present in the deployment environment.

---

## T27 Runbook — Render Backend Service

> **Status (2026-02-25):** Service is live at `https://weather-and-wellness-dashboard.onrender.com`.
> Verification results: `/health` → 200 `{"status":"ok"}` ✓ | `/docs` → 200 ✓ | `/openapi.json` → 200 valid JSON ✓

Use this runbook when re-deploying or reconfiguring the Render backend.

### 1) Service configuration (reference)

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

### 2) Required Render environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Always | Supabase session pooler URL; must include `ssl=require` |
| `ALLOWED_ORIGINS` | Always | Comma-separated Vercel frontend URL(s) for CORS. Without this only localhost origins are allowed. |
| `SUPABASE_JWT_SECRET` | When RA JWT auth enabled | Used by FastAPI to validate Supabase JWTs |
| `SUPABASE_URL` | When backend uses Supabase SDK | Supabase project URL |
| `SUPABASE_ANON_KEY` | When backend uses Supabase SDK | Supabase anonymous key |

> Keep all secret values in Render env settings only — never commit values to the repo.

## Admin Import/Export Setup (Phase 3 — T46+)

This phase adds an RA-only Import/Export page and admin endpoints to support legacy imports and controlled exports.

### 1) Backend dependencies

Added Python packages (T48) — included in `backend/requirements.txt`:
- `openpyxl>=3.1.0` — XLSX file reading (import preview/commit) and writing (export)
- `python-multipart>=0.0.9` — FastAPI multipart file upload support

Install/update backend deps as usual (Render deploy or local):

```bash
cd backend
pip install -r requirements.txt
```

### 1b) Backend environment variables (Phase 3)

Optional env vars (Render and local dev):

| Variable | Default | Notes |
|---|---:|---|
| `DAYLIGHT_START_LOCAL_TIME` | `06:00` | Local clock time used to compute `participants.daylight_exposure_minutes` at session start (study TZ: `America/Vancouver`). |

## Pooler Note

- In IPv4-only environments, use Supabase **session pooler** for `DATABASE_URL`.
- With SQLAlchemy asyncpg in this repo, use `ssl=require` in the URL query string.

---

## Phase 4 Runbook — Backfill legacy imports into canonical tables (T57, implemented 2026-03-01)

Phase 4 includes an idempotent one-off backfill for already-imported legacy sessions that:
- ensures `sessions.study_day_id` is set consistently (America/Vancouver day semantics),
- populates imported rows in `survey_uls8` / `survey_cesd10` / `survey_gad7` / `digitspan_runs` (no raw items/trials fabricated),
- backfills missing `weather_daily` rows (temp + precip only) for historical days using imported session values.

Script: `backend/app/scripts/phase4_backfill.py`

Execution (from `backend/`):
```bash
cd backend
alembic upgrade head
python -m app.scripts.phase4_backfill --dry-run   # preview counts, no writes
python -m app.scripts.phase4_backfill              # apply
```

Verification checklist:
- `--dry-run` prints per-table create/update/skip counts for all four canonical tables.
- After a real run, re-running reports 0 creates and N updates (idempotent).
- No `data_source="native"` survey or digit span rows are modified (guarded by `WHERE data_source='imported'` in each upsert).
- For a historical day missing ingestion, `weather_daily` exists with only `current_temp_c` and `current_precip_today_mm` populated; `forecast_periods` is `[]` and `structured_json` is `{}`.

---

## Demo Runbook — Wipe Study Data + Restore from Reference Import

This runbook is for resetting a demo database by deleting all study-domain rows while leaving the schema intact.

### Wipe (IRREVERSIBLE)

The wipe deletes rows from these tables (CASCADE): `participants`, `sessions`, `study_days`, `imported_session_measures`, all survey tables, digit span tables, and weather tables.

Script (mirrors Alembic wipe migration `20260228_000009_clear_all_test_data.py`):

```bash
cd backend
python -m app.scripts.clear_all_test_data --dry-run
python -m app.scripts.clear_all_test_data --apply
```

Optional safety step before wiping:
- Download a backup via `GET /admin/export.zip` or `GET /admin/export.xlsx` (RA-only). The legacy import file cannot restore native item/trial-level rows.

### Restore (from the legacy reference XLSX/CSV)

1) Re-import via the RA Import/Export page (or `POST /admin/import/commit`) using the unchanged reference file.

2) Restore derived weather rows (if you want weather_daily populated for imported days):

- Call `POST /admin/backfill/legacy-weather` (idempotent).

Notes:
- Import commit repopulates: `participants`, `sessions`, `study_days`, `imported_session_measures`, and imported rows in `digitspan_runs` + `survey_uls8` + `survey_cesd10` + `survey_gad7`.
- Import does not reconstruct raw `digitspan_trials` or `survey_cogfunc8a` rows; those only exist for native sessions.
