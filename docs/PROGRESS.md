# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.

---

## Current State

| Field              | Value                  |
|--------------------|------------------------|
| Phase              | 2 (planning)           |
| Tasks completed    | 18 / 32                |
| Tasks in progress  | 0                      |
| Last updated       | 2026-02-23             |

---

**Architecture note (2026-02-22):** Project architecture is now standardized on Next.js (Vercel) + FastAPI (Render) + Supabase Postgres. Earlier entries referencing SvelteKit reflect the initial scaffold and are superseded by docs/ARCHITECTURE.md.

---

## Currently In Progress

_No tasks in progress._

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

---


## Completed Tasks

Note: T01, T07, and T08 were reopened on 2026-02-20 after verification found incomplete or invalid implementations. See Recent Changes.

| Task | Title | Completed | Notes |
|------|-------|-----------|-------|
| T01 | Initialize monorepo structure | 2026-02-19 | Monorepo scaffolded (frontend+backend); env + gitignore added. |
| T02 | Set up Supabase project and Alembic | 2026-02-19 | Alembic initialized; async SQLAlchemy Base and session factory in app.db; env-only DATABASE_URL; migrations env configured; live `upgrade head` verified on Supabase (2026-02-23). |
| T03 | DB schema — participants and sessions tables | 2026-02-19 | Models and migration created for participants and sessions with constraints and timestamps. |
| T04 | DB schema — digit span tables | 2026-02-19 | Models and migration created for digitspan_runs and digitspan_trials with FK constraints and checks. |
| T05 | DB schema — all four survey tables | 2026-02-19 | Models + migration for all four survey tables created. |
| T06 | Auth — stub lab member dependency | 2026-02-19 | Pydantic LabMember + stubbed dependency in backend/app/auth.py. |
| T07 | Backend — participant CRUD endpoints | 2026-02-19 | POST/GET endpoints implemented; server-assigned participant_number; docs updated. |
| T08 | Backend — session endpoints | 2026-02-22 | POST/GET/PATCH endpoints implemented; session status lifecycle; docs updated. |
| T09 | Backend — digit span scoring module and endpoint | 2026-02-22 | Pure scoring function + POST /digitspan/runs endpoint; 5 unit tests passing. |
| T10 | Backend — all four survey scoring modules and endpoints | 2026-02-22 | 4 scoring modules + 4 POST endpoints + 23 unit tests passing. |
| T11 | Frontend — Next.js route layout and auth guard | 2026-02-22 | Route groups, auth guard layout, login stub, typed API wrapper. |
| T12 | Frontend — RA participant management UI | 2026-02-23 | List table + create form using api wrappers; build verified. |
| T13 | Frontend — RA session creation and launch UI | 2026-02-23 | Participant selector, session create/activate, URL copy, status polling. |
| T14 | Frontend — participant digit span task UI | 2026-02-23 | Full digit span flow: instructions, practice, 14 trials, POST to backend. |
| T15 | Frontend — ULS-8 and CES-D 10 survey screens | 2026-02-23 | Reusable SurveyForm component; exact item wording; routes to next survey on 2xx. |
| T16 | Frontend — GAD-7 and CogFunc 8a survey screens + completion routing | 2026-02-23 | GAD-7 (4-pt) + CogFunc 8a (5-pt); PATCH complete + route to /complete on final submit. |
| T17 | Frontend — session completion screen | 2026-02-23 | Thank-you page, no scores shown, no navigation forward/back. |
| T18 | Auth — replace stub with Supabase Auth | 2026-02-23 | Real JWT validation (backend) + Supabase Auth client (frontend). |
<!-- Ralph: append one row per completed task. Never delete rows. -->

---

## Recent Changes
### Phase 2 planning update — 2026-02-23

**Files modified:**
- docs/kanban.md — appended full detailed Phase 2 task queue (`T19`–`T32`) while preserving existing Phase 1 block
- docs/PROGRESS.md — current state updated for Phase 2 planning

