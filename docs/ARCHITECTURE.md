# Architecture & Deployment

> Canonical source for hosting, tiers, and environment boundaries. Other docs should link
> here instead of restating architecture details.
>
> Deployment state:
> - **Current live state:** Vercel frontend + Railway backend + Canada-region Supabase
>   (`ca-central-1`).

---

## Summary

- **Three-tier web app**: Next.js frontend → FastAPI backend → Supabase Postgres
- **Optional cache layer (Vercel)**: Next.js Route Handlers use **Upstash Redis** (via Vercel integration) to cache select RA read responses while still fetching live data from the backend service.
- **Frontend (Vercel)**: Next.js (TypeScript + Tailwind) for UI and Route Handlers. No FastAPI on Vercel.
  - Primary domain: `https://ubcpsych.com`
  - Legacy Vercel subdomain (also active): `https://weather-and-wellness-dashboard.vercel.app`
- **Backend (Railway current)**: Long-lived FastAPI service. All scoring, validation, and DB writes live here for production.
- **Database (Supabase current)**: Managed Postgres in the Canada Central (`ca-central-1`) Supabase project. Lab reads data via Supabase Studio.
- **Admin data ops**: RA-only Import/Export endpoints on the backend service support legacy imports and controlled CSV/XLSX exports.
- **Analytics layer**: backend-generated statistical snapshots now power the dashboard's model-based analytics surface via `GET /api/ra/dashboard/analytics`. See `docs/labs/weather-wellness/weather/ANALYTICS.md`.
- **Session safety tool**: a narrow RA-only undo action for the latest native session is live on `/dashboard`, implemented as transactional hard delete plus audit log rather than soft delete.

## Dashboard Read Topology

Current shipped dashboard reads are split across these same-origin Vercel Route Handlers:

- `GET /api/ra/dashboard/study-window`
- `GET /api/ra/dashboard?mode=cached|live`
- `GET /api/ra/weather/range?mode=cached|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`
- `GET /api/ra/dashboard/analytics?mode=snapshot|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`

FastAPI endpoints and same-origin Route Handlers are separate routing layers:

- `docs/labs/weather-wellness/weather/API.md` is canonical for FastAPI endpoint contracts (Weather-Wellness dashboard, sessions, surveys, admin, auth endpoints).
- `docs/labs/weather-wellness/misokinesia/API.md` is canonical for Misokinesia FastAPI endpoint contracts.
- This document is canonical for Next.js Route Handler topology, cache behavior, and cross-tier request flow.

---

## Canonical Dashboard Routing Inventory

This section is the single routing inventory for dashboard-related reads across the browser, Next.js Route Handlers, and FastAPI. Classifications mean:

- `canonical`: active shipped path; safe to extend only with the owning screen in mind
- `transitional`: present in code, but not part of the shipped read topology; do not add callers without resolving the linked cleanup task
- `internal-only`: backend primitive with an explicitly documented same-origin caller; not for direct browser use
- `remove`: no current owner; delete as part of the linked cleanup task

### Browser -> Vercel -> backend inventory

| Browser owner / caller | Typed wrapper | Same-origin Route Handler | Backend read(s) | Classification | Notes |
|---|---|---|---|---|---|
| RA dashboard page (`/dashboard`) anchor-date bootstrap | `getDashboardStudyWindow()` | `GET /api/ra/dashboard/study-window` | `GET /dashboard/study-window` | `canonical` | Lightweight metadata read that exposes the latest available study day for dashboard range anchoring. |
| RA dashboard page (`/dashboard`) initial mount and post-undo refresh | `getDashboardWeatherBundle(mode)` | `GET /api/ra/dashboard?mode=cached\|live` | `GET /weather/daily?start=today&end=today&include_forecast_periods=false` | `canonical` | This is the canonical default dashboard read path. The bundle is intentionally weather-only because the current page renders weather but not operational summary KPIs. |
| `WeatherUnifiedCard` on `/dashboard` | `getWeatherRangeBundle(mode, dateFrom, dateTo)` | `GET /api/ra/weather/range?mode=cached\|live&date_from&date_to` | `GET /weather/daily?start=<date_from>&end=<date_to>&include_forecast_periods=false&include_latest_run=false` | `canonical` | Canonical weather range path for the dashboard trend chart. |
| `DashboardAnalyticsSection` on `/dashboard` | `getDashboardAnalyticsBundle(mode, dateFrom, dateTo)` | `GET /api/ra/dashboard/analytics?mode=snapshot\|live&date_from&date_to` | `GET /dashboard/analytics?date_from&date_to&mode=snapshot\|live` | `canonical` | Canonical analytics snapshot/live path for dashboard model outputs. The section owns its own study-window controls; `date_from` / `date_to` come from analytics state, not the weather card. |

