# Routing Cleanup Taskboard

> Purpose: track the comprehensive backend-routing and read-path cleanup identified in the March 2026 routing audit.
> Scope: code-only issues already present in the repo. This board covers FastAPI routes, Next.js Route Handlers, cache behavior, query hot paths, and supporting docs/tests.

---

## Status Legend

- `todo` — not started
- `in_progress` — actively being implemented
- `blocked` — waiting on a dependency or product decision
- `done` — implemented and verified
- `cancelled` — intentionally removed from scope

---

## Summary Board

| ID | Status | Priority | Area | Depends On | Title |
|---|---|---|---|---|---|
| `RC01` | `done` | `P0` | Docs / Architecture | — | Establish canonical routing inventory and deprecation map |
| `RC02` | `done` | `P0` | Frontend infra | `RC01` | Extract shared Vercel Route Handler infrastructure |
| `RC03` | `done` | `P0` | Dashboard reads | `RC01`, `RC02` | Simplify default dashboard read path |
| `RC04` | `done` | `P0` | Filtered reads | `RC01`, `RC02` | Consolidate or remove transitional filtered dashboard route handlers |
| `RC05` | `done` | `P0` | Cache | `RC02` | Harden cache lifecycle, TTL behavior, and diagnostics |
| `RC06` | `done` | `P0` | Analytics | `RC01`, `RC02` | Stop automatic live analytics recompute on initial dashboard load |
| `RC07` | `done` | `P1` | Backend API | `RC01` | Consolidate dashboard backend endpoints and move query logic into services |
| `RC08` | `done` | `P1` | Database / Perf | `RC07` | Add hot-path indexes and verify query plans for dashboard routes |
| `RC09` | `done` | `P1` | Cleanup / Tests | `RC03`, `RC04`, `RC06`, `RC07` | Remove dead wrappers/routes and add routing regression tests |
| `RC10` | `done` | `P1` | Docs / Runbooks | `RC03`, `RC04`, `RC05`, `RC06`, `RC07`, `RC08`, `RC09` | Sync API, architecture, conventions, and troubleshooting docs after cleanup |

---

## Global Exit Criteria

- The shipped RA dashboard has a documented canonical read path with no ambiguous duplicate handlers.
- Every active `src/app/api/ra/*` Route Handler has:
  - an owning screen,
  - a documented cache key policy,
  - a documented timeout policy,
  - a documented fallback policy,
  - a shared auth/cache/fetch utility path.
- Every active FastAPI dashboard/weather analytics endpoint has a documented caller or explicit admin/debug purpose.
- Unused or transitional routes/wrappers are deleted or explicitly marked for removal with no silent leftovers.
- Docs agree on:
  - which paths are FastAPI endpoints,
  - which paths are same-origin Vercel Route Handlers,
  - current cache TTLs,
  - canonical dashboard read topology.

---

## Tasks

### `RC01` — Establish canonical routing inventory and deprecation map

- Status: `done`
- Priority: `P0`
- Area: Docs / Architecture
- Depends on: —
- Problem:
  - Routing ownership is currently split across FastAPI routes, same-origin Route Handlers, and frontend wrappers without one source of truth.
  - Transitional routes such as `/api/ra/dashboard/range` and backend primitives such as `/dashboard/summary/range` are easy to expand accidentally because their current ownership is not explicit.
- Scope:
  - Inventory all active dashboard-related read paths from browser -> Vercel -> Render -> Supabase.
  - Mark each route as `canonical`, `transitional`, `internal-only`, or `remove`.
  - Record the target canonical route shape for:
    - default dashboard operational reads,
    - filtered dashboard operational reads,
    - weather range reads,
    - analytics snapshot/live reads.
- Reference docs to read:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
  - `docs/ANALYTICS.md`
- Affected code/paths:
  - `frontend/src/app/api/ra/**`
  - `frontend/src/lib/api/index.ts`
  - `frontend/src/app/(ra)/dashboard/page.tsx`
  - `backend/app/routers/dashboard.py`
  - `backend/app/routers/weather.py`
