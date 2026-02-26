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

## Setup Steps

| Step | Action | Related tasks |
|------|--------|---------------|
| 1 | Create a Supabase project and collect: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. If auth is enabled, also collect `SUPABASE_JWT_SECRET` and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend. | T02 | 
| 2 | Create a local root `.env` and fill required variables. | T01, T02 |
| 3 | Install backend deps: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`. | T01 |
| 4 | Install frontend deps: `cd frontend && npm install`. | T01 |
| 5 | Apply migrations: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/alembic upgrade head`. | T02, T03, T04, T05 |
| 6 | Start backend: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload`. | T01, T07, T08 |
| 7 | Start frontend: `cd frontend && npm run dev`. | T01 |
| 8 | After T07/T08 are corrected, smoke-test endpoints (create participant, create session, update session status) and confirm rows appear in Supabase Studio. | T07, T08 |

---

## Verification Checklist

- `alembic upgrade head` completes without errors against your Supabase DB. (T02–T05)
- `alembic current -v` reports `Rev: 20260226_000005 (head)` after applying all migrations. (T02–T05, T29)
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

### 3) Alembic migrations (hosted one-off procedure)

Migrations run **explicitly** — never on app startup (`app/main.py` contains no Alembic calls).

**Option A — Run locally against production DATABASE_URL (⚠ use carefully):**

```bash
cd backend
# Export the production DATABASE_URL (the same value set in Render)
export DATABASE_URL="<production-pooler-url>?ssl=require"
PYTHONPATH=. .venv/bin/alembic upgrade head
```

**Option B — Render Shell / one-off job:**

In the Render dashboard, open the service → **Shell** tab and run:

```bash
PYTHONPATH=. alembic upgrade head
```

**Confirm migrations applied:**

```bash
# Locally (against the same DB):
PYTHONPATH=. .venv/bin/alembic current -v
# Expected: Rev: 20260219_000004 (head)
```

Or query the DB directly in Supabase Studio:

```sql
SELECT version_num FROM alembic_version;
-- Expected: 20260219_000004
```

Current head revision: `20260226_000005` (weather_tables — Phase 2, T29).

### 4) Link frontend to hosted backend

Set the following in Vercel project environment settings:

```
NEXT_PUBLIC_API_URL=https://weather-and-wellness-dashboard.onrender.com
```

After setting, redeploy the frontend and smoke-test `/health`, participant creation, and a survey submission.

### 5) Smoke test checklist (developer-owned)

- [ ] `GET /health` → 200 `{"status":"ok"}`
- [ ] `GET /docs` → 200 (Swagger UI loads)
- [ ] `GET /openapi.json` → 200 valid JSON
- [ ] RA endpoint auth behavior matches current phase
- [ ] Frontend (Vercel) can reach backend from its deployed origin (check CORS headers)
- [ ] New rows appear in Supabase Studio after participant/session creation

---

## Weather Ingestion Setup (Phase 2 — planned)

> Canonical feature spec: `docs/WEATHER_INGESTION.md`

### Backend (Render) env vars

Add to Render backend env:

- `WEATHER_INGEST_SHARED_SECRETS` — comma-separated secrets for GitHub Actions ingestion auth (supports rotation)
- `WEATHER_INGEST_COOLDOWN_SECONDS` — set to `600` (optional; defaults to 600 in code)

### GitHub repository secrets

Add to GitHub repo secrets:

- `WEATHER_INGEST_BASE_URL` — e.g. `https://weather-and-wellness-dashboard.onrender.com`
- `WEATHER_INGEST_SHARED_SECRET` — one value that matches an entry in Render `WEATHER_INGEST_SHARED_SECRETS`

Note:
- GitHub Actions `schedule` runs on the repository default branch and uses UTC cron time.
- Use `workflow_dispatch` (manual run) to verify configuration immediately.

### Verification steps (after implementation)

- Run Alembic migration that creates `study_days`, `weather_daily`, `weather_ingest_runs`.
- Trigger ingestion manually from the RA dashboard and confirm rows appear in Supabase Studio.
- Confirm the GitHub Actions workflow runs on schedule and is idempotent (no duplicate day rows).

---

## One-Click Session Flow (Phase 2 — planned)

After implementation of the one-click supervised workflow:

- From `/dashboard`, click **Start New Entry**.
- Confirm the app redirects directly into Survey 1 (`/session/<session_id>/uls8`) without copying a link.
- Complete all four surveys, then Digit Span, then the completion screen.
- Return to `/dashboard` and confirm KPIs (especially Completed sessions) reflect the new completion.

---

## Pooler Note

- In IPv4-only environments, use Supabase **session pooler** for `DATABASE_URL`.
- With SQLAlchemy asyncpg in this repo, use `ssl=require` in the URL query string.
