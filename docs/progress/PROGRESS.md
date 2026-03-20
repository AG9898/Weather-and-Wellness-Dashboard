# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.
> Older entries below may mention superseded dashboard routes such as `getDashboardBundle()` or `/api/ra/dashboard/range`; treat those as historical implementation notes only. The current shipped routing topology lives in `docs/ARCHITECTURE.md`.

---

## Current State

| Field              | Value                                                        |
|--------------------|--------------------------------------------------------------|
| Phase              | 4 (in progress)                                              |
| Tasks completed    | 61 — Phase 4 ongoing                                         |
| Remaining queue    | T114–T115 in kanban.md                                       |
| Tasks in progress  | 0                                                            |
| Last updated       | 2026-03-17                                                   |

---

**Architecture note (2026-02-22):** Project architecture is now standardized on Next.js (Vercel) + FastAPI (Render) + Supabase Postgres. Earlier entries referencing SvelteKit reflect the initial scaffold and are superseded by docs/ARCHITECTURE.md.

---

## Currently In Progress

_No tasks in progress._

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

## T113 — Frontend — Misokinesia completion screen (completed 2026-03-17)

- Complete state was fully implemented as part of T112 (same file). All T113 criteria satisfied:
  - `complete` phase entered only after `MisokinesiaEndOfTaskForm` submits (not directly after final per-clip questionnaire).
  - `completing` guard shows "Saving your results…" while `patchSessionStatus` is in-flight.
  - On error: inline destructive error box + Retry button (via `handleRetry` which increments `sessionPatchAttempt` counter to re-trigger the effect).
  - On success: checkmark icon, "Thank you" heading, "Return to Dashboard" button (`router.push('/dashboard')`).
  - Session status set to `'complete'` in DB on success.

## T112 — Frontend — Misokinesia task page (full single-page state machine) (completed 2026-03-17)

- Implemented `frontend/src/app/misokinesia/[misokinesia_participant_id]/page.tsx` — full participant-facing task page.
- **State machine:** `loading` → `intro` → `playing` → `questionnaire` → (loop ×29) → `end_of_task` → `complete`.
- **Manifest loading:** reads `misokinesia_manifest` from `sessionStorage` on mount, validates participant ID match. Shows an error state if not found (no re-fetch endpoint exists for existing sessions).
- **`playing` state:** renders `MisokinesiaVideoPlayer`; `onEnded` transitions to `questionnaire`.
- **`questionnaire` state:** renders `MisokinesiaQuestionnaire`; on submit result — if `is_complete=true` transitions to `end_of_task`, otherwise increments `currentClipIndex` and returns to `playing`.
- **`end_of_task` state:** renders `MisokinesiaEndOfTaskForm`; on `onComplete` transitions to `complete`.
- **`complete` state:** calls `patchSessionStatus(sessionId, 'complete')` via a `useEffect` triggered by `sessionPatchAttempt` counter (supports retry). Shows loading state while in-flight, inline error + retry button on failure, thank-you screen on success.
- **Progress indicator:** `ProgressIndicator` renders "Clip N of M" during `playing` and `questionnaire` states only.
- **`Return to Dashboard` button** calls `router.push('/dashboard')` from the completion screen.
- Both T112 and T113 acceptance criteria are satisfied by this implementation (complete state is fully implemented).

## T111 — Frontend — MisokinesiaQuestionnaire + MisokinesiaEndOfTaskForm components (completed 2026-03-17)

- Created `frontend/src/lib/components/MisokinesiaQuestionnaire.tsx`.
  - Props: `{ misokinesiaParticipantId, stimulusId, displayOrder, onComplete }`.
  - Renders all 4 per-clip questionnaire items with 1–5 radio scale (Strongly Disagree → Strongly Agree).
  - Submit button disabled until all 4 questions answered; calls `submitMisokinesiaTrialResponse()` and then `onComplete(result)` (passing through the `MisokinesiaTrialResponseResult` so the parent can read `is_complete`).
  - Inline loading and error states on the submit button.
- Created `frontend/src/lib/components/MisokinesiaEndOfTaskForm.tsx`.
  - Props: `{ misokinesiaParticipantId, onComplete }`.
  - Renders 3 question groups: free-text fidgeting field, free-text emotions field, binary Yes/No for stronger_responses.
  - `stronger_responses_timing` radio group conditionally shown only when stronger_responses is Yes.
  - All fields optional — submit is never blocked. Calls `submitMisokinesiaEndOfTask()` then `onComplete()`.
  - Inline loading and error states on the submit button.