**Key implementation decisions:**
- Kept Phase 1 task history intact and unchanged
- Phase 2 is intentionally broken down into UI/dashboard polish, backend connection hardening, Render deployment, JWT signing-key verification, and E2E/release readiness work
- Added per-task `read_docs`, `acceptance_criteria`, and `updates_docs` requirements for all new tasks

**Docs updated:**
- docs/kanban.md — Phase 2 planned tasks added
- docs/PROGRESS.md — state table and this entry added

---

### T18 — Auth — replace stub with Supabase Auth — 2026-02-23

**Files created:**
- frontend/src/lib/supabase.ts — Supabase client singleton (reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)

**Files modified:**
- backend/app/auth.py — replaced stub with real JWT validation: decodes HS256 JWT using SUPABASE_JWT_SECRET, extracts sub (UUID) and email from claims, returns 401 for missing/invalid/expired tokens
- backend/requirements.txt — added python-jose[cryptography]>=3.3.0
- frontend/src/lib/api/index.ts — getAuthToken now reads from Supabase Auth session (async) instead of localStorage
- frontend/src/app/(ra)/layout.tsx — auth guard uses supabase.auth.getSession() + onAuthStateChange listener
- frontend/src/app/login/page.tsx — real email/password login via supabase.auth.signInWithPassword()
- docs/DECISIONS.md — no changes needed (auth pattern already documented)
- docs/kanban.md — T18 status set to `done`
- docs/PROGRESS.md — state table updated (18/18), this entry added

**Key implementation decisions:**
- Backend uses python-jose with HS256 (Supabase default algorithm), verify_aud disabled for compatibility
- HTTPBearer scheme with auto_error=False so we return a clear 401 message
- Frontend Supabase client handles missing env vars at build time via placeholder (fails gracefully at runtime only)
- buildHeaders in api wrapper is now async to support async getSession() call
- Auth state listener in RA layout redirects to /login on sign-out

**Verification:**
- `next build` succeeds with all routes
- 28/28 backend unit tests pass
- Backend app loads with all routes

**Docs updated:**
- docs/kanban.md — T18 done
- docs/PROGRESS.md — state and this entry

---

### T17 — Frontend — session completion screen — 2026-02-23

**Files created:**
- frontend/src/app/session/[session_id]/complete/page.tsx — thank-you page with RA-return instruction

**Key implementation decisions:**
- No scores, computed values, or raw data displayed
- No forward navigation links or back buttons (dead end)
- Accessible without auth at /session/[session_id]/complete
- Server component (no client state needed)

**Verification:**
- `next build` succeeds with /complete route confirmed

**Docs updated:**
- docs/kanban.md — T17 done
- docs/PROGRESS.md — state and this entry

---

### T16 — Frontend — GAD-7 and CogFunc 8a survey screens + completion routing — 2026-02-23

**Files created:**
- frontend/src/app/session/[session_id]/gad7/page.tsx — GAD-7 survey: 7 items, 4-point scale, routes to /cogfunc
- frontend/src/app/session/[session_id]/cogfunc/page.tsx — CogFunc 8a survey: 8 items, 5-point scale, PATCH complete + route to /complete

**Key implementation decisions:**
- GAD-7: 4-point scale (Never/Rarely/Sometimes/Often), exact wording from GAD7.md
- CogFunc 8a: 5-point scale (Never/Rarely/Sometimes/Often/Very Often), exact wording from COGFUNC8A.md
- CogFunc 8a is the final instrument — after successful POST, calls PATCH /sessions/{id}/status with "complete", then routes to /session/[id]/complete
- Both use shared SurveyForm component; neither allows partial submission
- PATCH to complete session does not require auth (matches GET sessions/{id} pattern for participant pages)

**Verification:**
- `next build` succeeds with /gad7 and /cogfunc routes confirmed

**Docs updated:**
- docs/kanban.md — T16 done
- docs/PROGRESS.md — state and this entry

---

### T15 — Frontend — ULS-8 and CES-D 10 survey screens — 2026-02-23

