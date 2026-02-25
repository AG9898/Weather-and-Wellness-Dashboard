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
      "title": "Auth hardening — JWT signing key verification path",
      "status": "todo",
      "description": "Upgrade backend auth verification to production-ready signing key handling (Supabase JWT signing key/JWKS flow), including key rotation support and strict claim validation (`exp`, `sub`, issuer/audience policy).",
      "depends_on": [
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
      "id": "T29",
      "title": "Backend reliability — readiness endpoint, structured logging, request IDs",
      "status": "todo",
      "description": "Add readiness checks and structured request logging (without PII) to improve debugging and deployment confidence for hosted usage.",
      "depends_on": [
        "T27"
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
      "id": "T30",
      "title": "E2E verification — Playwright workflow coverage",
      "status": "todo",
      "description": "Add end-to-end Playwright coverage for core RA and participant workflows against running frontend/backend services, including auth guard behavior and end-to-end session completion.",
      "depends_on": [
        "T23",
        "T25",
        "T28",
        "T29"
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
        "E2E test covers RA login, participant creation, session activation, and participant completion flow",
        "Tests assert key status transitions (`created` -> `active` -> `complete`)",
        "Test run command is documented and reproducible",
        "Failures provide actionable traces/screenshots"
      ],
      "updates_docs": [
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T31",
      "title": "Release readiness — production checklist and rollback notes",
      "status": "todo",
      "description": "Create a practical launch checklist covering Render/Vercel env config, DB migration order, auth checks, smoke tests, and rollback/incident notes for lab operations.",
      "depends_on": [
        "T30"
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
      "id": "T32",
      "title": "Phase 2 documentation sync and closeout",
      "status": "todo",
      "description": "Run a final documentation consistency pass so API, schema, conventions, design, and progress docs fully match implemented Phase 2 behavior and deployment reality.",
      "depends_on": [
        "T31"
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
