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
