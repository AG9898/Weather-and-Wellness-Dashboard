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

# Kanban — Phase 3 (archived 2026-03-01)

> Archived from `docs/kanban.md` when Phase 4 planning began.
> This block preserves the detailed machine-readable format used during Phase 3.

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
      "id": "T48",
      "title": "Backend — admin import preview/commit (CSV/XLSX) with upsert rules",
      "status": "done",
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
      "status": "done",
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
      "status": "done",
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
      "status": "done",
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
      "status": "done",
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
      "status": "done",
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
      "status": "done",
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
    }
  ]
}
```

---

# Kanban — Phase 3

> Collapsed summary format: archived completed tasks are intentionally reduced to only task number, title, and description.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 3,
  "phase_status": "in_progress",
  "tasks": [
    {
      "task_number": "T35",
      "title": "DB schema — anonymize participants (drop names)",
      "description": "Migrate to anonymous participants by dropping name fields from the participants table and updating backend/frontend contracts accordingly (Participant ID only)."
    },
    {
      "task_number": "T36",
      "title": "Backend — one-click start endpoint (create participant + active session)",
      "description": "Add an RA-protected endpoint that creates an anonymous participant and an active session atomically, returning a participant start path for the supervised test flow."
    },
    {
      "task_number": "T37",
      "title": "Frontend — RA dashboard Start New Entry (auto redirect)",
      "description": "Replace the manual participant/session launch sequence with a dashboard button that calls the one-click backend endpoint and redirects into Survey 1 automatically."
    },
    {
      "task_number": "T38",
      "title": "Frontend — reorder participant flow (surveys first)",
      "description": "Update the participant route sequence to run the 4 surveys first, then Digit Span, then completion (surveys: uls8 → cesd10 → gad7 → cogfunc → digitspan → complete)."
    },
    {
      "task_number": "T39",
      "title": "Backend + Frontend — mark session complete after Digit Span",
      "description": "Move session completion to the end of the Digit Span submission so the session is only marked complete once all surveys and digit span have finished."
    },
    {
      "task_number": "T40",
      "title": "Frontend — completion returns to dashboard (supervised)",
      "description": "Add an explicit supervised return path from participant completion to the RA dashboard and ensure dashboard statistics refresh to reflect the newly completed session."
    },
    {
      "task_number": "T41",
      "title": "Frontend infra — Upstash Redis cache + RA JWT verification (Vercel route)",
      "description": "Add a Next.js Route Handler on Vercel that verifies Supabase JWTs and serves a cached dashboard bundle from Upstash Redis (Vercel integration), with a live fetch path that refreshes the cache."
    },
    {
      "task_number": "T42",
      "title": "Frontend — typed API wrappers + RA dashboard stale-while-revalidate",
      "description": "Add typed frontend API wrappers for the new cached dashboard route and refactor the RA dashboard to load cached data first, then refresh from live data (stale-while-revalidate)."
    },
    {
      "task_number": "T43",
      "title": "Frontend — eliminate extra cold-start fetches on dashboard (WeatherCard)",
      "description": "Refactor the dashboard WeatherCard to use the cached/live dashboard bundle for its initial state so it does not independently trigger a cold-start fetch on mount."
    },
    {
      "task_number": "T44",
      "title": "Docs/runbook — Vercel Upstash cache setup (env vars + verification)",
      "description": "Document the Upstash (Vercel integration) setup, required Vercel env vars, local dev env setup, and a smoke-test checklist for cache hit/miss and auth gating."
    },
    {
      "task_number": "T45",
      "title": "Verification — production smoke test and cold-start UX check",
      "description": "Validate that the RA dashboard loads quickly from cache on repeated visits and still refreshes correctly from the live backend, including behavior during a Render cold start."
    },
    {
      "task_number": "T46",
      "title": "Docs/spec — Phase 3 admin import/export + UI cleanup + consent + demographics + dashboard filtering",
      "description": "Write decision-complete docs for the Phase 3 feature set after T45: Import/Export page + backend endpoints, export formats (CSV/XLSX), UI cleanup (remove /participants and /sessions pages), consent gating page (no DB record), demographic attribute mapping, and dashboard filtering scope. Update the core decisions log to allow admin export (CSV/XLSX)."
    },
    {
      "task_number": "T47",
      "title": "DB schema — demographics columns + imported measures table (alembic)",
      "description": "Add participant demographic columns (age band, gender, origin, origin_other_text, commute method, commute_method_other_text, time outside, daylight exposure minutes) and add a 1:1 imported measures table for legacy aggregate outcomes. Daylight exposure is stored on participants (derived minutes since the configured daylight-start local time). Use Alembic migration only; update models and SCHEMA.md."
    },
    {
      "task_number": "T47a",
      "title": "Backend infra — study timezone and daylight exposure config",
      "description": "Standardize day-level semantics (study_days date_local, session→study_day linking, weather_daily day linking, dashboard date filtering) on America/Vancouver. Introduce DAYLIGHT_START_LOCAL_TIME (default 06:00) used to compute participants.daylight_exposure_minutes from a session start time. Update any backend constants/services accordingly and verify docs match code assumptions."
    }
  ]
}
```

---

# Kanban — Phase 4 (archived 2026-03-04)

> Collapsed summary format. Archived from `docs/kanban.md` when the Phase 4 initial wave (T54–T70) completed and the board was cleared for new tasks.