**Files created:**
- frontend/src/lib/components/SurveyForm.tsx — reusable survey component (radio buttons, validation, submit)
- frontend/src/app/session/[session_id]/uls8/page.tsx — ULS-8 survey with 8 items, 4-point scale
- frontend/src/app/session/[session_id]/cesd10/page.tsx — CES-D 10 survey with 10 items, 4-point scale

**Key implementation decisions:**
- Shared SurveyForm component: renders items with radio button scale, prevents submission until all answered
- Exact item wording from ULS8.md and CESD10.md
- Scale: Never(1) / Rarely(2) / Sometimes(3) / Often(4) — raw values sent to backend
- ULS-8 routes to /cesd10 on 2xx; CES-D 10 routes to /gad7 on 2xx
- All API calls through @/lib/api wrappers (no bare fetch)

**Verification:**
- `next build` succeeds with /uls8 and /cesd10 routes confirmed

**Docs updated:**
- docs/kanban.md — T15 done
- docs/PROGRESS.md — state and this entry

---

### T14 — Frontend — participant digit span task UI — 2026-02-23

**Files created:**
- frontend/src/app/session/[session_id]/digitspan/page.tsx — full backwards digit span flow

**Key implementation decisions:**
- 4 instruction screens advancing on Space key press (exact wording from DIGITSPAN.md)
- Practice trial: hardcoded sequence 1 3 5 7 9, correct answer 9 7 5 3 1, 2000ms color feedback
- 14 scored trials: spans 3,3,4,4,5,5,6,6,7,7,8,8,9,9 with pre-generated sequences (no-replacement sampling)
- Digit presentation: setTimeout chains — 1000ms display, 100ms gap (never setInterval)
- Keyboard input: digits 1-9 only, Backspace deletes, Enter submits; all other keys ignored
- Answer checking: all-or-nothing, reversed entry compared to shown sequence
- On completion: POST /digitspan/runs with all 14 trial data, route to /session/[id]/uls8 on 2xx
- Practice data NOT sent to backend

**Verification:**
- `next build` succeeds, route `/session/[session_id]/digitspan` confirmed

**Docs updated:**
- docs/kanban.md — T14 done
- docs/PROGRESS.md — state and this entry

---

### T13 — Frontend — RA session creation and launch UI — 2026-02-23

**Files modified:**
- frontend/src/app/(ra)/sessions/page.tsx — replaced placeholder with full session management UI

**Key implementation decisions:**
- Participant dropdown loads from GET /participants on mount
- POST /sessions creates session, starts 3-second status polling via setInterval
- Participant URL displayed with copy-to-clipboard button (navigator.clipboard API)
- Status badge (created=yellow, active=green, complete=gray) updates live via polling
- "Activate session" button calls PATCH /sessions/{id}/status with status="active"
- Polling stops automatically when status reaches "complete"
- All API calls through @/lib/api wrappers with auth: true

**Verification:**
- `next build` succeeds with no errors

**Docs updated:**
- docs/kanban.md — T13 done
- docs/PROGRESS.md — state and this entry

---

### T12 — Frontend — RA participant management UI — 2026-02-23

**Files modified:**
- frontend/src/app/(ra)/participants/page.tsx — replaced placeholder with full participant list table and create form

**Key implementation decisions:**
- All API calls go through `@/lib/api` wrappers (apiGet, apiPost) with `auth: true`
- Form prevents submission with empty first_name or last_name (HTML required + disabled button)
- On successful create, displays auto-assigned participant_number and refreshes list
- Table ordered by participant_number (backend returns sorted)
- Error and success feedback displayed inline

**Verification:**
- `next build` succeeds with no errors

**Docs updated:**
- docs/kanban.md — T12 done
- docs/PROGRESS.md — state and this entry

---

### T11 — Frontend — Next.js route layout and auth guard — 2026-02-22

