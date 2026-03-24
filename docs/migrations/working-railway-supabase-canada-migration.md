# Working Railway + Canada Supabase Migration

> Working planning snapshot for the infrastructure migration from Render +
> the current Supabase project to Railway (backend) + a new Supabase project
> in `ca-central-1` (database + auth). This document records the current
> direction and confirmed decisions so the migration can be executed cleanly
> without re-deciding the basics.
>
> Status: pre-implementation. This is the target cutover plan, not a claim
> that production has already moved.

---

## Resolved Decisions

These items were evaluated during planning (March 2026) and are resolved:

| Decision | Resolution |
|---|---|
| Canadian data residency scope | **Supabase project region.** Participant data will live in a new Supabase project created in `ca-central-1` (Canada Central). Backend compute location is not currently in scope. |
| Database provider | **Supabase Postgres remains the managed database.** We are not switching to Neon. |
| Auth provider | **Supabase Auth remains the auth system, but on the new project.** Auth config and RA users are recreated against the new Canada-region project. |
| Backend host | **Railway** on the Hobby plan. Replaces Render to remove cold starts. |
| Frontend host | **Vercel stays unchanged.** Next.js + Upstash Redis caching layer are unaffected. |
| Cold start fix | Railway services are always-on by default. The Render keep-alive workaround is no longer part of the long-term architecture after cutover. |
| Code changes required | **No application logic changes are expected.** Existing integration points are env-var driven; the cutover is primarily infrastructure, env, and documentation work. |
| Lab data access tool | **Supabase Studio remains the default data-read interface.** No Neon Console replacement is needed. |

---

## Purpose

The current stack runs the FastAPI backend on Render and stores participant
data in an existing Supabase project that is not the target Canada region.
This creates two problems:

1. **Data residency:** Participant health data (survey responses, digit span
   results, session records) needs to live in a Canada-region managed
   database project.

2. **Cold start latency:** Render's free-tier behavior makes uncached write
   paths feel slow and unreliable to operators and participants.

The migration addresses both by:

- moving the backend from Render to Railway
- moving database and auth configuration to a new Supabase project in
  `ca-central-1`

---

## Current Decisions

These are the working defaults and should be treated as the current direction
unless explicitly changed.

- Keep backend Python code exactly as-is. Do not refactor during migration.
- Keep frontend code exactly as-is. Do not refactor during migration.
- Keep Supabase as the single managed platform for Postgres + Auth.
- Create a **new Supabase project** in `ca-central-1`; do not treat this as a
  simple `DATABASE_URL` swap.
- Recreate auth/project settings on the new Supabase project instead of
  assuming a paid project clone/restore workflow.
- Re-invite or otherwise recreate RA users in the new Supabase project.
- Use Railway's **Nixpacks** builder (default). It auto-detects Python, reads
  `requirements.txt`, and handles the build without a Dockerfile.
- The Railway start command is:
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Run `alembic upgrade head` against the new Supabase database before any
  participant data is migrated, to ensure schema parity.
- Keep Render and the old Supabase project available until Railway + the new
  Supabase project pass smoke testing.
- Do not resolve or fold in the pending multi-lab schema redesign as part of
  this migration. The infra cutover is independent of `OPEN-05`.

---

## What Changes vs What Stays the Same

### Changes

| Item | From | To |
|------|------|----|
| Backend host | Render | Railway Hobby |
| Database host | Existing Supabase project | New Supabase project in `ca-central-1` |
| Auth project | Existing Supabase Auth project | New Supabase Auth project in `ca-central-1` |
| `DATABASE_URL` | Current Supabase connection string | New Supabase connection string |
| Supabase backend env vars | Old project values | New project values |
| Frontend Supabase public env vars | Old project values | New project values |
| `NEXT_PUBLIC_API_URL` in Vercel | Render service URL | Railway service URL |
| `ALLOWED_ORIGINS` in backend env | Set in Render | Set in Railway |
| Daily weather workflow base URL | Render backend URL | Railway backend URL |

### Stays the Same