- Acceptance criteria:
  - A single routing inventory exists in docs and clearly distinguishes FastAPI endpoints from Next.js Route Handlers.
  - Every active route lists its owner screen or caller.
  - Every transitional route lists its cleanup task and removal target.
  - No dashboard-related route remains undocumented.
- Required testing/verification:
  - Code review of all route definitions and direct callers.
  - Verify the documented inventory matches the codebase exactly.
- Required doc updates:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
- Completion notes:
  - Added a single dashboard routing inventory and deprecation map to `docs/ARCHITECTURE.md`.
  - Marked current caller/classification status for dashboard/weather FastAPI read endpoints in `docs/API.md`.
  - Updated routing-governance rules in `docs/CONVENTIONS.md` so future route changes must keep the inventory current.

### `RC02` — Extract shared Vercel Route Handler infrastructure

- Status: `done`
- Priority: `P0`
- Area: Frontend infra
- Depends on: `RC01`
- Problem:
  - JWT verification, backend timeout helpers, Redis client setup, and cache response patterns are duplicated across multiple Route Handlers.
  - Duplication raises drift risk and makes routing behavior harder to audit.
- Scope:
  - Extract shared server-only utilities for:
    - Supabase JWT verification,
    - backend fetch with timeout,
    - Redis client creation,
    - common cache headers / response helpers,
    - date validation helpers used by route handlers.
  - Update all `src/app/api/ra/*` Route Handlers to use the shared utilities.
- Reference docs to read:
  - `docs/CONVENTIONS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TESTING.md`
- Affected code/paths:
  - `frontend/src/app/api/ra/dashboard/route.ts`
  - `frontend/src/app/api/ra/weather/range/route.ts`
  - `frontend/src/app/api/ra/dashboard/range/route.ts`
  - `frontend/src/app/api/ra/dashboard/analytics/route.ts`
  - new shared server-side helper module(s) under `frontend/src/lib/`
- Acceptance criteria:
  - Route Handlers no longer each define their own JWKS/JWT verification helpers.
  - Route Handlers no longer each define their own fetch-timeout helper.
  - Route Handlers no longer each define their own Redis bootstrap logic.
  - Behavior remains unchanged except where later cleanup tasks intentionally alter it.
- Required testing/verification:
  - Frontend unit tests for shared auth/cache utilities where practical.
  - Smoke test each Route Handler for `401`, success path, and timeout/error path.
- Required doc updates:
  - `docs/CONVENTIONS.md`
  - `docs/ARCHITECTURE.md`
- Completion notes:
  - Extracted shared server-only Route Handler helpers under `frontend/src/lib/server/` for Supabase JWT verification, backend fetch + timeout handling, Redis/cache helpers, and date-range validation.
  - Updated all active RA Route Handlers to use the shared helper layer instead of duplicating JWT, timeout, and Redis bootstrap logic inline.
  - Added frontend Vitest coverage for the new shared helpers plus smoke tests for the route handlers active at the time; `RC04` later removed the transitional filtered dashboard handler.

### `RC03` — Simplify default dashboard read path

- Status: `done`
- Priority: `P0`
- Area: Dashboard reads
- Depends on: `RC01`, `RC02`
- Problem:
  - The default dashboard page currently requests a cached/live dashboard bundle whose `summary` payload is not rendered by the page.
  - This adds avoidable backend fan-out and cache payload size on every live refresh.
- Scope:
  - Decide and implement one of these outcomes:
    - restore real UI usage of the operational summary payload, or
    - remove the unused summary fetch from the default dashboard path.
  - Keep the default dashboard initial load minimal and aligned with what the page actually renders.
  - Ensure the dashboard page does not make overlapping default-read requests for the same data.
