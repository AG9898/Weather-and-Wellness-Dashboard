# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.

---

## Current State

| Field              | Value                                                        |
|--------------------|--------------------------------------------------------------|
| Phase              | 4 (in progress)                                              |
| Tasks completed    | 24 — Phase 4 ongoing                                         |
| Remaining queue    | T76–T99 in kanban.md                                         |
| Tasks in progress  | 0                                                            |
| Last updated       | 2026-03-09                                                   |

---

**Architecture note (2026-02-22):** Project architecture is now standardized on Next.js (Vercel) + FastAPI (Render) + Supabase Postgres. Earlier entries referencing SvelteKit reflect the initial scaffold and are superseded by docs/ARCHITECTURE.md.

---

## Currently In Progress

_No tasks in progress._

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

## Analytics implementation tasks added (planned 2026-03-09)

- Added a new scoped implementation sequence to `docs/kanban.md` for the
  planned dashboard analytics pipeline documented in `docs/ANALYTICS.md`.
- New tasks:
  - **T83** — add backend analytics dependencies and schema scaffolding
  - **T84** — add durable analytics run/snapshot tables
  - **T85** — build canonical analysis dataset service
  - **T86** — implement z-scoring and mixed-model fitting
  - **T87** — add snapshot persistence and recompute orchestration
  - **T88** — implement `GET /dashboard/analytics`
  - **T89** — add frontend analytics API wrappers and Route Handler
  - **T90** — add dashboard analytics model cards UI
  - **T91** — add analytics parity and regression coverage
- Existing scoring semantics remain unchanged; the new queue is additive and
  follows the analytics design documented on 2026-03-09.

## Selective wipe + fresh re-import tasks added (planned 2026-03-09)

- Added a post-import-verification cleanup path for restoring the reference XLSX
  data without deleting existing weather history.
- New tasks added to `docs/kanban.md` immediately after T80:
  - **T81** — add a participant-domain wipe script that preserves weather tables
  - **T82** — after T80, run the selective wipe and perform a brand new import of `reference/data_full_1-230.xlsx`
- This sequence is intentionally placed before the analytics implementation
  tasks so the restored participant dataset is in a clean post-T80 state.

## Analytics visualization linkage tasks added (planned 2026-03-09)

- Updated the planned analytics direction so effect plots are rendered in a
  separate dashboard card rather than overlaid on the weather time-series chart.
- The weather chart and analytics surfaces will share dashboard filter state and
  may use lightweight date-based annotations to stay visually linked.
- New tasks added to `docs/kanban.md`:
  - **T92** — extend analytics payload for effect plots and weather-link metadata
  - **T93** — unify weather and analytics filter state on the dashboard
  - **T94** — add a separate analytics effect-plot card with weather annotations
  - **T95** — verify linked weather-analysis visualization behavior end to end

## Undo-last-session tasks added (planned 2026-03-09)

- Added a narrow RA-only correction path for undoing the most recently created
  native session via hard delete plus append-only audit log.
- This decision explicitly avoids broad soft-delete semantics and does not touch
  weather-domain rows.
- New tasks added to `docs/kanban.md`:
  - **T96** — add audit table and backend delete service
  - **T97** — implement `DELETE /sessions/last-native`
  - **T98** — add the dashboard undo control
  - **T99** — verify undo safeguards and regressions

## T75 — Frontend — KPI stat number counter animation with animejs (completed 2026-03-05)

- `dashboard/page.tsx`: added `import { animate } from "animejs"`.
- Added `useCountUp(target: number, duration: number): number` hook: animates a plain JS object `{ value: currentRef.current }` → `{ value: target }` via animejs `animate()`, reads `obj.value` in `onUpdate` to drive React state with `Math.round`. Duration 800ms, ease `out(3)`.
- Starts from the previously displayed value (tracked via `currentRef`) so data-refresh re-animations go from old to new value rather than from 0.
- `prefers-reduced-motion`: calls `setCount(target)` immediately with no animation.
- Cleanup: `anim.pause()` returned from `useEffect`.
- `KpiCard`: calls `useCountUp(numericTarget, 800)` unconditionally; displays `displayCount` when `value` is a number, raw string otherwise (e.g. "—" during loading).
- No layout shift: `tabular-nums` already present on the value `<p>`.

## T74 — Frontend — Highcharts graph draw-in animation on load and filter change (completed 2026-03-05)

- `WeatherUnifiedCard.tsx`: enabled left-to-right draw-in animation on the weather trend chart.
- `plotOptions.series.animation = { duration: 800 }` — applies to initial chart load automatically.
- Extracted data from `chartOptions` useMemo: series now start with `data: []`; the memo depends only on `chartColors` (prevents chart recreation on data change).
- Added `useRef<HighchartsReact.RefObject>(null)` + `ref={chartRef}` on `<HighchartsReact>`.
- New `useEffect([rangeItems, chartColors, mounted])`: calls `chart.series[n].setData(data, false/true, { duration: 800 })` imperatively — triggers animated redraw on every filter or metric change. `chartColors` included so data is re-applied after a theme-change `chart.update()`.
- New `useEffect([showTemp, showPrecip, showSunlight, mounted])`: calls `chart.series[n].setVisible()` for metric toggle without animation.
- `tsc --noEmit` passes with no errors.

## T73 — Frontend — Fix survey form question/answer alignment (completed 2026-03-05)

- Root cause: `<legend>` floats on the fieldset border by default in all browsers, causing question text to overlap the border rather than render as block content inside the container.
- Fix in `src/lib/components/SurveyForm.tsx`:
  - Changed `<legend>` to `<legend className="sr-only">` — preserves screen reader semantics for the radio group.
  - Added a visible `<p className="text-sm font-medium leading-snug text-foreground">` as the first block child inside the fieldset to display the question number and text.
- No changes to answer option rendering, response state, or submit logic.
- Applies to all survey pages: ULS-8, CES-D 10, GAD-7, CogFunc 8a (all use `<SurveyForm />`).

## T72 (kanban) — Frontend — Shared cloud loading component with animejs (completed 2026-03-05)

- Installed `animejs` (^4.x) in `frontend/` (`npm install animejs`).
- Created `src/lib/components/CloudLoading.tsx` — reusable `<CloudLoading size="sm|md|lg" />` component.
  - Inlines the cloud SVG from `reference/UI Reference/Animations/cloud-load-icon.svg` with `stroke="currentColor"` for theming.
  - On mount: uses `svg.createDrawable()` from animejs to animate both stroke paths drawing in once (700ms, `out(2)`).
  - After draw completes: starts a continuous `translateY [-5px → 5px]` float loop (1600ms, `inOut(2)`, `loop+alternate`).
  - Respects `prefers-reduced-motion` — no animation when user prefers reduced motion.
  - Cleans up both animations (`anim.pause()`) on unmount.
- Applied to three locations:
  - `WeatherUnifiedCard.tsx`: replaces the `animate-spin` SVG in the Update Weather button (`updating` state) and replaces the "Loading…" text in the `isLoading` state.
  - `dashboard/page.tsx`: shows a `sm` CloudLoading indicator above the KPI grid when `summaryLoading` is true.
  - `new-session/page.tsx`: replaces the `animate-spin` SVG in the Start Session submit button (`starting` state).