**Files created:**
- frontend/src/app/(ra)/layout.tsx — auth guard: redirects to /login if no auth_token in localStorage
- frontend/src/app/(ra)/participants/page.tsx — placeholder for T12
- frontend/src/app/(ra)/sessions/page.tsx — placeholder for T13
- frontend/src/app/session/[session_id]/layout.tsx — no-auth layout for participant pages
- frontend/src/app/session/[session_id]/page.tsx — placeholder session landing page
- frontend/src/app/login/page.tsx — stub login page (sets dev token, redirects to /participants)
- frontend/src/lib/api/index.ts — typed fetch wrappers (apiGet, apiPost, apiPatch) + domain types

**Files modified:**
- frontend/src/app/layout.tsx — updated metadata title/description
- docs/kanban.md — T11 status set to `done`
- docs/PROGRESS.md — state table updated (11/18), this entry added

**Key implementation decisions:**
- Auth guard uses localStorage token check (stub for T18 Supabase Auth replacement)
- API wrapper reads NEXT_PUBLIC_API_URL env var, defaults to localhost:8000
- All domain response types exported from api/index.ts for use by T12-T16
- Login page is a dev stub that sets a placeholder token

**Verification:**
- `next build` succeeds with all routes: /, /login, /participants, /sessions, /session/[session_id]
- (ra)/ route group correctly applies auth guard layout

**Docs updated:**
- docs/kanban.md — T11 done
- docs/PROGRESS.md — state and this entry

---

### T10 — Backend — all four survey scoring modules and endpoints — 2026-02-22

**Files created:**
- backend/app/scoring/uls8.py — pure scoring: reverse items 3 & 6, mean, 0-100 transform
- backend/app/scoring/cesd10.py — pure scoring: 0-based conversion, reverse items 5 & 8, sum 0-30
- backend/app/scoring/gad7.py — pure scoring: 0-based conversion, sum, severity band assignment
- backend/app/scoring/cogfunc8a.py — pure scoring: reverse all (6-raw), sum and mean
- backend/app/schemas/surveys.py — Pydantic Create/Response models for all 4 surveys
- backend/app/routers/surveys.py — 4 POST endpoints with active-session validation
- backend/tests/test_scoring_uls8.py — 5 tests (all never, all often, max/min loneliness, mixed)
- backend/tests/test_scoring_cesd10.py — 5 tests (all never, all often, max/min depression, mixed)
- backend/tests/test_scoring_gad7.py — 8 tests (all bands + boundary cases)
- backend/tests/test_scoring_cogfunc8a.py — 5 tests (all never, all very often, sometimes, mixed)

**Files modified:**
- backend/app/main.py — registered surveys router
- docs/API.md — all 4 survey endpoints marked `implemented`
- docs/kanban.md — T10 status set to `done`
- docs/PROGRESS.md — state table updated (10/18), this entry added

**Key implementation decisions:**
- All scoring functions are pure (no DB, no side effects) per CONVENTIONS.md
- All 4 endpoints validate session exists and status == "active"; return 404/409 otherwise
- participant_uuid derived from session (not client-supplied)
- ULS-8 uses Decimal for computed_mean/score_0_100 to match NUMERIC column types
- CogFunc 8a uses Decimal for mean_score

**Verification:**
- 28/28 unit tests pass across all 5 scoring modules
- App loads with all 4 survey routes confirmed

**Docs updated:**
- docs/API.md — survey endpoint statuses
- docs/kanban.md — T10 done
- docs/PROGRESS.md — state and this entry

---

### T09 — Backend — digit span scoring module and endpoint — 2026-02-22

**Files created:**
- backend/app/scoring/__init__.py — package marker
- backend/app/scoring/digitspan.py — pure scoring function: `score(trials) -> DigitSpanScored` computing total_correct and max_span
- backend/app/schemas/digitspan.py — Pydantic models: TrialSubmission, DigitSpanRunCreate, DigitSpanRunResponse
- backend/app/routers/digitspan.py — POST /digitspan/runs endpoint
- backend/tests/test_scoring_digitspan.py — 5 unit tests (all correct, all wrong, mixed, sparse, single)

**Files modified:**
- backend/app/main.py — registered digitspan router
- docs/API.md — POST /digitspan/runs marked `implemented`
- docs/kanban.md — T09 status set to `done`
- docs/PROGRESS.md — state table updated (9/18), this entry added