## T110 — Frontend — MisokinesiaVideoPlayer placeholder component (completed 2026-03-17)

- Created `frontend/src/lib/components/MisokinesiaVideoPlayer.tsx`.
  - Props: `{ stimulusIndex, totalStimuli, publicUrl, onEnded }` — designed for easy future swap to a real `<video>` element.
  - Renders a 16:9 aspect-ratio card with "Clip N of M" centered and a "Continue" button that fires `onEnded`.
  - `publicUrl` accepted in the interface but unused in the placeholder (intentional).
  - Styled with UBC blue tokens and Tailwind utilities; compatible with light and dark mode via CSS variables.

## T109 — Frontend — Misokinesia RA page, dock navigation, and API wrappers (completed 2026-03-17)

- Created `frontend/src/app/(ra)/misokinesia/page.tsx` — RA-only page at `/misokinesia`.
  - Hero zone with a teal-accented "Start Misokinesia Session" button (distinct from the UBC blue on /dashboard).
  - On click: calls `startMisokinesiaSession()`, stores the manifest in `sessionStorage`, then navigates to `/misokinesia/{misokinesia_participant_id}`.
  - Shows a loading state while in-flight and an inline error on failure.
  - Placeholder KPI section below the hero zone.
- Updated `frontend/src/lib/components/RAFloatingChrome.tsx`:
  - Added `Video` icon import from lucide-react.
  - Added `{ href: "/misokinesia", label: "Misokinesia", icon: Video, adminOnly: false }` to `ALL_DOCK_ITEMS`.
  - Updated `shouldShowRAFloatingChrome()` to return `true` for `/misokinesia`.
- Added to `frontend/src/lib/api/index.ts`:
  - Types: `MisokinesiaClipMeta`, `MisokinesiaManifest`, `MisokinesiaTrialResponsePayload`, `MisokinesiaTrialResponseResult`, `MisokinesiaEndOfTaskPayload`, `MisokinesiaEndOfTaskResult`.
  - Wrappers: `startMisokinesiaSession()`, `submitMisokinesiaTrialResponse()`, `submitMisokinesiaEndOfTask()`.
  - Also added `patchSessionStatus(sessionId, status)` — reusable wrapper for `PATCH /sessions/{id}/status`.
- Created participant task route folder `frontend/src/app/misokinesia/[misokinesia_participant_id]/` with a minimal placeholder page (full implementation in T112).

## T108 — Backend — Tests for misokinesia endpoints (completed 2026-03-17)

- Created `backend/tests/test_misokinesia.py` with 20 tests across 3 test classes, all passing.
- **StartMisokinesiaSessionTests** (5 tests): manifest shape, public URL format, 404 on missing test set, MAX+1 participant_number, `Depends(get_current_lab_member)` on route registration.
- **SubmitTrialResponseTests** (8 tests): valid 201 response, no-auth route check, 404 on unknown participant, 409 on already-complete participant, 422 on stimulus outside test_set, 409 on duplicate (UNIQUE violation), `is_complete=True` and `completed_at` set on final submission, Pydantic-level rejection of out-of-range q values.
- **SubmitEndOfTaskTests** (7 tests): valid 200 with all fields, null fields accepted, 404 on unknown participant, 409 when `completed_at` is null, `stronger_responses_timing` with `stronger_responses=False` → 422, `stronger_responses_timing` with `stronger_responses=None` → 422, no-auth route check.
- All tests use fake `AsyncSession` objects (no live DB); follows `IsolatedAsyncioTestCase` pattern from existing test files.
- No pre-existing tests broken by this addition.

## T107 — Backend — Trial response submission + end-of-task endpoints (completed 2026-03-17)

- Added `POST /misokinesia/participants/{participant_id}/responses` to `backend/app/routers/misokinesia.py` (no auth, HTTP 201).
  - Validates: participant exists (404), not already complete (409), stimulus belongs to participant's test_set (422), UNIQUE constraint on `(participant_id, stimulus_id)` — caught as 409 rather than 500.
  - After insert, counts total active stimuli vs submitted responses; sets `misokinesia_participants.completed_at = func.now()` server-side on the final submission.
  - Returns `MisokinesiaTrialResponseResponse` including `is_complete` (bool) and `session_id`.