### Backend endpoint inventory

| FastAPI endpoint | Current same-origin caller | Classification | Notes |
|---|---|---|---|
| `GET /dashboard/study-window` | `GET /api/ra/dashboard/study-window` | `internal-only` | Canonical backend metadata primitive that returns the latest available `study_days.date_local` for dashboard anchoring. |
| `GET /weather/daily` | `GET /api/ra/dashboard?mode=live`, `GET /api/ra/weather/range?mode=live` | `internal-only` | Canonical backend operational read primitive used by the shipped same-origin weather handlers. Router validation/auth lives in `backend/app/routers/weather.py`; DB read logic lives in `backend/app/services/weather_read_service.py`. |
| `GET /dashboard/analytics` | `GET /api/ra/dashboard/analytics?mode=snapshot\|live` | `internal-only` | Canonical backend analytics endpoint behind the same-origin analytics handler. |

### Frontend page route inventory

| Route | Auth | Classification | Notes |
|---|---|---|---|
| `/users` | RA required, admin role required in page guard | `canonical` | Admin page for app-owned invitations, role/lab edits, pending invite resend/revoke, and access revocation. |
| `/misokinesia` | RA required (via `(ra)` layout) | `canonical` | RA page — launch a Misokinesia session via "Start Misokinesia Session" button |
| `/misokinesia/[id]` | None | `canonical` | Participant task page — video clips + questionnaires; `id` = `misokinesia_participant_id` |

Backend API endpoints for Misokinesia are documented in `docs/labs/weather-wellness/misokinesia/API.md`. Dashboard and session routes are implicitly canonical and owned by their respective layout groups.

### Deprecation map and target canonical shapes

| Read surface | Current state | Target canonical shape | Cleanup owner |
|---|---|---|---|
| Default dashboard operational reads | `GET /api/ra/dashboard?mode=cached\|live` is the only shipped default bundle path and now carries weather only | Keep one canonical same-origin bundle path for `/dashboard`; default bundle stays limited to currently rendered weather data unless the UI adds a real owner for more fields | `RC03` |
| Filtered dashboard operational reads | No shipped same-origin operational bundle exists; the dead `/api/ra/dashboard/range` path was removed in `RC04` | Keep filtered operational reads absent until a concrete screen needs them, then introduce exactly one explicitly owned path rather than reviving deleted transitional routes | `RC04` |
| Weather range reads | `GET /api/ra/weather/range?mode=cached\|live&date_from&date_to` | Keep as the canonical weather-only range path for `WeatherUnifiedCard` | `RC02`, `RC05` |
| Analytics snapshot/live reads | `GET /api/ra/dashboard/analytics?mode=snapshot\|live&date_from&date_to` | Keep as the canonical analytics read path; default dashboard loads should stay on snapshot-safe behavior unless explicitly opted into live recompute | `RC02`, `RC06` |

### Shared Route Handler Infrastructure

All active RA same-origin Route Handlers now share a single server-only helper layer under `frontend/src/lib/server/`:

- `route-handler-auth.ts` — Supabase bearer-token extraction and JWT verification (JWKS primary, HS256 fallback)
- `route-handler-backend.ts` — backend URL resolution, 55-second timeout fetch wrapper, and normalized backend error type. Each Route Handler also exports `maxDuration = 60` to allow the full 55s timeout window before Vercel's function limit fires.
- `route-handler-cache.ts` — Upstash Redis bootstrap, shared cache-policy constants, cache read/write helpers, cache-key composition, and standardized `x-ww-cache*` response-header helpers
- `route-handler-validation.ts` — `date_from` / `date_to` validation shared by filtered handlers

This helper layer is the required path for shared auth/cache/fetch/date behavior in `src/app/api/ra/*`; do not re-inline those concerns per Route Handler.

### Shared cache lifecycle and diagnostics

All active RA cache keys use fixed expiry on write only:

