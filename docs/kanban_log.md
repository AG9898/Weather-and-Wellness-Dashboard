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
