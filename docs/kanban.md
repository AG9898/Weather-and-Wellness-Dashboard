# Kanban — Phase 1

> Collapsed summary format: tasks are intentionally reduced to only task number, title, and description.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 1,
  "phase_status": "complete",
  "tasks": [
    {
      "task_number": "T01",
      "title": "Initialize monorepo structure",
      "description": "Scaffold frontend and backend projects with required env docs, README, and ignore rules."
    },
    {
      "task_number": "T02",
      "title": "Set up Supabase project and Alembic",
      "description": "Wire FastAPI to Supabase Postgres through env configuration and initialize Alembic migrations."
    },
    {
      "task_number": "T03",
      "title": "DB schema — participants and sessions tables",
      "description": "Create participants and sessions models/migration with UUID keys, participant numbering, status, and timestamps."
    },
    {
      "task_number": "T04",
      "title": "DB schema — digit span tables",
      "description": "Create digitspan_runs and digitspan_trials schema with required foreign keys and trial fields."
    },
    {
      "task_number": "T05",
      "title": "DB schema — all four survey tables",
      "description": "Create ULS-8, CES-D 10, GAD-7, and CogFunc 8a survey tables with raw and computed score fields."
    },
    {
      "task_number": "T06",
      "title": "Auth — stub lab member dependency",
      "description": "Add a temporary typed lab-member auth dependency to unblock protected RA endpoint development."
    },
    {
      "task_number": "T07",
      "title": "Backend — participant CRUD endpoints",
      "description": "Implement RA-authenticated participant create/list/detail endpoints with server-assigned participant numbers."
    },
    {
      "task_number": "T08",
      "title": "Backend — session endpoints",
      "description": "Implement session create/status/status-update endpoints with created/active/complete lifecycle support."
    },
    {
      "task_number": "T09",
      "title": "Backend — digit span scoring module and endpoint",
      "description": "Implement pure digit span scoring and POST endpoint that validates active sessions and stores run/trial data."
    },
    {
      "task_number": "T10",
      "title": "Backend — all four survey scoring modules and endpoints",
      "description": "Implement scoring logic and submission endpoints for ULS-8, CES-D 10, GAD-7, and CogFunc 8a."
    },
    {
      "task_number": "T11",
      "title": "Frontend — Next.js route layout and auth guard",
      "description": "Set up RA/participant route groups, auth guard behavior, and typed API wrapper foundation."
    },
    {
      "task_number": "T12",
      "title": "Frontend — RA participant management UI",
      "description": "Build participant list and create form screens for RAs using typed API wrappers only."
    },
    {
      "task_number": "T13",
      "title": "Frontend — RA session creation and launch UI",
      "description": "Build RA session creation, participant launch URL display, status polling, and activation control."
    },
    {
      "task_number": "T14",
      "title": "Frontend — participant digit span task UI",
      "description": "Build full participant digit span flow with exact timing, practice, 14 trials, and backend submission."
    },
    {
      "task_number": "T15",
      "title": "Frontend — ULS-8 and CES-D 10 survey screens",
      "description": "Build ULS-8 and CES-D 10 participant forms with required responses and next-step routing on success."
    },
    {
      "task_number": "T16",
      "title": "Frontend — GAD-7 and CogFunc 8a survey screens + completion routing",
      "description": "Build GAD-7 and CogFunc forms and finalize sessions by marking complete after final submission."
    },
    {
      "task_number": "T17",
      "title": "Frontend — session completion screen",
      "description": "Build participant completion page with thank-you messaging and no score/data exposure."
    },
    {
      "task_number": "T18",
      "title": "Auth — replace stub with Supabase Auth",
      "description": "Replace stub auth with validated Supabase JWT auth and integrate real RA login session handling."
    }
  ]
}
```

---

# Kanban — Phase 2

> This block follows the detailed machine-readable task format with dependencies, docs to read, acceptance criteria, and required doc updates.
> Keep Phase 1 above unchanged.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 2,
  "phase_status": "in_progress",
  "goal": "Ship a polished dashboard-like RA experience and clean participant UI while hardening backend connections, deployment, and production auth.",
  "stack_overview": {
    "frontend": "Next.js (Vercel) + TypeScript + Tailwind",
    "backend": "FastAPI (Python, Render)",
    "database": "Supabase (managed PostgreSQL)",
    "auth": "Supabase Auth (JWT validated in FastAPI)"
  },
  "tasks": [
    {
      "id": "T19",
      "title": "Frontend foundation — design tokens and shared layout shell",
      "status": "done",
      "description": "Create a coherent design foundation for RA and participant routes: spacing/typography/color tokens, reusable page container primitives, and a consistent app shell that replaces scaffold/default styling.",
      "depends_on": [
        "T18"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ],
      "acceptance_criteria": [
        "Shared UI tokens/components exist and are used by at least 3 pages",
        "No default Next.js starter visuals remain in app routes",
        "Desktop and mobile breakpoints render without layout breakage",
        "No direct fetch calls introduced in components"
      ],
      "updates_docs": [
        "docs/CONVENTIONS.md",
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T20",
      "title": "Backend — dashboard summary endpoint for RA home",
      "status": "done",
      "description": "Add an authenticated RA endpoint that returns dashboard summary metrics (total participants, sessions by status, sessions created in last 7 days, sessions completed in last 7 days).",
      "depends_on": [
        "T08",
        "T19"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "GET dashboard summary endpoint exists and requires lab-member auth",
        "Response schema is typed and documented in API.md",
        "Counts match DB state for status values created/active/complete",
        "Unknown/invalid auth token returns 401"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T21",
      "title": "Backend — sessions list endpoint with filters and pagination",
      "status": "done",
      "description": "Add an authenticated RA endpoint to list sessions with pagination and optional filters (`status`, `participant_number`, date range) for dashboard tables.",
      "depends_on": [
        "T08",
        "T20"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Endpoint returns deterministic ordering (newest first)",
        "Supports query params for page/page_size/status/date filters",
        "Input validation rejects invalid status and invalid date ranges",
        "API docs include request params and response schema"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T22",
      "title": "Frontend — RA dashboard landing page",
      "status": "done",
      "description": "Build an RA dashboard home page that consumes dashboard summary and sessions list endpoints, with KPI cards, recent sessions table, quick actions to create participant/session, and clear links/anchors to start a participant session flow.",
      "depends_on": [
        "T20",
        "T21"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Dashboard loads real metrics from typed API wrappers",
        "Recent sessions table renders status badges and participant mapping",
        "Loading, empty, and error states are visible and usable",
        "Navigation links to participants and sessions are present",
        "Homepage includes quick-start links/anchors that take RAs directly to session creation/launch actions"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T23",
      "title": "Frontend — RA participants and sessions UI cleanup",
      "status": "done",
      "description": "Refactor `/participants` and `/sessions` pages to align with dashboard visual system: clearer hierarchy, cleaner forms/tables, consistent feedback patterns, and responsive layout.",
      "depends_on": [
        "T19",
        "T22"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Participant and session pages use shared design primitives from T19",
        "Form submit, success, and error states are consistent with dashboard",
        "Table readability is improved on narrow screens",
        "No regressions in create/activate/copy URL functionality"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T24",
      "title": "Frontend — participant flow visual cleanup",
      "status": "done",
      "description": "Polish participant-facing pages (`digitspan`, all surveys, completion) with consistent spacing, typography, progress context, and clearer interaction affordances while preserving instrument wording and behavior.",
      "depends_on": [
        "T19"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DIGITSPAN.md",
        "docs/ULS8.md",
        "docs/CESD10.md",
        "docs/GAD7.md",
        "docs/COGFUNC8A.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Exact instrument wording and response scales remain unchanged",
        "Digit span flow remains keyboard-first and timing-compliant",
        "Survey pages show clear step context without enabling back-navigation",
        "Completion page stays data-free and participant-safe"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T25",
      "title": "Frontend — survey and task UX reliability pass",
      "status": "done",
      "description": "Improve client-side robustness for participant submissions with standardized loading disable states, retry-safe button behavior, and friendly error messaging for network/API failures.",
      "depends_on": [
        "T24"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/DESIGN_SPEC.md"
      ],
      "acceptance_criteria": [
        "All participant submit actions prevent duplicate submissions while pending",
        "API failure messages are user-readable and non-technical",
        "Recoverable network failures allow retry without losing page state",
        "No bare fetch introduced outside `src/lib/api/`"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T26",
      "title": "Backend — API connection hardening (CORS, timeouts, error mapping)",
      "status": "done",
      "description": "Harden cross-service behavior between Vercel frontend and Render backend by configuring strict allowed origins, standard API error shapes, and backend timeout-safe DB patterns.",
      "depends_on": [
        "T21"
      ],
      "stack": [
        "backend",
        "infra"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/CONVENTIONS.md",
        "docs/API.md"
      ],
      "acceptance_criteria": [
        "CORS origins are environment-driven and least-privilege",
        "Consistent JSON error body format is returned for 4xx/5xx cases",
        "Local and deployed frontend origins can call backend successfully",
        "Connection-related failures are logged with enough context for debugging"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T27",
      "title": "Infra — Render backend integration",
      "status": "done",
      "description": "Set up and verify Render deployment for FastAPI (build/start command, env vars, health check, migration workflow) so Phase 2 can run in hosted mode.",
      "depends_on": [
        "T26"
      ],
      "stack": [
        "backend",
        "infra"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "Render service runs backend and exposes healthy `/health` endpoint",
        "Required env vars are documented and set in Render",
        "Alembic migration runbook for deploy is documented and tested",
        "API base URL references in docs are updated for hosted backend"
      ],
      "updates_docs": [
        "docs/ARCHITECTURE.md",
        "docs/API.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T28",
      "title": "Docs — weather ingestion spec + doc wiring",
      "status": "todo",
      "description": "Add a canonical Phase 2 weather ingestion spec doc and update API/schema/architecture/dev runbooks so the feature is decision-complete before implementation.",
      "depends_on": [
        "T27"
      ],
      "stack": [
        "docs"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/ARCHITECTURE.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "docs/WEATHER_INGESTION.md exists and is decision-complete",
        "docs/API.md includes planned Weather endpoints with full schemas",
        "docs/SCHEMA.md includes planned weather tables and study_days day-linking",
        "docs/ARCHITECTURE.md documents GitHub Actions scheduling and secret ownership",
        "docs/devSteps.md includes setup/verification steps for ingestion"
      ],
      "updates_docs": [
        "docs/WEATHER_INGESTION.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ]
    },
    {
      "id": "T29",
      "title": "DB schema — study_days + weather tables",
      "status": "todo",
      "description": "Add schema for day-level linking and weather ingestion storage: study_days dimension, sessions FK, weather_daily upsert table, and weather_ingest_runs audit table.",
      "depends_on": [
        "T28"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/WEATHER_INGESTION.md"
      ],
      "acceptance_criteria": [
        "Alembic migration creates study_days, weather_daily, and weather_ingest_runs",
        "Idempotency constraints exist for weather_daily (unique per station per day)",
        "Indexes support day-range queries and recent-run debugging",
        "docs/SCHEMA.md migration history is updated"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T30",
      "title": "Backend — UBC EOS scrape/parse + POST ingest endpoint",
      "status": "todo",
      "description": "Implement HTML scraping/parsing for UBC EOS sources and add POST /weather/ingest/ubc-eos with dual auth (LabMember JWT or GitHub Actions shared secret), idempotent daily upserts, cooldown, and concurrency lock.",
      "depends_on": [
        "T29"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/WEATHER_INGESTION.md"
      ],
      "acceptance_criteria": [
        "POST endpoint accepts LabMember JWT or shared-secret header",
        "Ingestion writes weather_ingest_runs with parse_status and parse_errors",
        "weather_daily is upserted per station per study day (idempotent)",
        "Cooldown (429) and per-station advisory lock (409) prevent abuse/concurrency",
        "docs/API.md is updated to implemented after verification"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T31",
      "title": "Backend — GET daily weather endpoint (RA-only)",
      "status": "todo",
      "description": "Add GET /weather/daily?start&end (RA-only) to read day-keyed weather rows for dashboard status and future analyses, including latest ingest run metadata.",
      "depends_on": [
        "T30"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/WEATHER_INGESTION.md"
      ],
      "acceptance_criteria": [
        "Endpoint is RA-protected and validates date range inputs",
        "Response includes ordered day rows and latest run status",
        "Max range guard prevents abusive queries",
        "docs/API.md is updated to implemented after verification"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T32",
      "title": "Infra — GitHub Actions scheduled ingestion",
      "status": "todo",
      "description": "Add a GitHub Actions workflow that triggers daily ingestion by calling the backend endpoint with a shared secret and retry policy suitable for free-tier cold starts.",
      "depends_on": [
        "T31"
      ],
      "stack": [
        "infra",
        "backend"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/WEATHER_INGESTION.md"
      ],
      "acceptance_criteria": [
        "Workflow runs on a daily cron and supports manual dispatch",
        "Workflow uses retrying HTTP call and fails loudly on non-2xx",
        "Required GitHub secrets and Render env vars are documented"
      ],
      "updates_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T33",
      "title": "Ops — configure GitHub Actions recurrence + secrets",
      "status": "todo",
      "description": "Configure GitHub repo secrets and verify scheduled recurrence semantics for the weather ingestion workflow (cron trigger on default branch; manual dispatch for testing).",
      "depends_on": [
        "T32"
      ],
      "stack": [
        "infra",
        "ops"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/WEATHER_INGESTION.md"
      ],
      "acceptance_criteria": [
        "GitHub repo secrets are set (base URL + shared secret)",
        "Render env var WEATHER_INGEST_SHARED_SECRETS is set and matches GitHub secret",
        "Manual run via workflow_dispatch succeeds end-to-end",
        "Cron schedule is confirmed to be active on the default branch"
      ],
      "updates_docs": [
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T34",
      "title": "Frontend — RA dashboard Weather card + manual Update Weather",
      "status": "todo",
      "description": "Add an RA-only dashboard card that shows last ingest status (success/partial/fail), last updated time, and a manual 'Update Weather' button using typed API wrappers (no bare fetch).",
      "depends_on": [
        "T33"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/styleguide.md",
        "docs/WEATHER_INGESTION.md"
      ],
      "acceptance_criteria": [
        "Dashboard shows last attempt/success and parse_status",
        "Manual trigger calls POST ingest with LabMember JWT via typed API wrapper",
        "Loading/success/failure feedback is visible and non-technical",
        "No client-side secret leakage"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T40",
      "title": "DB schema — anonymize participants (drop names)",
      "status": "todo",
      "description": "Migrate to anonymous participants by dropping name fields from the participants table and updating backend/frontend contracts accordingly (Participant ID only).",
      "depends_on": [
        "T34"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "Alembic migration removes participants.first_name and participants.last_name",
        "Participant creation/listing endpoints no longer accept or return names",
        "Docs reflect anonymous participant model (Participant ID only)"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/API.md",
        "docs/PRD.md",
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T41",
      "title": "Backend — one-click start endpoint (create participant + active session)",
      "status": "todo",
      "description": "Add an RA-protected endpoint that creates an anonymous participant and an active session atomically, returning a participant start path for the supervised test flow.",
      "depends_on": [
        "T40"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/DESIGN_SPEC.md"
      ],
      "acceptance_criteria": [
        "POST /sessions/start exists and requires LabMember auth",
        "Endpoint returns session_id, participant_number, and start_path for Survey 1",
        "Session is immediately active so participant submissions are accepted"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T42",
      "title": "Frontend — RA dashboard Start New Entry (auto redirect)",
      "status": "todo",
      "description": "Replace the manual participant/session launch sequence with a dashboard button that calls the one-click backend endpoint and redirects into Survey 1 automatically.",
      "depends_on": [
        "T41"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "No copy-link step is required to start a new participant run",
        "Button uses typed API wrapper only (no bare fetch)",
        "Loading and error states are visible and non-technical"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T43",
      "title": "Frontend — reorder participant flow (surveys first)",
      "status": "todo",
      "description": "Update the participant route sequence to run the 4 surveys first, then Digit Span, then completion (surveys: uls8 → cesd10 → gad7 → cogfunc → digitspan → complete).",
      "depends_on": [
        "T42"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Survey pages route to the correct next step in the new order",
        "No session completion is triggered at the end of CogFunc",
        "Digit Span routes to completion after successful submission"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T44",
      "title": "Backend + Frontend — mark session complete after Digit Span",
      "status": "todo",
      "description": "Move session completion to the end of the Digit Span submission so the session is only marked complete once all surveys and digit span have finished.",
      "depends_on": [
        "T43"
      ],
      "stack": [
        "backend",
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "completed_at is set only after Digit Span succeeds",
        "Completion screen is shown only after session completion is recorded",
        "Dashboard 'Completed' KPIs reflect the new completion on return"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T45",
      "title": "Frontend — completion returns to dashboard (supervised)",
      "status": "todo",
      "description": "Add an explicit supervised return path from participant completion to the RA dashboard and ensure dashboard statistics refresh to reflect the newly completed session.",
      "depends_on": [
        "T44"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "Completion page provides a clear return-to-dashboard action",
        "Returning to /dashboard shows updated KPIs and recent sessions list"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T46",
      "title": "Auth hardening — JWT signing key verification path",
      "status": "todo",
      "description": "Upgrade backend auth verification to production-ready signing key handling (Supabase JWT signing key/JWKS flow), including key rotation support and strict claim validation (`exp`, `sub`, issuer/audience policy).",
      "depends_on": [
        "T45",
        "T18",
        "T27"
      ],
      "stack": [
        "backend",
        "auth"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "JWT validation path supports configured signing-key strategy for production",
        "Expired, tampered, wrong-issuer, and wrong-audience tokens are rejected",
        "Key rotation behavior is documented and test-covered",
        "Auth module remains the only location for provider-specific auth logic"
      ],
      "updates_docs": [
        "docs/CONVENTIONS.md",
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T47",
      "title": "Backend reliability — readiness endpoint, structured logging, request IDs",
      "status": "todo",
      "description": "Add readiness checks and structured request logging (without PII) to improve debugging and deployment confidence for hosted usage.",
      "depends_on": [
        "T46"
      ],
      "stack": [
        "backend",
        "infra"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "Readiness endpoint checks critical dependencies and returns actionable status",
        "Each request has a traceable request ID in logs/response headers",
        "Logs avoid first_name/last_name and other direct identifiers",
        "Failure logs include endpoint and failure category details"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/CONVENTIONS.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T48",
      "title": "E2E verification — Playwright workflow coverage",
      "status": "todo",
      "description": "Add end-to-end Playwright coverage for core RA and participant workflows against running frontend/backend services, including auth guard behavior and end-to-end session completion.",
      "depends_on": [
        "T23",
        "T25",
        "T46",
        "T47"
      ],
      "stack": [
        "frontend",
        "backend",
        "qa"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/devSteps.md"
      ],
      "acceptance_criteria": [
        "E2E test covers RA login, one-click start, participant completion flow, and dashboard refresh",
        "Tests assert key status transitions (`active` -> `complete`)",
        "Test run command is documented and reproducible",
        "Failures provide actionable traces/screenshots"
      ],
      "updates_docs": [
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T49",
      "title": "Release readiness — production checklist and rollback notes",
      "status": "todo",
      "description": "Create a practical launch checklist covering Render/Vercel env config, DB migration order, auth checks, smoke tests, and rollback/incident notes for lab operations.",
      "depends_on": [
        "T48"
      ],
      "stack": [
        "infra",
        "ops"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ],
      "acceptance_criteria": [
        "Checklist includes pre-deploy, deploy, and post-deploy verification steps",
        "Rollback instructions exist for backend and frontend deploys",
        "Critical env vars and secret ownership are explicitly documented",
        "Document is usable by a lab member without implicit context"
      ],
      "updates_docs": [
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T50",
      "title": "Phase 2 documentation sync and closeout",
      "status": "todo",
      "description": "Run a final documentation consistency pass so API, schema, conventions, design, and progress docs fully match implemented Phase 2 behavior and deployment reality.",
      "depends_on": [
        "T49"
      ],
      "stack": [
        "docs"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/DESIGN_SPEC.md",
        "docs/ARCHITECTURE.md",
        "docs/PROGRESS.md"
      ],
      "acceptance_criteria": [
        "No documented endpoint/field conflicts with implemented behavior",
        "Design and UX docs reflect current RA/participant flows",
        "Progress log captures all Phase 2 tasks and outcomes",
        "Phase 2 in kanban can be marked complete with no unresolved doc drift"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/DESIGN_SPEC.md",
        "docs/ARCHITECTURE.md",
        "docs/PROGRESS.md",
        "docs/kanban.md"
      ]
    }
  ]
}
```