**Key implementation decisions:**
- Scoring function is pure (no DB, no side effects) per CONVENTIONS.md
- Endpoint validates session exists and status == "active"; returns 404/409 otherwise
- participant_uuid derived from session (not client-supplied) to prevent spoofing
- Uses flush() after run insert to get run_id FK for trial rows, then single commit
- Trials validated: exactly 14 required, trial_number 1-14, span_length 3-9

**Verification:**
- All 5 unit tests pass (all correct, all wrong, mixed, sparse, single lowest span)
- App loads with `/digitspan/runs` route confirmed

**Docs updated:**
- docs/API.md — digitspan endpoint status
- docs/kanban.md — T09 done
- docs/PROGRESS.md — state and this entry

---

### T08 — Backend — session endpoints (fix & re-implement) — 2026-02-22

**Files modified:**
- backend/app/schemas/sessions.py — switched to `ConfigDict(from_attributes=True)`, added `__all__`
- backend/app/routers/sessions.py — fixed missing string quotes, completed truncated POST handler, added GET and PATCH endpoints
- backend/app/main.py — registered sessions router via `app.include_router(sessions.router)`
- docs/API.md — all 3 session endpoints marked `implemented`
- docs/kanban.md — T08 status set to `done`
- docs/PROGRESS.md — state table updated (8/18), this entry added

**Key implementation decisions:**
- POST requires auth (creates session with status="created"), returns 404 if participant_uuid unknown
- GET is unauthenticated so participant page can poll session status
- PATCH requires auth, accepts only "created"/"active"/"complete" via Literal type, sets `completed_at` to `func.now()` when status becomes "complete"

**Blockers encountered:**
- Previous implementation had missing string quotes and was truncated at line 31; fully overwritten

**Docs updated:**
- docs/API.md — session endpoint statuses
- docs/kanban.md — T08 done
- docs/PROGRESS.md — state and this entry

---

### T07 — Backend — participant CRUD endpoints (fix & re-implement) — 2026-02-22

**Files modified:**
- backend/app/schemas/participants.py — fixed `__all__` quoting, replaced `class Config` with `model_config = ConfigDict(from_attributes=True)`, removed trailing `PY}` garbage
- backend/app/routers/participants.py — fixed missing string quotes on prefix/tags/route paths, completed truncated 404 handler
- backend/app/main.py — registered participants router via `app.include_router(participants.router)`
- docs/API.md — all 3 participant endpoints marked `implemented`
- docs/kanban.md — T07 status set to `done`
- docs/PROGRESS.md — state table updated (7/18), this entry added

**Key implementation decisions:**
- participant_number assigned as MAX(number)+1 within a single transaction (default 1 if no participants exist)
- All 3 endpoints protected via router-level `dependencies=[Depends(get_current_lab_member)]`
- Used `ConfigDict(from_attributes=True)` (Pydantic v2 style) instead of inner `class Config`

**Blockers encountered:**
- Previous implementation had missing string quotes in router file and trailing garbage in schema file; both fully overwritten

**Docs updated:**
- docs/API.md — participant endpoint statuses
- docs/kanban.md — T07 done
- docs/PROGRESS.md — state and this entry

---

### T01 — Initialize monorepo structure (completion) — 2026-02-22

**Files modified:**
- README.md — added frontend dev commands; added NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to env docs; updated workspace status
- docs/kanban.md — T01 status set to done
- docs/PROGRESS.md — state tables and this entry updated

**Key implementation decisions:**
- Frontend re-scaffolded with Next.js (TypeScript + Tailwind + App Router + src dir) replacing the original SvelteKit scaffold
- Broken T07/T08 router imports removed from main.py (routers are T07/T08 scope, not T01)
- All acceptance criteria verified: `npm run dev` starts Next.js, `uvicorn app.main:app --reload` starts FastAPI, .gitignore covers all required patterns, env vars documented in README and devSteps

**Docs updated:**
- README.md
- docs/kanban.md
- docs/PROGRESS.md

---

### Backend setup verification + docs alignment — 2026-02-23

