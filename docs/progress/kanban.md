Current kanban for tasks. Historical kanban tasks have been moved to 'kanban_log.md'
Follow current JSON Schema when adding tasks.
---

# Kanban — Phase 4

> This block follows the detailed machine-readable task format with dependencies, docs to read, acceptance criteria, and required doc updates.
> Keep Phase 1 and Phase 2 above unchanged.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 4,
  "phase_status": "in_progress",
  "goal": "Demo launch final prep and beyond: completed initial wave (T54–T70). Phase 4 is ongoing — remaining work now includes UI polish, legacy scoring/import alignment, and the planned dashboard analytics pipeline derived from the reference R analysis.",
  "stack_overview": {
    "frontend": "Next.js (Vercel) + TypeScript + Tailwind",
    "backend": "FastAPI (Python, Render)",
    "database": "Supabase (managed PostgreSQL)",
    "auth": "Supabase Auth (JWT validated in FastAPI)"
  },
  "tasks": [
    {
      "id": "T100",
      "title": "Backend — Auth hardening: role + lab_name claims in FastAPI",
      "status": "done",
      "description": "Extend `backend/app/auth.py` to extract `role` and `lab_name` from the `app_metadata` JWT claim (set admin-side only in Supabase). Add both fields to the `LabMember` Pydantic model. Add a `get_current_admin` FastAPI dependency that calls `get_current_lab_member` and raises HTTP 403 if `role != 'admin'`. Add a `get_current_ra_for_lab(lab_name: str)` factory for lab-scoped access checks (raises 403 if the user's `lab_name` does not match and the user is not admin). Swap `Depends(get_current_lab_member)` to `Depends(get_current_admin)` on admin-only routes in `backend/app/routers/admin.py` (import preview, import commit, export xlsx, export zip, backfill). All existing RA routes that do not require admin remain on `get_current_lab_member`. Default `role` to `'ra'` if missing from `app_metadata` and default `lab_name` to `''` if missing. See RESOLVED-15 in docs/DECISIONS.md.",
      "stack": ["backend"],
      "depends_on": [],
      "read_docs": [
        "docs/DECISIONS.md",
        "docs/API.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "`LabMember` model has `role: str` and `lab_name: str` fields",
        "`get_current_admin` returns LabMember when role='admin' and raises 403 otherwise",
        "All admin-only routes in `admin.py` use `Depends(get_current_admin)`",
        "An RA-role JWT hitting an admin route returns HTTP 403, not 401",
        "An admin-role JWT hitting an admin route succeeds",
        "Missing `app_metadata` in JWT defaults to role='ra' and lab_name='' without a 500"
      ],
      "updates_docs": [
        "docs/PROGRESS.md",
        "docs/API.md"
      ]
    },
    {
      "id": "T101",
      "title": "Backend — Admin invite utility script with role + lab_name assignment",
      "status": "done",
      "description": "Create `backend/scripts/invite_user.py`, a CLI script for admins to invite new users and assign their role and `lab_name`. The script uses the Supabase Python client with the service role key, never the anon key, to: (1) call `supabase.auth.admin.invite_user_by_email(email)` to send an invite link, (2) retrieve the created user's ID, and (3) call `supabase.auth.admin.update_user_by_id(user_id, { 'app_metadata': { 'role': role, 'lab_name': lab_name } })` to set role and `lab_name`. Accept `--email`, `--role` (choices: admin, ra), and `--lab-name` via argparse. Print the user ID on success. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars. Add `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env.example` with a warning that it must never be exposed publicly. See RESOLVED-15 in docs/DECISIONS.md.",
      "stack": ["backend"],
      "depends_on": ["T100"],
      "read_docs": [
        "docs/DECISIONS.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "`backend/scripts/invite_user.py` exists and accepts `--email`, `--role`, and `--lab-name`",
        "Running the script sends an invite email visible in Supabase Studio Auth > Users",
        "The invited user has correct `app_metadata.role` and `app_metadata.lab_name` in Supabase Studio",
        "`SUPABASE_SERVICE_ROLE_KEY` is added to `backend/.env.example` with a warning comment",
        "Script fails clearly when env vars are missing or Supabase returns an error",
        "Script rejects use of the anon key as a substitute for the service role key"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T102",
      "title": "Frontend — Role + lab_name UI gating via session context",
      "status": "done",
      "description": "Gate frontend pages and nav items based on the authenticated user's `role` and `lab_name` from Supabase session `app_metadata`. In `frontend/src/app/(ra)/layout.tsx`, after session check, extract `role` and `lab_name` from `session.user.app_metadata` and pass them via React context created at `src/lib/contexts/RAUserContext.tsx`. In `frontend/src/lib/components/RANavBar.tsx`, consume the context and render the Import-Export nav link only when `role === 'admin'`. For future lab-scoped pages, `lab_name` becomes the gating mechanism for page access or redirects. Add a `403 / Unauthorized` page at `src/app/(ra)/unauthorized/page.tsx` for RA users who access content outside their lab scope. Admin users bypass all lab checks. See RESOLVED-15 in docs/DECISIONS.md.",
      "stack": ["frontend"],
      "depends_on": ["T100"],
      "read_docs": [
        "docs/DECISIONS.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "`RAUserContext` exists and provides `role` and `lab_name` to RA layout children",
        "Import-Export nav link is visible only when `role === 'admin'` and hidden for `role === 'ra'`",
        "Navigating directly to `/import-export` as an RA user redirects to `/unauthorized` and backend returns 403",
        "`/unauthorized` renders a clear message and a link back to `/dashboard`",
        "Admin users see the Import-Export link and can access the page",
        "Context values update correctly after sign-out and sign-in as a different user"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T104",
      "title": "Backend — DB migration: 4 misokinesia tables",
      "status": "done",
      "description": "Write a new Alembic migration file in `backend/alembic/versions/` following the existing naming convention (e.g. `YYYYMMDD_000001_misokinesia_tables.py`). Create 4 tables: (1) `misokinesia_test_sets` — reusable stimulus configurations with fields: test_set_id UUID PK, name VARCHAR, version VARCHAR, description TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(). (2) `misokinesia_stimuli` — clip metadata (no video bytes): stimulus_id UUID PK, test_set_id UUID FK→misokinesia_test_sets, storage_path VARCHAR (Supabase Storage object key), filename VARCHAR, duration_ms INTEGER, mime_type VARCHAR DEFAULT 'video/mp4', sort_order INTEGER (1-based fixed playback order), active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(). (3) `misokinesia_participants` — one row per participant session execution: misokinesia_participant_id UUID PK, session_id UUID FK→sessions, participant_uuid UUID FK→participants, test_set_id UUID FK→misokinesia_test_sets, misokinesia_participant_number SERIAL (independent auto-increment, participant-facing ID starting from 1 — independent of the main study participant_number sequence), started_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ nullable, created_at TIMESTAMPTZ DEFAULT now(). (4) `misokinesia_trial_responses` — one row per clip per participant: response_id UUID PK, misokinesia_participant_id UUID FK→misokinesia_participants, session_id UUID FK→sessions, participant_uuid UUID FK→participants, stimulus_id UUID FK→misokinesia_stimuli, display_order INTEGER (position shown, 1-based), plus explicit fixed questionnaire columns (determine column names and integer ranges by reading `reference/Misokinesia Questionnaire.pdf` before writing — use q1, q2… qN pattern matching survey table style), completed_at TIMESTAMPTZ nullable, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(misokinesia_participant_id, stimulus_id). Add indexes on: misokinesia_participants(session_id), misokinesia_participants(participant_uuid), misokinesia_trial_responses(misokinesia_participant_id), misokinesia_trial_responses(stimulus_id). IMPORTANT: Before finalising the migration, read `reference/Misokinesia Questionnaire.pdf`, determine the exact questions and response scales, confirm the column list with the user, then write the migration.",
      "stack": ["backend"],
      "depends_on": ["T103"],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "reference/Misokinesia Questionnaire.pdf"
      ],
      "acceptance_criteria": [
        "Migration file exists in `backend/alembic/versions/` with correct date-prefixed name",
        "All 4 tables are created by `alembic upgrade head` with no errors",
        "misokinesia_participants.misokinesia_participant_number is a SERIAL that auto-increments independently from participants.participant_number",
        "misokinesia_trial_responses has one explicit integer column per questionnaire item (confirmed from the PDF before writing)",
        "UNIQUE constraint on (misokinesia_participant_id, stimulus_id) in misokinesia_trial_responses is present",
        "All FK constraints reference the correct parent tables",
        "All specified indexes are present and correct",
        "`alembic downgrade -1` cleanly drops all 4 tables in reverse order with no errors"
      ],
      "updates_docs": [
        "docs/PROGRESS.md",
        "docs/SCHEMA.md"
      ]
    },
    {
      "id": "T105",
      "title": "Backend — SQLAlchemy models + Pydantic schemas for misokinesia",
      "status": "done",
      "description": "Create SQLAlchemy ORM models and Pydantic request/response schemas for the 4 misokinesia tables added in T104. New model file `backend/app/models/misokinesia.py` with 4 classes: MisokinesiaTestSet, MisokinesiaStimulus, MisokinesiaParticipant, MisokinesiaTrialResponse — following the patterns in `backend/app/models/digitspan.py` and `backend/app/models/surveys.py` (column types, FK declarations, __tablename__). Register the new models in `backend/app/models/__init__.py` so Alembic autogenerate and app startup can discover them. New schema file `backend/app/schemas/misokinesia.py` with at minimum: MisokinesiaClipMeta (stimulus_id, public_url, sort_order, duration_ms), MisokinesiaManifestResponse (misokinesia_participant_id, misokinesia_participant_number, session_id, clips: list[MisokinesiaClipMeta]), MisokinesiaTrialResponseCreate (misokinesia_participant_id, stimulus_id, display_order, q1…qN with integer validation matching the ranges confirmed in T104), MisokinesiaTrialResponseResponse (response_id, is_complete: bool, session_id, created_at) — is_complete signals to the frontend that all stimuli have been answered so it can call PATCH /sessions/{session_id}/status next. ALSO include MisokinesiaEndOfTaskCreate and MisokinesiaEndOfTaskResponse for the end-of-task questionnaire endpoint — see docs/working-misokinesia-add.md End-of-task Questionnaire section for field names, types, and validation rules. Follow the existing Pydantic schema style in `backend/app/schemas/digitspan.py` and `backend/app/schemas/surveys.py`.",
      "stack": ["backend"],
      "depends_on": ["T104"],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/API.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`backend/app/models/misokinesia.py` exists with all 4 model classes",
        "All 4 models registered in `backend/app/models/__init__.py`",
        "`backend/app/schemas/misokinesia.py` exists with MisokinesiaManifestResponse, MisokinesiaTrialResponseCreate, MisokinesiaTrialResponseResponse, MisokinesiaParticipantResponse",
        "MisokinesiaTrialResponseCreate validates qN columns are within the correct integer ranges per the questionnaire",
        "MisokinesiaEndOfTaskCreate and MisokinesiaEndOfTaskResponse schemas exist in misokinesia.py",
        "All model column definitions match the migration exactly (same names, types, nullability)",
        "App imports cleanly with no errors (`python -c 'from app.models import *'`)"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T106",
      "title": "Backend — Anonymous session start + clip manifest endpoint",
      "status": "done",
      "description": "Create `backend/app/routers/misokinesia.py` with `router = APIRouter(prefix='/misokinesia', tags=['misokinesia'])` and register it in `backend/app/main.py`. Implement one endpoint: `POST /misokinesia/start` — RA-triggered, requires `Depends(get_current_lab_member)` (same auth as `POST /sessions/start` in `backend/app/routers/sessions.py`). Returns HTTP 201. Must atomically: (1) create an anonymous participant row in `participants` with no demographics fields set (participant_number auto-assigned via the existing MAX+1 pattern used in sessions.py), (2) create a session row (status='active'), (3) create a misokinesia_participants row (misokinesia_participant_number assigned by SERIAL automatically), (4) query the single active misokinesia_test_sets row and its stimuli ordered by sort_order, (5) construct public Supabase Storage URLs per stimulus: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}` — SUPABASE_URL is already available as a backend env var. Return MisokinesiaManifestResponse with misokinesia_participant_id, misokinesia_participant_number, session_id, and the full ordered clip list. See `backend/app/routers/sessions.py` start_session function for the participant+session creation pattern.",
      "stack": ["backend"],
      "depends_on": ["T105"],
      "read_docs": [
        "docs/API.md",
        "docs/ARCHITECTURE.md",
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`POST /misokinesia/start` returns HTTP 201 with MisokinesiaManifestResponse",
        "Endpoint requires lab-member auth — unauthenticated request returns 401",
        "Response contains misokinesia_participant_id (UUID), misokinesia_participant_number (integer), session_id, and a list of clips ordered by sort_order",
        "Each clip object has stimulus_id, public_url, sort_order, duration_ms",
        "public_url is a valid Supabase Storage public URL (format: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`)",
        "A new anonymous participant row exists in `participants` with no demographics after the call",
        "A new session row (status='active') linked to that participant exists after the call",
        "A new misokinesia_participants row linked to the session exists after the call",
        "misokinesia_participant_number increments by 1 on each successive call",
        "Router registered in `backend/app/main.py` and reachable at `/misokinesia/start`"
      ],
      "updates_docs": [
        "docs/PROGRESS.md",
        "docs/API.md"
      ]
    },
    {
      "id": "T107",
      "title": "Backend — Trial response submission + end-of-task endpoints",
      "status": "done",
      "description": "Add two endpoints to `backend/app/routers/misokinesia.py`. (1) `POST /misokinesia/participants/{participant_id}/responses` — participant-facing, no auth required (same pattern as `POST /digitspan/runs` in `backend/app/routers/digitspan.py` which has no auth dependency). Returns HTTP 201. Validates: misokinesia_participants row exists for {participant_id}; stimulus_id belongs to the test_set assigned to that participant; no duplicate response already exists for this (participant_id, stimulus_id) pair — catch the UNIQUE constraint violation and return a clean HTTP 409 rather than letting it bubble as a 500; all qN values are within valid integer ranges. On success, create a misokinesia_trial_responses row. After inserting, check whether all stimuli in the participant's test_set now have a response row — if yes, set misokinesia_participants.completed_at = now() server-side. Return MisokinesiaTrialResponseResponse (includes session_id and is_complete). (2) `PATCH /misokinesia/participants/{participant_id}/end-of-task` — participant-facing, no auth. Accepts MisokinesiaEndOfTaskCreate body. Validates that misokinesia_participants.completed_at is set (all 29 per-clip responses submitted) — return HTTP 409 if not. On success, writes the 4 end-of-task fields to the misokinesia_participants row and returns MisokinesiaEndOfTaskResponse. The frontend calls this endpoint after the final per-clip questionnaire, then calls `PATCH /sessions/{session_id}/status` to mark the session complete. See docs/working-misokinesia-add.md End-of-task Questionnaire section for full field specs.",
      "stack": ["backend"],
      "depends_on": ["T106"],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`POST /misokinesia/participants/{participant_id}/responses` returns HTTP 201 with MisokinesiaTrialResponseResponse on valid input",
        "Endpoint requires no auth — an unauthenticated request with a valid participant_id succeeds",
        "Submitting a duplicate (same participant_id + stimulus_id) returns HTTP 409",
        "Submitting a stimulus_id not belonging to the participant's test_set returns HTTP 422",
        "qN values outside valid range are rejected with HTTP 422",
        "After the 29th (final) response is submitted, misokinesia_participants.completed_at is set automatically",
        "Response body includes session_id so the frontend can call PATCH /sessions/{session_id}/status",
        "Submitting a response after all stimuli are already answered returns HTTP 409",
        "`PATCH /misokinesia/participants/{participant_id}/end-of-task` returns HTTP 200 with MisokinesiaEndOfTaskResponse on valid input",
        "End-of-task endpoint requires no auth",
        "End-of-task endpoint returns HTTP 409 when misokinesia_participants.completed_at is null",
        "End-of-task fields are written to the misokinesia_participants row on success"
      ],
      "updates_docs": [
        "docs/PROGRESS.md",
        "docs/API.md"
      ]
    },
    {
      "id": "T108",
      "title": "Backend — Tests for misokinesia endpoints",
      "status": "done",
      "description": "Create `backend/tests/test_misokinesia.py` following the patterns in existing backend test files. Write tests covering: happy path (start → submit all N trial responses → end-of-task → session complete), validation errors, and edge cases. Use the same test client and DB fixture patterns as the existing test suite. Test cases must include: (1) POST /misokinesia/start returns HTTP 201 with valid manifest, correct clip count, and clips ordered by sort_order; (2) POST /misokinesia/start requires auth — unauthenticated request returns 401; (3) misokinesia_participant_number increments correctly across two successive start calls; (4) POST /responses returns HTTP 201 for a valid trial with no auth required; (5) duplicate response (same participant_id + stimulus_id) returns 409; (6) response with out-of-range qN value returns 422; (7) response with stimulus_id not in the participant's test_set returns 422; (8) after submitting the final (29th) response, misokinesia_participants.completed_at is set; (9) submitting a response when all stimuli are already answered returns 409; (10) PATCH /end-of-task returns 200 with valid payload when completed_at is set; (11) PATCH /end-of-task returns 409 when completed_at is null; (12) PATCH /end-of-task with stronger_responses_timing present but stronger_responses false/null returns 422. See docs/working-misokinesia-add.md End-of-task Questionnaire section for endpoint spec.",
      "stack": ["backend"],
      "depends_on": ["T107"],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`backend/tests/test_misokinesia.py` exists",
        "All listed test cases (including end-of-task cases 10–12) are present and pass",
        "`pytest backend/tests/test_misokinesia.py` exits 0 with no failures or errors",
        "No existing tests are broken by the new test file"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T109",
      "title": "Frontend — Misokinesia RA page, dock navigation, and API wrappers",
      "status": "done",
      "description": "Three parts: (1) Create a new dedicated RA page at `frontend/src/app/(ra)/misokinesia/page.tsx` (URL: /misokinesia). This page lives inside the (ra) route group so it inherits the RA auth guard from `frontend/src/app/(ra)/layout.tsx`. The page is intentionally minimal for now — a hero zone with a 'Start Misokinesia Session' button and placeholder text ('Participant statistics and KPIs coming soon'). The button should have a visually distinct aesthetic from the 'Start New Entry' button on the dashboard — consider a different accent color (e.g. a teal/green-adjacent UBC accent rather than UBC blue) or a different button shape/weight. On click: call POST /misokinesia/start, receive MisokinesiaManifest, then navigate to `/misokinesia/{misokinesia_participant_id}` passing the manifest via router state or sessionStorage. Show loading and inline error states on the button. (2) Update `frontend/src/lib/components/RAFloatingChrome.tsx`: add a misokinesia entry to the DOCK_ITEMS array — `{ href: '/misokinesia', label: 'Misokinesia', icon: Video }` (import Video from lucide-react alongside the existing icons); update `shouldShowRAFloatingChrome()` to return true for `/misokinesia` in addition to the existing routes. (3) Add TypeScript types and API wrapper functions to `frontend/src/lib/api/index.ts`: MisokinesiaClipMeta (stimulus_id, public_url, sort_order, duration_ms), MisokinesiaManifest (misokinesia_participant_id, misokinesia_participant_number, session_id, clips: MisokinesiaClipMeta[]), MisokinesiaTrialResponsePayload (stimulus_id, display_order, q1...qN), MisokinesiaTrialResponseResult (response_id, is_complete: bool, session_id), MisokinesiaEndOfTaskPayload, MisokinesiaEndOfTaskResult; startMisokinesiaSession() → Promise<MisokinesiaManifest>; submitMisokinesiaTrialResponse(participantId, payload) → Promise<MisokinesiaTrialResponseResult>; submitMisokinesiaEndOfTask(participantId, payload) → Promise<MisokinesiaEndOfTaskResult>. Session completion reuses the existing patchSessionStatus() — no new complete wrapper needed. See docs/working-misokinesia-add.md for end-of-task payload type specs. Also create the participant task route folder `frontend/src/app/misokinesia/[misokinesia_participant_id]/` (outside the (ra) group, no auth guard — participants access these pages directly) so the navigation target exists.",
      "stack": ["frontend"],
      "depends_on": ["T106"],
      "read_docs": [
        "docs/styleguide.md",
        "docs/CONVENTIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "New page exists at `frontend/src/app/(ra)/misokinesia/page.tsx` and is accessible at /misokinesia when authenticated",
        "Navigating to /misokinesia while unauthenticated redirects to /login (inherited from RA layout)",
        "Page renders a hero zone with a 'Start Misokinesia Session' button and a placeholder KPI note",
        "Button has a visually distinct style from the 'Start New Entry' button on /dashboard",
        "Clicking the button calls startMisokinesiaSession() and navigates to /misokinesia/{id} on success",
        "Button shows a loading state while the API call is in-flight",
        "Button shows an inline error message on failure without navigating away",
        "RAFloatingChrome DOCK_ITEMS includes a misokinesia entry with href='/misokinesia', label='Misokinesia', and a Video icon",
        "shouldShowRAFloatingChrome('/misokinesia') returns true",
        "The floating dock is visible on /misokinesia and the misokinesia item is highlighted as active",
        "The floating dock is still visible and correct on /dashboard and /import-export (no regressions)",
        "startMisokinesiaSession(), submitMisokinesiaTrialResponse(), and submitMisokinesiaEndOfTask() wrappers exist in api/index.ts with correct TypeScript types",
        "MisokinesiaManifest type includes session_id; MisokinesiaTrialResponseResult includes is_complete and session_id",
        "No new complete wrapper added — session completion reuses the existing patchSessionStatus()",
        "Participant task route folder `frontend/src/app/misokinesia/[misokinesia_participant_id]/` exists"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },s
    {
      "id": "T110",
      "title": "Frontend — MisokinesiaVideoPlayer placeholder component",
      "status": "done",
      "description": "Create `frontend/src/lib/components/MisokinesiaVideoPlayer.tsx`. This is a PLACEHOLDER implementation — real mp4 video files are not yet available. The component renders a styled box displaying 'Clip [stimulusIndex] of [totalStimuli]' as a centered message, with a 'Continue' button that triggers the onEnded callback. The component interface must be designed for easy future swap to a real <video> element: accept props `{ stimulusIndex: number, totalStimuli: number, publicUrl: string, onEnded: () => void }` — publicUrl is accepted but ignored in the placeholder. Style the placeholder to occupy a consistent height (e.g. a fixed-height card or 16:9 aspect box) so the layout does not shift when replaced by a real video. Follow the existing component style in `frontend/src/lib/components/` for dark/light mode compatibility and Tailwind class conventions (see `docs/styleguide.md`).",
      "stack": ["frontend"],
      "depends_on": ["T109"],
      "read_docs": [
        "docs/styleguide.md",
        "docs/CONVENTIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`frontend/src/lib/components/MisokinesiaVideoPlayer.tsx` exists and exports a default component",
        "Component renders a styled box showing 'Clip N of M' and a 'Continue' button",
        "Clicking 'Continue' calls the onEnded prop",
        "Component accepts the publicUrl prop without errors (even though it is not used in the placeholder)",
        "Component renders correctly in both light and dark mode",
        "Component has a fixed/consistent height so layout does not shift when real video replaces it"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T111",
      "title": "Frontend — MisokinesiaQuestionnaire + MisokinesiaEndOfTaskForm components",
      "status": "done",
      "description": "Create two components. (1) `frontend/src/lib/components/MisokinesiaQuestionnaire.tsx` — renders the fixed per-clip questionnaire (4 questions, shown after every clip). Question text and response scales come from `reference/Misokinesia Questionnaire.pdf`. Follow the patterns in `frontend/src/lib/components/SurveyForm.tsx` for layout (question above answer options), radio button inputs, required-answer validation before submit, and submit handling. Props: `{ misokinesiaParticipantId: string, stimulusId: string, displayOrder: number, onComplete: () => void }`. On submit: call submitMisokinesiaTrialResponse, then call onComplete. Show an inline error message if the API call fails (do not navigate away). Show a loading state on the submit button while the call is in-flight. (2) `frontend/src/lib/components/MisokinesiaEndOfTaskForm.tsx` — renders the end-of-task questionnaire shown ONCE after all 29 per-clip questionnaires are complete (before the completion screen). See docs/working-misokinesia-add.md End-of-task Questionnaire section for the exact fields, question text, and input types. Props: `{ misokinesiaParticipantId: string, onComplete: () => void }`. On submit: call submitMisokinesiaEndOfTask(), then call onComplete. All fields are optional. Show loading and inline error states.",
      "stack": ["frontend"],
      "depends_on": ["T110"],
      "read_docs": [
        "docs/styleguide.md",
        "docs/CONVENTIONS.md",
        "reference/Misokinesia Questionnaire.pdf",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`frontend/src/lib/components/MisokinesiaQuestionnaire.tsx` exists and exports a default component",
        "All 4 per-clip questionnaire items from the PDF are rendered with correct question text and 1–5 response options",
        "Submit button is disabled until all required questions are answered",
        "On submit, calls submitMisokinesiaTrialResponse with correct payload (stimulusId, displayOrder, q1…qN values)",
        "onComplete is called after a successful submission",
        "API errors are displayed inline without navigating away",
        "Submit button shows a loading state during the API call",
        "`frontend/src/lib/components/MisokinesiaEndOfTaskForm.tsx` exists and exports a default component",
        "Renders all 3 end-of-task question groups (fidgeting text, emotions text, stronger-responses binary + conditional timing options)",
        "stronger_responses_timing options are only shown when stronger_responses is Yes",
        "All fields are optional — submit is never blocked by unanswered fields",
        "On submit, calls submitMisokinesiaEndOfTask() with correct payload then calls onComplete"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T112",
      "title": "Frontend — Misokinesia task page (full single-page state machine)",
      "status": "done",
      "description": "Create `frontend/src/app/misokinesia/[misokinesia_participant_id]/page.tsx`. This is the main participant-facing task page. It is a single-page state machine — no URL transitions between clips. States: `intro` → `playing` → `questionnaire` → (loop back to playing for next clip) → `end_of_task` → `complete`. On mount: retrieve the manifest from router state or sessionStorage (set in T109); if unavailable, re-fetch via the API. Track `currentClipIndex` (0-based) in React state. In `playing` state: render MisokinesiaVideoPlayer with the current clip; on onEnded transition to `questionnaire`. In `questionnaire` state: render MisokinesiaQuestionnaire with the current clip's stimulusId and displayOrder (currentClipIndex + 1); on onComplete: if more clips remain increment currentClipIndex and transition back to `playing`; if is_complete is true (final submission) transition to `end_of_task`. In `end_of_task` state: render MisokinesiaEndOfTaskForm; on onComplete transition to `complete`. In `complete` state: call the existing `PATCH /sessions/{session_id}/status` endpoint with status='complete', then show the completion screen. Show a progress indicator ('Clip N of 29') in both playing and questionnaire states (not in end_of_task or complete). Reference `frontend/src/app/session/[session_id]/digitspan/page.tsx` for the established multi-phase state machine pattern in this codebase. See docs/working-misokinesia-add.md for the full state machine spec and end-of-task details.",
      "stack": ["frontend"],
      "depends_on": ["T111"],
      "read_docs": [
        "docs/styleguide.md",
        "docs/CONVENTIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`frontend/src/app/misokinesia/[misokinesia_participant_id]/page.tsx` exists",
        "Page renders an intro state with a 'Begin' button before the first clip",
        "After 'Begin', cycles through all clips: video placeholder → per-clip questionnaire → next clip",
        "Progress indicator ('Clip N of 29') is visible and accurate during playing and questionnaire states",
        "After the final per-clip questionnaire submission (is_complete=true), page transitions to end_of_task state (NOT directly to complete)",
        "In end_of_task state, MisokinesiaEndOfTaskForm is rendered; on form submission page transitions to complete",
        "In complete state, patchSessionStatus is called and the completion screen is shown",
        "No URL change occurs between clips (single-page state machine)",
        "Manifest re-fetch fallback works if router state is unavailable"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T113",
      "title": "Frontend — Misokinesia completion screen",
      "status": "done",
      "description": "Implement the `complete` state within `frontend/src/app/misokinesia/[misokinesia_participant_id]/page.tsx` (added in T112). The complete state is entered after the end-of-task form is submitted (NOT directly after the final per-clip questionnaire — see docs/working-misokinesia-add.md for the full flow). When the complete state is entered: call the existing `patchSessionStatus(sessionId, 'complete')` API wrapper (the same wrapper used by digitspan at `frontend/src/app/session/[session_id]/digitspan/page.tsx` — no new API function needed). On success, display a centered 'Thank you — the session is complete' message. Include a 'Return to Dashboard' button that calls `router.push('/dashboard')`. Show a loading state while the PATCH is in-flight. If the PATCH fails, show an inline error with a retry button. Follow the visual style used by the existing session complete page at `frontend/src/app/session/[session_id]/complete/page.tsx` for reference.",
      "stack": ["frontend"],
      "depends_on": ["T112"],
      "read_docs": [
        "docs/styleguide.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "Completion state is entered after the end-of-task form is submitted (not directly after the final per-clip questionnaire)",
        "Completion state displays a 'Thank you' message",
        "'Return to Dashboard' button navigates to /dashboard",
        "Loading state shown while patchSessionStatus is in-flight",
        "If patchSessionStatus errors, an inline error message and retry button are shown",
        "Session status in the DB is 'complete' after the page reaches this state successfully"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T114",
      "title": "Frontend — Tests for misokinesia flow",
      "status": "todo",
      "description": "Write frontend tests for the misokinesia feature following the patterns of existing frontend test files. Cover: (1) RA dashboard renders 'Start Misokinesia' button and clicking it calls the startMisokinesiaSession API wrapper; (2) MisokinesiaVideoPlayer placeholder renders the clip index and triggers onEnded when Continue is clicked; (3) MisokinesiaQuestionnaire renders all 4 question items, blocks submit until all answered, calls submitMisokinesiaTrialResponse on submit, then calls onComplete; (4) the task page advances from playing → questionnaire on onEnded, then from questionnaire → playing (next clip) on onComplete for non-final clips; (5) after the 29th per-clip questionnaire (is_complete=true), page transitions to end_of_task — NOT complete; (6) MisokinesiaEndOfTaskForm renders all 3 question groups, stronger_responses_timing options only appear when stronger_responses is Yes, calling submitMisokinesiaEndOfTask on submit then onComplete; (7) after end-of-task form submission, page transitions to complete; (8) progress indicator shows correct 'Clip N of 29' during playing/questionnaire states; (9) completion screen renders correctly and 'Return to Dashboard' navigates to /dashboard. See docs/working-misokinesia-add.md for the full state machine and end-of-task specs.",
      "stack": ["frontend"],
      "depends_on": ["T113"],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "All listed test cases are present and pass",
        "Frontend test suite exits with no failures",
        "No existing tests are broken"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T115",
      "title": "Infra — Supabase Storage public bucket setup + stimuli seed data",
      "status": "todo",
      "description": "Set up the Supabase Storage bucket for misokinesia video clips and seed the stimulus metadata. (1 - implemented as a side task in T112 [Please check that it is correct]) In the Supabase dashboard (or via migration/seed script), create a bucket named `misokinesia-stimuli` with public access enabled — public access ensures video URLs are immediately resolvable with no signed-URL generation latency and no token expiry. (2) Upload the ~29 mp4 clip files when they become available; in the meantime, uploading placeholder or dummy files is fine. (3) Write a seed SQL script or Python seed script that inserts one row into `misokinesia_test_sets` (name='v1', version='1.0', active=true) and 29 rows into `misokinesia_stimuli` with correct: test_set_id, storage_path (filename only, e.g. 'clip_01.mp4'), filename, duration_ms (use the known durations — ~15000ms each, longest 33000ms), mime_type='video/mp4', sort_order 1–29, active=true. Public URL pattern to verify: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`. This task can run in parallel with T109–T114 once T104 is complete.",
      "stack": ["backend", "infra"],
      "depends_on": ["T104"],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/SCHEMA.md",
        "docs/working-misokinesia-add.md"
      ],
      "acceptance_criteria": [
        "`misokinesia-stimuli` Supabase Storage bucket exists with public access enabled",
        "At least one placeholder/dummy mp4 is uploaded and its public URL is directly accessible in a browser with no auth",
        "Seed script/SQL exists in the repo (e.g. `backend/scripts/seed_misokinesia_stimuli.py` or a SQL file)",
        "Running the seed inserts exactly 1 row in misokinesia_test_sets and 29 rows in misokinesia_stimuli",
        "All 29 stimuli rows have correct sort_order (1–29), storage_path, and duration_ms",
        "POST /misokinesia/start returns manifest URLs that are immediately loadable (no 403, no redirect)"
      ],
      "updates_docs": [
        "docs/PROGRESS.md",
        "docs/ARCHITECTURE.md"
      ]
    }
  ]
}
```