| Cache keyspace | TTL | Renewal policy | Refresh trigger |
|---|---|---|---|
| `ww:ra:dashboard:v1` | 24 hours | `fixed-expiry-on-write` | Explicit `mode=live` request; the dashboard page currently issues that live refresh only when its cached bundle is older than about 10 minutes or when a supervised action explicitly refreshes it |
| `ww:ra:weather:range:v1:<date_from>:<date_to>` | 24 hours | `fixed-expiry-on-write` | Explicit `mode=live` request for the selected date window |
| `ww:ra:analytics:snapshot:v2:<date_from>:<date_to>` | 24 hours | `fixed-expiry-on-write` | Snapshot read refreshes, explicit background refresh requests, or snapshot fallback after live failure |

Repeated cache reads do not renew TTL. A key survives only until the last successful write plus its configured TTL.

Standardized same-origin diagnostics:

- `x-ww-cache`: route outcome state (`hit`, `miss`, `disabled`, `refresh`, `stale-fallback`, `bypass`, `snapshot-fallback`, `error`, `skip`)
- `x-ww-cache-ttl`: TTL in seconds for the route's cache keyspace
- `x-ww-cache-renewal`: current renewal policy string (`fixed-expiry-on-write`)

---

## Vercel Cache Route Handler

`GET /api/ra/dashboard?mode=cached|live` is a Next.js Route Handler that runs server-side on Vercel.

| Mode | Behaviour |
|---|---|
| `cached` | Reads bundle from Upstash Redis (`ww:ra:dashboard:v1`). Returns `{ cached: true, data }` on hit, `{ cached: false, data: null }` on miss. |
| `live` | Fetches `/weather/daily?start=today&end=today&include_forecast_periods=false` from the backend service with a 55s timeout. On success, writes the result bundle to Redis (TTL 24 hours; write is awaited, reads do not renew TTL) and returns `{ cached: false, data }`. On live failure, best-effort returns stale cached data when available. |

**Auth:** The handler verifies the Supabase JWT from `Authorization: Bearer <token>` before touching the cache or making backend calls. No auth bypass via cache. Returns 401 for missing or invalid tokens.

**Redis credentials** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are server-only Vercel env vars provided by the Upstash integration. The handler degrades gracefully when these vars are absent (falls back to live-only path).

**Bundle type:** `{ weather: WeatherDailyResponse, cached_at: string }` — no PII, no secrets.

**Cache key:** `ww:ra:dashboard:v1` — versioned prefix allows safe invalidation on schema changes.

**Refresh threshold:** the `/dashboard` page currently keeps the cache key on fixed expiry, but only triggers a background `mode=live` refresh when the cached bundle is older than about 10 minutes. Cache hits themselves do not extend Redis TTL.

**Shared helper path:** auth, backend timeout fetches, Redis access, and `x-ww-cache` header shaping are implemented via the shared `frontend/src/lib/server/route-handler-*.ts` helper modules rather than inline in this handler.

> Planned extension: if the default dashboard later renders additional server-owned
> data, extend this bundle only when the new fields have a concrete UI owner.

## Vercel Weather Range Cache Route Handler

`GET /api/ra/weather/range?mode=cached|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` is a Next.js Route Handler used by the dashboard weather trend chart.

| Mode | Behaviour |
|---|---|
| `cached` | Reads bundle from Upstash Redis (`ww:ra:weather:range:v1:<date_from>:<date_to>`). Returns `{ cached: true, data }` on hit, `{ cached: false, data: null }` on miss. |
| `live` | Fetches `/weather/daily?start=<date_from>&end=<date_to>&include_forecast_periods=false&include_latest_run=false` from the backend service with a 55s timeout. On success, writes the result bundle to Redis (TTL 24 hours; write is awaited, reads do not renew TTL) and returns `{ cached: false, data }`. On live failure, best-effort returns stale cached data when available. |

**Payload shaping:** the weather trend chart path requests a lean day-level payload (empty `forecast_periods`) because the chart only needs date, temperature, precipitation, and sunlight-hours values. This keeps first-load range fetches smaller and reduces cold-cache timeout risk on Vercel.

**Shared helper path:** auth, Redis access, timeout fetches, date validation, and cache-header responses are delegated to `frontend/src/lib/server/route-handler-*.ts`.

## Vercel Analytics Route Handler (Phase 4)

`GET /api/ra/dashboard/analytics?mode=snapshot|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` is the same-origin Next.js Route Handler for statistical dashboard analytics reads.

