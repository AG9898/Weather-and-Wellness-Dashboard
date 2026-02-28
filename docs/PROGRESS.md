# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.

---

## Current State

| Field              | Value                  |
|--------------------|------------------------|
| Phase              | 3 (in progress)        |
| Tasks completed    | 46 / 57                |
| Remaining queue    | T47–T54 (including T47a, T51a, T51b) |
| Tasks in progress  | 0                      |
| Last updated       | 2026-02-28             |

---

**Architecture note (2026-02-22):** Project architecture is now standardized on Next.js (Vercel) + FastAPI (Render) + Supabase Postgres. Earlier entries referencing SvelteKit reflect the initial scaffold and are superseded by docs/ARCHITECTURE.md.

---

## Currently In Progress

_No tasks in progress._

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

---

## T46 — Docs/spec: Phase 3 admin import/export + UI cleanup + consent + demographics + dashboard filtering (completed 2026-02-28)

Phase 3 documentation is now decision-complete for upcoming implementation tasks:
- `docs/API.md` expanded Phase 3 admin import rules (expected headers, Excel serial/time parsing, normalization, and upsert rules) and added a planned `GET /dashboard/summary/range` contract for date-range filtering.
- `docs/DESIGN_SPEC.md` updated participant flow to include consent gating, clarified Phase 3 IA (dashboard + import/export; remove `/participants` + `/sessions`), and specified dashboard filter + weather behavior.
- `docs/SCHEMA.md` documented legacy import column→DB mappings for demographics and `imported_session_measures`.
- Runbooks/conventions updated: `docs/devSteps.md`, `docs/CONVENTIONS.md`, `docs/WEATHER_INGESTION.md`, and `AGENTS.md`.

---

## T45 — Verification: production smoke test and cold-start UX check (completed 2026-02-28)

**Verification method:** Code-level review of route handler and dashboard logic; build verification via `tsc --noEmit` + `next build`. Production e2e checklist in `docs/devSteps.md` (smoke test section) is owned by the developer post-deployment.

**Acceptance criteria — verified:**

| Criterion | Verification | Result |
|---|---|---|
| Second visit (≤5 min) renders from cache without waiting on Render | Phase 1 calls `getDashboardBundle('cached')` → route handler returns Redis bundle immediately if `ww:ra:dashboard:v1` key exists (TTL 300s). `setSummaryLoading(false)` + UI update happens before Phase 2 starts. No Render call in the cached path. | ✅ Verified by code review |
| Dashboard refreshes to live values once backend responds | Phase 2 always calls `getDashboardBundle('live')` → route handler fetches `/dashboard/summary` + `/weather/daily` from Render in parallel, writes to Redis, returns fresh bundle → dashboard updates all state. | ✅ Verified by code review |
| No unauthorized access without valid JWT (401 on missing/invalid token) | `verifySupabaseJWT()` is called on every request before any Redis read or Render fetch. Missing `Authorization` header → 401 `{"detail":"Missing Authorization header"}`. Invalid/expired token → 401 `{"detail":"Invalid or expired token"}`. No branch bypasses auth check. | ✅ Verified by code review |
| `tsc --noEmit` passes | Ran 2026-02-28 | ✅ Pass (0 errors) |
| `next build` passes | Ran 2026-02-28 | ✅ Pass — `ƒ /api/ra/dashboard` listed as dynamic route handler |

**Production e2e checklist (developer-owned — run after Vercel deploy):**
See `docs/devSteps.md` → "Vercel Upstash Cache Setup → 3) Smoke test checklist" for the full list of curl/browser checks covering 401, cache hit, cache miss, and live refresh.

---

## T44 — Docs/runbook: Vercel Upstash cache setup (completed 2026-02-28)

All acceptance criteria met by work done during T41:
- `docs/devSteps.md` "Vercel Upstash Cache Setup" section covers integration steps, server-only vs `NEXT_PUBLIC_*` env vars, local dev setup, and a smoke-test checklist for cache hit/miss/live/401.
- `docs/ARCHITECTURE.md` — Vercel Cache Route Handler section added.
- `docs/CONVENTIONS.md` — caching conventions expanded (jose, Redis key versioning).

---

## T43 — Frontend: eliminate extra cold-start fetches on dashboard (WeatherCard) (completed 2026-02-28)

**Acceptance criteria met:**
- WeatherCard on-mount fetch (`getWeatherStatus`) removed entirely. Component now accepts `weather: WeatherDailyResponse | null` prop — null shows loading skeleton, data shows content. No independent backend call on mount.
- WeatherCard displays today's summary fields: `current_temp_c` (large), `forecast_high_c` / `forecast_low_c`, `forecast_condition_text`. Data sourced from `weather.items[0]`.
- Manual "Update Weather" action still works: calls `triggerWeatherIngest()`, stores result in `ingestOverride` state which overrides `latestRun` display without a full re-fetch.
- WeatherCard moved above KPI cards in the dashboard (hero → weather → KPIs → sessions).
- Dashboard passes `weather={weatherData}` where `weatherData` is set from the bundle in both Phase 1 (cached) and Phase 2 (live).
- Dashboard mount triggers exactly one live backend refresh path (through `/api/ra/dashboard?mode=live` → Vercel route handler → Render backend).
- `WeatherDailyItem` interface added to `src/lib/api/index.ts`; `WeatherDailyResponse.items` typed as `WeatherDailyItem[]`.
- `getWeatherStatus()` wrapper removed (unused after refactor).
- `tsc --noEmit` clean; `next build` passes.

---

## T42 — Frontend: typed API wrappers + RA dashboard stale-while-revalidate (completed 2026-02-28)

**Acceptance criteria met:**
- `getDashboardBundle(mode: 'cached' | 'live')` typed wrapper added to `src/lib/api/index.ts`. Calls same-origin `/api/ra/dashboard` with the Supabase JWT. No bare `fetch` from components.
- Dashboard page refactored to stale-while-revalidate: Phase 1 fetches cached bundle (shows KPIs immediately if Redis hit); Phase 2 fetches live bundle in parallel with sessions list and updates values when it arrives.
- Separate `summaryLoading` (KPI cards) and `sessionsLoading` (sessions list) states so cached KPIs show instantly while sessions continue loading.
- Error banner only displayed when no data is available at all; cached data view is never wiped by a background live-refresh failure.
- `tsc --noEmit` clean; `next build` passes.

---

## T41 — Frontend infra: Upstash Redis cache + RA JWT verification (completed 2026-02-28)

**Acceptance criteria met:**
- `GET /api/ra/dashboard?mode=cached|live` route handler created at `frontend/src/app/api/ra/dashboard/route.ts`
- JWT verification: ES256 via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) with HS256 fallback using `SUPABASE_JWT_SECRET`. Returns 401 for missing/invalid tokens.
- `mode=cached`: checks Upstash Redis for key `ww:ra:dashboard:v1`; returns `{ cached: true, data: <bundle> }` on hit, `{ cached: false, data: null }` on miss.
- `mode=live`: fetches `/dashboard/summary` + `/weather/daily?start=today&end=today` from Render backend in parallel, writes bundle to Redis with TTL 300s, returns `{ cached: false, data: <bundle> }`.
- Redis client is created only if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (server-only vars). Gracefully degrades if absent.
- `DashboardBundle` and `DashboardRouteResponse` types added to `src/lib/api/index.ts`.
- `@upstash/redis` and `jose` npm packages installed.
- `tsc --noEmit` passes clean. `next build` succeeds; route listed as `ƒ /api/ra/dashboard`.

**Packages added:** `@upstash/redis`, `jose`

---