- `tsc --noEmit` passes with no errors.

## T73 — Frontend — Login page glassmorphism refactor (completed 2026-03-05)

- Redesigned `src/app/login/page.tsx` to match the glassmorphism reference (`reference/UI Reference/login/Glass Effect Login Page - Blue.png`).
- Full-viewport UBC blue gradient background (`#001328 → #001f5e → #002d80`) replaces the theme `--background` variable on this standalone page.
- Glassmorphism card: `backdrop-filter: blur(18px)`, semi-transparent `rgba(0,28,76,0.38)` background, `rgba(255,255,255,0.13)` border.
- 5 abstract SVG blob shapes distributed around viewport, each with UBC blue gradient fill (`blue-700 → blue-500/300`), 0.17–0.28 opacity, 2–5px blur, and independent CSS `@keyframes blob-drift-N` animations (~19–26s, `alternate`, `ease-in-out`).
- Animation keyframes and `prefers-reduced-motion` guard added to `globals.css`.
- All auth logic (Supabase sign-in, stale session recovery, redirect to `/dashboard`) unchanged.

## T72 — Frontend reliability: live fetch timeout + stale-cache fallback docs (completed 2026-03-05)

- Diagnosed deployed dashboard stall: both cache reads were misses while live Route Handler calls hung waiting on Render; no timeout existed in Vercel->Render fetch path.
- Implemented route-level protection in `GET /api/ra/dashboard` and `GET /api/ra/weather/range`:
  - 15s backend fetch timeout per upstream Render request.
  - `mode=live` stale-cache fallback on live-fetch failure when cache exists.
- Updated docs for operational behavior and verification:
  - `docs/ARCHITECTURE.md` (live-mode timeout + stale-fallback semantics)
  - `docs/CONVENTIONS.md` (timeout/fallback conventions for cached Route Handlers)
  - `docs/devSteps.md` (smoke-test/troubleshooting with `x-ww-cache: refresh|stale-fallback|error`)
  - `docs/DESIGN_SPEC.md` (fail-fast loading behavior note)

## T71 — Frontend perf: cache hardening + weather range caching (completed 2026-03-05)

- `/api/ra/dashboard` cache behaviour hardened:
  - Redis write is awaited (prevents dropped writes in serverless runtimes).
  - Cache TTL increased to 6 hours (reduces repeated cold-start misses).
  - Response header `x-ww-cache` added (`hit|miss|disabled|refresh|error|skip`) to aid production diagnostics.
- Dashboard page avoids waking the Render backend on every visit: it skips the immediate live refresh when cached data is still recent.
- New cached route handler added for the weather trend chart:
  - `GET /api/ra/weather/range?mode=cached|live&date_from=...&date_to=...`
  - Cache key `ww:ra:weather:range:v1:<date_from>:<date_to>` with TTL 24 hours.
- WeatherUnifiedCard range fetch updated to cached-first weather-only calls (no longer uses the live-only dashboard range bundle).
- Docs updated: `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/DESIGN_SPEC.md`, `docs/devSteps.md`.

## T70 — Frontend: Dashboard simplification + WeatherUnifiedCard swap (completed 2026-03-04)

**Acceptance criteria met:**

- `dashboard/page.tsx` no longer imports `WeatherCard`, `WeatherTrendChart`, or `getDashboardRangeBundle`.
- All range-related state and functions removed (`rangeSummary`, `rangeWeatherData`, `rangeParticipantsData`, `rangeLoading`, `rangeError`, `preset`, `customFrom`, `customTo`, `requestedRange`, `appliedRange`, `rangeRequestSeqRef`, `applyRange`, `clearRangeFilter`, `handlePresetClick`, `handleApplyCustomRange`, `FilterPresetButton`, helper functions).
- Dashboard range filter UI section removed entirely.
- `WeatherUnifiedCard` rendered in place of `WeatherCard`.
- KPI labels "Created (7d)" and "Completed (7d)" are static strings; values always come from `sessions_created_last_7_days` / `sessions_completed_last_7_days` from the base bundle.
- `WeatherCard.tsx` deleted. (`WeatherTrendChart.tsx` was already deleted in T68.)
- **Chart improvements (T69/T70 combined):** Temperature series upgraded to `areaspline` with gradient fill; Precipitation and Sunlight use `spline` with dashed/dotted dash styles to visually differentiate the three trends. Precipitation and Sunlight each have their own right y-axis (separate scales — mm vs hours). Temperature axis uses `°` formatter. Tooltip has improved styling with date header.
- `tsc --noEmit` passes; `npm run build` passes.

## T69 — Frontend: WeatherUnifiedCard (completed 2026-03-04)

**Acceptance criteria met:**

- `WeatherUnifiedCard.tsx` created at `frontend/src/lib/components/WeatherUnifiedCard.tsx`.
- Card header shows cloud icon + "Weather" label (section label) + "Update Weather" button with spinner and inline feedback.
- Current-day weather summary (large temperature, forecast ↑/↓ high/low, condition text, precipitation pill, ingest status badge) sourced from the base `weather` prop.
- Date range filter presets: Study Start (2025-03-03 to today), Last 7d, Last 30d, Last 90d, Custom. Default = Study Start. Custom preset reveals date-from/date-to inputs + Apply button.
- Range data fetched internally via `getDashboardRangeBundle`; loading and error states handled inline; race-condition guard via sequence counter.
- Highcharts line chart renders Temperature (chart-1, left Y-axis), Precipitation (chart-2, right Y-axis, opacity 0.5), Sunlight Hours (chart-3, right Y-axis, opacity 0.5).
- Toggle buttons (Temp / Precip / Sunlight) control per-series visibility; all default visible.
- CSS variable colors read at mount via `getComputedStyle`; `MutationObserver` on `document.documentElement` re-themes chart on light/dark toggle.
- `connectNulls: false` — null sunshine values render as gaps, no errors.
- Shared tooltip shows date + all three series values for the hovered date.
- `tsc --noEmit` passes; `npm run build` passes.
- `docs/DESIGN_SPEC.md` WeatherUnifiedCard spec updated to reflect implemented component.
- `docs/styleguide.md` Section 12 updated with Highcharts theming convention.

## T66 — Backend: POST /weather/backfill/historical endpoint (completed 2026-03-03)

**Acceptance criteria met:**

- `POST /weather/backfill/historical` added to `backend/app/routers/weather.py`; requires LabMember JWT (`Depends(get_current_lab_member)`).
- Request body is fully optional (all fields have defaults): `start_date` (default `2025-01-01`), `end_date` (default today in `America/Vancouver`), `station_id` (default `3510`).
- `start_date > end_date` → HTTP 422. Date range > 400 days → HTTP 422.
- Calls `run_historical_weather_backfill(db, start_date, end_date, station_id)` from `historical_weather_backfill_service.py` (T65).
- `OpenMeteoError` from the fetch service is caught and re-raised as HTTP 502 with descriptive detail.
- Returns `HistoricalBackfillResponse(days_inserted, days_enhanced, days_skipped)`.
- New imports added to router: `ZoneInfo`, `Body`, `HistoricalBackfillRequest`, `HistoricalBackfillResponse`, `run_historical_weather_backfill`, `OpenMeteoError`.
- `docs/API.md` updated: endpoint status changed from `planned` to `implemented (T66)`.

