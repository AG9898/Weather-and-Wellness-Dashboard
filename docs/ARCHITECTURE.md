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

## Vercel Cache Route Handler

`GET /api/ra/dashboard?mode=cached|live` is a Next.js Route Handler that runs server-side on Vercel.

| Mode | Behaviour |
|---|---|
| `cached` | Reads bundle from Upstash Redis (`ww:ra:dashboard:v1`). Returns `{ cached: true, data }` on hit, `{ cached: false, data: null }` on miss. |
| `live` | Fetches `/dashboard/summary` + `/weather/daily` from the Render backend in parallel with a 15s timeout per backend request. On success, writes the result bundle to Redis (TTL 24 hours; write is awaited) and returns `{ cached: false, data }`. On live failure, best-effort returns stale cached data when available. |

**Auth:** The handler verifies the Supabase JWT from `Authorization: Bearer <token>` before touching the cache or making backend calls. No auth bypass via cache. Returns 401 for missing or invalid tokens.

**Redis credentials** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are server-only Vercel env vars provided by the Upstash integration. The handler degrades gracefully when these vars are absent (falls back to live-only path).

**Bundle type:** `{ summary: DashboardSummaryResponse, weather: WeatherDailyResponse, cached_at: string }` — no PII, no secrets.

**Cache key:** `ww:ra:dashboard:v1` — versioned prefix allows safe invalidation on schema changes.

## Vercel Weather Range Cache Route Handler

`GET /api/ra/weather/range?mode=cached|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` is a Next.js Route Handler used by the dashboard weather trend chart.

| Mode | Behaviour |
|---|---|
| `cached` | Reads bundle from Upstash Redis (`ww:ra:weather:range:v1:<date_from>:<date_to>`). Returns `{ cached: true, data }` on hit, `{ cached: false, data: null }` on miss. |
| `live` | Fetches `/weather/daily?start=<date_from>&end=<date_to>` from the Render backend with a 15s timeout. On success, writes the result bundle to Redis (TTL 24 hours; write is awaited) and returns `{ cached: false, data }`. On live failure, best-effort returns stale cached data when available. |

## Vercel Range Bundle Route Handler (Phase 4)

`GET /api/ra/dashboard/range?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` is a separate Next.js Route Handler for filtered dashboard views.

- **Auth:** Verifies the Supabase JWT from `Authorization: Bearer <token>` before any backend call.
- **Cache behavior:** Intentionally **live-only** and bypasses Redis by default. It also sends backend fetches with `cache: "no-store"` to avoid serving stale filter data.
- **Backend fan-out:** Fetches these Render endpoints in parallel:
  - `/dashboard/summary/range?date_from=<...>&date_to=<...>`
  - `/weather/daily?start=<date_from>&end=<date_to>`
  - `/dashboard/participants-per-day?start=<date_from>&end=<date_to>`
- **Bundle type:** `{ summary, weather, participants_per_day, cached_at }` wrapped in `{ cached: false, data }`.
- **Purpose:** Provides a single typed payload for date-range dashboard KPIs + weather context + graph-ready participant counts.

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
- Day-level semantics (study days, weather day linking, dashboard filtering) use the study timezone `America/Vancouver`.
- Schema details live in `docs/SCHEMA.md`.