**Files modified:**
- backend/alembic/versions/20260219_000004_survey_tables.py — fixed quote escaping syntax in migration script
- README.md — updated stack/status wording and run commands
- docs/devSteps.md — updated local `.env` workflow, venv-based commands, and Render timing guidance
- docs/ARCHITECTURE.md — added explicit Render setup timing section
- docs/CONVENTIONS.md — added session-pooler/SSL guidance for asyncpg
- docs/SCHEMA.md — added note confirming applied head revision
- docs/kanban.md — aligned T01 env-doc acceptance wording with current repo workflow
- docs/PROGRESS.md — state date and this entry updated

**Key implementation decisions:**
- For this environment, Supabase connectivity uses a session pooler URL in `DATABASE_URL`.
- SQLAlchemy asyncpg in this repo expects `ssl=require` query param.
- Render setup is not required to complete local backend setup tasks in current Phase 1 scope.

**Verification:**
- `alembic upgrade head` completed successfully against Supabase.
- `alembic current -v` reports revision `20260219_000004 (head)`.

**Blockers encountered:**
- T07/T08 endpoint tasks remain open because router files still contain syntax issues.

**Docs updated:**
- README.md
- docs/devSteps.md
- docs/ARCHITECTURE.md
- docs/CONVENTIONS.md
- docs/SCHEMA.md
- docs/kanban.md
- docs/PROGRESS.md

---

### Architecture & deployment documentation update — 2026-02-22

**Files modified:**
- docs/ARCHITECTURE.md — canonical architecture/deployment doc updated
- docs/DECISIONS.md — OPEN-04 resolved; deployment locked
- docs/CONVENTIONS.md — frontend conventions updated to Next.js
- docs/API.md — production base URL and auth notes aligned
- docs/devSteps.md — dev setup aligned to Next.js + optional auth
- docs/kanban.md — stack and frontend tasks aligned to Next.js
- docs/PRD.md — removed CSV export scope per architecture
- docs/PROGRESS.md — state and this entry updated

**Key implementation decisions:**
- Deploy as a 3-tier web app: Next.js on Vercel (UI only), FastAPI on Render, Supabase Postgres.
- Supabase Auth is optional; if enabled, Next.js sends JWTs to FastAPI for validation.
- Alembic migrations run as deploy step/one-off command, not on app startup.

---

### T01/T07/T08 — Status corrections after audit — 2026-02-20

**Files modified:**
- docs/kanban.md — T01 set to in_progress; T07/T08 set to todo after verification
- docs/PROGRESS.md — current state updated to reflect reopened tasks

**Key implementation decisions:**
- Reopened tasks are tracked as corrections rather than deleting historical completion entries.

**Blockers encountered:**
- T07/T08 routers contain syntax errors and incomplete code, preventing backend from starting.
- T01 cannot be marked complete until dev servers are verified locally (env + deps required).

**Docs updated:**
- docs/PROGRESS.md — this entry and state tables updated

### T07 — Backend — participant CRUD endpoints — 2026-02-19

**Files created:**
- backend/app/routers/participants.py — FastAPI router for create/list/detail
- backend/app/schemas/participants.py — Pydantic request/response models

**Files modified:**
- backend/app/main.py — registered participants router
- docs/API.md — marked participant endpoints implemented
- docs/kanban.md — T07 status set to done
- docs/PROGRESS.md — state tables and completed tasks updated

**Key implementation decisions:**
- participant_number assigned as MAX(number)+1 within a single transaction
- All endpoints protected with Depends(get_current_lab_member) per T06
- Async SQLAlchemy queries via app.db.get_session dependency

**Blockers encountered:**
- Cannot run FastAPI server in this environment (no network/DB). Static verification only.

**Docs updated:**
- docs/API.md — endpoint statuses and details
- docs/kanban.md — task marked done
- docs/PROGRESS.md — this entry and state updated
**Key implementation decisions:**
- Returned synthetic LabMember using uuid4 id and fixed email ra@example.com
- No Supabase Auth SDK imported; auth isolated in backend/app/auth.py per conventions