## Weather hierarchy correction (2026-03-03)

`backend/app/services/weather_backfill_service.py` updated to correctly enforce the data hierarchy: legacy import temp/precip now **overwrites** existing Open-Meteo rows (not just fills gaps). Previously, the service used `on_conflict_do_nothing` and silently lost import measurements when Open-Meteo data already existed for a date.

New behaviour:
- **No row** → insert partial row (temp + precip only) — `days_inserted`
- **open-meteo-v1 row** → UPDATE `current_temp_c` + `current_precip_today_mm`; preserve humidity/sunshine — `days_updated`
- **ubc-eos-v1 row** → skip (highest quality, never touched) — `days_skipped`
- **legacy-import-v1 row** → no-op (idempotent)

`LegacyWeatherBackfillResult` updated: `days_backfilled` renamed to `days_inserted`; `days_updated` added.
`phase4_backfill.py` and `weather_backfill.py` updated to reflect new counter names.
`docs/HISTORICAL_WEATHER_BACKFILL.md` and `docs/WEATHER_INGESTION.md` updated with corrected hierarchy and run-order guidance.

Current DB state (2026-03-03): 427 `weather_daily` rows with `parser_version=open-meteo-v1` covering 2025-01-01 → 2026-03-03. After XLSX import, running `weather_backfill.py` will overwrite temp/precip for import dates with actual measurements.

## T65 — Backend: Open-Meteo fetch + historical backfill services (completed 2026-03-03)

- `backend/app/services/historical_weather_service.py` — `fetch_open_meteo(start_date, end_date)` returns `dict[date, OpenMeteoDay]` keyed by local date; `sunshine_duration` divided by 3600 to produce hours. Raises `OpenMeteoError` on non-2xx response. URL built with `timezone=America%2FVancouver`; returned `daily.time` strings used directly as `date_local` (no conversion).
- `backend/app/services/historical_weather_backfill_service.py` — `run_historical_weather_backfill(db, start_date, end_date, station_id)` applies the three-case precedence rule:
  - **Case A (no row):** full insert of all six mapped fields; get-or-create `study_days` row; `ON CONFLICT DO NOTHING` idempotency guard. Counted in `days_inserted`.
  - **Case B (legacy-import-v1):** UPDATE only null fields via `COALESCE(existing, new)` for `current_relative_humidity_pct`, `sunshine_duration_hours`, `forecast_high_c`, `forecast_low_c`. `current_temp_c` and `current_precip_today_mm` never touched. `source_run_id` updated to new open-meteo-v1 run, so second pass classifies the row as Case C (idempotent). Counted in `days_enhanced`.
  - **Case C (ubc-eos-v1 or open-meteo-v1):** skipped entirely. Counted in `days_skipped`.
- One `weather_ingest_runs` audit row per affected day: `requested_via="historical_api_backfill"`, `parser_version="open-meteo-v1"`.
- Idempotent: second run returns `days_inserted=0, days_enhanced=0, days_skipped=N`.
- `HistoricalBackfillRequest` and `HistoricalBackfillResponse` Pydantic schemas added to `backend/app/schemas/weather.py` (used by T66 endpoint).

## T64 — DB: sunshine_duration_hours column (completed 2026-03-03)

- Alembic migration `20260303_000001` adds `sunshine_duration_hours DOUBLE PRECISION NULL` to `weather_daily`. Down migration drops it.
- `WeatherDaily` SQLAlchemy model updated with `sunshine_duration_hours: Mapped[float | None]`.
- `WeatherDailyItem` Pydantic schema updated with `sunshine_duration_hours: float | None = None`.
- `GET /weather/daily` now includes `sunshine_duration_hours` (null for all existing rows).
- Migration applied and verified on Supabase. Upgrade and downgrade both confirmed clean.
- Docs updated: `SCHEMA.md` (migration history + column reference), `PROGRESS.md`.

## T68–T70 — Unified WeatherUnifiedCard + Highcharts Migration (planned 2026-03-03)

Phase 4 extended with three new tasks to replace the separate `WeatherCard` and `WeatherTrendChart` components with a single self-contained `WeatherUnifiedCard` that owns its own date-range filter and uses Highcharts for all chart rendering.

**T67 is superseded** by T68–T70. The `sunshine_duration_hours` type addition and sunlight series are incorporated into T68 and T69 respectively; `WeatherTrendChart` is deleted entirely.

**New tasks added:**
- **T68** — Frontend: Install `highcharts` + `highcharts-react-official`; add `sunshine_duration_hours: number | null` to `WeatherDailyItem` in `src/lib/api/index.ts`; remove `recharts` dependency
- **T69** — Frontend: `WeatherUnifiedCard.tsx` — unified current-day weather summary (temperature, forecast high/low, condition, precipitation, ingest status) + Highcharts 3-series line chart (Temperature / Precipitation / Sunlight Hours) + internal date range filter (default: 2025-03-03 → today in America/Vancouver) + per-series visibility toggle buttons. Component fetches its own range data via `getDashboardRangeBundle`.
- **T70** — Frontend: Dashboard page refactor — remove `WeatherCard`, `WeatherTrendChart`, and the top-level "Dashboard Range" filter section; add `WeatherUnifiedCard`; simplify KPI labels to static last-7-day strings; delete `WeatherCard.tsx` and `WeatherTrendChart.tsx`

**Key design decisions:**
- Highcharts does not natively read CSS variables; colors are read via `getComputedStyle(document.documentElement).getPropertyValue(name)` at mount and re-read on light/dark theme change
- Default chart range is fixed at 2025-03-03 (study start date) → today (America/Vancouver)
- Precipitation and Sunlight series rendered with 0.5 opacity to visually differentiate from the primary Temperature line
- Dashboard KPI cards are no longer range-filtered; they always show all-time totals + last-7-day metrics
- Chart series presets: Study Start → Today, Last 7 days, Last 30 days, Last 90 days, Custom (date pickers)

**Docs updated:** `docs/DESIGN_SPEC.md`, `docs/styleguide.md`, `docs/kanban.md`, `docs/PROGRESS.md`

### T68 — Completed 2026-03-03

**Acceptance criteria met:**

- Installed `highcharts@^12.5.0` and `highcharts-react-official@^3.2.3` in `frontend/package.json`
- Removed `recharts` from `frontend/package.json` dependencies
- Added `sunshine_duration_hours: number | null` to `WeatherDailyItem` in `frontend/src/lib/api/index.ts`
- Deleted `frontend/src/lib/components/WeatherTrendChart.tsx` (superseded; imports removed from dashboard page)
- `tsc --noEmit` passes with no errors

---

## T64–T67 — Open-Meteo Historical Weather Backfill (planned 2026-03-03)

