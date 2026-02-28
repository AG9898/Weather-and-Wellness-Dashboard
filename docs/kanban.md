Current kanban for tasks. Historical kanban tasks have been moved to 'kanban_log.md'
Follow current JSON Schema when adding tasks.
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
        "Returning to /dashboard shows updated KPIs"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T41",
      "title": "Frontend infra — Upstash Redis cache + RA JWT verification (Vercel route)",
      "status": "done",
      "description": "Add a Next.js Route Handler on Vercel that verifies Supabase JWTs and serves a cached dashboard bundle from Upstash Redis (Vercel integration), with a live fetch path that refreshes the cache.",
      "depends_on": [
        "T40"
      ],
      "stack": [
        "frontend",
        "infra",
        "auth"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/CONVENTIONS.md",
        "docs/API.md",
        "docs/devSteps.md"
      ],
      "acceptance_criteria": [
        "A new route handler exists at GET /api/ra/dashboard?mode=cached|live (same-origin on Vercel)",
        "Route handler requires Authorization: Bearer <supabase-jwt> and rejects missing/invalid tokens (401)",
        "Cached mode returns quickly using Upstash Redis when available (TTL target: 300s)",
        "Live mode fetches fresh data from Render backend endpoints and writes a refreshed bundle into Redis (bundle includes dashboard summary + today's weather info)",
        "No Redis credentials are exposed to the browser (server-only env vars)"
      ],
      "updates_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/CONVENTIONS.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T42",
      "title": "Frontend — typed API wrappers + RA dashboard stale-while-revalidate",
      "status": "done",
      "description": "Add typed frontend API wrappers for the new cached dashboard route and refactor the RA dashboard to load cached data first, then refresh from live data (stale-while-revalidate).",
      "depends_on": [
        "T41"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/CONVENTIONS.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "RA dashboard uses cached bundle to render initial KPIs quickly when cache exists",
        "RA dashboard triggers a background live refresh and updates the UI when fresh data arrives",
        "All calls use typed wrappers in src/lib/api/ (no bare fetch from components)",
        "Error states are non-technical and do not break core dashboard actions"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T43",
      "title": "Frontend — eliminate extra cold-start fetches on dashboard (WeatherCard)",
      "status": "done",
      "description": "Refactor the dashboard WeatherCard to use the cached/live dashboard bundle for its initial state so it does not independently trigger a cold-start fetch on mount.",
      "depends_on": [
        "T42"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md"
      ],
      "acceptance_criteria": [
        "WeatherCard initial status is sourced from the dashboard bundle (cached/live) rather than an on-mount fetch",
        "WeatherCard displays the latest fetched weather data cleanly (today's summary fields) and is placed at the top of the dashboard",
        "Manual Update Weather action still works and refreshes the displayed status",
        "Dashboard mount performs at most one live backend refresh request path (via the Vercel aggregator)"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T44",
      "title": "Docs/runbook — Vercel Upstash cache setup (env vars + verification)",
      "status": "done",
      "description": "Document the Upstash (Vercel integration) setup, required Vercel env vars, local dev env setup, and a smoke-test checklist for cache hit/miss and auth gating.",
      "depends_on": [
        "T41"
      ],
      "stack": [
        "docs",
        "infra"
      ],
      "read_docs": [
        "docs/ARCHITECTURE.md",
        "docs/devSteps.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "devSteps.md includes a Vercel Upstash cache section with env vars and exact setup steps",
        "Docs clearly distinguish server-only env vars vs NEXT_PUBLIC_* vars",
        "Smoke-test checklist covers cache hit, cache miss, live refresh, and 401 behavior"
      ],
      "updates_docs": [
        "docs/devSteps.md",
        "docs/ARCHITECTURE.md",
        "docs/CONVENTIONS.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T45",
      "title": "Verification — production smoke test and cold-start UX check",
      "status": "done",
      "description": "Validate that the RA dashboard loads quickly from cache on repeated visits and still refreshes correctly from the live backend, including behavior during a Render cold start.",
      "depends_on": [
        "T43",
        "T44"
      ],
      "stack": [
        "frontend",
        "qa",
        "ops"
      ],
      "read_docs": [
        "docs/devSteps.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "A second dashboard visit within 5 minutes renders from cache without waiting on Render",
        "Dashboard still refreshes to live values once the backend responds",
        "No unauthorized access to cached RA data is possible without a valid JWT (401 on missing/invalid token)",
        "Smoke-test steps are executed and results are recorded in PROGRESS.md"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T46",
      "title": "Docs/spec — Phase 3 admin import/export + UI cleanup + consent + demographics + dashboard filtering",
      "status": "done",
      "description": "Write decision-complete docs for the Phase 3 feature set after T45: Import/Export page + backend endpoints, export formats (CSV/XLSX), UI cleanup (remove /participants and /sessions pages), consent gating page (no DB record), demographic attribute mapping, and dashboard filtering scope. Update the core decisions log to allow admin export (CSV/XLSX).",
      "depends_on": [
        "T45"
      ],
      "stack": [
        "docs"
      ],
      "read_docs": [
        "AGENTS.md",
        "docs/DECISIONS.md",
        "docs/PRD.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md",
        "docs/devSteps.md"
      ],
      "acceptance_criteria": [
        "DECISIONS.md permits RA-only Import/Export (CSV/XLSX) in Phase 3 without weakening PII rules",
        "DESIGN_SPEC.md specifies Import/Export page UX (preview + confirm) and removes participants/sessions UI references",
        "API.md contains planned admin endpoints and updated start_path behavior for consent",
        "SCHEMA.md includes planned columns/tables for demographic mapping and imported measures storage",
        "devSteps.md contains setup and smoke test steps for import/export"
      ],
      "updates_docs": [
        "AGENTS.md",
        "docs/DECISIONS.md",
        "docs/PRD.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T47",
      "title": "DB schema — demographics columns + imported measures table (alembic)",
      "status": "todo",
      "description": "Add participant demographic columns (age band, gender, origin, origin_other_text, commute method, commute_method_other_text, time outside, daylight exposure minutes) and add a 1:1 imported measures table for legacy aggregate outcomes. Daylight exposure is stored on participants (derived minutes since the configured daylight-start local time). Use Alembic migration only; update models and SCHEMA.md.",
      "depends_on": [
        "T46"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "Alembic migration adds demographic/exposure columns to participants (nullable), including origin_other_text and commute_method_other_text",
        "Alembic migration adds imported_session_measures (1:1 with sessions) for legacy aggregate values",
        "SQLAlchemy models and Pydantic schemas updated; SCHEMA.md reflects the applied migration"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T47a",
      "title": "Backend infra — study timezone and daylight exposure config",
      "status": "todo",
      "description": "Standardize day-level semantics (study_days date_local, session→study_day linking, weather_daily day linking, dashboard date filtering) on America/Vancouver. Introduce DAYLIGHT_START_LOCAL_TIME (default 06:00) used to compute participants.daylight_exposure_minutes from a session start time. Update any backend constants/services accordingly and verify docs match code assumptions.",
      "depends_on": [
        "T46"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/DECISIONS.md",
        "docs/WEATHER_INGESTION.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Backend uses America/Vancouver for study_days date_local derivation and all day-level joins/filters",
        "DAYLIGHT_START_LOCAL_TIME is supported (default 06:00) and documented; daylight exposure minutes can be computed deterministically",
        "No schema-enforced 1:1 is introduced for participants↔sessions (workflow-only rule)"
      ],
      "updates_docs": [
        "docs/DECISIONS.md",
        "docs/WEATHER_INGESTION.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T48",
      "title": "Backend — admin import preview/commit (CSV/XLSX) with upsert rules",
      "status": "todo",
      "description": "Implement RA-only import endpoints that accept CSV/XLSX uploads, validate rows, present a preview with counts/errors, then commit writes on confirmation. Import upserts participants by participant_number (overwriting demographics) and creates/updates a complete session per participant (workflow 1:1; ambiguous >1 sessions fails). Import links study_day_id from the imported date (America/Vancouver) and stores imported aggregate measures in imported_session_measures with a source_row_json audit payload. Daytime is parsed as a session start time-of-day used to compute participants.daylight_exposure_minutes (minutes since DAYLIGHT_START_LOCAL_TIME).",
      "depends_on": [
        "T47",
        "T47a"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "POST /admin/import/preview validates file and returns counts + row-level issues without writing",
        "POST /admin/import/commit performs DB writes matching the preview (transactional; fails cleanly)",
        "Excel date serials are converted deterministically and interpreted as America/Vancouver study dates",
        "Daytime values (Excel fractions or HH:MM:SS) are parsed deterministically and used to compute daylight_exposure_minutes via DAYLIGHT_START_LOCAL_TIME",
        "Import upsert behavior is documented and tested (create vs update counts match) and does not overwrite native survey/digit span rows"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T49",
      "title": "Backend — admin export (XLSX workbook + zipped CSV)",
      "status": "todo",
      "description": "Implement RA-only export endpoints for current DB data. XLSX: README sheet plus one sheet per table (schema-faithful; includes join keys). CSV: zip containing one CSV per table (schema-faithful; includes join keys). Filenames: 'Weather and wellness - YYYY-MM-DD.xlsx' and '.zip'.",
      "depends_on": [
        "T48"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "GET /admin/export.xlsx returns a workbook with a README sheet plus one sheet per table and correct headers",
        "GET /admin/export.zip returns a zip with one CSV per table and correct headers",
        "Both endpoints require RA auth and do not expose secrets"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T50",
      "title": "Frontend — Import/Export page (upload preview+confirm, export downloads)",
      "status": "todo",
      "description": "Add an RA-only /import-export page. Import section supports drag+drop CSV/XLSX, preview, and explicit confirm before commit. Export section provides XLSX and CSV (zip) downloads with required filenames.",
      "depends_on": [
        "T49"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/API.md",
        "docs/styleguide.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Import preview shows participant/session counts and validation errors before any writes",
        "Confirm import triggers commit and shows a success summary (created vs updated counts)",
        "Export buttons download files with required names and extensions",
        "No bare fetch: all calls go through typed wrappers in src/lib/api/"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T51",
      "title": "Frontend — UI cleanup (remove participants/sessions pages; update nav)",
      "status": "todo",
      "description": "Remove the RA /participants and /sessions pages from the frontend and remove their navigation links. Ensure dashboard remains the primary RA landing page and add a nav link to Import/Export. Start-session demographics are collected via the dashboard flow (not a separate participants editor).",
      "depends_on": [
        "T50"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "No RA routes exist for /participants and /sessions",
        "RANavBar contains Dashboard + Import/Export (and Sign out) only",
        "DESIGN_SPEC.md no longer describes the removed pages"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T51a",
      "title": "Backend — start session requires demographics + daylight exposure compute",
      "status": "todo",
      "description": "Extend POST /sessions/start to accept required participant demographics (age band, gender, origin, commute_method, time_outside; plus origin_other_text/commute_method_other_text when applicable), store them on participants, compute daylight_exposure_minutes, and return start_path for the consent-gated flow.",
      "depends_on": [
        "T47",
        "T47a"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md",
        "docs/DECISIONS.md"
      ],
      "acceptance_criteria": [
        "POST /sessions/start accepts a demographics payload and persists values to participants (no demographics stored on sessions)",
        "If origin or commute_method is Other, the corresponding *_other_text field is required and persisted",
        "participants.daylight_exposure_minutes is computed deterministically from session start local time and DAYLIGHT_START_LOCAL_TIME (default 06:00 America/Vancouver)",
        "start_path returned by /sessions/start is /session/<session_id>/consent"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T51b",
      "title": "Frontend — Start New Entry demographics questionnaire (dashboard)",
      "status": "todo",
      "description": "Update the RA dashboard Start New Entry flow to require a demographics questionnaire before creating a session. Use preset options derived from the legacy XLSX value set; allow free-text when Other is selected (with no-PII UI copy). Call POST /sessions/start with the payload and route to the returned start_path.",
      "depends_on": [
        "T51a"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/API.md",
        "docs/styleguide.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Start New Entry opens a required demographics form with the specified preset options",
        "Origin/commute_method Other requires free-text detail before submit and includes a warning not to enter names/PII",
        "On submit, the dashboard calls the typed API wrapper (no bare fetch) and routes to /session/<id>/consent",
        "Error states are inline and non-technical; form state is preserved on failure"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T52",
      "title": "Frontend + Backend — consent gating page (no DB record)",
      "status": "todo",
      "description": "Add a participant consent screen at /session/[session_id]/consent that gates the flow before Survey 1. Consent is not written to the DB (UI-only). Ensure the participant flow begins at consent and proceeds to Survey 1 only after explicit acceptance.",
      "depends_on": [
        "T51b"
      ],
      "stack": [
        "frontend",
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Participant flow begins at the consent page and requires explicit acceptance to continue",
        "No consent record is stored in Supabase (UI-only gating)"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T53",
      "title": "Dashboard — filtering controls (scope: KPIs + weather)",
      "status": "todo",
      "description": "Add dashboard filtering controls (initially date range) that affect KPI summaries and weather display where applicable. Weather behavior: if range is one day, show that day's weather; if multi-day, show date_to weather context. Cache policy: default view uses cache; filtered views bypass Redis initially.",
      "depends_on": [
        "T52"
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
        "Dashboard provides date-range filtering controls with clear defaults",
        "Backend supports filtered summary reads (GET /dashboard/summary/range) without breaking existing callers",
        "Filtered requests interpret date_from/date_to in America/Vancouver and use inclusive local-day windows",
        "Cache behavior for filtered vs default view is documented and matches implementation"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T54",
      "title": "Verification — import/export + consent + UI cleanup smoke tests",
      "status": "todo",
      "description": "Run end-to-end smoke tests for start-session demographics, consent gating, import preview/commit, export downloads, dashboard filtering, and the cleaned RA navigation. Record results in PROGRESS.md.",
      "depends_on": [
        "T53"
      ],
      "stack": [
        "qa",
        "ops"
      ],
      "read_docs": [
        "docs/devSteps.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "Start New Entry requires demographics and routes to consent; participants row has demographics + daylight_exposure_minutes set",
        "Import preview and commit run successfully on a small sample and the reference XLSX",
        "Exported XLSX and CSV zip contain expected tables/sheets and correct filenames",
        "Consent page gates the participant flow before Survey 1",
        "Dashboard filtering works for single-day and multi-day ranges (weather uses date_to for multi-day)",
        "Removed pages are not accessible and nav reflects the new IA",
        "Results are recorded in PROGRESS.md with dates"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    }
  ]
}
```