```json
{
  "project": "Weather & Wellness + Misokinesia Research Web App",
  "phase": 4,
  "phase_status": "in_progress",
  "tasks": [
    {
      "task_number": "T54",
      "title": "DB — Phase 4 schema for legacy-import remapping into survey_* + digitspan_runs",
      "description": "Added data_source column (default native) and legacy-value columns to survey and digitspan tables; added unique-per-session constraints to prevent duplicate imported rows."
    },
    {
      "task_number": "T55",
      "title": "Backend — import commit writes remapped legacy rows into survey_* + digitspan_runs",
      "description": "Import commit upserts imported rows into survey_uls8/cesd10/gad7 and digitspan_runs with data_source=imported; never overwrites native rows; preserves audit trail in imported_session_measures.source_row_json."
    },
    {
      "task_number": "T56",
      "title": "Backend — legacy weather backfill (temp/precip only) from imported sessions",
      "description": "POST /admin/backfill/legacy-weather inserts partial weather_daily rows (temp + precip only) for days with imported session data but no existing weather row; writes one weather_ingest_runs audit row per day; idempotent."
    },
    {
      "task_number": "T57",
      "title": "Backend — one-off Phase 4 backfill for already-imported sessions",
      "description": "Idempotent backfill script that remaps existing imported_session_measures rows into the Phase 4 survey/digitspan schema and runs the legacy weather backfill for missing days; logs created/updated counts per table."
    },
    {
      "task_number": "T58",
      "title": "Backend — range-filter dashboard reads + participants-per-day aggregation",
      "description": "GET /dashboard/summary/range and GET /dashboard/participants-per-day implemented with America/Vancouver inclusive local-day windows; GET /weather/daily extended to include current_precip_today_mm."
    },
    {
      "task_number": "T59",
      "title": "Frontend — range dashboard bundle route handler + typed wrappers",
      "description": "Added Vercel Route Handler GET /api/ra/dashboard/range with JWT verification and typed getDashboardRangeBundle wrapper; live-only (no Redis read path)."
    },
    {
      "task_number": "T60",
      "title": "Frontend — dashboard date-range filter + remove Recent Sessions panel",
      "description": "Added date-range filter UI (presets + custom dates) to dashboard; filtered views update KPIs and weather context; Recent Sessions section removed; default view continues using cached→live SWR."
    },
    {
      "task_number": "T61",
      "title": "Frontend — weather graph (Recharts) + filter wiring",
      "description": "Added temperature and participant-count line chart to dashboard driven by the date-range filter; tooltip shows date, temp, precip, and participant count. (Superseded by T68–T70 which replaced Recharts with Highcharts and unified the weather card.)"
    },
    {
      "task_number": "T62",
      "title": "Frontend — system-default light/dark theme toggle (UBC light palette)",
      "description": "Added light/dark toggle (default=system, persisted in localStorage); UBC-based semantic token mapping in globals.css; ThemeToggle in RANavBar; applies globally to RA and participant pages."
    },
    {
      "task_number": "T63",
      "title": "Frontend — UI polish (dashboard, weather components, surveys, favicon/top bar)",
      "description": "Polished dashboard KPI hierarchy, consistent button hover/focus, survey page legibility, favicon and RANavBar branding updated to ww-mark.png with capsule nav treatment."
    },
    {
      "task_number": "T64",
      "title": "DB — add sunshine_duration_hours column to weather_daily",
      "description": "Alembic migration added sunshine_duration_hours DOUBLE PRECISION NULL to weather_daily; SQLAlchemy model and WeatherDailyItem Pydantic schema updated; GET /weather/daily now returns the field."
    },
    {
      "task_number": "T65",
      "title": "Backend — Open-Meteo fetch service + historical backfill service",
      "description": "fetch_open_meteo() returns daily fields keyed by date_local; run_historical_weather_backfill() applies three-case precedence logic (insert / COALESCE-enhance / skip) with one weather_ingest_runs audit row per affected day; idempotent."
    },
    {
      "task_number": "T66",
      "title": "Backend — POST /weather/backfill/historical endpoint",
      "description": "RA-JWT-protected endpoint that calls the Open-Meteo historical backfill service; defaults start_date=2025-01-01, end_date=today, station_id=3510; returns days_inserted/enhanced/skipped; 422 for invalid range; 502 if Open-Meteo is unavailable."
    },
    {
      "task_number": "T67",
      "title": "Frontend — sunshine_duration_hours in WeatherTrendChart (SUPERSEDED)",
      "description": "Superseded by T68–T70. WeatherTrendChart was removed entirely in favour of the unified Highcharts-based WeatherUnifiedCard."
    },
    {
      "task_number": "T68",
      "title": "Frontend — Install Highcharts + update WeatherDailyItem type + remove Recharts",
      "description": "Installed highcharts and highcharts-react-official; added sunshine_duration_hours: number | null to WeatherDailyItem; removed recharts from dependencies."
    },
    {
      "task_number": "T69",
      "title": "Frontend — WeatherUnifiedCard: unified weather display + Highcharts line chart + internal date filter",
      "description": "Created WeatherUnifiedCard.tsx merging WeatherCard and WeatherTrendChart. Top section: current-day weather summary + Update Weather ingest trigger. Bottom section: 3-series Highcharts chart (Temperature/areaspline with gradient fill, Precipitation/spline/dashed, Sunlight/spline/dotted) with internal preset date-range filter (Study Start / Last 30d / Last 90d / Custom) and per-series toggle buttons. CSS vars read at mount; MutationObserver re-themes on light/dark toggle."
    },
    {
      "task_number": "T70",
      "title": "Frontend — Dashboard page: replace old weather components with WeatherUnifiedCard + simplify range state",
      "description": "Removed WeatherCard, WeatherTrendChart, and dashboard-level date-range filter section. Replaced with WeatherUnifiedCard. Removed all range-related state from the page. KPI labels simplified to static 'Created (7d)' / 'Completed (7d)'. Deleted WeatherCard.tsx."
    }
  ]
}
```