Phase 4 extended with four new tasks to implement historical weather gap-filling via the Open-Meteo Archive API. Goal: make the weather trend graph continuous from 2025-01-01 by backfilling temperature, humidity, precipitation, and sunshine duration for dates that have no UBC EOS live data.

**New tasks added:**
- **T64** — DB migration: `sunshine_duration_hours DOUBLE PRECISION NULL` added to `weather_daily`; ORM model + Pydantic schema updated
- **T65** — Backend: `historical_weather_service.py` (Open-Meteo fetch) + `historical_weather_backfill_service.py` (precedence logic: insert / enhance import rows / skip UBC live rows)
- **T66** — Backend: `POST /weather/backfill/historical` endpoint (LabMember JWT, optional date range, returns `days_inserted / days_enhanced / days_skipped`)
- **T67** — Frontend: `sunshine_duration_hours` TypeScript type + dashed amber sunshine line in `WeatherTrendChart`

**Key design decisions documented in `docs/HISTORICAL_WEATHER_BACKFILL.md`:**
- Open-Meteo queried with `timezone=America/Vancouver` → returned `daily.time` strings are already `date_local` values; no conversion needed
- Import-sourced temperature/precipitation is never overwritten (import wins on `current_temp_c` and `current_precip_today_mm`)
- UBC EOS live rows are never touched
- Audit trail: one `weather_ingest_runs` row per affected day, `parser_version=open-meteo-v1`, `requested_via=historical_api_backfill`

**Docs updated:** `docs/API.md`, `docs/WEATHER_INGESTION.md`, `docs/SCHEMA.md`, `docs/HISTORICAL_WEATHER_BACKFILL.md` (new), `docs/kanban.md`

---

## T63 — Frontend: UI polish (dashboard, weather components, surveys, favicon/top bar) (completed 2026-03-03)

**Acceptance criteria met:**

- Dashboard hierarchy is polished and coherent with no Recent Sessions panel:
  - order now emphasizes Hero action -> date-range controls -> KPI cards -> weather context -> weather trend chart
  - KPI cards and weather card received consistent card treatment (border, glow accents, spacing hierarchy)
- Button hover/focus behavior is now consistent across key RA + participant surfaces:
  - improved shared shadcn `Button` interaction baseline (focus ring offset, transition set, shadow consistency)
  - migrated custom action buttons in `login`, `import-export`, `digitspan`, `dashboard` preset chips, and `SurveyForm` submit to shared button styling
- Survey pages were redesigned via shared `SurveyForm` using the provided survey-page references as inspiration only:
  - calmer card-shell container, clearer question grouping, optional progress bar derived from step label, and answered-count helper
  - submission/error/duplicate-submit behavior remains unchanged
- Top bar + favicon branding updated from provided references while preserving theme consistency:
  - new RA capsule navbar with integrated logo mark (`frontend/public/ww-mark.png`)
  - app icon now served from `frontend/src/app/icon.png` (logo-derived)
  - browser theme colors moved to `viewport.themeColor` for light/dark alignment

**Verification:**

- `npm run lint` (frontend) passes.
- `npx tsc --noEmit` (frontend) passes.
- `npm run build` (frontend) passes.

## T62 — Frontend: system-default light/dark theme toggle (completed 2026-03-03)

**Acceptance criteria met:**

- Added global theme runtime wiring:
  - `frontend/src/lib/theme.ts` defines preference types, resolver logic, storage key (`ww-theme-preference`), and boot script.
  - `frontend/src/lib/components/ThemeProvider.tsx` applies the resolved theme globally, persists preference in `localStorage`, and reacts to system theme changes.
  - `frontend/src/app/layout.tsx` now injects an early theme init script and wraps the app with `ThemeProvider` so first paint and hydrated state remain aligned.
- Added RA-nav theme control:
  - `frontend/src/lib/components/ThemeToggle.tsx` now exposes a light/dark toggle; startup still defaults to system-resolved theme when no preference is saved.
  - `frontend/src/lib/components/RANavBar.tsx` now exposes the theme control alongside sign-out.
- Updated semantic theming in `frontend/src/app/globals.css`:
  - UBC-based light semantic tokens remain in `:root`.
  - Replaced placeholder dark tokens with a UBC-tonal dark mapping in `.dark` (no purple-biased palette).
  - Added `color-scheme` synchronization for native control rendering.
- Ensured UI elements remain theme-compatible by replacing non-semantic hardcoded text colors in key pages/components (session placeholder, import warnings/success text, weather status states, digit span feedback, etc.).
- **Requested add-on completed after T62 implementation:** global typography now uses JetBrains Mono only:
  - Removed Geist font imports from `frontend/src/app/layout.tsx`.
  - Mapped both `--font-sans` and `--font-mono` to the JetBrains Mono stack in `frontend/src/app/globals.css`.

**Verification:**

- `npm run lint` (frontend) passes.
- `npx tsc --noEmit` (frontend) passes.
- `npm run build` (frontend) passes.

## T61 — Frontend: weather graph (Recharts) + filter wiring (completed 2026-03-03)

**Acceptance criteria met:**

- Added a reusable `WeatherTrendChart` component at `frontend/src/lib/components/WeatherTrendChart.tsx` using `recharts` (`ComposedChart`) with:
  - temperature as a line (`weather_daily.current_temp_c`)
  - participant counts as bars (`participants_per_day.participants_completed`)
  - precipitation shown in tooltip (`weather_daily.current_precip_today_mm`) when present
- Graph data is generated by date-key merging of the already-fetched dashboard range bundle data; no independent fetch path exists in the graph component.
- Dashboard range wiring updated in `frontend/src/app/(ra)/dashboard/page.tsx`:
  - stores `participants_per_day` from `getDashboardRangeBundle(...)`
  - passes `appliedRange`, range weather, and participants/day into `WeatherTrendChart`
  - clears graph range data on filter reset
- Missing values handled safely:
  - temperature remains `null` for missing days and the line skips those points (`connectNulls={false}`)
  - participant bars default to `0` for days with no participant rows
- Tooltip content includes:
  - `date_local`
  - `temp`
  - `precip`
  - `participant count`
- Dependency update:
  - added `recharts` to `frontend/package.json`

**Verification:**

- `npm run lint` (frontend) passes.
- `npx tsc --noEmit` (frontend) passes.
- `npm run build` still fails in this sandbox due blocked outbound Google Fonts fetch (`Geist`, `Geist Mono`), unchanged from prior tasks and unrelated to T61 logic.

## T60 — Frontend: dashboard date-range filter + remove Recent Sessions panel (completed 2026-03-03)

**Acceptance criteria met:**

- Dashboard now includes date-range controls with clear defaults and study-timezone semantics:
  - Presets: `Default`, `Today`, `Last 7 days`, `Last 30 days`, `This month`
  - Custom controls: `date_from` + `date_to` inputs with explicit Apply
  - Context copy states that filtering semantics use `America/Vancouver`
- Default (unfiltered) mode still uses existing cached -> live SWR behavior through `getDashboardBundle("cached")` then `getDashboardBundle("live")`.
- Filtered mode uses `getDashboardRangeBundle(dateFrom, dateTo)` only (live-only range bundle path) and does not fall back to or re-show cached dashboard bundle data for filtered requests.
- Range-fetch error handling is non-destructive:
  - Transient errors do not clear currently displayed dashboard values.
  - Inline error messaging is shown while previously displayed values remain visible.