| Item | Notes |
|------|-------|
| All backend Python code | No expected changes to routers, models, scoring, analytics, or auth logic |
| All frontend TypeScript code | No expected changes to components, API wrappers, or Route Handlers |
| `backend/app/db.py` | Existing SQLAlchemy + asyncpg setup remains valid |
| `backend/app/auth.py` | Still validates Supabase JWTs; only project-specific secrets/URLs change |
| `backend/app/main.py` | `ALLOWED_ORIGINS` already reads from env |
| `frontend/src/lib/server/route-handler-backend.ts` | `NEXT_PUBLIC_API_URL` already reads from env |
| Alembic migrations | Run unchanged against the new Supabase DB |
| Upstash Redis cache | Cache layer remains between Vercel and the backend service |
| Supabase Studio | Remains the default browser-based lab data access tool |

---

## Environment Variable Changes

### Railway (backend) — full env var set

```bash
# Database — new Canada-region Supabase connection string
DATABASE_URL=postgresql+asyncpg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require

# CORS — set to the Vercel frontend origin
ALLOWED_ORIGINS=https://your-app.vercel.app

# Supabase project — all values now point at the new Canada-region project
SUPABASE_URL=https://<new-project-ref>.supabase.co
SUPABASE_ANON_KEY=<new-supabase-anon-key>
SUPABASE_JWT_SECRET=<new-supabase-jwt-secret>
SUPABASE_SERVICE_ROLE_KEY=<new-service-role-key-if-needed>

# Weather ingestion auth
WEATHER_INGEST_SHARED_SECRETS=<comma-separated-shared-secrets>
```

### Vercel (frontend)

```bash
# Backend URL changes from Render to Railway
NEXT_PUBLIC_API_URL=https://your-project.up.railway.app

# Frontend auth now points at the new Canada-region Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://<new-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<new-supabase-anon-key>
```

### GitHub Actions / operator secrets

```bash
# Weather ingest workflow points at Railway after cutover
WEATHER_INGEST_BASE_URL=https://your-project.up.railway.app
WEATHER_INGEST_SHARED_SECRET=<shared-secret>
```

`SUPABASE_SERVICE_ROLE_KEY` is required anywhere admin invite or admin-auth
automation is run. Do not assume the old project key remains valid.

---

## Migration Steps

### Phase 1 — New Supabase Project Setup

**1.1 Create the new Supabase project**
- Create a new Supabase project.
- Choose **Canada (Central) / `ca-central-1`** at creation time.
- Record the project URL, anon key, JWT secret, and service role key.

**1.2 Recreate project-level config**
- Recreate the auth configuration used by this app on the new project.
- Recreate any required redirect URLs, email invite behavior, and admin setup.
- Review any project-level settings that were previously configured manually in
  the old project.

**1.3 Apply schema**
- Set local `DATABASE_URL` to the new Supabase connection string.
- Run:
  `cd backend && alembic upgrade head`
- Verify the DB is at head:
  `cd backend && alembic current`

**1.4 Migrate existing data (if applicable)**
- If there is no participant data to preserve, skip to 1.5.
- If there is data to preserve:
  - export from the current database with `pg_dump`
  - restore into the new Canada-region database with `pg_restore`
  - verify row counts in Supabase Studio before proceeding

**1.5 Recreate RA access**
- Re-invite or recreate RA/admin users against the new Supabase Auth project.
- Confirm `app_metadata.role` and lab metadata match current expectations.
- Treat old access tokens/sessions as obsolete after cutover.

**1.6 Validate locally**
- With local env vars pointing at the new project, run the backend locally:
  `cd backend && uvicorn app.main:app --reload`
- Confirm the app starts and can read/write a test row.

---

### Phase 2 — Railway Setup

**2.1 Create the Railway project**
- Create a new Railway project connected to the repo.
- Use the `backend/` directory as the service root if needed.
- Use the **Hobby** plan for the always-on backend target.

**2.2 Configure start command**

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**2.3 Set Railway environment variables**
- Add the full backend env var set listed above.
- Ensure all Supabase values point at the **new** Canada-region project.
- Set `ALLOWED_ORIGINS` to the Vercel frontend origin.