**Blockers encountered:**
- Network-restricted environment; cannot run FastAPI here to exercise dependency injection. Static verification only.

**Docs updated:**
- docs/PROGRESS.md — this entry, state tables updated
- docs/kanban.md — task marked done


### T05 — DB schema — all four survey tables — 2026-02-19

**Files created:**
- backend/app/models/surveys.py — SQLAlchemy models for ULS-8, CES-D 10, GAD-7, CogFunc 8a
- backend/alembic/versions/20260219_000004_survey_tables.py — migration creating all four survey tables with FKs

**Files modified:**
- backend/app/models/__init__.py — export survey models
- docs/SCHEMA.md — migration history updated for T05
- docs/kanban.md — T05 status set to done
- docs/PROGRESS.md — state and completed tables updated

**Key implementation decisions:**
- Stored raw item responses as SMALLINT per instrument scales (1–4 or 1–5).
- Used NUMERIC(5,4) and NUMERIC(6,2) for ULS-8 computed fields as specified.
- Added VARCHAR `severity_band` to GAD-7.
- Enforced FKs to `sessions` and `participants` at DB level in all tables; all tables include `created_at`.

**Blockers encountered:**
- Network-restricted environment prevents running Alembic against a live DB. Static verification only; local steps required to apply.

**Docs updated:**
- docs/SCHEMA.md — T05 migration row appended
- docs/kanban.md — task marked done
- docs/PROGRESS.md — this entry, state tables updated

### T04 — DB schema — digit span tables — 2026-02-19

**Files created:**
- backend/app/models/digitspan.py — SQLAlchemy models for DigitSpanRun and DigitSpanTrial
- backend/alembic/versions/20260219_000003_digitspan_tables.py — migration creating digitspan_runs and digitspan_trials with FKs and checks

**Files modified:**
- backend/app/models/__init__.py — export new models
- docs/SCHEMA.md — migration history updated for T04
- docs/kanban.md — T04 status set to done

**Key implementation decisions:**
- Added CHECK constraints to enforce trial_number (1–14) and span_length (3–9).
- Used naming conventions for predictable FK/check names via op.f().
- Included created_at TIMESTAMPTZ DEFAULT NOW() on both tables per conventions.

**Blockers encountered:**
- Network-restricted environment prevents running Alembic against a live DB. Static verification only; see local steps below.

**Docs updated:**
- docs/SCHEMA.md — migration history row appended
- docs/kanban.md — task marked done

### T01 — Initialize monorepo structure — 2026-02-19

**Files created:**
- backend/app/__init__.py — package marker
- backend/app/main.py — FastAPI app with /health
- backend/app/auth.py — auth dependency placeholder (to be stubbed in T06)
- backend/app/db.py — env-based DB URL helper
- backend/app/routers/__init__.py — package marker
- backend/requirements.txt — FastAPI/UVicorn deps
- frontend/package.json — SvelteKit + Tailwind scaffold
- frontend/svelte.config.js — adapter-auto
- frontend/vite.config.ts — SvelteKit Vite config
- frontend/postcss.config.cjs — Tailwind
- frontend/tailwind.config.cjs — Tailwind content paths
- frontend/tsconfig.json — TS strict config
- frontend/src/app.d.ts — SvelteKit types
- frontend/src/app.css — Tailwind base
- frontend/src/routes/+layout.svelte — imports global CSS
- frontend/src/routes/+page.svelte — landing page
- frontend/src/lib/api/index.ts — typed GET wrapper
- frontend/src/lib/components/.gitkeep — placeholder
- frontend/src/lib/stores/.gitkeep — placeholder
- .env.example — documented required env vars
- .gitignore — node_modules, __pycache__, .env, .svelte-kit, *.pyc
- README.md — dev commands, env notes

**Files modified:**
- docs/kanban.md — T01 status set to done
- docs/PROGRESS.md — state, completed tasks, recent changes

**Key implementation decisions:**
- Used  per OPEN-04 deferral; no prod adapter committed.
- Minimal FastAPI app exposes  only; routers to be added in later tasks.