- Removed the Recent Sessions dashboard panel and eliminated dashboard `/sessions` fetch usage:
  - Removed `apiGet("/sessions?...")` from `frontend/src/app/(ra)/dashboard/page.tsx`
  - Removed all Recent Sessions rendering/state code.
- Weather card date context now aligns with filter state:
  - Added `focusDate` prop to `WeatherCard`
  - In filtered mode, dashboard passes `date_to` as the weather context day
  - Card safely falls back to nearest available weather day if the exact context day is missing.

**Verification:**

- `npm run lint` (frontend) passes.
- `npm run build` still fails in this sandbox due blocked outbound access to Google Fonts (`Geist`, `Geist Mono`), consistent with prior runs and unrelated to T60 code changes.

---

## T59 — Frontend: range dashboard bundle route handler + typed wrappers (completed 2026-03-03)

**Acceptance criteria met:**

- Added a new Next.js Route Handler at `frontend/src/app/api/ra/dashboard/range/route.ts`:
  - Verifies Supabase JWT from `Authorization: Bearer <token>` before returning any data.
  - Requires `date_from` and `date_to` (`YYYY-MM-DD`) and returns 422 when missing/invalid.
  - Fetches backend range endpoints in parallel: `/dashboard/summary/range`, `/weather/daily`, `/dashboard/participants-per-day`.
- Filtered range bundle is live-only and bypasses Redis by default:
  - No Upstash Redis read/write path exists in the range route.
  - Backend `fetch()` calls use `cache: "no-store"` and route is marked `dynamic = "force-dynamic"` to avoid stale filter responses.
- Added typed API contracts in `frontend/src/lib/api/index.ts`:
  - `DashboardSummaryRangeResponse`
  - `DashboardParticipantsPerDayItem` / `DashboardParticipantsPerDayResponse`
  - `DashboardRangeBundle` / `DashboardRangeRouteResponse`
  - New wrapper `getDashboardRangeBundle(dateFrom, dateTo)` for same-origin calls to `/api/ra/dashboard/range`.
- Kept component/page API call convention intact: no bare `fetch` introduced in components/pages; all UI-side calls continue through `src/lib/api` wrappers.
- Updated weather typing for Phase 4 graph needs: `WeatherDailyItem` now includes `current_precip_today_mm`.
- Verification:
  - `npm run lint` (frontend) passes.
  - `npm run build` fails in this sandbox due to blocked outbound access to Google Fonts (`Geist`, `Geist Mono`), not due to TypeScript or route-handler contract errors.

---

## T58 — Backend: range-filter dashboard reads + participants-per-day (completed 2026-03-01)

**Acceptance criteria met:**

- `GET /dashboard/summary/range` implemented in `backend/app/routers/dashboard.py`. Accepts `date_from` and `date_to` (YYYY-MM-DD) interpreted in `America/Vancouver` using inclusive local-day windows (UTC conversion via `_local_date_to_utc_range`). Returns `sessions_created`, `sessions_completed`, and `participants_completed` for the range. Single-pass conditional aggregation over all sessions (same pattern as `/dashboard/summary`). Validates `date_from <= date_to` → 422.
- `GET /dashboard/participants-per-day` implemented. Accepts `start`/`end` local dates. Joins `sessions` with `study_days` via `study_day_id`, filters `status=complete`, groups by `study_days.date_local`, returns `sessions_completed` and `participants_completed` per day. Only sessions with a linked `study_day_id` are included. Results ordered `date_local` ASC.
- `GET /weather/daily` response extended: `current_precip_today_mm` added to `WeatherDailyItem` schema (was already stored in `weather_daily` and serialised by `from_attributes`; only the Pydantic model needed updating).
- All date semantics use `STUDY_TIMEZONE` from `app.config` (never hardcoded).
- New schemas: `DashboardSummaryRangeResponse`, `ParticipantsPerDayItem`, `ParticipantsPerDayResponse` in `backend/app/schemas/dashboard.py`.
- OpenAPI verified: all three endpoints correctly typed and registered.

---

## T57 — Backend: one-off Phase 4 backfill for already-imported sessions (completed 2026-03-01)

**Acceptance criteria met:**

- `backend/app/scripts/phase4_backfill.py` created as an idempotent standalone script runnable via `python -m app.scripts.phase4_backfill [--dry-run]`.
- Script loads all `imported_session_measures` rows, batch-queries which canonical table rows already exist, then upserts `digitspan_runs`, `survey_uls8`, `survey_cesd10`, and `survey_gad7` with `data_source='imported'` and the legacy-value columns populated — matching the same logic used by `commit_import` in T55.
- GAD-7: if `anxiety_mean` is an exact integer 0–21, `total_score` and `severity_band` are also set; otherwise only `legacy_mean_1_4` is stored.
- Idempotent: all canonical-table upserts use `ON CONFLICT (session_id) DO UPDATE WHERE data_source='imported'`; the DB-level guard prevents overwriting native rows. Re-running reports 0 creates and N updates per table.
- `sessions.study_day_id` is fixed for any session where it is null: derived from `sessions.completed_at` in America/Vancouver, using get-or-create on `study_days`.
- After canonical upserts are committed, the script calls `run_legacy_weather_backfill()` (T56 service) for a unified, idempotent weather backfill pass.
- `--dry-run` flag prints per-table create/update/skip counts and the study_day_id fix count without writing any data.
- Logs structured `INFO` output: session count found, commit confirmation, and a final summary table with per-category counts.
- `backend/app/scripts/__init__.py` created to enable `python -m app.scripts.phase4_backfill` module invocation.
- `docs/devSteps.md` Phase 4 runbook updated to mark the steps as executable.

---

## T56 — Backend: legacy weather backfill (completed 2026-03-01)

**Acceptance criteria met:**

- `POST /admin/backfill/legacy-weather` (RA-protected) implemented in `backend/app/routers/admin.py`; service logic in `backend/app/services/weather_backfill_service.py`.
- Backfill groups `imported_session_measures` by `study_days.date_local` (America/Vancouver), computing mean `temperature_c` and `precipitation_mm` per day. Supports 1:M day↔session relationship via aggregate.
- Only `current_temp_c` and `current_precip_today_mm` are populated in `weather_daily`; all other fields are null (JSONB NOT-NULL columns set to `[]`/`{}`).
- One `weather_ingest_runs` audit row per backfilled day: `parser_version="legacy-import-v1"`, `requested_via="legacy_backfill"`. `date_local` on the run row matches the backfilled day, preserving the analytic join key.
- Existing `weather_daily` rows are never overwritten (`on_conflict_do_nothing` guard).
- Idempotent: second call returns `days_backfilled=0, days_skipped=109`.
- Verified: 109 days backfilled from reference XLSX. 2 existing UBC-ingest rows untouched.

---

## T55 — Backend: import commit writes remapped legacy rows (completed 2026-03-01)

**Acceptance criteria met:**