| Mode | Behaviour |
|---|---|
| `snapshot` | Reads the cached snapshot bundle from Upstash Redis (`ww:ra:analytics:snapshot:v2:<date_from>:<date_to>`) when present. If the cached bundle is marked `status="recomputing"`, the handler revalidates against the backend snapshot endpoint before serving it so the UI can pick up the newly finished snapshot promptly. On cache miss, fetches `/dashboard/analytics?...&mode=snapshot` from the backend service with a 55s timeout, then caches the response (TTL 24 hours, fixed from the last successful snapshot write). A backend `404` remains a snapshot-miss response; the handler does not escalate that miss into a live recompute. |
| `live` | Calls `/dashboard/analytics?...&mode=live` on the backend service with a 55s timeout and `cache: "no-store"`. The backend treats this as a background refresh request and returns immediately with the current snapshot state for the range, which the handler writes back into Redis so the dashboard can keep serving the in-progress snapshot state consistently. If the live request fails or times out, the handler falls back to the latest cached snapshot bundle, and if Redis has no copy it tries the backend snapshot mode before returning an error. |

- **Auth:** Verifies the Supabase JWT from `Authorization: Bearer <token>` before reading Redis or calling the backend. No auth bypass via cache.
- **Bundle type:** `{ analytics: DashboardAnalyticsResponse, cached_at }` wrapped in `{ cached, data, refresh }`, where `refresh` explains whether the response is an idle snapshot read or a background refresh request.
- **Cache boundary:** Analytics reads use a dedicated Redis namespace and do not reuse the operational dashboard or weather cache keys.
- **Live-path rule:** Live refresh requests now write the returned snapshot state into Redis so the dashboard can show `recomputing` status immediately while the backend finishes the durable refresh in the background.
- **Snapshot renewal rule:** Snapshot reads do not renew TTL; the 24-hour clock resets only after a successful snapshot write path.
- **Shared helper path:** auth, timeout fetches, Redis access, cache-header shaping, and date validation use the shared `frontend/src/lib/server/route-handler-*.ts` modules.

## Analytics Snapshot Architecture

Canonical analysis spec: `docs/labs/weather-wellness/weather/ANALYTICS.md`

The dashboard's statistical KPI layer now uses a hybrid read path for frontend reads, while the dashboard UI surfaces remain in progress:

- **Durable source of truth:** Postgres-backed analytics snapshot storage
- **Optional cache layer:** Upstash Redis for snapshot read acceleration only, via the same-origin analytics Route Handler
- **Live recompute path:** explicit filtered/admin requests may trigger backend recompute from current DB rows through `GET /api/ra/dashboard/analytics?mode=live`, which now starts the run in the background and immediately returns the current snapshot state
- **Serving rule:** while recompute is running, or if the live path fails, continue serving the most recent successful snapshot when available

### Current lifecycle

1. Backend builds a canonical analysis dataset from transactional tables and imported aggregate values.
2. Backend fits the documented mixed-effects models in Python.
3. Backend serializes both model-card results and separate effect-plot payloads.
4. Backend writes a versioned snapshot payload plus run metadata to Postgres.
5. The analytics Route Handler may cache the serialized snapshot in Redis under a dedicated analytics keyspace.
6. Dashboard reads snapshot data by default, treats snapshot misses as a non-blocking empty state, and may request `mode=live` only for explicit recompute flows. The current snapshot remains visible while the backend recompute runs in the background.

### Frontend coordination rule

- The weather chart no longer drives analytics range changes through the dashboard page.
- The dashboard page uses `GET /api/ra/dashboard/study-window` once to anchor weather presets to `latest_study_day ?? Vancouver today`.
- Analytics and weather still render as separate surfaces with separate payloads because they represent different x-axes and different analytical meanings.
- `DashboardAnalyticsSection` owns its own date-range controls and refresh state; the weather card no longer drives analytics refetches.
- Any weather-chart linking added for analytics should stay limited to date-based annotations or labels derived from the analytics payload.

### Cache implications

- Analytics cache keys must be separate from:
  - `ww:ra:dashboard:v1`
  - `ww:ra:weather:range:v1:<date_from>:<date_to>`
  - `ww:ra:analytics:snapshot:v2:<date_from>:<date_to>`
- Redis should never be the only analytics store because:
  - snapshots need auditability
  - recompute state needs durability
  - cache eviction must not erase the latest successful analysis result

### Failure behavior

- If live analytics recompute fails or lacks sufficient data, return a typed
  analytics status and preserve the prior successful snapshot.
- Route Handlers should not block the dashboard indefinitely waiting for model
  fitting to finish.
