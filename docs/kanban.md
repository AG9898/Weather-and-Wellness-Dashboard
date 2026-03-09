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
      "id": "T71",
      "title": "Frontend — Login page glassmorphism refactor",
      "status": "done",
      "description": "Redesign the login page to match the glassmorphism aesthetic from the reference image at `reference/UI Reference/login/Glass Effect Login Page - Blue.png`. The full viewport background becomes a deep-to-mid UBC blue gradient. The login card gets backdrop-filter blur, a semi-transparent UBC blue background, and a low-opacity white border. Add 4–5 abstract SVG blob shapes (irregular Bezier path curves) distributed around the viewport as decorative background elements: each with a UBC brand gradient fill (blue-700 → blue-500 → blue-300), 0.15–0.35 opacity, slight CSS blur filter, and a slow CSS @keyframes drift/rotation loop (~20s). Both light and dark modes use the same full-bleed gradient (this page is a standalone visual). All existing auth logic (Supabase sign-in, session recovery, error handling) remains unchanged.",
      "stack": ["frontend"],
      "read_docs": [
        "docs/styleguide.md",
        "docs/animejs.md"
      ],
      "acceptance_criteria": [
        "Login page background is a full-viewport UBC blue gradient (not the theme background variable)",
        "Login card has backdrop-filter blur and semi-transparent background (glassmorphism)",
        "4–5 SVG abstract blob shapes are visible in the background with UBC blue gradients and subtle animation",
        "Card content (email, password, submit button, error) is unchanged and fully functional",
        "Looks correct in both light and dark system themes",
        "No regressions: auth flow still redirects to /dashboard on success"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T72",
      "title": "Frontend — Shared cloud loading component with animejs float animation",
      "status": "done",
      "description": "Create a reusable `<CloudLoading />` component at `src/lib/components/CloudLoading.tsx` that replaces all existing inline spinner patterns. IMPORTANT: animejs is documented in docs/animejs.md but is not yet installed — run `npm install animejs` inside `frontend/` as part of this task. Inline the SVG from `reference/UI Reference/Animations/cloud-load-icon.svg` (stroke paths; change stroke color to `currentColor` for theming). On mount: (1) use `svg.createDrawable()` from animejs to animate the stroke being drawn in once; (2) then start a continuous `translateY` float loop: `[-5px → 5px]`, duration 1600ms, ease `inOut(2)`, loop+alternate. Clean up with `anim.pause()` on unmount. Respect `prefers-reduced-motion`. Accept a `size` prop (sm/md/lg). Apply to: `WeatherUnifiedCard` loading/updating states, `DashboardPage` summaryLoading state, and `new-session/page.tsx` submitting spinner.",
      "stack": ["frontend"],
      "depends_on": [],
      "read_docs": [
        "docs/animejs.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "`npm install animejs` has been run and animejs appears in package.json dependencies",
        "`src/lib/components/CloudLoading.tsx` exists and exports a default `CloudLoading` component",
        "On mount the cloud SVG strokes draw in once, then the icon floats up and down continuously",
        "Animation pauses cleanly on unmount (no console errors or memory leaks)",
        "prefers-reduced-motion: cloud icon renders statically with no animation",
        "Replaces the inline animate-spin spinner in WeatherUnifiedCard, DashboardPage loading state, and new-session page",
        "Stroke color adapts to current text color (uses currentColor)"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T73",
      "title": "Frontend — Fix survey form question/answer alignment",
      "status": "done",
      "description": "In `src/lib/components/SurveyForm.tsx`, the `<legend>` element causes each survey question to render on the fieldset border rather than as block content above the answer options. Root cause: browsers position `<legend>` floating at the top of the fieldset border by default. Fix: replace the visible `<legend>` with a visually hidden `<legend className='sr-only'>` (preserves screen reader semantics for the fieldset radio group) and add a sibling `<p>` or `<div>` as the first visible child inside the fieldset to display the question number and text with the same styling. No changes to answer option rendering, response state, or submit logic.",
      "stack": ["frontend"],
      "read_docs": [
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "Survey question text renders as a block element clearly above the answer option buttons, not on or overlapping the fieldset border",
        "Answer option buttons (Never/Rarely/Sometimes/Often) are visually aligned below the question text within the bordered container",
        "Screen readers still announce the fieldset label (sr-only legend is present)",
        "Verified on ULS-8, CES-D 10, GAD-7, and CogFunc 8a survey pages",
        "No change to response state management or submission logic"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T74",
      "title": "Frontend — Highcharts graph draw-in animation on load and filter change",
      "status": "done",
      "description": "Add a left-to-right draw-in animation to the weather trend chart in `src/lib/components/WeatherUnifiedCard.tsx`. Highcharts line series natively animate data rendering left-to-right when `setData()` is called with animation options enabled. Configure `plotOptions.series.animation = { duration: 800 }` on the chart options object. When a date range filter or metric toggle is applied, update each series via `chart.series[n].setData(newData, true, { duration: 800 })` rather than destroying and recreating the chart instance (avoid `key` prop resets that bypass animation). On initial chart load the same animation applies automatically. Total draw duration must be ≤1000ms. Ensure the chart ref (or Highcharts callback) is used to access series imperatively.",
      "stack": ["frontend"],
      "read_docs": [
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "On initial dashboard load the weather chart lines animate drawing from left to right",
        "Applying a date range filter or metric toggle triggers a visible redraw animation (≤1000ms)",
        "Animation does not block or delay the display of data — chart appears with correct data after animation",
        "No regressions to existing filter controls, legend, tooltip, or zoom functionality"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T75",
      "title": "Frontend — KPI stat number counter animation with animejs",
      "status": "done",
      "description": "Add a count-up animation to the 5 KPI stat numbers on the dashboard (`src/app/(ra)/dashboard/page.tsx`). Create a `useCountUp(target: number, duration: number)` hook inside the file: use animejs `animate()` on a plain JS object `{ value: 0 }` targeting `{ value: target }`, read the interpolated value via `onUpdate` callback and push it to React state (Math.round). Duration: 800ms, ease: `out(3)`. Trigger re-animation when `target` changes (data refresh). Pause on unmount. Apply to the `<p className='text-3xl font-bold ...'>` value render in `KpiCard`. Requires animejs to be installed (see T72).",
      "stack": ["frontend"],
      "depends_on": ["T72"],
      "read_docs": [
        "docs/animejs.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "All 5 KPI numbers animate from 0 to their actual value on first load",
        "When dashboard data refreshes in the background, numbers animate from their previous value to the new value",
        "Animation duration is ~800ms with smooth deceleration",
        "prefers-reduced-motion: numbers appear instantly without animation",
        "No layout shift during animation (use tabular-nums, fixed width as needed)"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T76",
      "title": "Frontend — Custom rain-style scrollbar (CSS-only)",
      "status": "todo",
      "description": "Restyle the browser scrollbar throughout the app using CSS pseudo-elements in `src/app/globals.css`. Target `::-webkit-scrollbar` (width: 6px), `::-webkit-scrollbar-track` (transparent), and `::-webkit-scrollbar-thumb`. The thumb should use a UBC blue gradient (`--ubc-blue-700` → `--ubc-blue-500`) with a teardrop shape approximated via `border-radius` and/or `background` gradient with a narrow specular highlight streak (slightly lighter UBC blue offset to top-left corner). Animate multiple staggered droplet motifs within the thumb using CSS `@keyframes fall` with staggered `animation-delay` values to create a continuous falling rain visual. Design must work in both light and dark themes (use CSS variables). Firefox fallback: `scrollbar-width: thin` + `scrollbar-color` using UBC blue. Note: animated droplet effects are Webkit-only (Chrome, Edge, Safari) — Firefox shows a styled solid thumb.",
      "stack": ["frontend"],
      "read_docs": [
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "Scrollbar is visually present and styled (not default browser chrome) in Chrome/Edge/Safari",
        "Scrollbar thumb uses UBC blue gradient colors matching the design system",
        "Animated falling droplet effect is visible while scrolling or when scrollbar is hovered",
        "Specular highlight (lighter streak) is visible on each droplet shape",
        "Firefox shows a thin styled scrollbar with UBC blue color (no animation required)",
        "Works correctly in both light and dark theme modes",
        "No scrollbar styling interferes with overflow-hidden or dialog components"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T77",
      "title": "DB — extend survey_cogfunc8a for imported legacy rows",
      "status": "todo",
      "description": "Add Phase 4-style import support to `survey_cogfunc8a` via Alembic and model updates. Make raw item columns and computed columns nullable for imported rows, add `data_source VARCHAR(16) NOT NULL DEFAULT 'native'`, add `legacy_mean_1_5 NUMERIC NULLABLE`, and add `UNIQUE(session_id)` so imported legacy CogFunc rows can be upserted per session without fabricating raw items.",
      "stack": ["backend", "database"],
      "depends_on": [],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/API.md",
        "docs/COGFUNC8A.md"
      ],
      "acceptance_criteria": [
        "Alembic migration applies cleanly up/down",
        "`backend/app/models/surveys.py` reflects nullable imported-row behavior for `survey_cogfunc8a`",
        "`survey_cogfunc8a` can represent both native rows and imported rows without overloading native computed fields",
        "No changes to participant-facing survey submission endpoints"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T78",
      "title": "Backend — import commit + Phase 4 backfill for legacy CogFunc and digit span semantics cleanup",
      "status": "todo",
      "description": "Update `import_service.py` and `phase4_backfill.py` so legacy `self_report` upserts imported `survey_cogfunc8a` rows with `data_source='imported'` and `legacy_mean_1_5`. Also clean up internal naming/comments for legacy Digit Span so the code no longer implies the imported value is a true `max_span`, while keeping storage in `digitspan_runs.total_correct`.",
      "stack": ["backend"],
      "depends_on": ["T77"],
      "read_docs": [
        "docs/SCHEMA.md",
        "docs/SCORING.md",
        "docs/DIGITSPAN.md"
      ],
      "acceptance_criteria": [
        "`POST /admin/import/commit` creates or updates imported `survey_cogfunc8a` rows from `self_report`",
        "Existing imported sessions can be remapped by the backfill script into `survey_cogfunc8a`",
        "Native `survey_cogfunc8a` rows are never overwritten",
        "`_get_sessions_with_native_rows` treats `survey_cogfunc8a` the same way as the other imported survey tables after the schema change",
        "Legacy Digit Span behavior is described and implemented as a legacy imported score while storage remains in `digitspan_runs.total_correct`"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T79",
      "title": "Backend — export/API parity for imported CogFunc rows",
      "status": "todo",
      "description": "Update export surfaces and API references so imported CogFunc rows are visible and schema-faithful. Extend `export_service.py` table specs for `survey_cogfunc8a` to include the new imported-row columns and remove any docs that still claim imported CogFunc rows are absent once the code path is live.",
      "stack": ["backend"],
      "depends_on": ["T78"],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/COGFUNC8A.md"
      ],
      "acceptance_criteria": [
        "`GET /admin/export.xlsx` and `GET /admin/export.zip` include the new `survey_cogfunc8a` imported-row columns",
        "Export ordering and README descriptions remain consistent with the other imported survey tables",
        "API docs and schema docs reflect the live export shape and no longer carry a stale imported-CogFunc limitation",
        "No changes to participant-facing endpoint contracts"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T80",
      "title": "Verification — legacy import regression tests for CogFunc and digit span",
      "status": "todo",
      "description": "Add or extend automated coverage for the new import path and export shape, including backfill safety. Focus on legacy `self_report` remap, native-row overwrite protection, export columns, and legacy Digit Span semantics under the current storage approach.",
      "stack": ["backend"],
      "depends_on": ["T78", "T79"],
      "read_docs": [
        "docs/API.md",
        "docs/SCHEMA.md",
        "docs/SCORING.md"
      ],
      "acceptance_criteria": [
        "Import preview/commit tests cover rows with `self_report` and verify imported `survey_cogfunc8a` creation/update",
        "Tests verify native `survey_cogfunc8a` rows block overwrite on re-import",
        "Backfill tests verify existing `imported_session_measures.self_report` rows populate `survey_cogfunc8a`",
        "Export tests verify `survey_cogfunc8a` includes `data_source` and `legacy_mean_1_5`",
        "Digit Span import tests verify imported rows still land in `digitspan_runs.total_correct` with `max_span = null`"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T81",
      "title": "Backend analytics — add Python dependencies and response schema scaffolding",
      "status": "todo",
      "description": "Add the Python packages needed for DB-driven statistical analysis (`pandas`, `numpy`, `statsmodels`, and `scipy` if required by the implementation), then scaffold the analytics-side Pydantic response models and version/config constants without changing any existing survey scoring logic. This task is only the infrastructure layer for the planned analytics pipeline documented in `docs/ANALYTICS.md`.",
      "stack": ["backend"],
      "depends_on": [],
      "read_docs": [
        "docs/ANALYTICS.md",
        "docs/API.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "`backend/requirements.txt` includes the approved analytics dependencies",
        "Analytics response/schema classes exist for dataset metadata, model summaries, and effect cards",
        "A backend analytics version constant or equivalent is defined for snapshot/result versioning",
        "No existing survey scoring modules or participant submission endpoints are changed"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T82",
      "title": "DB — add durable analytics run and snapshot tables",
      "status": "todo",
      "description": "Create Alembic migrations and SQLAlchemy models for durable analytics storage in Postgres. Add an append-only run/audit table and a snapshot table keyed by date range + model version so analytics results are not stored in Redis alone. Persist recompute status, warning metadata, generation timestamps, and the serialized analytics payload.",
      "stack": ["backend", "database"],
      "depends_on": ["T81"],
      "read_docs": [
        "docs/ANALYTICS.md",
        "docs/SCHEMA.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "Alembic migration applies cleanly up/down",
        "ORM models exist for analytics run metadata and durable snapshot payload storage",
        "Snapshot rows can distinguish date-range-specific results and analytics/model version",
        "Schema/docs clearly state that Redis is only a cache layer for analytics reads"
      ],
      "updates_docs": [
        "docs/SCHEMA.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T83",
      "title": "Backend analytics — build canonical analysis dataset service",
      "status": "todo",
      "description": "Implement a backend service that constructs the canonical analysis dataset from sessions, study days, weather, digit span, survey tables, participants, and imported aggregate fallbacks. This service must apply the source-precedence rules documented in `docs/ANALYTICS.md`, derive `date_bin` in-memory, and return both included rows and exclusion metadata.",
      "stack": ["backend"],
      "depends_on": ["T81"],
      "read_docs": [
        "docs/ANALYTICS.md",
        "docs/SCHEMA.md",
        "docs/SCORING.md"
      ],
      "acceptance_criteria": [
        "Service returns one canonical logical dataset for a requested local-date range",
        "Native scored values are preferred over imported fallback values per the documented precedence rules",
        "Imported `self_report` is sourced from `imported_session_measures.self_report` when no native CogFunc row exists",
        "Rows missing required predictors/outcomes are excluded with structured exclusion counts/reasons",
        "No derived analysis fields are persisted to transactional tables"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T84",
      "title": "Backend analytics — implement z-scoring and mixed-model fitting service",
      "status": "todo",
      "description": "Implement the Python-side statistics engine that standardizes the active dataset window and fits the two planned mixed-effects models from `docs/ANALYTICS.md`. Serialize model-level metadata and effect-card outputs suitable for the dashboard, including coefficient, standard error, p-value, confidence interval, direction, and convergence warnings.",
      "stack": ["backend"],
      "depends_on": ["T83"],
      "read_docs": [
        "docs/ANALYTICS.md",
        "reference/Weather_MLM.R"
      ],
      "acceptance_criteria": [
        "Both planned outcome models are fit from the canonical dataset in Python",
        "Z-scoring is computed within the requested analysis window only",
        "Serialized results include model metadata, per-term effect cards, and warning/convergence state",
        "Undersized or zero-variance datasets return typed analytics status/warnings rather than an unhandled error"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T85",
      "title": "Backend analytics — add snapshot persistence and recompute orchestration",
      "status": "todo",
      "description": "Implement the service layer that reads the latest analytics snapshot, triggers a fresh recompute when requested, writes successful results back to durable snapshot storage, and preserves the prior snapshot while recompute is in progress or fails. This task owns the backend state machine for `ready`, `stale`, `recomputing`, `insufficient_data`, and `failed` analytics states.",
      "stack": ["backend"],
      "depends_on": ["T82", "T84"],
      "read_docs": [
        "docs/ANALYTICS.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "Backend can return the latest successful snapshot for a requested range without recomputing",
        "Live recompute writes a new snapshot only after successful model fitting",
        "Prior snapshot remains readable while recompute is running or if recompute fails",
        "Run metadata captures generated_at, status, warnings, and model version"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T86",
      "title": "Backend API — implement GET /dashboard/analytics",
      "status": "todo",
      "description": "Add the RA-protected analytics endpoint and wire it to the dataset, model, and snapshot services. Support `date_from`, `date_to`, and `mode=snapshot|live`, interpret bounds in `America/Vancouver`, and return the typed analytics response contract defined in the docs.",
      "stack": ["backend"],
      "depends_on": ["T85"],
      "read_docs": [
        "docs/API.md",
        "docs/ANALYTICS.md",
        "docs/ARCHITECTURE.md"
      ],
      "acceptance_criteria": [
        "`GET /dashboard/analytics` exists and requires LabMember auth",
        "Date range bounds are validated and interpreted in the study timezone",
        "`mode=snapshot` returns the latest durable snapshot for the requested range",
        "`mode=live` triggers recompute behavior and returns the typed analytics status payload",
        "Endpoint does not change existing `/dashboard/summary` or `/dashboard/participants-per-day` contracts"
      ],
      "updates_docs": [
        "docs/API.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T87",
      "title": "Frontend analytics — add typed API wrappers and same-origin route handler",
      "status": "todo",
      "description": "Add typed frontend API wrappers for the analytics endpoint and a same-origin Route Handler for dashboard analytics reads. Keep analytics caching separate from the current operational dashboard and weather cache keys, and preserve auth validation plus stale-snapshot fallback behavior.",
      "stack": ["frontend"],
      "depends_on": ["T86"],
      "read_docs": [
        "docs/ANALYTICS.md",
        "docs/ARCHITECTURE.md",
        "docs/CONVENTIONS.md"
      ],
      "acceptance_criteria": [
        "Frontend reads analytics through typed wrappers in `src/lib/api/` with no bare fetch in components",
        "A same-origin Route Handler proxies analytics requests with JWT validation",
        "Analytics cache keys are distinct from `ww:ra:dashboard:v1` and `ww:ra:weather:range:v1:*`",
        "Snapshot responses can be served quickly while live recompute requests do not block the UI indefinitely"
      ],
      "updates_docs": [
        "docs/ARCHITECTURE.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T88",
      "title": "Frontend dashboard — add analytics model cards UI",
      "status": "todo",
      "description": "Add the dashboard analytics section that renders model cards from the analytics payload. The implemented UI should clearly separate operational KPI cards from statistical model cards, display coefficient/direction/significance/convergence state, and show snapshot freshness or recompute status without blocking the existing weather and summary surfaces.",
      "stack": ["frontend"],
      "depends_on": ["T87"],
      "read_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/ANALYTICS.md",
        "docs/styleguide.md"
      ],
      "acceptance_criteria": [
        "Dashboard renders a separate analytics section in addition to the existing operational KPI row",
        "Each model card shows outcome, term, coefficient, confidence interval, significance, and direction",
        "UI handles `recomputing`, `stale`, `insufficient_data`, and `failed` analytics states gracefully",
        "Operational dashboard summary cards and WeatherUnifiedCard behavior remain unchanged"
      ],
      "updates_docs": [
        "docs/DESIGN_SPEC.md",
        "docs/PROGRESS.md"
      ]
    },
    {
      "id": "T89",
      "title": "Verification — analytics dataset, model, endpoint, and dashboard parity tests",
      "status": "todo",
      "description": "Add focused automated coverage for the new analytics pipeline end to end. Cover dataset assembly precedence, exclusion rules, model serialization, snapshot/live endpoint behavior, and the dashboard analytics UI states. Include at least one parity-oriented fixture derived from the reference R workflow to catch regressions in term naming and included-row logic.",
      "stack": ["backend", "frontend"],
      "depends_on": ["T86", "T88"],
      "read_docs": [
        "docs/ANALYTICS.md",
        "docs/API.md",
        "reference/Weather_MLM.R"
      ],
      "acceptance_criteria": [
        "Backend tests cover native/imported source precedence and exclusion metadata in the canonical analysis dataset",
        "Model tests verify expected terms and serialized effect fields for both outcomes",
        "Endpoint tests cover auth, invalid ranges, snapshot mode, live mode, and stale-snapshot fallback behavior",
        "Frontend tests cover analytics loading, ready, stale, recomputing, insufficient-data, and failed UI states",
        "At least one verification fixture maps back to the R-script formula and logical field naming"
      ],
      "updates_docs": [
        "docs/PROGRESS.md"
      ]
    }
  ]
}
```