- Added `PATCH /misokinesia/participants/{participant_id}/end-of-task` (no auth, HTTP 200).
  - Validates: participant exists (404), `completed_at` is set (409 otherwise).
  - Writes 4 end-of-task fields (`end_fidgeting_text`, `end_emotions_text`, `stronger_responses`, `stronger_responses_timing`) to the `misokinesia_participants` row.
  - Returns `MisokinesiaEndOfTaskResponse` with the updated fields.
  - Pydantic model validator (from T105) already enforces that `stronger_responses_timing` may only be set when `stronger_responses` is true → 422.
- Both endpoints documented in `docs/API.md` with full request/response schemas and error codes.

## T106 — Backend — Anonymous session start + clip manifest endpoint (completed 2026-03-17)

- Created `backend/app/routers/misokinesia.py` with `router = APIRouter(prefix='/misokinesia', tags=['misokinesia'])`.
- Implemented `POST /misokinesia/start` (HTTP 201, requires `Depends(get_current_lab_member)`).
- Endpoint atomically: resolves the single active test set (404 if none), creates an anonymous `participants` row (MAX+1 participant_number), creates an `active` session, creates a `misokinesia_participants` row (misokinesia_participant_number assigned by SERIAL via `server_default`).
- Fetches active stimuli for the test set ordered by `sort_order` and constructs public Supabase Storage URLs: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`.
- Returns `MisokinesiaManifestResponse` (misokinesia_participant_id, misokinesia_participant_number, session_id, clips[]).
- Router registered in `backend/app/main.py`; `python -c 'from app.main import app'` exits cleanly.

## T105 — Backend — SQLAlchemy models + Pydantic schemas for misokinesia (completed 2026-03-17)

- Created `backend/app/models/misokinesia.py` with 4 ORM classes: `MisokinesiaTestSet`, `MisokinesiaStimulus`, `MisokinesiaParticipant`, `MisokinesiaTrialResponse`.
- Column types match the T104 migration exactly: UUID PKs with `default=uuid.uuid4`, SMALLINT for q1–q4, `server_default=text("nextval('misokinesia_participant_number_seq')")` for `misokinesia_participant_number`, nullable TIMESTAMPTZ for `completed_at` and end-of-task fields.
- `MisokinesiaTrialResponse` uses `__table_args__` `UniqueConstraint` on `(misokinesia_participant_id, stimulus_id)` matching the migration constraint name.
- All 4 models registered in `backend/app/models/__init__.py`.
- Created `backend/app/schemas/misokinesia.py` with: `MisokinesiaClipMeta`, `MisokinesiaManifestResponse`, `MisokinesiaParticipantResponse`, `MisokinesiaTrialResponseCreate` (q1–q4 validated 1–5), `MisokinesiaTrialResponseResponse` (includes `is_complete` bool and `session_id`), `MisokinesiaEndOfTaskCreate` (model_validator rejects `stronger_responses_timing` when `stronger_responses` is not true; validates timing against the 4 valid options), `MisokinesiaEndOfTaskResponse`.
- `python -c 'from app.models import *'` and `from app.schemas.misokinesia import *` both exit cleanly.

## T104 — Backend — DB migration: 4 misokinesia tables (completed 2026-03-17)

- Created `backend/alembic/versions/20260317_000001_misokinesia_tables.py`.
- Adds 4 tables: `misokinesia_test_sets`, `misokinesia_stimuli`, `misokinesia_participants`, `misokinesia_trial_responses`.
- `misokinesia_participant_number` uses a dedicated PostgreSQL sequence (`misokinesia_participant_number_seq`) independent of `participants.participant_number`.
- `misokinesia_trial_responses` has 4 per-clip SMALLINT columns (`q1`–`q4`, range 1–5) matching the questionnaire (Strongly Disagree → Strongly Agree): unpleasant, physical discomfort, upset, wanted to stop.
- `misokinesia_participants` includes 4 end-of-task fields: `end_fidgeting_text` (TEXT), `end_emotions_text` (TEXT), `stronger_responses` (BOOLEAN), `stronger_responses_timing` (VARCHAR) — all nullable, collected once per participant at task end.
- UNIQUE constraint on `(misokinesia_participant_id, stimulus_id)` in `misokinesia_trial_responses`.
- Indexes on `misokinesia_participants(session_id)`, `misokinesia_participants(participant_uuid)`, `misokinesia_trial_responses(misokinesia_participant_id)`, `misokinesia_trial_responses(stimulus_id)`.
- `alembic upgrade head` and `alembic downgrade -1` both verified clean.

## T102 — Frontend — Role + lab_name UI gating via session context (completed 2026-03-16)

- Created `frontend/src/lib/contexts/RAUserContext.tsx` — React context providing `{ role, lab_name }` with defaults `role='ra'`, `lab_name=''`.
- Updated `frontend/src/app/(ra)/layout.tsx` to extract `role` and `lab_name` from `session.user.app_metadata` on initial session load and on `onAuthStateChange` events; wraps all RA layout children in `RAUserContext.Provider`. Resets to defaults on sign-out.
- Updated `frontend/src/lib/components/RANavBar.tsx` to consume `useRAUser()` and filter the nav links so the Import / Export link is rendered only when `role === 'admin'`.
- Updated `frontend/src/lib/components/RAFloatingChrome.tsx` to consume `useRAUser()` and include the Export dock item only when `role === 'admin'` (computed in `resolvedItems` useMemo with `role` as a dependency).
- Added `frontend/src/app/(ra)/unauthorized/page.tsx` — 403/Unauthorized page with a "Return to Dashboard" button; inherits the RA auth guard from the layout.
- Updated `frontend/src/app/(ra)/import-export/page.tsx` to call `useRAUser()` and redirect to `/unauthorized` in a `useEffect` if `role !== 'admin'`, providing a client-side guard that complements the backend's HTTP 403.

## T101 — Backend — Admin invite utility script (completed 2026-03-16)

- Created `backend/admin_cli/invite_user.py` — standalone admin CLI for inviting new users and assigning `role` + `lab_name` via Supabase Admin API.
- Folder named `backend/admin_cli/` (not `scripts/`) to distinguish admin operator tools from app-internal scripts in `backend/app/scripts/`.
- Loads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the project root `.env` file via `python-dotenv` (values are never printed or logged).
- Calls `POST /auth/v1/invite` to send the invite email, then `PUT /auth/v1/admin/users/{id}` to set `app_metadata.role` and `app_metadata.lab_name`.
- Accepts `--email`, `--role` (choices: `admin`, `ra`), and `--lab-name` args.
- Rejects use of the anon key: decodes JWT payload without verification and aborts if `role` claim is `anon` rather than `service_role`.
- Fails with a clear message when required env vars are missing or Supabase returns an error.
- Created `backend/.env.example` documenting all required backend env vars including `SUPABASE_SERVICE_ROLE_KEY` with a prominent warning.

## T100 — Backend — Auth hardening: role + lab_name claims in FastAPI (completed 2026-03-16)

- Extended `LabMember` Pydantic model with `role: str` and `lab_name: str`, extracted from `app_metadata` JWT claim.
- `role` defaults to `'ra'` and `lab_name` defaults to `''` when `app_metadata` is absent or missing those keys — no 500 on missing metadata.
- Two roles in use: `admin` (full access) and `ra` (RA; lab membership tracked via `lab_name`, e.g. `ww` for WW + Misokinesia).
- Added `get_current_admin` FastAPI dependency: raises HTTP 403 if `role != 'admin'`.
- Added `get_current_ra_for_lab(lab_name)` factory dependency: admin bypasses, non-admin with wrong `lab_name` gets HTTP 403.
- All 5 admin-only routes in `backend/app/routers/admin.py` swapped to `Depends(get_current_admin)` (import preview, import commit, export xlsx, export zip, backfill).
- Updated existing test fixtures in `test_undo_last_session.py` and `test_dashboard_analytics_router.py` to supply the new required `role` and `lab_name` fields — all 13 undo tests pass.
- Updated `docs/API.md` authentication section and endpoint index (admin routes now show `Admin` auth requirement).

## RC10 — Docs/runbooks — final routing cleanup sync (completed 2026-03-13)

- Audited the active routing docs against the shipped same-origin handlers and backend primitives after `RC03` through `RC09`.
- Updated `docs/ARCHITECTURE.md` so the summary and testing sections describe the shipped analytics layer, the live undo-last-session dashboard control, and the current frontend regression coverage instead of older "planned" wording.
- Updated `docs/CONVENTIONS.md` to require topology regression coverage when removing same-origin handlers/wrappers, document the accepted `KV_REST_*` cache env aliases alongside direct Upstash vars, and align frontend testing guidance with the current Node-runtime Route Handler suite.
- Updated `docs/devSteps.md` to point at the current Alembic head (`20260313_000001`), document that initial dashboard analytics loads should stay snapshot-only, and note that analytics snapshot `404` is now an expected empty-state path rather than a signal to auto-recompute.
- Added the historical-routing note at the top of this file so superseded route names in older progress entries are explicitly preserved as history, not current topology.


