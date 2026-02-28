# Architecture & Deployment

> Canonical source for hosting, tiers, and environment boundaries. Other docs should link
> here instead of restating architecture details.

---

## Summary

- **Three-tier web app**: Next.js frontend → FastAPI backend → Supabase Postgres
- **Optional cache layer (Vercel)**: Next.js Route Handlers use **Upstash Redis** (via Vercel integration) to cache select RA read responses to reduce perceived cold-start latency, while still fetching live data from the Render backend.
- **Frontend (Vercel)**: Next.js (TypeScript + Tailwind) for UI and Route Handlers. No FastAPI on Vercel.
- **Backend (Render)**: Long-lived FastAPI service. All scoring, validation, and DB writes live here.
  - Hosted URL: `https://weather-and-wellness-dashboard.onrender.com`
- **Database (Supabase)**: Managed Postgres. Lab reads data via Supabase Studio.
- **Admin data ops (planned, Phase 3)**: RA-only Import/Export endpoints on Render support legacy imports and controlled CSV/XLSX exports.

---

## Auth (Optional)

- If Supabase Auth is enabled, Next.js obtains a JWT and sends
  `Authorization: Bearer <JWT>` to FastAPI.
- FastAPI validates JWTs using `SUPABASE_JWT_SECRET`.
- When using the Vercel cache Route Handler for RA dashboard reads, the Route Handler must also validate the Supabase JWT before returning cached data (no auth bypass via cache).
- Participant endpoints remain unauthenticated and are validated by `session_id` + status.

---

## CORS

- Allowed origins are configured via the `ALLOWED_ORIGINS` env var (comma-separated list).
- When `ALLOWED_ORIGINS` is unset, the backend defaults to localhost dev origins only.
- In production (Render), set `ALLOWED_ORIGINS` to the Vercel frontend URL(s).
- No wildcard (`*`) origins are used — least-privilege policy.

---

## Migrations

- **Alembic only** for schema changes.
- **Run as a deploy step / one-off command**, not on every app startup.

---

## Scheduled Jobs (GitHub Actions)

> Canonical feature spec: `docs/WEATHER_INGESTION.md`

Phase 2 introduces a single scheduled job: **daily UBC EOS weather ingestion**.

- Scheduler: **GitHub Actions only** (explicitly excluding Supabase `pg_cron` for now).
- Workflow file: `.github/workflows/weather-ingest.yml`
- Trigger: GitHub Actions calls a protected backend endpoint on Render.
- Schedule: `cron: '0 14 * * *'` (14:00 UTC daily) + `workflow_dispatch` for manual runs.
- Reliability: bash retry loop (5 attempts, 60s delay) handles Render free-tier cold starts (~50s spin-up); ingestion is idempotent so duplicate runs are safe.
- Exit policy: 2xx → success; 409/429 → exit 0 (expected control-flow responses); all other non-2xx → retry, then exit 1 (loud failure in Actions UI).

### Secrets ownership

- GitHub repository secrets (used by Actions):
  - `WEATHER_INGEST_BASE_URL` (Render backend base URL)
  - `WEATHER_INGEST_SHARED_SECRET` (shared secret header value)
- Render backend environment:
  - `WEATHER_INGEST_SHARED_SECRETS` (comma-separated to allow rotation)

---

## Render Setup

- Service is live at `https://weather-and-wellness-dashboard.onrender.com`.
- Health check path: `/health` → returns `{"status":"ok"}`.
- Local backend tasks in Phase 1 (DB wiring, models, migrations, stub auth) do not require Render.

### Required Render Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Always | Supabase pooler URL; include `ssl=require` |
| `ALLOWED_ORIGINS` | Always | Comma-separated Vercel frontend URL(s) for CORS |
| `SUPABASE_JWT_SECRET` | When RA JWT auth enabled | Used by FastAPI to validate Supabase JWTs |
| `SUPABASE_URL` | When backend uses Supabase SDK | Supabase project URL |
| `SUPABASE_ANON_KEY` | When backend uses Supabase SDK | Supabase anonymous key |

> Do not commit secret values to the repo. Set them only in Render service environment settings.

---

## Data Model and Access

- All results are linked by `participant_uuid` and `session_id`.
- Participants are anonymous: do not collect or store names or other direct identifiers.
- Schema details live in `docs/SCHEMA.md`.
