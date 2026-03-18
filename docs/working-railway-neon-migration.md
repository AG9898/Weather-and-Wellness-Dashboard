# Working Railway + Neon Migration

> Working planning snapshot for the infrastructure migration from Render + Supabase Postgres
> to Railway (backend) + Neon (database). This document records the current direction and
> confirmed decisions so the migration can be executed cleanly without re-deciding the basics.
>
> Status: pre-implementation. All architectural decisions resolved March 2026 (see Resolved
> Decisions section below). Migration has not yet started.

---

## Resolved Decisions

These items were evaluated during planning (March 2026) and are resolved:

| Decision | Resolution |
|---|---|
| Canadian data residency scope | **Database only.** Ethics board requires participant health/survey data to be stored in Canada. Backend compute location is not in scope. |
| Database provider | **Neon**, hosted in `aws-ca-central-1` (Toronto). Serverless Postgres, compatible with existing SQLAlchemy + asyncpg + Alembic stack. |
| Backend host | **Railway** (always-on by default, no cold starts, US region is acceptable). Replaces Render. |
| Auth provider | **Supabase Auth stays unchanged.** Only stores RA credentials (emails/passwords). Not in scope for data residency. No code changes to `auth.py` or the frontend Supabase client. |
| Frontend host | **Vercel stays unchanged.** Next.js + Upstash Redis caching layer unaffected. |
| Cold start fix | Railway services are always-on by default — no sleep, no manual keep-alive configuration required. Solves the current Render free-tier cold start problem entirely. |
| Code changes required | **Zero application code changes.** All integration points are already env-var driven. Only env vars and deployment config change. |
| Supabase Studio replacement | Neon Console (browser-based SQL editor at console.neon.tech) is the working default for lab data reads. Desktop client (TablePlus or DBeaver) is an acceptable alternative. |

---

## Purpose

The current stack runs the FastAPI backend on Render's free tier and stores all participant
data in Supabase Postgres (US East). This creates two problems:

1. **Data residency:** Participant health data (survey responses, digit span results, session
   records) is stored in a US-East Supabase Postgres instance. Ethics board requires this data
   to be physically located in Canada.

2. **Cold start latency:** Render's free tier spins down after 15 minutes of inactivity. Cold
   restart takes ~1 minute and makes non-cached endpoints (session start, survey submit, digit
   span) feel unresponsive to users. Upstash Redis mitigates dashboard reads but does not help
   write paths.

The migration addresses both by moving the database to Neon (Toronto) and the backend to
Railway (always-on).

---

## Current Decisions

These are the working defaults and should be treated as the current direction unless
explicitly changed.

- Keep all backend Python code exactly as-is. Do not refactor during migration.
- Keep all frontend code exactly as-is. Do not refactor during migration.
- Use the Neon **direct connection string** (not the pooler URL) for the FastAPI backend.
  SQLAlchemy manages its own connection pool; Neon's PgBouncer pooler is for serverless
  functions that cannot maintain persistent connections. Since Railway keeps the service
  always-on, SQLAlchemy's built-in pool is the correct layer.
- Set `sslmode=require` in the Neon connection string. The existing `.env.example` already
  documents this format and `db.py` handles `?ssl=require` correctly.
- Use Railway's **Nixpacks** builder (default). It auto-detects Python, reads
  `requirements.txt`, and handles the build without a Dockerfile.
- The Railway start command is: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  Railway injects `$PORT` automatically.
- Do not migrate the Supabase project itself. Keep the Supabase project alive for Auth only
  (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
  all remain valid and unchanged).
- Neon free tier is the starting point. Upgrade to Neon Launch ($19/month) if storage exceeds
  512 MB or if auto-suspend causes observable latency issues.
- Run `alembic upgrade head` against the new Neon database before any participant data is
  migrated, to ensure schema parity.
- Keep Render running in parallel until the Railway deployment is fully validated. Do not
  decommission Render until smoke tests pass.

---

## What Changes vs What Stays the Same

### Changes

| Item | From | To |
|------|------|----|
| Database host | Supabase Postgres (US East) | Neon Postgres (`aws-ca-central-1`, Toronto) |
| `DATABASE_URL` env var | `postgresql+asyncpg://...supabase.co/...` | `postgresql+asyncpg://...neon.tech/...?sslmode=require` |
| Backend host | Render (free tier, cold starts) | Railway (always-on, US region) |
| `NEXT_PUBLIC_API_URL` in Vercel | Render service URL | Railway service URL |
| `ALLOWED_ORIGINS` in backend env | Set in Render dashboard | Set in Railway dashboard |
| Lab data access tool | Supabase Studio | Neon Console or TablePlus/DBeaver |
| Deployment config | Render buildpack config | Railway Nixpacks (zero-config) |

