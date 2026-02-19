# Kanban — Phase 1

> This file is machine-readable. The JSON block below is the authoritative task queue
> consumed by the Ralph autonomous development loop. Edit JSON fields only; do not
> restructure the block.
>
> **Ralph usage:**
> 1. Read `AGENTS.md` and `docs/PROGRESS.md` to orient on current state.
> 2. Find the next task where `status == "todo"` and all `depends_on` IDs have `status == "done"`.
> 3. Read each file listed in that task's `read_docs`.
> 4. Set `status = "in_progress"` before writing any code.
> 5. Implement the task and verify all `acceptance_criteria`.
> 6. Update every file listed in `updates_docs`.
> 7. Set `status = "done"` and loop.

## Definition of Done (Global)

- RA can create a participant and see `participant_number` auto-assigned
- RA can create a session, launch participant mode, and observe session status change
- Participant completes full flow end-to-end (digit span + all 4 surveys) without errors
- All data is linked to `participant_uuid` + `session_id` in the Supabase database
- Auto-scoring runs server-side and computed values are stored correctly in the DB
- Lab team can view all stored results via Supabase Studio

---

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 1,
  "stack_overview": {
    "frontend": "SvelteKit + TypeScript + Tailwind",
    "backend": "FastAPI (Python)",
    "database": "Supabase (managed PostgreSQL)",
    "auth": "Supabase Auth (JWT validated in FastAPI)"
  },
  "tasks": [
    {
      "id": "T01",
      "title": "Initialize monorepo structure",
      "status": "done",
      "description": "Create the top-level project layout with frontend/ and backend/ directories. Initialize a SvelteKit + TypeScript + Tailwind project in frontend/ and a FastAPI project in backend/. Add .env.example documenting all required environment variables (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET), a root .gitignore, and a root README. Monorepo vs. split-repo is an open decision — proceed with monorepo assumption until overridden.",
      "depends_on": [],
      "stack": [
        "frontend",
        "backend",
        "infra"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "`cd frontend && npm run dev` starts SvelteKit dev server without errors",
        "`cd backend && uvicorn app.main:app --reload` starts FastAPI without errors",
        ".env.example documents DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET",
        ".gitignore covers node_modules, __pycache__, .env, .svelte-kit, and *.pyc"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T02",
      "title": "Set up Supabase project and Alembic",
      "status": "done",
      "description": "Configure the FastAPI app to connect to Supabase PostgreSQL using SQLAlchemy and the DATABASE_URL from the environment. Initialize Alembic for schema migrations, pointing at the Supabase connection string. Create the base migration environment and verify that `alembic upgrade head` runs cleanly against the Supabase database.",
      "depends_on": [
        "T01"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "`alembic upgrade head` completes without error against the Supabase Postgres instance",
        "`alembic downgrade base` reverses cleanly",
        "DATABASE_URL is read from environment only — never hardcoded",
        "SQLAlchemy Base and async session factory are importable from `app.db`"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T03",
      "title": "DB schema — participants and sessions tables",
      "status": "done",
      "description": "Write SQLAlchemy models and an Alembic migration for the `participants` and `sessions` tables. `participants` uses `participant_uuid` (UUID PK) and `participant_number` (unique ascending int, server-assigned). `sessions` uses `session_id` (UUID PK), `participant_uuid` FK, `status` VARCHAR ('created'/'active'/'complete'), and timestamps.",
      "depends_on": [
        "T02"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Migration creates both tables with correct column types and NOT NULL constraints",
        "FK from sessions.participant_uuid to participants.participant_uuid is enforced at DB level",
        "participant_number is UNIQUE and NOT NULL",
        "Both tables have created_at TIMESTAMPTZ DEFAULT NOW()"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T04",
      "title": "DB schema — digit span tables",
      "status": "done",
      "description": "Write SQLAlchemy models and an Alembic migration for `digitspan_runs` and `digitspan_trials`. `digitspan_runs` stores run_id (UUID PK), session_id FK, participant_uuid FK, total_correct (INT), max_span (INT). `digitspan_trials` stores trial_id (UUID PK), run_id FK, trial_number (INT 1–14), span_length (INT 3–9), sequence_shown (VARCHAR), sequence_entered (VARCHAR), correct (BOOLEAN).",
      "depends_on": [
        "T03"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Migration creates both tables with correct column types",
        "FK from digitspan_trials.run_id to digitspan_runs.run_id is enforced at DB level",
        "FK from digitspan_runs.session_id to sessions.session_id is enforced at DB level",
        "`alembic upgrade head` and `alembic downgrade -1` both succeed cleanly"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T05",
      "title": "DB schema — all four survey tables",
      "status": "done",
      "description": "Write SQLAlchemy models and a single Alembic migration covering `survey_uls8`, `survey_cesd10`, `survey_gad7`, and `survey_cogfunc8a`. Each table stores response_id (UUID PK), session_id FK, participant_uuid FK, raw item columns (r1–rN as SMALLINT), and computed score columns. See docs/SCHEMA.md for full column specs. CogFunc 8a uses 1-5 Likert range (OPEN-02 resolved).",
      "depends_on": [
        "T03"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/SCORING.md",
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "All four survey tables created with correct column types (SMALLINT for items, NUMERIC for computed scores)",
        "FKs to sessions and participants enforced at DB level for all four tables",
        "survey_gad7 includes severity_band VARCHAR column",
        "survey_uls8 includes computed_mean NUMERIC(5,4) and score_0_100 NUMERIC(6,2)"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T06",
      "title": "Auth — stub lab member dependency",
      "status": "done",
      "description": "Implement a stubbed `get_current_lab_member` FastAPI dependency in `backend/app/auth.py` that returns a hardcoded LabMember Pydantic object without contacting Supabase Auth. This unblocks all RA endpoint development while the real JWT validation (T18) is deferred. Mark the stub clearly with a TODO comment referencing T18.",
      "depends_on": [
        "T01"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "`Depends(get_current_lab_member)` can be injected into any router without error",
        "Stub returns a typed LabMember Pydantic model with at least `id` (UUID) and `email` (str) fields",
        "A TODO comment in auth.py explicitly marks this as a stub to be replaced in T18",
        "No Supabase Auth SDK is imported in this task"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T07",
      "title": "Backend — participant CRUD endpoints",
      "status": "done",
      "description": "Implement POST /participants (create), GET /participants (list), and GET /participants/{uuid} (detail) in `backend/app/routers/participants.py`. Server assigns participant_number as the next integer in sequence — it must never be client-supplied. All three endpoints require the `get_current_lab_member` auth dependency from T06.",
      "depends_on": [
        "T03",
        "T06"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "POST /participants creates a participant, auto-assigns participant_number starting from 1, returns ParticipantResponse",
        "participant_number increments correctly for sequential creates with no gaps",
        "GET /participants returns list ordered by participant_number ascending",
        "GET /participants/{uuid} returns 404 for an unknown UUID"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T08",
      "title": "Backend — session endpoints",
      "status": "done",
      "description": "Implement POST /sessions (create), GET /sessions/{session_id} (status check), and PATCH /sessions/{session_id}/status (update status) in `backend/app/routers/sessions.py`. Sessions start with status='created'. POST and PATCH require auth; GET is unauthenticated so the participant page can poll status.",
      "depends_on": [
        "T03",
        "T06"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "POST /sessions creates a session linked to a valid participant_uuid and returns session_id",
        "POST /sessions with unknown participant_uuid returns 404",
        "PATCH /sessions/{id}/status accepts only 'created', 'active', 'complete' and rejects other values with 422",
        "GET /sessions/{session_id} is accessible without an auth token"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T09",
      "title": "Backend — digit span scoring module and endpoint",
      "status": "todo",
      "description": "Implement `backend/app/scoring/digitspan.py` with a pure `score(trials: list[TrialInput]) -> DigitSpanScored` function that computes total_correct and max_span. Implement POST /digitspan/runs in `backend/app/routers/digitspan.py` that accepts raw trial data, validates session is 'active', runs scoring, and persists rows to both digitspan_runs and digitspan_trials.",
      "depends_on": [
        "T04",
        "T08"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/DIGITSPAN.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Scoring function correctly computes total_correct and max_span from a list of trial inputs",
        "POST /digitspan/runs with an active session_id persists one run row and all 14 trial rows",
        "POST /digitspan/runs with a non-active session returns 400 or 409",
        "Unit tests for the scoring function cover: all correct, all wrong, and mixed results"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T10",
      "title": "Backend — all four survey scoring modules and endpoints",
      "status": "todo",
      "description": "Implement scoring modules in `backend/app/scoring/` for uls8.py, cesd10.py, gad7.py, and cogfunc8a.py, each exposing a `score(raw)` function following the exact rules in each instrument's doc (docs/ULS8.md, docs/CESD10.md, docs/GAD7.md, docs/COGFUNC8A.md). Implement POST endpoints for each survey in `backend/app/routers/surveys.py`. Each endpoint validates active session, scores, persists, and returns the scored result. OPEN-02 and OPEN-03 are now RESOLVED — see docs/DECISIONS.md.",
      "depends_on": [
        "T05",
        "T08"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/ULS8.md",
        "docs/CESD10.md",
        "docs/GAD7.md",
        "docs/COGFUNC8A.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "ULS-8: items 3 & 6 reversed (5 − raw), mean computed, 0–100 transform applied and stored",
        "CES-D 10: raw 1-4 stored, items 5 & 8 reversed (4 − raw), negative items (raw − 1), total 0–30 stored",
        "GAD-7: severity_band assigned correctly for all four bands (minimal/mild/moderate/severe)",
        "All four endpoints reject submissions where session status is not 'active'"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCORING.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T11",
      "title": "Frontend — SvelteKit route layout and auth guard",
      "status": "todo",
      "description": "Establish the SvelteKit route structure: a `(ra)/` route group for RA pages with an auth guard layout, and a `session/[session_id]/` route group for unauthenticated participant pages. Implement `+layout.svelte` and `+layout.server.ts` for the RA group that redirect to /login if no auth session is present. Create the typed API wrapper module at `src/lib/api/index.ts`.",
      "depends_on": [
        "T01"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Navigating to any (ra)/ route without auth redirects to /login",
        "Navigating to /session/[any-id] does not require auth",
        "Route group folders exist: src/routes/(ra)/ and src/routes/session/[session_id]/",
        "src/lib/api/index.ts exists with typed fetch wrapper functions and exports at least one placeholder"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T12",
      "title": "Frontend — RA participant management UI",
      "status": "todo",
      "description": "Build the RA-facing participant pages under (ra)/participants/: a list page showing all participants and a create-participant form. The form posts first_name and last_name to POST /participants and displays the auto-assigned participant_number on success. All API calls go through src/lib/api/ wrappers.",
      "depends_on": [
        "T07",
        "T11"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Create participant form submits to backend and displays auto-assigned participant_number on success",
        "Participant list renders participant_number, first_name, last_name in a table ordered by number",
        "Form prevents submission with empty first_name or last_name",
        "No bare fetch calls in component files — all calls go through src/lib/api/"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T13",
      "title": "Frontend — RA session creation and launch UI",
      "status": "todo",
      "description": "Build session management UI under (ra)/sessions/: RA selects a participant, calls POST /sessions to create a session, and is shown the participant session URL (/session/[session_id]). Include a status badge that polls GET /sessions/{id} to display current status. Add a button to set status to 'active' via PATCH /sessions/{id}/status.",
      "depends_on": [
        "T08",
        "T11"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Session creation calls POST /sessions and receives session_id",
        "Generated participant URL is displayed and copyable to clipboard",
        "Status badge updates when session transitions from 'created' to 'active' to 'complete'",
        "RA button triggers PATCH /sessions/{id}/status to set status to 'active'"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T14",
      "title": "Frontend — participant digit span task UI",
      "status": "todo",
      "description": "Build the participant-facing digit span flow under /session/[session_id]/digitspan. See docs/DIGITSPAN.md for full specification including instruction text, practice trial (hardcoded '13579' at span 5), and input behavior. 14 scored trials (spans 3,3,4,4,5,5,6,6,7,7,8,8,9,9). Client manages presentation timing: 1000ms per digit display, 100ms gap between digits, using setTimeout chains. On completion, POST raw trial data to POST /digitspan/runs.",
      "depends_on": [
        "T09",
        "T11"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DIGITSPAN.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Digits display one at a time with 1000ms on-screen and 100ms gap, driven by setTimeout chains (not setInterval)",
        "Participant input is keyboard-only; no mouse interaction is required or used",
        "14 scored trials presented in order: span 3,3,4,4,5,5,6,6,7,7,8,8,9,9",
        "Raw trial data is POSTed to /digitspan/runs after all 14 trials; routing to next survey only after 2xx"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T15",
      "title": "Frontend — ULS-8 and CES-D 10 survey screens",
      "status": "todo",
      "description": "Build survey screens for ULS-8 at /session/[session_id]/uls8 and CES-D 10 at /session/[session_id]/cesd10. Each screen presents exact instrument wording from docs/ULS8.md and docs/CESD10.md with the correct response scale (1-4 Never/Rarely/Sometimes/Often). On submission, POST raw responses (1-4) to the corresponding backend endpoint and advance to the next survey only on a 2xx response. OPEN-03 is now RESOLVED.",
      "depends_on": [
        "T10",
        "T11"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/ULS8.md",
        "docs/CESD10.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "ULS-8 presents all 8 items with 4-point scale labeled Never / Rarely / Sometimes / Often",
        "CES-D 10 presents all 10 items with 4-point scale labeled Never / Rarely / Sometimes / Often (values 1-4)",
        "Neither survey allows form submission until every item has a response selected",
        "Routing to the next step only happens after the backend returns 2xx"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T16",
      "title": "Frontend — GAD-7 and CogFunc 8a survey screens + completion routing",
      "status": "todo",
      "description": "Build survey screens for GAD-7 at /session/[session_id]/gad7 and Cognitive Function 8a at /session/[session_id]/cogfunc. See docs/GAD7.md and docs/COGFUNC8A.md for exact item wording and scales. CogFunc 8a is the final instrument. After CogFunc 8a submits successfully, update session status to 'complete' via PATCH /sessions/{id}/status and route to /session/[session_id]/complete. OPEN-02 is now RESOLVED — CogFunc uses 1-5 scale.",
      "depends_on": [
        "T10",
        "T11"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/GAD7.md",
        "docs/COGFUNC8A.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "GAD-7 presents all 7 items with 4-point scale labeled Never / Rarely / Sometimes / Often (values 1-4)",
        "CogFunc 8a presents all 8 items with 5-point scale labeled Never / Rarely / Sometimes / Often / Very Often (values 1-5)",
        "Neither survey allows partial submission",
        "After successful CogFunc 8a POST, PATCH /sessions/{id}/status sets 'complete' and routes to /session/[session_id]/complete"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T17",
      "title": "Frontend — session completion screen",
      "status": "todo",
      "description": "Build the participant-facing completion screen at /session/[session_id]/complete. Display a thank-you message and instruction to return the device to the RA. No scores or data should be shown to the participant. The page is a dead end — no navigation forward or back.",
      "depends_on": [
        "T16"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Completion page renders a thank-you message and RA-return instruction",
        "No score, computed value, or raw response data is displayed on the page",
        "No forward navigation links or back buttons are present",
        "Page is accessible at /session/[session_id]/complete without auth"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T18",
      "title": "Auth — replace stub with Supabase Auth",
      "status": "todo",
      "description": "Replace the stub in backend/app/auth.py with real Supabase JWT validation: decode and verify the JWT from the Authorization header using SUPABASE_JWT_SECRET, and return a typed LabMember from the token claims. On the frontend, wire the RA route group auth guard to Supabase Auth session management so that login/logout and protected route redirects work against real Supabase Auth tokens.",
      "depends_on": [
        "T06",
        "T11"
      ],
      "stack": [
        "frontend",
        "backend"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "FastAPI get_current_lab_member validates a real Supabase JWT and returns the lab member's id and email from token claims",
        "Expired or invalid JWTs return 401 from all protected endpoints",
        "RA login page authenticates against Supabase Auth and stores the session",
        "Protected (ra)/ routes redirect to /login when the Supabase Auth session is absent or expired"
      ],
      "updates_docs": [
        "docs/DECISIONS.md",
        "docs/PROGRESS.md"
      ]
    }
  ]
}
```