- Import commit upserts `digitspan_runs` with `data_source='imported'` and `total_correct` from legacy `digit_span_score` (0–14); `max_span` remains null. 199 rows populated from 207-row reference XLSX.
- Import commit upserts survey rows with `data_source='imported'` and `legacy_mean_1_4` populated: `survey_uls8` (205 rows), `survey_cesd10` (206 rows), `survey_gad7` (205 rows).
- GAD-7: if legacy `anxiety` is an exact integer 0–21, `total_score` and `severity_band` are set (132/205 rows had deterministic mappings). Otherwise only `legacy_mean_1_4` is stored.
- Re-import is idempotent: second commit ran cleanly — 207 updated, 0 errors; no duplication. `_get_sessions_with_native_rows` updated to filter by `data_source='native'` so sessions with only imported rows allow re-import. `on_conflict_do_update WHERE data_source='imported'` guards against overwriting native rows at DB level.
- Implemented in `backend/app/services/import_service.py`: `_gad7_severity_from_total` helper, updated `_get_sessions_with_native_rows`, and four canonical upsert blocks in `commit_import`.
- Verified against `reference/data_full_1-230.xlsx` (207 rows, 0 errors).

---

## T54 — DB schema: Phase 4 legacy import remapping (completed 2026-03-01)

**Acceptance criteria met:**

- Alembic migration `20260301_000010` adds `data_source VARCHAR(16) DEFAULT 'native' NOT NULL` to `survey_uls8`, `survey_cesd10`, `survey_gad7`, and `digitspan_runs`.
- Legacy-mean columns added: `survey_uls8.legacy_mean_1_4`, `survey_cesd10.legacy_mean_1_4`, `survey_gad7.legacy_mean_1_4` (all NUMERIC NULLABLE). Legacy-total added: `survey_gad7.legacy_total_score` (SMALLINT NULLABLE).
- UNIQUE constraint on `session_id` added to all four tables (`uq_digitspan_runs_session_id`, `uq_survey_uls8_session_id`, `uq_survey_cesd10_session_id`, `uq_survey_gad7_session_id`).
- `digitspan_runs.max_span` made nullable; raw `r*` columns and computed score columns in the three survey tables made nullable to accommodate imported rows that lack item-level data.
- Existing native rows are unaffected: they receive `data_source='native'` via the column default and all previously-NOT-NULL columns already have data. Native submissions continue to be validated via Pydantic (unchanged).
- SQLAlchemy models updated: `digitspan.py`, `surveys.py` — `Optional` typing added for nullable columns, `UniqueConstraint` added via `__table_args__`.
- Docs updated: `SCHEMA.md` (table definitions + migration history), `API.md` (Phase 4 note), `PROGRESS.md`, `DECISIONS.md`.
- Migration structure verified: revision chain correct (`20260228_000009` → `20260301_000010`); model assertions pass.
- **Run `alembic upgrade head` to apply migration to Supabase.**

---

## T52 — Frontend: consent gating page (completed 2026-02-28, revised ×2 2026-02-28)

**Acceptance criteria met:**

- Participant consent page created at `frontend/src/app/session/[session_id]/consent/page.tsx`.
- Displays the official lab consent form (`reference/Consent Form 2.pdf`) via a full-height `<iframe>` (file copied to `frontend/public/consent-form.pdf` for static serving). No text replication in code.
- Two explicit action buttons replace the earlier checkbox design:
  - **"I Consent"** — routes to `/session/<session_id>/uls8`, beginning the data-collection phase.
  - **"I Do Not Consent"** — routes to `/dashboard`, returning the RA to the home screen.
- No API call at consent step; no DB record written (UI-only gating).
- Page is client-only (`"use client"`); uses `useRouter` from Next.js; no bare `fetch`.
- **Second revision (routing restructure):** Consent now happens *before* session creation.
  - Created `frontend/src/app/(ra)/new-session/page.tsx` — two-step RA-protected page: Step 1 = consent PDF iframe + "I Consent"/"I Do Not Consent"; Step 2 = demographics form + "Back"/"Start Session".
  - "I Do Not Consent" → `/dashboard` (no participant/session created).
  - "I Consent" → shows demographics form; on submit → `POST /sessions/start` → navigates to `result.start_path`.
  - `(ra)/dashboard/page.tsx` simplified: "Start New Entry" now routes to `/new-session`; demographics dialog and all related state removed.
  - `session/[session_id]/consent/page.tsx` deleted (consent no longer lives within the session flow).
  - Backend `start_path` updated: `POST /sessions/start` now returns `/session/<session_id>/uls8` (not `/consent`).
  - `tsc --noEmit` passes with zero errors.
  - `API.md`, `DESIGN_SPEC.md` updated to reflect new flow order and removed `/consent` route.

---

## T51b — Frontend: Start New Entry demographics questionnaire (completed 2026-02-28)

**Acceptance criteria met:**

- "Start New Entry" button now opens a shadcn Dialog with a required demographics form before creating any session.
- Form fields: Age band, Gender, Coming from (origin), Commute method, Time spent outside — each with the canonical preset options from the legacy XLSX value set.
- When `origin` or `commute_method` is `"Other"`, a free-text Input appears immediately below the select, with a visible PII warning ("Do not enter names, initials, or any information that could identify the participant."). Submit is disabled until the free-text field is non-empty.
- Submit button disabled until all required fields are complete (including conditional Other text); form state fully preserved on API failure.
- On submit, calls `startSession(payload)` from `src/lib/api/index.ts` (typed wrapper, no bare fetch) with the full demographics payload; routes to `result.start_path` (i.e., `/session/<id>/consent`).
- Inline error messages on failure are non-technical (auth expiry / server error / network error).
- Added `StartSessionCreate` interface and updated `startSession(payload)` signature in `src/lib/api/index.ts`.
- Installed shadcn components: `dialog`, `select`, `label`, `input`.
- Build passes with no TypeScript errors.

---

## T51a — Backend: start session requires demographics + daylight exposure compute (completed 2026-02-28)

**Acceptance criteria met:**

- `POST /sessions/start` now requires a demographics payload: `age_band`, `gender`, `origin`, `commute_method`, `time_outside` (all required); `origin_other_text` and `commute_method_other_text` conditionally required when the corresponding field is `"Other"`.
- All fields validated server-side against canonical preset option lists (defined in `backend/app/schemas/sessions.py`). Invalid values return HTTP 422 with descriptive messages.
- If `origin` or `commute_method` is `"Other"`, the corresponding `*_other_text` field is required and must be non-empty; otherwise it is ignored.
- Demographics stored on the `participants` row only (not on `sessions`): `age_band`, `gender`, `origin`, `origin_other_text`, `commute_method`, `commute_method_other_text`, `time_outside`.
- `participants.daylight_exposure_minutes` computed at request time using `compute_daylight_exposure_minutes(datetime.now(utc))` from `backend/app/config.py` and stored on the participant row.
- `start_path` in the response is now `/session/<session_id>/consent` (was `/session/<session_id>/uls8`), consistent with the consent-gated participant flow (T52).
- `StartSessionCreate` Pydantic schema added to `backend/app/schemas/sessions.py` with a `model_validator` enforcing all preset and conditional rules.
- Verified: schema imports cleanly; validator accepts valid payloads; rejects invalid `age_band`, missing `*_other_text` when `Other` selected.
- Docs updated: `docs/API.md` (endpoint status, full request/response), `docs/DESIGN_SPEC.md` (questionnaire note), `docs/devSteps.md` (one-click flow section), `docs/PROGRESS.md`.