**2.4 Verify build and health**
- Trigger a Railway deploy.
- Confirm Nixpacks detects Python and boots the app successfully.
- Confirm `GET /health` returns `{"status":"ok"}`.

**2.5 Record the Railway service URL**
- Capture the generated `https://<project>.up.railway.app` URL.
- This is needed for Vercel env vars, GitHub Actions, and smoke testing.

---

### Phase 3 — Frontend and Ops Cutover

**3.1 Update Vercel environment variables**
- Change `NEXT_PUBLIC_API_URL` to the Railway URL.
- Change `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the new Supabase project values.
- Redeploy the frontend.

**3.2 Update operator secrets**
- Update GitHub Actions `WEATHER_INGEST_BASE_URL` to Railway.
- Confirm backend-side `WEATHER_INGEST_SHARED_SECRETS` matches the workflow
  secret.

**3.3 Confirm CORS**
- Confirm `ALLOWED_ORIGINS` in Railway matches the Vercel origin exactly.

---

### Phase 4 — Smoke Testing

Run through this checklist against Railway + the new Canada-region Supabase
project before decommissioning anything:

- [ ] RA login completes against the new Supabase project
- [ ] RA reaches `/dashboard`
- [ ] Dashboard weather and analytics load without errors
- [ ] New session creation succeeds and demographics save correctly
- [ ] Participant survey flow completes end-to-end
- [ ] Session status updates to `complete`
- [ ] Import/Export page still works for authorized users
- [ ] Misokinesia session flow still works
- [ ] Undo-last-session still behaves transactionally
- [ ] Supabase Studio shows expected rows in the core tables
- [ ] Weather ingestion still succeeds against the Railway backend

---

### Phase 5 — Decommission Old Infra

Only after Phase 4 passes:

- Disable or remove the Render service.
- Remove the Render keep-alive workflow if it still exists.
- Retire the old Supabase project only after confirming no operators still rely
  on it.
- Remove old project env var values from local operator notes and deployment
  settings.
- Update canonical docs if any cutover-specific wording remains.

---

## Rollback Plan

If the Railway + new Supabase deployment fails smoke tests:

1. Revert `NEXT_PUBLIC_API_URL` in Vercel to the Render URL.
2. Revert frontend Supabase public env vars to the old Supabase project.
3. Point backend env vars back to the old Supabase project.
4. Keep Render and the old Supabase project running while the issue is
   investigated.

Because cutover is env-driven, rollback does not require code reversion.

---

## Later Decisions to Revisit

These remain open and should not be assumed without a deliberate decision:

- Whether to automate migration via paid Supabase restore features in the
  future instead of manual project recreation.
- Whether backend compute also needs Canadian residency in a future ethics
  review.
- How `alembic upgrade head` should eventually be automated in the Railway
  deploy workflow.
- How the pending multi-lab schema redesign (`OPEN-05`) should land after the
  infrastructure cutover.

---

## Relevant Existing Project References

Use these docs as the baseline when this migration resumes:

- `docs/ARCHITECTURE.md`
- `docs/SCHEMA.md`
- `docs/CONVENTIONS.md`
- `docs/DECISIONS.md`
- `AGENTS.md`
- `README.md`

---

## Implementation Checklist

Before starting Phase 1:

1. Confirm whether there is real participant data to migrate or if the DB can
   be rebuilt from schema only.
2. Confirm the new Supabase project's auth settings and redirect URLs have been
   recreated.
3. Confirm operator access to Supabase Studio on the new project.

Before cutover:

4. Ensure Railway has completed at least one clean deploy cycle.
5. Ensure the new Supabase project is at Alembic head.
6. Ensure GitHub Actions secrets and backend shared-secret env vars are aligned.

Before decommissioning old infra:

7. All smoke test items are checked off.
8. Supabase Studio confirms expected row counts in the new project.
9. At least one full RA session has completed end-to-end on Railway + the new
   Supabase project.