### Stays the Same

| Item | Notes |
|------|-------|
| All backend Python code | Zero changes to routers, models, scoring, analytics, auth |
| All frontend TypeScript code | Zero changes to components, API wrappers, Route Handlers |
| `backend/app/db.py` | Already handles URL normalization and `pool_pre_ping=True` |
| `backend/app/auth.py` | Supabase JWT verification is provider-agnostic |
| `backend/app/main.py` | `ALLOWED_ORIGINS` already reads from env |
| `frontend/src/lib/server/route-handler-backend.ts` | `NEXT_PUBLIC_API_URL` already reads from env |
| Supabase Auth | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET` all unchanged |
| `admin_cli/invite_user.py` | Uses `SUPABASE_SERVICE_ROLE_KEY` — unchanged |
| Alembic migrations | Run unchanged against new DB; no migration files need editing |
| Upstash Redis cache | Not affected; cache layer sits between Vercel and Railway |
| Vercel frontend deployment | Not affected |

---

## Environment Variable Changes

### Railway (backend) — full env var set

```
# Database — new Neon connection string
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.ca-central-1.aws.neon.tech/dbname?sslmode=require

# CORS — set to the Vercel frontend origin
ALLOWED_ORIGINS=https://your-app.vercel.app

# Supabase Auth — all unchanged from current Render values
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_JWT_SECRET=<supabase-jwt-secret>
```

`SUPABASE_SERVICE_ROLE_KEY` is only used by `admin_cli/invite_user.py` locally — it does not
need to be set in Railway.

### Vercel (frontend) — one change

```
# Update from Render URL to Railway URL
NEXT_PUBLIC_API_URL=https://your-project.up.railway.app
```

All other Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are unchanged.

---

## Migration Steps

### Phase 1 — Neon Setup

**1.1 Create Neon project**
- Log in to console.neon.tech
- Create a new project
- **Region must be set to `aws-ca-central-1` at creation — it cannot be changed later**
- Note the direct connection string (not the pooler string)

**1.2 Apply schema to Neon**
- Set `DATABASE_URL` in local `.env` to the Neon connection string
- Run: `cd backend && alembic upgrade head`
- Verify all 15 migrations applied cleanly: `alembic current` should show the latest revision

**1.3 Migrate existing data (if applicable)**
- If there is no production participant data to preserve, skip to Phase 2
- If there is production data:
  - Export from Supabase Postgres: `pg_dump -Fc <supabase-connection-string> -f dump.pgdump`
  - Restore to Neon: `pg_restore -d <neon-connection-string> dump.pgdump`
  - Verify row counts in Neon Console match Supabase Studio before proceeding

**1.4 Validate Neon connection locally**
- With `DATABASE_URL` pointing at Neon, run the backend locally:
  `cd backend && uvicorn app.main:app --reload`
- Confirm the app starts and can write/read a test row

---

### Phase 2 — Railway Setup

**2.1 Create Railway project**
- Log in to railway.app
- Create a new project, connect to the GitHub repo
- Select the `backend/` directory as the root (or configure the Nixpacks root path)

**2.2 Configure start command**
In Railway service settings, set the start command:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**2.3 Set environment variables**
In Railway dashboard → Service → Variables, add all env vars from the
"Railway (backend)" list above. Use the Neon connection string for `DATABASE_URL`.

**2.4 Verify Nixpacks build**
- Trigger a deploy from the Railway dashboard
- Check build logs — Nixpacks should detect Python, install from `requirements.txt`, and start uvicorn
- Note: first build will be slow due to numpy/scipy/statsmodels compilation; subsequent builds use the cache

**2.5 Note the Railway service URL**
Railway generates a URL of the form `https://project-name.up.railway.app`. This is needed for
the Vercel env var update and for CORS.

---

### Phase 3 — Frontend Cutover

**3.1 Update Vercel env var**
- In Vercel project settings → Environment Variables
- Update `NEXT_PUBLIC_API_URL` from the current Render URL to the Railway URL
- Redeploy the frontend (or wait for next auto-deploy)

**3.2 Verify CORS**
- Confirm `ALLOWED_ORIGINS` in Railway matches the Vercel frontend origin exactly
  (e.g. `https://your-app.vercel.app` — no trailing slash)

---

### Phase 4 — Smoke Testing

Run through this checklist against the Railway backend + Neon DB before decommissioning Render:

- [ ] RA login (Supabase Auth flow completes, JWT issued, RA reaches `/dashboard`)
- [ ] Dashboard loads (weather data, analytics section renders without errors)
- [ ] New session: RA creates participant + session, demographics saved
- [ ] Participant survey flow: consent → digit span → ULS-8 → CES-D 10 → GAD-7 → CogFunc → complete
- [ ] Session status updates to `complete` after participant finishes
- [ ] Import/Export page: export generates XLSX without error
- [ ] Misokinesia: RA starts session, participant completes clips + end-of-task questionnaire
- [ ] Undo last session: deletes session rows transactionally
- [ ] Neon Console: verify rows appear in `sessions`, `survey_uls8`, `digitspan_runs`, etc.

---

### Phase 5 — Decommission Render

Only after Phase 4 checklist passes completely:

- Remove or disable the Render web service (do not delete immediately — keep for 1–2 weeks
  as a safety net in case an issue surfaces)
- Remove Render-specific env vars from any local `.env` overrides
- Update `docs/ARCHITECTURE.md` to reflect the new deployment topology

---

## Neon-Specific Considerations

### Free Tier Auto-Suspend

Neon's free tier suspends compute after 5 minutes of inactivity. Because Railway keeps the
FastAPI process always-on, SQLAlchemy's connection pool will hold open connections, which
typically prevents Neon from suspending. The existing `pool_pre_ping=True` in `db.py` handles
the case where a connection does drop — it re-establishes transparently before the next query.

If auto-suspend latency becomes observable (first request after a long idle period feels slow),
upgrade to Neon Launch ($19/month) which allows disabling auto-suspend entirely.

### Free Tier Storage Limit

Neon free tier: 512 MB storage. For a research study with tens of participants and binary-free
data (no file blobs in Postgres), this should be sufficient for the study duration. Monitor via
Neon Console → Project → Storage. Upgrade to Launch ($19/month, 10 GB) before hitting the limit.

### Alembic and Direct vs Pooler URL

Always use the **direct** connection string (not the pooler) when running Alembic migrations
locally. The direct string is the default connection string shown in Neon Console. The pooler
string (contains `-pooler` in the hostname) is for serverless/edge function contexts.

---

## Rollback Plan

If the Railway + Neon deployment fails smoke tests:

1. Revert `NEXT_PUBLIC_API_URL` in Vercel to the Render URL
2. Revert `DATABASE_URL` in the local `.env` to the Supabase Postgres URL
3. Render continues running (it was not decommissioned yet)
4. Investigate failure before retrying

No data loss risk: Supabase Postgres is untouched until Phase 5. Running both backends in
parallel during Phase 4 testing is safe because only one backend URL is active in the frontend
at any time.

---

## Later Decisions to Revisit

These remain open and should not be assumed without a deliberate decision:

- Whether to upgrade Neon to the Launch plan proactively or wait until free tier limits
  are approached.
- Whether to standardise on Neon Console, TablePlus, or another tool as the team's
  canonical data-read interface to replace Supabase Studio.
- Whether the Supabase project should eventually be downgraded or closed once Auth-only
  usage is confirmed (Supabase free tier allows one project indefinitely; this is low priority).
- Whether Railway's US-East region is acceptable long-term or if Fly.io YYZ is worth
  revisiting if a future ethics review extends the residency requirement to compute.
- How to handle `alembic upgrade head` as part of the Railway deploy pipeline (currently
  manual; could be automated as a Railway pre-deploy command).

---

## Relevant Existing Project References

Use these docs as the baseline when this migration resumes:

- `docs/ARCHITECTURE.md`
  - current deployment model and service topology
  - Vercel Route Handler caching layer
  - Upstash Redis cache key conventions
- `docs/SCHEMA.md`
  - full table inventory and FK conventions
- `docs/CONVENTIONS.md`
  - env var naming and backend/frontend integration rules
- `docs/DECISIONS.md`
  - prior auth and architecture decisions
- `backend/.env.example`
  - canonical env var names and format (including `DATABASE_URL` with `sslmode=require`)
- `backend/app/db.py`
  - URL normalization logic (`_as_asyncpg_url`) and connection pool config
- `backend/app/main.py`
  - `ALLOWED_ORIGINS` env var parsing
- `AGENTS.md`
  - project guardrails, especially the Alembic-only schema rule and auth adapter expectations

---

## Implementation Checklist

Before starting Phase 1:

1. Confirm ethics board scope — database-only Canadian residency is sufficient (already confirmed March 2026)
2. Confirm whether there is real participant data to migrate or if the DB can be rebuilt from schema only
3. Confirm with the team which data-read tool replaces Supabase Studio (Neon Console vs desktop client)

Before cutover (end of Phase 3):

4. Ensure Railway service has been up for at least one full deploy cycle with no restart errors
5. Ensure Neon storage and compute metrics are visible and being monitored

Before decommissioning Render (Phase 5):

6. All smoke test items checked off
7. Neon Console confirms expected row counts in all core tables
8. At least one full RA session (login → new session → participant task → completion) completed end-to-end on Railway + Neon