- Reference docs to read:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/styleguide.md`
- Affected code/paths:
  - `frontend/src/app/(ra)/dashboard/page.tsx`
  - `frontend/src/app/api/ra/dashboard/route.ts`
  - `frontend/src/lib/api/index.ts`
- Acceptance criteria:
  - The default dashboard read path fetches only data rendered on the page.
  - The default dashboard no longer pays for an unused `/dashboard/summary` backend request.
  - Route naming and bundle shape match the actual UI contract.
  - The canonical default dashboard request path is documented.
- Required testing/verification:
  - Verify initial dashboard load issues only the expected requests.
  - Verify cache-hit and cache-miss behavior still works.
  - Add or update tests around the default dashboard bundle contract.
- Required doc updates:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
- Completion notes:
  - Narrowed `GET /api/ra/dashboard?mode=cached|live` to a weather-only bundle so the default dashboard stops fetching the unused `/dashboard/summary` backend primitive.
  - Renamed the typed frontend wrapper to `getDashboardWeatherBundle()` and aligned the bundle contract with the data the dashboard page actually renders.
  - Updated route-handler coverage and routing docs to reflect the canonical weather-only default dashboard path and mark `GET /dashboard/summary` as no longer part of the shipped topology.

### `RC04` — Consolidate or remove transitional filtered dashboard route handlers

- Status: `done`
- Priority: `P0`
- Area: Filtered reads
- Depends on: `RC01`, `RC02`
- Problem:
  - `/api/ra/dashboard/range` exists as a live-only fan-out Route Handler but is not part of the shipped dashboard read path.
  - It currently lacks the timeout/fallback guarantees used by the other cache-aware handlers.
  - Supporting backend endpoints can remain orphaned or proliferate if this route is not resolved cleanly.
- Scope:
  - Choose one canonical filtered operational read path.
  - If `/api/ra/dashboard/range` is not needed, remove it and its wrapper.
  - If it is needed, harden it with:
    - explicit timeouts,
    - minimal payload shaping,
    - shared helper usage,
    - documented ownership.
  - Reassess backend primitives `/dashboard/summary/range` and `/dashboard/participants-per-day` after the decision.
- Reference docs to read:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
- Affected code/paths:
  - `frontend/src/app/api/ra/dashboard/range/route.ts`
  - `frontend/src/lib/api/index.ts`
  - `backend/app/routers/dashboard.py`
- Acceptance criteria:
  - No unused filtered dashboard Route Handler remains in the repo.
  - Any retained filtered dashboard Route Handler has explicit timeout behavior.
  - Any retained filtered dashboard Route Handler has a documented owner screen.
  - Backend filtered primitives are either documented as canonical callers or removed.
- Required testing/verification:
  - Verify filtered reads do not hang indefinitely on cold backend responses.
  - Verify request inventory before/after cleanup matches the chosen target topology.
- Required doc updates:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
- Completion notes:
  - Removed the dead same-origin filtered operational bundle path by deleting `GET /api/ra/dashboard/range` and the unused `getDashboardRangeBundle()` wrapper/types.
  - Removed backend endpoints `GET /dashboard/summary/range` and `GET /dashboard/participants-per-day` because they had no remaining shipped caller after the frontend route deletion.
  - Updated the routing inventory and test docs to show that filtered dashboard reads are weather-only today via `GET /api/ra/weather/range`, with no parallel filtered operational bundle left in the repo.

### `RC05` — Harden cache lifecycle, TTL behavior, and diagnostics

- Status: `done`
- Priority: `P0`
- Area: Cache
- Depends on: `RC02`
- Problem:
  - Cache TTL behavior is currently fixed-expiry and not documented clearly enough to avoid false assumptions about persistence.
  - Diagnostic behavior is inconsistent across route handlers and docs.
  - Cache TTL values in docs have already drifted from code.
- Scope:
  - Decide and implement the intended cache lifecycle for each dashboard-related key:
    - fixed expiry,
    - expiry renewal on hit,
    - background warm/refresh threshold,
    - or explicit invalidation only.
  - Standardize `x-ww-cache` header semantics.
  - Ensure current TTLs and persistence semantics are documented exactly.
- Reference docs to read:
  - `docs/CONVENTIONS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/devSteps.md`
- Affected code/paths:
  - `frontend/src/app/api/ra/dashboard/route.ts`
  - `frontend/src/app/api/ra/weather/range/route.ts`
  - `frontend/src/app/api/ra/dashboard/analytics/route.ts`
  - related helper utilities created in `RC02`
- Acceptance criteria:
  - Each active cache key has a documented TTL and renewal policy.
  - Cache-hit behavior matches the documented persistence model.
  - `x-ww-cache` values are consistent across all active Route Handlers.
  - Docs no longer contain stale TTL values.
- Required testing/verification:
  - Verify TTL behavior against Upstash in dev/staging or through focused tests/mocks.
  - Smoke test cache `hit`, `miss`, `refresh`, `stale-fallback`, and `disabled` states where applicable.
- Required doc updates:
  - `docs/CONVENTIONS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/devSteps.md`
- Completion notes:
  - Centralized active RA cache policy metadata in `frontend/src/lib/server/route-handler-cache.ts` so key prefixes, TTLs, and renewal semantics now come from one shared source instead of per-handler literals.
  - Standardized cache diagnostics across the active same-origin handlers by making cache reads/writes report availability explicitly and by adding shared `x-ww-cache-ttl` plus `x-ww-cache-renewal` headers alongside `x-ww-cache`.
  - Documented the exact fixed-expiry-on-write lifecycle for dashboard weather, weather range, and analytics snapshot keys, including the dashboard page's current 10-minute background refresh threshold and the fact that repeated reads do not extend TTL.

### `RC06` — Stop automatic live analytics recompute on initial dashboard load

- Status: `done`
- Priority: `P0`
- Area: Analytics
- Depends on: `RC01`, `RC02`
- Problem:
  - The dashboard currently falls back from snapshot read to live analytics recompute on mount when no snapshot exists.
  - That makes a heavy backend compute path part of the default dashboard load and can contend with operational dashboard reads.
- Scope:
  - Make initial dashboard analytics reads snapshot-first and non-blocking.
  - Restrict live recompute to an explicit user action or a separately documented background flow.
  - Keep snapshot fallback semantics and typed analytics status behavior intact.
- Reference docs to read:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ANALYTICS.md`
- Affected code/paths:
  - `frontend/src/lib/components/DashboardAnalyticsSection.tsx`
  - `frontend/src/app/api/ra/dashboard/analytics/route.ts`
  - `backend/app/services/analytics_service.py`