---

## T51 — Frontend: UI cleanup — remove /participants and /sessions, update nav (completed 2026-02-28)

**Acceptance criteria met:**

- `src/app/(ra)/participants/page.tsx` and its directory removed
- `src/app/(ra)/sessions/page.tsx` and its directory removed
- `RANavBar` now contains Dashboard + Import/Export + Sign out only; Participants and Sessions links removed
- `DESIGN_SPEC.md` updated: IA section updated to reflect final nav (no longer describes removed pages)
- `.next` build cache cleared; TypeScript strict-mode check passes with no errors

---

## T50 — Frontend: Import/Export page (completed 2026-02-28)

**Acceptance criteria met:**

- RA-only `/import-export` page created at `frontend/src/app/(ra)/import-export/page.tsx`
- Import section: drag-and-drop or click-to-browse for `.csv` / `.xlsx` files; auto-previews on file select; shows participant/session create+update counts plus row-level errors and warnings
- Errors disable the Confirm Import button with an explanatory message; warnings are shown but do not block commit
- Confirm Import triggers commit; success summary shows created/updated counts; "Import another file" resets the flow
- Export section: Export XLSX and Export CSV (zip) buttons; each shows loading state while downloading; triggers browser download with server-provided filename
- All API calls go through typed wrappers in `src/lib/api/index.ts`: `importPreview`, `importCommit`, `exportXlsx`, `exportZip` — no bare `fetch` in page component
- New types exported: `ImportRowIssue`, `ImportPreviewResponse`, `ImportCommitResponse`
- TypeScript strict-mode check passes with no errors

---

## T49 — Backend: admin export XLSX + ZIP CSV (completed 2026-02-28)

**Acceptance criteria met:**

- `GET /admin/export.xlsx` implemented — returns a schema-faithful XLSX workbook; requires RA auth
- `GET /admin/export.zip` implemented — returns a ZIP with one schema-faithful CSV per table; requires RA auth
- Both endpoints implemented in `backend/app/routers/admin.py`; export logic in `backend/app/services/export_service.py`
- XLSX structure: README sheet (description, join key guide, value conventions) + 12 data sheets in logical order
- Sheet/file order: participants, sessions, survey_uls8, survey_cesd10, survey_gad7, survey_cogfunc8a, digitspan_runs, digitspan_trials, study_days, weather_ingest_runs, weather_daily, imported_session_measures
- Filename format: `"Weather and wellness - YYYY-MM-DD.xlsx"` / `".zip"` (date in `America/Vancouver`)
- All join keys present on relevant sheets: `participant_uuid`, `session_id`, `study_day_id`, `run_id`, `source_run_id`
- Value conventions: UUIDs → ISO strings; datetimes → ISO-8601 UTC strings; JSONB → JSON strings; numerics and booleans preserved as native types in XLSX
- Headers bolded and first row frozen in XLSX for usability
- No secrets exposed: export queries DB through existing SQLAlchemy session; no raw credentials in response
- Verified: XLSX produces 13 sheets with correct headers; ZIP produces 12 CSVs with correct headers (all confirmed by unit test)

---

## T48 — Backend: admin import preview/commit (completed 2026-02-28)

**Acceptance criteria met:**

- `POST /admin/import/preview` and `POST /admin/import/commit` implemented in `backend/app/routers/admin.py` — both RA-protected (`Depends(get_current_lab_member)`)
- New service module `backend/app/services/import_service.py` implements all parsing and DB logic
- New schemas in `backend/app/schemas/admin.py`: `ImportRowIssue`, `ImportPreviewResponse`, `ImportCommitResponse`
- Excel date serials converted via base date `date(1899, 12, 30) + timedelta(days=N)`; Python `datetime`/`date` objects from openpyxl accepted directly
- Daytime values accept: Python `time`/`datetime` objects, Excel fraction floats (0.0–<1.0), `HH:MM` / `HH:MM:SS` strings — used to compute `participants.daylight_exposure_minutes` via `compute_daylight_exposure_minutes()` from `app.config`
- Demographic string normalization: whitespace-trimmed; canonical age band variants (`Over 38` → `>38`), gender variants (`Nonbinary person` → `Non-binary`); `origin`/`commute_method` values starting with "Other" split into `canonical="Other"` + `*_other_text`
- Upsert rules: participant by `participant_number` (demographics overwrite); session: 0→create, 1→update (blocked if has native survey/digitspan rows), >1→error
- Imported sessions: `status="complete"`, `study_day_id` from `date_local`, timestamps anchored to 12:00 local (`America/Vancouver`) → UTC
- `imported_session_measures` upserted (keyed by `session_id`) with full `source_row_json` audit payload
- Commit is transactional (all or nothing); fails with HTTP 422 + row-level error detail if any row is invalid
- Duplicate `participant ID` within the same file detected as an error (not silently overwritten)
- Verified against `reference/data_full_1-230.xlsx`: 207 rows parsed, 0 errors, 0 warnings
- New packages added to `requirements.txt`: `openpyxl>=3.1.0`, `python-multipart>=0.0.9`

---

## T47a — Backend infra: study timezone and daylight exposure config (completed 2026-02-28)

Migration `20260228_000008` applied to Supabase (now at `head`):

- Created `backend/app/config.py`: `STUDY_TIMEZONE = "America/Vancouver"`, `get_daylight_start_local_time()` (reads env var, default `"06:00"`), `compute_daylight_exposure_minutes(session_start)` (pure function, tested)
- Fixed `America/Edmonton` → `America/Vancouver` bug in `weather_parser.py` (`_TZ_EDMONTON` → `_TZ_VANCOUVER`), `weather.py` router (`tz_name` in study_days upsert, query descriptions), and `models/weather.py` (`StudyDay.tz_name` default and docstring)
- Data-fix migration corrected all existing `study_days` rows and the `tz_name` server_default
- Sessions router `date_from`/`date_to` filter now uses local-day boundaries in `America/Vancouver` instead of UTC midnight
- Docs updated: `SCHEMA.md`, `WEATHER_INGESTION.md`, `API.md`, `CONVENTIONS.md`, `devSteps.md`, `DECISIONS.md` (no change needed — RESOLVED-12 was already correct)

---

## T47 — DB schema: demographics columns + imported_session_measures table (completed 2026-02-28)

Migration `20260228_000007` applied to Supabase (now at `head`):

- Added 8 nullable columns to `participants`: `age_band`, `gender`, `origin`, `origin_other_text`, `commute_method`, `commute_method_other_text`, `time_outside`, `daylight_exposure_minutes`
- Created `imported_session_measures` table (PK = `session_id`; FK to `sessions` and `participants`); stores legacy aggregate measures + full `source_row_json` audit column
- SQLAlchemy models updated: `Participant` (demographics), new `ImportedSessionMeasures`
- Pydantic schemas updated: `ParticipantResponse` (demographics fields added), new `ImportedSessionMeasuresResponse`
- `SCHEMA.md` updated: planned items marked applied, migration history row added, entity diagram updated