- **30-minute staleness cutoff:** `_is_recomputing_run` in `analytics_service.py` treats any run that has been in `recomputing` status for more than 30 minutes as timed out. The next "Refresh In Background" click will queue a fresh run rather than returning a fake "already recomputing" response.
- **Startup cleanup:** A FastAPI lifespan hook in `main.py` marks orphaned `analytics_runs` rows (`status="recomputing"`, `finished_at=NULL`, `started_at` older than 30 minutes) as `"failed"` on every backend restart, clearing runs killed by process termination.

---

## Auth (Optional)

- If Supabase Auth is enabled, Next.js obtains a JWT and sends
  `Authorization: Bearer <JWT>` to FastAPI.
- FastAPI validates JWTs using `SUPABASE_JWT_SECRET`.
- When using the Vercel cache Route Handler for RA dashboard reads, the Route Handler must also validate the Supabase JWT before returning cached data (no auth bypass via cache).
- Participant endpoints remain unauthenticated and are validated by `session_id` + status.
- **Role + lab scoping:** `role` (`admin` | `ra`) and `lab_name` are stored in Supabase `app_metadata` (admin-only writable). FastAPI extracts both from the JWT; `get_current_admin` enforces `role == 'admin'` on admin-only routes. The frontend reads these from the session and gates UI links/pages accordingly (see RESOLVED-15 and RESOLVED-19 in `docs/DECISIONS.md`).
- **Frontend auth gate (two layers):**
  1. `src/middleware.ts` — Next.js edge middleware using `@supabase/ssr` `createServerClient`. Runs before any page rendering; redirects unauthenticated requests to `/login?next=<path>` for all RA routes (`/dashboard`, `/new-session`, `/import-export`, `/misokinesia`, `/users`). This is the primary server-side gate.
  2. `src/app/(ra)/layout.tsx` — client-side secondary guard. Handles mid-session sign-outs and populates `RAUserContext` (`email` from the Supabase Auth user plus `role` and `lab_name` from `app_metadata`) after hydration.
- **RA profile menu:** The shared RA chrome exposes the signed-in user's email, role label, lab name when available, theme toggle, password-change action, and sign-out action. Role and lab are read-only in this surface because they remain admin-controlled `app_metadata`. The password-change action routes to the RA-only self-service password screen.
- **Self-service password change:** A signed-in RA/admin may update only their own Supabase Auth password from the browser client using the active session. This does not use FastAPI, the service-role Admin API, or `/admin/users*` endpoints. The UI validates password confirmation and the same minimum length used by invite activation before calling Supabase Auth.
- **Cookie-based session:** The browser Supabase client uses `createBrowserClient` from `@supabase/ssr` (`src/lib/supabase.ts`), which persists the session in cookies in addition to `localStorage`. This is required for the edge middleware to read the session server-side.
- **Post-login redirect:** After successful login, `LoginDialogForm` reads the `?next=` search param and redirects there, falling back to `/dashboard`.
- **Admin user management and invites:** Supabase Auth remains the login/session/JWT provider, but admin onboarding uses an app-owned invitation layer (RESOLVED-19) instead of Supabase's built-in invite email as the durable control plane.
  - Admins manage users from an admin-only user management page.
  - Creating an invite writes a `ra_invitations` row with a hashed token, `role`, `lab_name`, and a 7-day `expires_at`.
  - The backend sends a custom invite email through the configured provider. Resend is the default provider; the email layer should remain swappable for AWS SES if required. The provider renders the repo-owned templates in `backend/app/services/email_templates/admin_invite.html` and `backend/app/services/email_templates/admin_invite.txt`; do not rely on a provider-hosted template as the primary source of invite content.
  - Invite links point to `{SITE_URL}/set-password?invite=<token>`.
  - Accepting an invite validates the app-owned token, creates or updates the Supabase Auth user through the service-role Admin API, sets `app_metadata.role` and `app_metadata.lab_name`, marks the invitation accepted, and then directs the user through the normal Supabase sign-in/session flow.
  - FastAPI exposes the admin-only management contracts under `/admin/users*` and the public token-protected activation contract at `POST /auth/invitations/accept`; exact request and response shapes live in `docs/labs/weather-wellness/weather/API.md`.
  - Resend/revoke/edit/delete actions are admin-only. Resend rotates the invite token without extending the original expiry. UI "delete" means access revocation/disablement by default, not hard deletion of `auth.users`.
  - `backend/admin_cli/invite_user.py` is a CLI/batch wrapper over the same app-owned invite service used by the admin UI. It writes `ra_invitations`, sends the custom provider email, accepts `--site-url` or the legacy `--redirect-to` alias for invite-link base URL selection, and records `created_by_lab_member_id` from `--created-by-lab-member-id` or `ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID`. For migration batches, pass `--use-railway-env` to read the linked Railway backend env or `--env-file <path>` to target a local migration env file instead of root `.env`. It does not call Supabase `/auth/v1/invite` or `generate_link` as an email-send fallback.

