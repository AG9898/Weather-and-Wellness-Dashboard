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

## Vercel Upstash Cache Setup (Phase 3 — T41–T45)

This phase adds an optional cache for **RA dashboard reads** using Upstash Redis via the Vercel integration.

### 1) Vercel integration and environment variables

In the Vercel dashboard for the frontend project:

1. Install the **Upstash Redis** integration and attach it to the project.
2. Confirm Vercel has the following server-side env vars (created by the integration):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Add the following server-side env vars (for JWT verification in the Route Handler):
   - `SUPABASE_URL`
   - `SUPABASE_JWT_SECRET` (optional but recommended for legacy HS256 support; ES256 via JWKS is primary)
4. Ensure `NEXT_PUBLIC_API_URL` is still set to the Render backend base URL (the live origin fetch).
5. Redeploy the frontend so the new env vars are available to Route Handlers.

### 2) Local dev (optional) env vars

To exercise the caching route locally, add a `frontend/.env.local` (do not commit) with:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>

SUPABASE_URL=<supabase-url>
SUPABASE_JWT_SECRET=<supabase-jwt-secret-optional>

UPSTASH_REDIS_REST_URL=<upstash-rest-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
```

Then run:

```bash
cd frontend && npm run dev
```

### 3) Smoke test checklist

- [ ] Visit `/dashboard` twice within 5 minutes: second visit should render immediately from cache while live refresh runs.
- [ ] Trigger a live refresh (reload after TTL or wait): dashboard should update once Render responds.
- [ ] Without a valid Supabase session (or with an invalid token), `/api/ra/dashboard` should return 401.

---

## Admin Import/Export Setup (Phase 3 — T46+)

This phase adds an RA-only Import/Export page and admin endpoints to support legacy imports and controlled exports.

### 1) Backend dependencies

Planned Python dependency for XLSX parsing and writing:
- `openpyxl`

After implementation, install/update backend deps as usual (Render deploy or local):

```bash
cd backend
pip install -r requirements.txt
```

### 2) DB migration

After the Phase 3 migration task (T47) is implemented:

```bash
cd backend && alembic upgrade head
```

### 3) Smoke test checklist (developer-owned)

- [ ] Sign in as RA and visit `/import-export`.
- [ ] Import preview: upload `reference/data_full_1-230.xlsx` and confirm the preview shows total rows and create/update counts.
- [ ] Import commit: click Confirm and verify a success summary (created vs updated counts).
- [ ] Verify in Supabase Studio:
  - `participants` has demographic columns populated (where present in the import)
  - `sessions` includes complete sessions created/updated by the import
  - `imported_session_measures` contains the imported aggregate values
- [ ] Export XLSX downloads and opens; file name matches `Weather and wellness - YYYY-MM-DD.xlsx`.
- [ ] Export CSV downloads as a zip; file name matches `Weather and wellness - YYYY-MM-DD.zip`; each CSV has headers.

---

## Weather Ingestion Setup (Phase 2 — T32)

> Canonical feature spec: `docs/WEATHER_INGESTION.md`
> Workflow file: `.github/workflows/weather-ingest.yml`

### 1) Backend (Render) env vars

Add to Render backend service environment settings:

| Variable | Value | Notes |
|---|---|---|
| `WEATHER_INGEST_SHARED_SECRETS` | `<your-secret>` | Comma-separated; supports rotation. Must match `WEATHER_INGEST_SHARED_SECRET` in GitHub. |
| `WEATHER_INGEST_COOLDOWN_SECONDS` | `600` | Optional — defaults to 600 in code. |

### 2) GitHub repository secrets

Add the following under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret name | Value |
|---|---|
| `WEATHER_INGEST_BASE_URL` | `https://weather-and-wellness-dashboard.onrender.com` (no quotes/whitespace) |
| `WEATHER_INGEST_SHARED_SECRET` | One value that matches an entry in Render `WEATHER_INGEST_SHARED_SECRETS` |

### 3) Verify the workflow triggers

- The `schedule` trigger (`cron: '0 14 * * *'`) is only active on the **default branch** (`main`).
- Use **Actions → Daily Weather Ingestion → Run workflow** to trigger manually via `workflow_dispatch` immediately after setting secrets.
- Confirm the run succeeds (green) and that a new row appears in Supabase Studio → `weather_ingest_runs`.

### Verification checklist

- [ ] Render env var `WEATHER_INGEST_SHARED_SECRETS` is set and non-empty.
- [ ] GitHub secrets `WEATHER_INGEST_BASE_URL` and `WEATHER_INGEST_SHARED_SECRET` are set.
- [ ] Manual `workflow_dispatch` run completes green.
- [ ] `weather_ingest_runs` shows a new row with `parse_status: success` or `partial`.
- [ ] `weather_daily` shows a row for today's date.
- [ ] Re-running the workflow within 10 minutes returns 429 (exit 0 — not a failure).

---

## One-Click Session Flow (Phase 2 — planned)

After implementation of the one-click supervised workflow:

- From `/dashboard`, click **Start New Entry**.
- Confirm the app redirects directly into the participant flow without copying a link.
  - Current: starts at Survey 1 (`/session/<session_id>/uls8`)
  - Planned (T52): consent-gated start (`/session/<session_id>/consent`)
- Complete all four surveys, then Digit Span, then the completion screen.
- Return to `/dashboard` and confirm KPIs (especially Completed sessions) reflect the new completion.

---

## Pooler Note

- In IPv4-only environments, use Supabase **session pooler** for `DATABASE_URL`.
- With SQLAlchemy asyncpg in this repo, use `ssl=require` in the URL query string.