- Acceptance criteria:
  - Initial dashboard mount does not automatically trigger live analytics recompute.
  - Users can still request a live recompute explicitly.
  - Snapshot read behavior remains typed and documented.
  - The default dashboard read path is lighter than before.
- Required testing/verification:
  - Verify no `mode=live` analytics request is emitted on initial dashboard load unless explicitly requested.
  - Verify manual refresh still works.
  - Add/update tests around snapshot-miss behavior and explicit live refresh behavior.
- Required doc updates:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ANALYTICS.md`
- Completion notes:
  - Removed the dashboard analytics section's automatic snapshot-404-to-live fallback so initial dashboard loads stay snapshot-first and never trigger `mode=live` unless the RA explicitly requests it.
  - Added a snapshot-miss empty state in `DashboardAnalyticsSection` so missing snapshots are visible without blocking or silently reusing stale data for a different range.
  - Added focused frontend tests covering snapshot-miss initial loads and explicit manual live refresh behavior, then updated routing/API/docs to document that `mode=live` is now manual-only from the shipped dashboard.

### `RC07` — Consolidate dashboard backend endpoints and move query logic into services

- Status: `done`
- Priority: `P1`
- Area: Backend API
- Depends on: `RC01`
- Problem:
  - Dashboard operational reads are split across multiple narrow backend endpoints that are recombined in Vercel.
  - Query/aggregation logic currently lives directly in route handlers despite the project convention that business logic belongs in services.
- Scope:
  - Define the canonical backend endpoint set for operational dashboard reads after `RC03` and `RC04`.
  - Move dashboard aggregation/query logic out of routers and into service-layer functions.
  - Keep endpoint contracts minimal and aligned with actual callers.
- Reference docs to read:
  - `docs/API.md`
  - `docs/CONVENTIONS.md`
  - `docs/ARCHITECTURE.md`
- Affected code/paths:
  - `backend/app/routers/dashboard.py`
  - new or expanded service modules under `backend/app/services/`
  - any backend schemas updated by the consolidation
- Acceptance criteria:
  - Dashboard routers contain orchestration and validation only; query logic lives in services.
  - The backend endpoint set for dashboard operational reads is documented and minimal.
  - Vercel fan-out is reduced where the chosen design allows it.
- Required testing/verification:
  - Backend router/service tests cover the new service boundaries.
  - Verify endpoint responses remain backward-compatible where compatibility is required.
- Required doc updates:
  - `docs/API.md`
  - `docs/CONVENTIONS.md`
  - `docs/ARCHITECTURE.md`
- Completion notes:
  - Removed the orphaned `GET /dashboard/summary` FastAPI endpoint so the backend operational read set now matches the shipped topology: weather reads stay on `GET /weather/daily`, while `/dashboard/*` is reserved for dashboard-owned analytics.
  - Extracted the `GET /weather/daily` read/query logic into `backend/app/services/weather_read_service.py`, leaving `backend/app/routers/weather.py` responsible only for auth, input validation, and service orchestration.
  - Added backend coverage for the new weather read service boundary and for the `/weather/daily` router delegation behavior, then updated routing docs to describe the minimal canonical backend endpoint set.

### `RC08` — Add hot-path indexes and verify query plans for dashboard routes

- Status: `done`
- Priority: `P1`
- Area: Database / Perf
- Depends on: `RC07`
- Problem:
  - The remaining dashboard summary/weather/analytics read paths still lean on `sessions.status`, `sessions.created_at`, `sessions.completed_at`, and related dashboard join/filter columns.
  - The current schema includes no secondary indexes for those hot-path fields.
- Scope:
  - Add the indexes required by the finalized dashboard endpoint set.
  - Verify query plans for:
    - dashboard summary,
    - any remaining consolidated dashboard operational read introduced by `RC07`,
    - analytics dataset source query.
  - Avoid speculative indexes that are not tied to an active route.
- Reference docs to read:
  - `docs/SCHEMA.md`
  - `docs/API.md`
  - `docs/TESTING.md`
- Affected code/paths:
  - new Alembic migration(s)
  - `backend/app/models/sessions.py`
  - any service/query code changed in `RC07`
- Acceptance criteria:
  - Required session hot-path indexes exist in schema and migration history.
  - Query-plan review shows the hot paths use the intended indexes or otherwise have justified plans.
  - No schema changes are applied outside Alembic.
- Required testing/verification:
  - `alembic upgrade head` and downgrade smoke check.
  - Query-plan capture or documented verification for each hot path.
  - Backend tests still pass.
- Required doc updates:
  - `docs/SCHEMA.md`
  - `docs/API.md`
- Completion notes:
  - Added Alembic migration `20260313_000001_add_session_analytics_indexes.py` plus matching SQLAlchemy metadata in `backend/app/models/sessions.py` for two complete-session partial indexes: `ix_sessions_complete_completed_at` and `ix_sessions_complete_study_day_completed_at`.
  - Reworked `build_canonical_analysis_dataset()` so candidate sessions are selected through unioned `study_days.date_local` and `sessions.completed_at` range branches instead of a single cross-table `OR`, giving the planner an indexable hot path for the shipped analytics read.
  - Verified the migration SQL in offline Alembic upgrade/downgrade mode, then ran a live Postgres `EXPLAIN (ANALYZE, BUFFERS)` against the updated analytics query on 2026-03-13. The current database uses `ix_sessions_complete_completed_at` for the UTC fallback branch and `uq_study_days_date_local` for the local-date branch; the study-day join still chooses a sequential scan on `sessions`, which is currently justified by the small live table size.

### `RC09` — Remove dead wrappers/routes and add routing regression tests

- Status: `done`
- Priority: `P1`
- Area: Cleanup / Tests
- Depends on: `RC03`, `RC04`, `RC06`, `RC07`
- Problem:
  - Frontend wrappers and Route Handlers can remain in place after topology changes, reintroducing drift and confusion.
  - There are currently few tests that protect the intended route topology itself.
- Scope:
  - Delete unused wrappers, transitional route handlers, and dead bundle types once the canonical topology is in place.
  - Add focused regression tests for:
    - route ownership assumptions,
    - cache-mode request behavior,
    - no unintended live analytics request on mount,
    - timeout/fallback behavior where supported.
- Reference docs to read:
  - `docs/TESTING.md`
  - `docs/CONVENTIONS.md`
  - `docs/API.md`
- Affected code/paths:
  - `frontend/src/lib/api/index.ts`
  - `frontend/src/app/api/ra/**`
  - frontend test files under `frontend/src/**`
  - backend router/service tests where endpoint topology changes
- Acceptance criteria:
  - No dead dashboard routing wrapper or bundle type remains exported.
  - Regression tests fail if removed cleanup rules are reintroduced.
  - The codebase route inventory matches the docs after cleanup.
- Required testing/verification:
  - `cd frontend && npm test`
  - `cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v`
- Required doc updates:
  - `docs/TESTING.md`
  - `docs/API.md`
- Completion notes:
  - Removed the dead frontend `DashboardSummaryResponse` export from `frontend/src/lib/api/index.ts` so the typed wrapper surface no longer advertises a deleted dashboard summary read.
  - Added `frontend/src/app/api/ra/route-topology.test.ts` to lock the shipped same-origin RA dashboard/weather route inventory and fail if removed wrappers such as `getDashboardRangeBundle()` reappear.
  - Updated `docs/TESTING.md` and `docs/API.md` to document the new topology regression coverage alongside the snapshot-first analytics loader guard introduced in `RC06`.

### `RC10` — Sync API, architecture, conventions, and troubleshooting docs after cleanup

- Status: `done`
- Priority: `P1`
- Area: Docs / Runbooks
- Depends on: `RC03`, `RC04`, `RC05`, `RC06`, `RC07`, `RC08`, `RC09`
- Problem:
  - Routing/caching docs have already drifted from code at least once.
  - Cleanup will fail long-term if docs are not updated as part of the implementation sequence.
- Scope:
  - Perform a final post-cleanup doc pass across:
    - route inventory,
    - cache keys and TTLs,
    - timeout/fallback rules,
    - troubleshooting steps,
    - testing guidance.
  - Remove stale references to deleted/transitional routes.
- Reference docs to read:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
  - `docs/devSteps.md`
  - `docs/TESTING.md`
- Affected docs:
  - `docs/API.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CONVENTIONS.md`
  - `docs/devSteps.md`
  - `docs/TESTING.md`
  - `docs/PROGRESS.md`
- Acceptance criteria:
  - No deleted route appears in docs without an explicit historical note.
  - Cache TTLs and semantics are consistent across all docs.
  - Canonical routing ownership is documented in one place and referenced elsewhere.
  - Troubleshooting steps reflect the final cleanup topology.
- Required testing/verification:
  - Final doc/code audit against the implemented route inventory.
  - Verify all internal cross-links point to the final docs.
- Completion notes:
  - Synced `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, and `docs/devSteps.md` with the shipped routing topology, cache TTL/renewal semantics, 15-second timeout behavior, snapshot-first analytics load rule, and the current Route Handler/test surface.
  - Added an explicit historical-routing note to `docs/PROGRESS.md` so superseded route names remain preserved as append-only project history rather than ambiguous current guidance.
  - Completed the final post-cleanup doc/code audit for the active dashboard/weather read paths and removed the remaining stale "planned/current" wording in the affected runbook docs.
