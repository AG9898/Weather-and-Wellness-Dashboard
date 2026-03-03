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
  "phase_status": "planned",
  "goal": "Demo launch final prep: remap legacy imported sessions into first-class tables, add a filter-aware weather graph, and apply final UI polish (including a system-default light/dark toggle).",
  "stack_overview": {
    "frontend": "Next.js (Vercel) + TypeScript + Tailwind",
    "backend": "FastAPI (Python, Render)",
    "database": "Supabase (managed PostgreSQL)",
    "auth": "Supabase Auth (JWT validated in FastAPI)"
  },
  "tasks": [
    {
      "id": "T54",
      "title": "DB — Phase 4 schema for legacy-import remapping into survey_* + digitspan_runs",
      "status": "done",
      "description": "Add schema support for storing imported aggregate values in the canonical survey and digit span tables without fabricating raw item/trial rows. Add a data_source flag, legacy-value columns, and uniqueness constraints to prevent duplicates per session.",
      "depends_on": [
        "T47",
        "T48"
      ],
      "stack": [
        "backend",
        "database"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Alembic migration adds a `data_source` column (default `native`) to survey and digit span run tables used for remapping",
        "Legacy-mean and legacy-total columns exist for ULS-8 / CES-D 10 / GAD-7 as documented in SCHEMA.md",
        "A session can have at most one row in each of: survey_uls8, survey_cesd10, survey_gad7, digitspan_runs (unique by session_id)",
        "Existing native rows remain unchanged and remain the canonical source for their sessions"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/PROGRESS.md",
        "docs/DECISIONS.md"
      ]
    },
    {
      "id": "T55",
      "title": "Backend — import commit writes remapped legacy rows into survey_* + digitspan_runs",
      "status": "done",
      "description": "On admin import commit, upsert imported rows into survey_uls8 / survey_cesd10 / survey_gad7 / digitspan_runs using the Phase 4 schema. Do not fabricate raw survey items or digit span trials. Preserve auditability via imported_session_measures.source_row_json.",
      "depends_on": [
        "T54"
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
        "Import commit upserts digitspan_runs with data_source=imported and total_correct from legacy digit_span_score (0–14); max_span remains null",
        "Import commit upserts survey rows with data_source=imported and legacy-value columns populated; canonical computed fields may remain null where no deterministic mapping exists",
        "If legacy anxiety is an exact integer 0–21, GAD-7 total_score and severity_band are populated; otherwise only legacy_mean is stored",
        "Re-import updates imported rows without overwriting native rows (native rows are treated as conflicts)"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T56",
      "title": "Backend — legacy weather backfill (temp/precip only) from imported sessions",
      "status": "done",
      "description": "Backfill weather_daily for days that do not have UBC-ingested weather, using mean temperature/precipitation from imported legacy sessions grouped by date_local. Do not overwrite existing weather_daily rows.",
      "depends_on": [
        "T55"
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
        "Backfill uses study_days.date_local (America/Vancouver) as the join key and supports a 1:M day↔session relationship",
        "Only current_temp_c and current_precip_today_mm are populated for legacy-backfilled weather_daily rows; all other fields remain null/empty",
        "weather_ingest_runs records the backfill run timestamp as an ingest audit trail without confusing day-linking (date_local remains the analytic join key)",
        "Existing weather_daily rows are never overwritten by legacy backfill"
      ],
      "updates_docs": [
        "docs/WEATHER_INGESTION.md",
        "docs/SCHEMA.md",
        "docs/PROGRESS.md",
        "docs/API.md"
      ]
    },
    {
      "id": "T57",
      "title": "Backend — one-off Phase 4 backfill for already-imported sessions",
      "status": "done",
      "description": "Add an idempotent one-off backfill script that remaps existing imported_session_measures rows into the new Phase 4 survey/digitspan schema and performs the legacy weather backfill for missing days.",
      "depends_on": [
        "T56"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/CONVENTIONS.md",
        "docs/devSteps.md"
      ],
      "acceptance_criteria": [
        "Script is safe to re-run (idempotent) and logs created/updated counts per table",
        "Script never overwrites native rows (data_source=native) and only upserts imported rows (data_source=imported)",
        "Script ensures sessions.study_day_id is set consistently from the session’s local completion date when needed"
      ],
      "updates_docs": [
        "docs/devSteps.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T58",
      "title": "Backend — range-filter dashboard reads + participants-per-day aggregation",
      "status": "done",
      "description": "Implement RA dashboard date-range summary endpoints and per-day participant counts (America/Vancouver inclusive local-day windows). Extend GET /weather/daily response to include precip for tooltips.",
      "depends_on": [
        "T31",
        "T21"
      ],
      "stack": [
        "backend"
      ],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "GET /dashboard/summary/range is implemented and returns range-aware KPI counts for the selected local-day window",
        "GET /dashboard/participants-per-day (planned Phase 4 endpoint) returns per-day participant/session counts aligned to study_days.date_local",
        "GET /weather/daily response includes both current_temp_c and current_precip_today_mm for display/tooltip use",
        "All date_from/date_to semantics use America/Vancouver inclusive local-day windows"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T59",
      "title": "Frontend — range dashboard bundle route handler + typed wrappers",
      "status": "done",
      "description": "Add a Vercel Route Handler that verifies the Supabase JWT and fetches range-filtered dashboard data from the backend (bypassing Redis). Add typed API wrappers for the new route and bundle shape.",
      "depends_on": [
        "T58"
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
        "Route handler verifies Supabase JWT before returning any data",
        "Filtered range bundle bypasses Redis caching by default",
        "All frontend calls use src/lib/api wrappers (no bare fetch from components/pages)"
      ],
      "updates_docs": [
        "docs/ARCHITECTURE.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T60",
      "title": "Frontend — dashboard date-range filter + remove Recent Sessions panel",
      "status": "done",
      "description": "Use Add a date-range filter UI (with presets) to the dashboard. Filtered views update KPIs, weather card context, and the weather graph. Remove the Recent Sessions section from the dashboard.",
      "depends_on": [
        "T59"
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
        "Dashboard provides date-range filter controls with clear defaults (system timezone = America/Vancouver semantics)",
        "Default (unfiltered) dashboard continues using cached→live SWR behavior",
        "Filtered dashboard uses the range bundle and does not show/remove cached data on transient errors",
        "Recent Sessions section is removed and no longer fetches /sessions for dashboard rendering"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T61",
      "title": "Frontend — weather graph (Recharts) + filter wiring",
      "status": "todo",
      "description": "Add a graph view of weather data that is driven by the dashboard date-range filter. Show temperature over time and participant counts per day, with precipitation available in hover/tooltip details.",
      "depends_on": [
        "T60"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/styleguide.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Graph renders a temperature series for the selected range (skipping missing values safely)",
        "Graph shows participant counts per day for the same date range",
        "Graph respects the dashboard filter state and updates with it (no independent fetch)",
        "Tooltip shows date_local + temp + precip (when available) + participant count"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T62",
      "title": "Frontend — system-default light/dark theme toggle (UBC light palette)",
      "status": "todo",
      "description": "Add a light/dark theme toggle (default = system, persisted in localStorage). Base light palette on the UBC color guide; keep references as inspiration (not 1:1 remakes) and preserve the clean, shipped research-tool aesthetic.",
      "depends_on": [
        "T60"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/styleguide.md",
        "docs/shadcn.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Theme default is system (`prefers-color-scheme`) and persisted choice overrides system",
        "All pages use semantic tokens (background/foreground/card/etc.) so the toggle works globally",
        "Theme toggle is available on RA navigation and does not break participant flows"
      ],
      "updates_docs": [
        "docs/styleguide.md",
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T63",
      "title": "Frontend — UI polish (dashboard, weather components, surveys, favicon/top bar)",
      "status": "todo",
      "description": "Polish UI for demo launch: consistent hover/focus interactions for buttons, update WeatherCard and KPI look per provided references (inspiration-only), clean survey page visuals, and update favicon/top bar styling.",
      "depends_on": [
        "T61",
        "T62"
      ],
      "stack": [
        "frontend"
      ],
      "read_docs": [
        "docs/styleguide.md",
        "docs/DESIGN_SPEC.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Dashboard no longer shows Recent Sessions and presents a coherent KPI + weather + graph hierarchy",
        "Button hover/focus behavior is visually consistent across the app",
        "Survey pages remain legible and calm; references are used as inspiration only (not cloned 1:1)",
        "Favicon and top bar are updated and consistent with the Phase 4 palette"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T64",
      "title": "Docs — Phase 4 documentation sweep and consistency pass",
      "status": "todo",
      "description": "Update docs to be Phase 4 decision-complete: kanban tasks, API contracts, schema notes, design spec, styleguide, and runbooks. Fix any Phase 3 doc mismatches discovered during implementation.",
      "depends_on": [],
      "stack": [
        "backend",
        "frontend",
        "database"
      ],
      "read_docs": [
        "docs/kanban.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/styleguide.md",
        "docs/devSteps.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Docs match current implementation status markers (planned vs implemented) accurately",
        "Phase 4 kanban is broken into single-target tasks with explicit acceptance criteria",
        "Phase 4 mapping rules and date_local linking semantics are clearly documented"
      ],
      "updates_docs": [
        "docs/kanban.md",
        "docs/kanban_log.md",
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/DESIGN_SPEC.md",
        "docs/styleguide.md",
        "docs/devSteps.md",
        "docs/CONVENTIONS.md",
        "docs/PROGRESS.md"
      ]
    }
  ]
}
```