---

## CORS

- Allowed origins are configured via the `ALLOWED_ORIGINS` env var (comma-separated list).
- When `ALLOWED_ORIGINS` is unset, the backend defaults to localhost dev origins only.
- In production, set `ALLOWED_ORIGINS` to the Vercel frontend URL(s). Both `https://ubcpsych.com` and `https://weather-and-wellness-dashboard.vercel.app` must be included.
- During migration smoke testing, also include the exact Vercel Preview deployment origin currently wired to Railway and the Canada-region Supabase project.
- No wildcard (`*`) origins are used — least-privilege policy.

---

## Testing Infrastructure

| Stack | Tool | Location | Run Command |
|---|---|---|---|
| Backend | pytest 9.x | `backend/tests/` | `cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v` |
| Frontend | vitest 4.x | `frontend/src/**/*.test.ts` | `cd frontend && npm test` |

The backend test suite covers scoring modules, service logic, snapshot orchestration, router
endpoints, and an R-script parity fixture (`test_analytics_parity.py`) that guards against
formula or field-name drift in the analytics pipeline.

The frontend test suite covers Node-runtime same-origin Route Handlers, route-topology guard
tests, and extracted analytics utility modules such as status-to-panel mapping, snapshot/live
loader behavior, error message resolution, and display formatting helpers.

Full inventory, conventions, and guidance for adding new tests: **`docs/TESTING.md`**

---

## Migrations

- **Alembic only** for schema changes.
- **Run as a deploy step / one-off command**, not on every app startup.

---

## Scheduled Jobs (GitHub Actions)

> Canonical feature spec: `docs/labs/weather-wellness/weather/WEATHER_INGESTION.md`

No GitHub Actions scheduled jobs are currently active.

**1. Daily UBC EOS weather ingestion** (Phase 2)

- Scheduler: **GitHub Actions only** (explicitly excluding Supabase `pg_cron` for now).
- Workflow file: `.github/workflows/weather-ingest.yml`
- Trigger: GitHub Actions calls a protected backend endpoint.
- Current state: manually disabled in GitHub Actions; when enabled, it targets the Railway backend through `WEATHER_INGEST_BASE_URL`.
- Configured schedule: `cron: '0 14 * * *'` (14:00 UTC daily) + `workflow_dispatch` for manual runs.
- Reliability: ingestion is idempotent so duplicate runs are safe. Retry policy can remain for transient backend/network failures during the transition.
- Exit policy: 2xx → success; 409/429 → exit 0 (expected control-flow responses); all other non-2xx → retry, then exit 1 (loud failure in Actions UI).

### Secrets ownership

Environment variable and secret definitions are centralized in `docs/ENV_VARS.md`.
For this workflow, GitHub Actions uses `WEATHER_INGEST_BASE_URL` and
`WEATHER_INGEST_SHARED_SECRET`, while backend runtime validation uses
`WEATHER_INGEST_SHARED_SECRETS`.

---

## Current Railway Setup

- Production service host: Railway.
- Railway project: `ubcpsych`; backend service: `backend`.
- Production Railway backend URL: `https://backend-production-5809.up.railway.app`.
- Deploy the backend service from the backend directory as the archive root:
  `railway up backend --path-as-root --service backend`.
- Backend startup is defined in `backend/Procfile`.
- Health check path: `/health` → returns `{"status":"ok"}`.
- Local backend tasks do not require Railway unless inspecting production service state.
- On startup, a lifespan hook cleans up orphaned `analytics_runs` rows from previous process lifetimes (see "Failure behavior" above).

### Railway Environment Variables

See `docs/ENV_VARS.md` for the canonical required/conditional variable table,
defaults, and ownership by environment.

> Do not commit secret values to the repo. Set them only in deployment environment settings.

---

## Data Model and Access

- All results are linked by `participant_uuid` and `session_id`.
- Participants are anonymous: do not collect or store names or other direct identifiers.
- Day-level semantics (study days, weather day linking, dashboard filtering) use the study timezone `America/Vancouver`.
- Schema details live in `docs/SCHEMA.md`.
- Analytics dataset rules live in `docs/labs/weather-wellness/weather/ANALYTICS.md`.
- Undo-last-session behavior removes only session-domain rows and must not mutate weather-domain rows.
