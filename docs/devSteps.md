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

## Phase 4 Runbook (planned) — Backfill legacy imports into canonical tables (T57)

Phase 4 introduces a one-off, idempotent backfill for already-imported legacy sessions to:
- ensure `sessions.study_day_id` is set consistently (America/Vancouver day semantics),
- populate imported rows in `survey_uls8` / `survey_cesd10` / `survey_gad7` / `digitspan_runs` (without fabricating raw items/trials),
- optionally backfill missing `weather_daily` rows (temp + precip only) for historical days using imported session values.

**Note:** This runbook becomes executable once the backfill script is implemented (T57). Until then, treat the steps below as placeholders.

Planned execution (local):
```bash
cd backend
alembic upgrade head
python -m app.scripts.phase4_backfill --dry-run
python -m app.scripts.phase4_backfill
```

Verification checklist:
- Script reports created/updated counts and is safe to re-run (idempotent).
- No `data_source="native"` survey or digit span rows are modified.
- For a historical day missing ingestion, `weather_daily` exists with only temp/precip populated and `forecast_periods` empty.