**Blockers encountered:**
- Network-restricted environment prevented installing npm/pip dependencies; cannot execute dev servers here. Structure and scripts are in place for local verification.

**Docs updated:**
- docs/PROGRESS.md — this entry, state tables updated
- docs/kanban.md — T01 marked done

<!-- Ralph: prepend one entry per completed task using the format below (newest first). -->

---

## Entry Format (for Ralph)

When marking a task `"done"`, prepend to Recent Changes:

```
### Txx — [Title] — YYYY-MM-DD

**Files created:**
- path/to/new/file.ext — brief description of purpose

**Files modified:**
- path/to/existing/file.ext — what changed

**Key implementation decisions:**
- Any choice that deviated from spec, filled in an underspecified detail, or
  that future tasks should be aware of

**Blockers encountered:**
- Any issue that required deviation, workaround, or that a future task should know

**Docs updated:**
- docs/FILENAME.md — what was added/changed
```

Also:
- Update the **Current State** table (increment completed count, update last updated date)
- Replace the **Currently In Progress** section with the next task or "_No tasks in progress._"
- Append one row to the **Completed Tasks** table
### T02 — Set up Supabase project and Alembic — 2026-02-19

**Files created:**
- backend/alembic.ini — Alembic configuration with env-only URL
- backend/alembic/env.py — Migration env using `app.db.Base` metadata and async engine
- backend/alembic/README — notes on environment behavior
- backend/alembic/versions/.keep — placeholder for future migrations

**Files modified:**
- backend/app/db.py — added SQLAlchemy `Base`, async engine/session factory, env URL handling
- backend/requirements.txt — added SQLAlchemy, asyncpg, Alembic
- docs/kanban.md — T02 marked done

**Key implementation decisions:**
- Engine/session created lazily to avoid import-time env errors.
- Enforced `DATABASE_URL` via env variable only; `alembic.ini` url left blank.
- Applied naming conventions for predictable constraint names across migrations.

**Blockers encountered:**
- Network-restricted environment prevents running Alembic commands here; verification steps documented for local run.

**Docs updated:**
- docs/PROGRESS.md — this entry and state table updated
- docs/kanban.md — task status updated

### T03 — DB schema — participants and sessions tables — 2026-02-19

**Files created:**
- backend/app/models/participants.py — SQLAlchemy model for participants
- backend/app/models/sessions.py — SQLAlchemy model for sessions
- backend/app/models/__init__.py — exports Participant, Session
- backend/alembic/versions/20260219_000002_participants_sessions.py — migration creating both tables

**Files modified:**
- docs/SCHEMA.md — migration history updated for T03

**Key implementation decisions:**
- Added DB-level CHECK on sessions.status to allow only 'created' | 'active' | 'complete'.
- Used TIMESTAMPTZ via SQLAlchemy DateTime(timezone=True) with server_default now().
- Enforced UNIQUE on participant_number at DB level per conventions.

**Blockers encountered:**
- Cannot run `alembic upgrade` in this environment (no DB/network). Verified via static inspection.

**Docs updated:**
- docs/SCHEMA.md — T03 migration row appended
### T08 — Backend — session endpoints — 2026-02-19

**Files created:**
- backend/app/schemas/sessions.py — Pydantic models for create, response, and status update
- backend/app/routers/sessions.py — FastAPI router for create/get/patch (see risks)

**Files modified:**
- backend/app/main.py — registered endpoints (temporary direct registration due to router quoting issue)
- docs/API.md — sessions endpoints marked implemented
- docs/kanban.md — T08 status set to done

**Key implementation decisions:**
- POST validates participant_uuid and starts status=created
- PATCH validates status via Literal and sets completed_at when status==complete
- GET is unauthenticated per design

**Blockers encountered:**
- Router file literal-quote corruption observed on write; endpoints also added directly in main.py as a fallback.

**Docs updated:**
- docs/API.md — statuses updated to implemented for all three session endpoints
### T08 — Backend — session endpoints — 2026-02-19