---

## T46 — Docs/spec: Phase 3 admin import/export + UI cleanup + consent + demographics + dashboard filtering (completed 2026-02-28)

Phase 3 documentation is now decision-complete for upcoming implementation tasks:
- `docs/API.md` expanded Phase 3 admin import rules (expected headers, Excel serial/time parsing, normalization, and upsert rules) and added a planned `GET /dashboard/summary/range` contract for date-range filtering.
- `docs/DESIGN_SPEC.md` updated participant flow to include consent gating, clarified Phase 3 IA (dashboard + import/export; remove `/participants` + `/sessions`), and specified dashboard filter + weather behavior.
- `docs/SCHEMA.md` documented legacy import column→DB mappings for demographics and `imported_session_measures`.
- Runbooks/conventions updated: `docs/devSteps.md`, `docs/CONVENTIONS.md`, `docs/WEATHER_INGESTION.md`, and `AGENTS.md`.

---

## T45 — Verification: production smoke test and cold-start UX check (completed 2026-02-28)

**Verification method:** Code-level review of route handler and dashboard logic; build verification via `tsc --noEmit` + `next build`. Production e2e checklist in `docs/devSteps.md` (smoke test section) is owned by the developer post-deployment.

**Acceptance criteria — verified:**

| Criterion | Verification | Result |
|---|---|---|
| Second visit (≤5 min) renders from cache without waiting on Render | Phase 1 calls `getDashboardBundle('cached')` → route handler returns Redis bundle immediately if `ww:ra:dashboard:v1` key exists (TTL 300s). `setSummaryLoading(false)` + UI update happens before Phase 2 starts. No Render call in the cached path. | ✅ Verified by code review |
| Dashboard refreshes to live values once backend responds | Phase 2 always calls `getDashboardBundle('live')` → route handler fetches `/dashboard/summary` + `/weather/daily` from Render in parallel, writes to Redis, returns fresh bundle → dashboard updates all state. | ✅ Verified by code review |
| No unauthorized access without valid JWT (401 on missing/invalid token) | `verifySupabaseJWT()` is called on every request before any Redis read or Render fetch. Missing `Authorization` header → 401 `{"detail":"Missing Authorization header"}`. Invalid/expired token → 401 `{"detail":"Invalid or expired token"}`. No branch bypasses auth check. | ✅ Verified by code review |
| `tsc --noEmit` passes | Ran 2026-02-28 | ✅ Pass (0 errors) |
| `next build` passes | Ran 2026-02-28 | ✅ Pass — `ƒ /api/ra/dashboard` listed as dynamic route handler |

**Production e2e checklist (developer-owned — run after Vercel deploy):**
See `docs/devSteps.md` → "Vercel Upstash Cache Setup → 3) Smoke test checklist" for the full list of curl/browser checks covering 401, cache hit, cache miss, and live refresh.

---

## T44 — Docs/runbook: Vercel Upstash cache setup (completed 2026-02-28)

All acceptance criteria met by work done during T41:
- `docs/devSteps.md` "Vercel Upstash Cache Setup" section covers integration steps, server-only vs `NEXT_PUBLIC_*` env vars, local dev setup, and a smoke-test checklist for cache hit/miss/live/401.
- `docs/ARCHITECTURE.md` — Vercel Cache Route Handler section added.
- `docs/CONVENTIONS.md` — caching conventions expanded (jose, Redis key versioning).

---

## T43 — Frontend: eliminate extra cold-start fetches on dashboard (WeatherCard) (completed 2026-02-28)

**Acceptance criteria met:**
- WeatherCard on-mount fetch (`getWeatherStatus`) removed entirely. Component now accepts `weather: WeatherDailyResponse | null` prop — null shows loading skeleton, data shows content. No independent backend call on mount.
- WeatherCard displays today's summary fields: `current_temp_c` (large), `forecast_high_c` / `forecast_low_c`, `forecast_condition_text`. Data sourced from `weather.items[0]`.
- Manual "Update Weather" action still works: calls `triggerWeatherIngest()`, stores result in `ingestOverride` state which overrides `latestRun` display without a full re-fetch.
- WeatherCard moved above KPI cards in the dashboard (hero → weather → KPIs → sessions).
- Dashboard passes `weather={weatherData}` where `weatherData` is set from the bundle in both Phase 1 (cached) and Phase 2 (live).
- Dashboard mount triggers exactly one live backend refresh path (through `/api/ra/dashboard?mode=live` → Vercel route handler → Render backend).
- `WeatherDailyItem` interface added to `src/lib/api/index.ts`; `WeatherDailyResponse.items` typed as `WeatherDailyItem[]`.
- `getWeatherStatus()` wrapper removed (unused after refactor).
- `tsc --noEmit` clean; `next build` passes.

---

## T42 — Frontend: typed API wrappers + RA dashboard stale-while-revalidate (completed 2026-02-28)

**Acceptance criteria met:**
- `getDashboardBundle(mode: 'cached' | 'live')` typed wrapper added to `src/lib/api/index.ts`. Calls same-origin `/api/ra/dashboard` with the Supabase JWT. No bare `fetch` from components.
- Dashboard page refactored to stale-while-revalidate: Phase 1 fetches cached bundle (shows KPIs immediately if Redis hit); Phase 2 fetches live bundle in parallel with sessions list and updates values when it arrives.
- Separate `summaryLoading` (KPI cards) and `sessionsLoading` (sessions list) states so cached KPIs show instantly while sessions continue loading.
- Error banner only displayed when no data is available at all; cached data view is never wiped by a background live-refresh failure.
- `tsc --noEmit` clean; `next build` passes.

---

## T41 — Frontend infra: Upstash Redis cache + RA JWT verification (completed 2026-02-28)

**Acceptance criteria met:**
- `GET /api/ra/dashboard?mode=cached|live` route handler created at `frontend/src/app/api/ra/dashboard/route.ts`
- JWT verification: ES256 via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) with HS256 fallback using `SUPABASE_JWT_SECRET`. Returns 401 for missing/invalid tokens.
- `mode=cached`: checks Upstash Redis for key `ww:ra:dashboard:v1`; returns `{ cached: true, data: <bundle> }` on hit, `{ cached: false, data: null }` on miss.
- `mode=live`: fetches `/dashboard/summary` + `/weather/daily?start=today&end=today` from Render backend in parallel, writes bundle to Redis with TTL 300s, returns `{ cached: false, data: <bundle> }`.
- Redis client is created only if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (server-only vars). Gracefully degrades if absent.
- `DashboardBundle` and `DashboardRouteResponse` types added to `src/lib/api/index.ts`.
- `@upstash/redis` and `jose` npm packages installed.
- `tsc --noEmit` passes clean. `next build` succeeds; route listed as `ƒ /api/ra/dashboard`.

**Packages added:** `@upstash/redis`, `jose`

---
