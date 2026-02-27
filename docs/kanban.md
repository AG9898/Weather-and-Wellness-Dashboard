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

> Collapsed summary format: tasks are intentionally reduced to only task number, title, and description.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 2,
  "phase_status": "complete",
  "tasks": [
    {
      "task_number": "T19",
      "title": "Frontend foundation — design tokens and shared layout shell",
      "description": "Create a coherent design foundation for RA and participant routes with shared tokens, layout primitives, and shell components."
    },
    {
      "task_number": "T20",
      "title": "Backend — dashboard summary endpoint for RA home",
      "description": "Add an authenticated RA endpoint that returns dashboard summary metrics for participant/session counts and recent activity."
    },
    {
      "task_number": "T21",
      "title": "Backend — sessions list endpoint with filters and pagination",
      "description": "Add an authenticated RA endpoint to list sessions with pagination and optional filters for dashboard tables."
    },
    {
      "task_number": "T22",
      "title": "Frontend — RA dashboard landing page",
      "description": "Build an RA dashboard page with KPI cards, recent sessions, and quick actions wired to typed API wrappers."
    },
    {
      "task_number": "T23",
      "title": "Frontend — RA participants and sessions UI cleanup",
      "description": "Refactor `/participants` and `/sessions` to align with the shared dashboard visual system and feedback patterns."
    },
    {
      "task_number": "T24",
      "title": "Frontend — participant flow visual cleanup",
      "description": "Polish participant-facing survey/task/completion pages for consistency while preserving instrument wording and behavior."
    },
    {
      "task_number": "T25",
      "title": "Frontend — survey and task UX reliability pass",
      "description": "Improve client-side robustness with loading guards, duplicate-submit prevention, and user-friendly error messaging."
    },
    {
      "task_number": "T26",
      "title": "Backend — API connection hardening (CORS, timeouts, error mapping)",
      "description": "Harden cross-service behavior with env-driven CORS, consistent API errors, and better failure logging."
    },
    {
      "task_number": "T27",
      "title": "Infra — Render backend integration",
      "description": "Set up and verify hosted Render deployment for FastAPI including health checks, env vars, and migration runbook."
    },
    {
      "task_number": "T28",
      "title": "Docs — weather ingestion spec + doc wiring",
      "description": "Add canonical weather-ingestion documentation and wire API/schema/architecture/dev runbooks before implementation."
    },
    {
      "task_number": "T29",
      "title": "DB schema — study_days + weather tables",
      "description": "Add `study_days`, `weather_daily`, and `weather_ingest_runs` schema for day-level weather linkage and ingestion audit history."
    },
    {
      "task_number": "T30",
      "title": "Backend — UBC EOS scrape/parse + POST ingest endpoint",
      "description": "Implement UBC EOS parsing and POST ingest endpoint with dual auth, idempotent upsert, cooldown, and concurrency lock."
    },
    {
      "task_number": "T31",
      "title": "Backend — GET daily weather endpoint (RA-only)",
      "description": "Add RA-only GET endpoint for day-keyed weather reads plus latest ingest-run metadata."
    },
    {
      "task_number": "T32",
      "title": "Infra — GitHub Actions scheduled ingestion",
      "description": "Add GitHub Actions daily scheduler and manual dispatch workflow for weather ingestion with retry handling."
    },
    {
      "task_number": "T33",
      "title": "Ops — configure GitHub Actions recurrence + secrets",
      "description": "Configure ingestion secrets and verify scheduled recurrence semantics with successful manual dispatch."
    },
    {
      "task_number": "T34",
      "title": "Frontend — RA dashboard Weather card + manual Update Weather",
      "description": "Add an RA-only dashboard weather card showing latest ingest status and manual update action via typed API wrappers."
    }
  ]
}
```

---

# Kanban — Phase 3

> This block follows the detailed machine-readable task format with dependencies, docs to read, acceptance criteria, and required doc updates.
> Keep Phase 1 and Phase 2 above unchanged.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 3,
  "phase_status": "in_progress",
  "goal": "Ship the supervised one-click participant flow, participant anonymization, production auth/reliability hardening, and release readiness.",
  "stack_overview": {
    "frontend": "Next.js (Vercel) + TypeScript + Tailwind",
    "backend": "FastAPI (Python, Render)",
    "database": "Supabase (managed PostgreSQL)",
    "auth": "Supabase Auth (JWT validated in FastAPI)"
  },
  "tasks": [
    {
      "id": "T35",
      "title": "DB schema — anonymize participants (drop names)",
      "status": "done",
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
      "id": "T36",
      "title": "Backend — one-click start endpoint (create participant + active session)",
      "status": "done",
      "description": "Add an RA-protected endpoint that creates an anonymous participant and an active session atomically, returning a participant start path for the supervised test flow.",
      "depends_on": [
        "T35"
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
      "id": "T37",
      "title": "Frontend — RA dashboard Start New Entry (auto redirect)",
      "status": "done",
      "description": "Replace the manual participant/session launch sequence with a dashboard button that calls the one-click backend endpoint and redirects into Survey 1 automatically.",
      "depends_on": [
        "T36"
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
      "id": "T38",
      "title": "Frontend — reorder participant flow (surveys first)",
      "status": "done",
      "description": "Update the participant route sequence to run the 4 surveys first, then Digit Span, then completion (surveys: uls8 → cesd10 → gad7 → cogfunc → digitspan → complete).",
      "depends_on": [
        "T37"
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
      "id": "T39",
      "title": "Backend + Frontend — mark session complete after Digit Span",
      "status": "done",
      "description": "Move session completion to the end of the Digit Span submission so the session is only marked complete once all surveys and digit span have finished.",
      "depends_on": [
        "T38"
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
      "id": "T40",
      "title": "Frontend — completion returns to dashboard (supervised)",
      "status": "done",
      "description": "Add an explicit supervised return path from participant completion to the RA dashboard and ensure dashboard statistics refresh to reflect the newly completed session.",
      "depends_on": [
        "T39"
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
      "id": "T41",
      "title": "Auth hardening — JWT signing key verification path",
      "status": "todo",
      "description": "Upgrade backend auth verification to production-ready signing key handling (Supabase JWT signing key/JWKS flow), including key rotation support and strict claim validation (`exp`, `sub`, issuer/audience policy).",
      "depends_on": [
        "T40",
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
      "id": "T42",
      "title": "Backend reliability — readiness endpoint, structured logging, request IDs",
      "status": "todo",
      "description": "Add readiness checks and structured request logging (without PII) to improve debugging and deployment confidence for hosted usage.",
      "depends_on": [
        "T41"
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
      "id": "T43",
      "title": "E2E verification — Playwright workflow coverage",
      "status": "todo",
      "description": "Add end-to-end Playwright coverage for core RA and participant workflows against running frontend/backend services, including auth guard behavior and end-to-end session completion.",
      "depends_on": [
        "T23",
        "T25",
        "T41",
        "T42"
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
      "id": "T44",
      "title": "Release readiness — production checklist and rollback notes",
      "status": "todo",
      "description": "Create a practical launch checklist covering Render/Vercel env config, DB migration order, auth checks, smoke tests, and rollback/incident notes for lab operations.",
      "depends_on": [
        "T43"
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
      "id": "T45",
      "title": "Phase 3 documentation sync and closeout",
      "status": "todo",
      "description": "Run a final documentation consistency pass so API, schema, conventions, design, and progress docs fully match implemented Phase 3 behavior and deployment reality.",
      "depends_on": [
        "T44"
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
        "Progress log captures all Phase 3 tasks and outcomes",
        "Phase 3 in kanban can be marked complete with no unresolved doc drift"
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
