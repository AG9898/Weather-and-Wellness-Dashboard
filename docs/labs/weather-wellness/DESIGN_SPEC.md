# Design Spec — Phase 1 + Phase 2 + Phase 3 + Phase 4

Visual language baseline: [docs/styleguide.md](../../styleguide.md) · Animation library: [docs/animejs.md](../../animejs.md)

## UX Goals
- Guided, simple flow — one screen per step, no back navigation during session
- Keyboard-only digit span (no mouse interaction)
- Exact survey wording from lab instrument forms (present-tense, "Right now..." framing)

## RA Flow
1. Login
   - App-owned RA/admin invitation links use `/set-password?invite=<token>`; successful activation sets the Supabase Auth password through the backend invitation acceptance endpoint, then returns the user to normal email/password login.
2. Click "Start New Entry" → navigates to `/new-session`
3. **Step 1 (consent):** Participant reads the official consent PDF; clicks "I Consent" to proceed or "I Do Not Consent" to cancel and return to dashboard (no DB record in either case)
4. **Step 2 (demographics):** RA fills required participant details and chooses either production start or rehearsal start:
   - **Start Session:** backend creates anonymous participant + active session atomically
   - **Run Test Trial:** frontend enters local-only trial mode with a fake session id and no backend calls
5. RA is navigated directly into the participant survey flow (`/session/<id>/uls8`) for either mode
6. After completion, return to RA dashboard:
   - production mode: KPIs reflect the new complete session
   - trial mode: no KPI/data changes (no writes)
7. View data via Supabase Studio
8. To run a Misokinesia session: click the **Misokinesia** entry in the floating dock → navigates to `/misokinesia` → click either "Start Misokinesia Session" (backend-backed write path) or "Run Test Trial" (read-only rehearsal path) → app navigates to `/misokinesia/[id]` participant task page (same device). See [Misokinesia Flow](#misokinesia-flow) below.

## Participant Flow
1. ULS-8 survey
2. CES-D 10 survey
3. GAD-7 survey
4. Cognitive Function 8a survey
5. Digit Span instructions → practice trial → 14 scored trials → session marked complete
6. Completion screen (thank you) → return to RA dashboard

> **Note:** Consent is obtained at `/new-session` (Step 1 of the RA flow) before the participant session is created. There is no consent page within the `/session/[id]/` route tree.

## Trial Run Mode (no-write rehearsal)

Trial Run mode is an RA-invoked rehearsal path for both WW and Misokinesia. It demonstrates the participant interaction flow without writing research data.

- Launch points:
  - WW: `/new-session` (after consent + demographics view)
  - Misokinesia: `/misokinesia`
- Data behavior:
  - Uses frontend-generated fake ids (`session_id`, and for misokinesia also fake `misokinesia_participant_id`)
  - WW trial mode does not call FastAPI endpoints
  - Misokinesia trial mode may call a read-only RA endpoint for a sampled clip manifest, but never calls write endpoints
  - Never writes rows to `participants`, `sessions`, survey tables, digit span tables, or misokinesia tables
  - Misokinesia Trial Run locally randomizes MkAQ timing as `"pre"` or `"post"` and never persists that assignment
- Misokinesia video behavior:
  - Samples 5 active videos by `stimulus_id` each time "Run Test Trial" is clicked
  - Plays the sampled videos from public Supabase Storage CDN URLs
  - Does not serve or proxy video bytes through FastAPI
- UX behavior:
  - Preserves the same end-to-end screen order as production flow
  - Shows a centered top-screen "Trial Run" watermark on WW participant trial-mode screens; Misokinesia participant task screens do not show this badge
  - Ends on the standard completion screens

---

## Misokinesia Flow

Full specification: [docs/labs/weather-wellness/tasks/MISOKINESIA.md](tasks/MISOKINESIA.md)

**RA steps:**
1. Navigate to `/misokinesia` via floating dock
2. Choose launch mode:
   - **Start Misokinesia Session** — backend atomically creates anonymous participant + session
   - **Run Test Trial** — frontend creates fake ids and loads a read-only 5-clip trial manifest (no backend start/write call)
3. App navigates to `/misokinesia/[id]` participant task page (same device, no login required)

**Participant task:**
1. Intro screen → click to begin
2. MkAQ timing is randomized per participant as either pre-trial or post-trial and stored for analysis
3. If assigned pre-trial: complete MkAQ before the first clip
4. Production mode: for each of 29 clips (randomized per session): video plays → 4-question per-clip form (scale 1–5) → submit
5. Trial mode: for each of 5 sampled clips (randomized on launch): video plays → 4-question per-clip form (scale 1–5) → local simulated submit
6. If assigned post-trial: complete MkAQ after the final clip response and before the end-of-task form
7. End-of-task form shown once after all clips and the assigned MkAQ position are complete
8. Completion screen → RA clicks "Back to Misokinesia" (routes to `/misokinesia`)

**MkAQ card carousel:**
- Production uses all 21 MkAQ items in four panes: `q1`-`q5`, `q6`-`q10`, `q11`-`q15`, `q16`-`q21`.
- Trial Run uses the shortened fixed rehearsal set `q1`-`q10` in two panes: `q1`-`q5`, `q6`-`q10`.
- The carousel stays on the same participant page; panes are not separate routes or separate submit steps.
- Participants can move backward after advancing; moving forward requires all questions on the current pane to be answered.
- Final submit is available only after all required answers for the current mode are selected.

Key differences from survey/digit-span flow: fully anonymous (no demographics), single-page state machine, videos served directly from Supabase Storage CDN (not proxied through backend).

---

## Digit Span UI Flow

Full specification: [docs/labs/weather-wellness/tasks/DIGITSPAN.md](tasks/DIGITSPAN.md)

1. **Instruction screen** — title, explanation, example (Sequence: 1 2 3 4 5 → Correct: 5 4 3 2 1), advance on spacebar/button
2. **Practice intro** — "We will begin with a practice trial...", advance on spacebar/button
3. **Practice trial** — show digits one at a time (1000ms each, 100ms gap), then input screen with "Type the sequence in backwards order:" prompt; after submit show green "Correct" or red "Incorrect" for 2000ms
4. **Main trials intro** — "We will now begin the main trials...", advance on spacebar/button
5. **14 scored trials** — same digit display + input flow as practice, but NO feedback after each trial
6. **End of task**:
   - production mode: POST trial data to backend and route to first survey on 2xx
   - trial mode: run local simulated submit success and route to first survey with no API call

**Input behavior:**
- Show digits entered in real time as participant types
- Only accept digit keys 1-9; ignore other keys
- Backspace deletes last digit; Enter submits
- No time limit on response

---

## Survey UI Conventions

All four surveys share:
- **Time frame:** "Right now..." (present tense)
- **All items required** — form cannot submit until every item has a response
- **Production mode:** POST to backend on submit — route to next survey only after 2xx response
- **Trial mode:** local simulated submit success — route to next survey with no backend request
- **No back navigation** — participant cannot return to a previous survey

### Response scales by instrument

| Survey     | Scale | Labels                                           | Details doc |
|------------|-------|--------------------------------------------------|-------------|
| ULS-8      | 1-4   | Never / Rarely / Sometimes / Often               | [ULS8.md](surveys/ULS8.md) |
| CES-D 10   | 1-4   | Never / Rarely / Sometimes / Often               | [CESD10.md](surveys/CESD10.md) |
| GAD-7      | 1-4   | Never / Rarely / Sometimes / Often               | [GAD7.md](surveys/GAD7.md) |
| CogFunc 8a | 1-5   | Never / Rarely / Sometimes / Often / Very Often   | [COGFUNC8A.md](surveys/COGFUNC8A.md) |

---

## Survey Scoring (summary)

All scoring is server-side. See per-instrument docs for full formulas.

- **ULS-8:** reverse items 3 & 6 (`5 - raw`), mean → 0-100 transform
- **CES-D 10:** raw 1-4, convert to 0-3 (`raw - 1`), reverse items 5 & 8 (`4 - raw`), sum → total 0-30
- **GAD-7:** raw 1-4, convert to 0-3 (`raw - 1`), sum → total 0-21 + severity band
- **CogFunc 8a:** raw 1-5, reverse all (`6 - raw`) for computed scores, sum (8-40) + mean (1.0-5.0)

> Planned dashboard analytics derived from `reference/Weather_MLM.R` must reuse
> these stored scores and must not introduce alternate scoring formulas. See
> `docs/labs/weather-wellness/ANALYTICS.md`.

---

# Design System — Phase 2 (T19+) + Phase 4 Theme Toggle (implemented)

> Implemented in T19. All new pages must follow this system.

## Design Tokens

All brand and semantic tokens are defined in `frontend/src/app/globals.css`.

**Phase 4 (implemented in T62):** Light/dark theme toggle is live:
- Default = **system** (`prefers-color-scheme`)
- Persist explicit user choice in `localStorage`
- References are **inspiration only** (not 1:1 remakes); preserve the clean, shipped research-tool aesthetic
- Theme preference key: `ww-theme-preference`
- RA navigation includes a light/dark toggle control; startup still defaults to `system` when no preference is stored

### UBC Brand Palette (CSS variables)

| Variable | Hex | Usage |
|---|---|---|
| `--ubc-video-blue` | `#001328` | Branded UI accent anchor |
| `--ubc-navy` | `#000847` | Reserved brand token |
| `--ubc-blue-700` | `#001328` | Legacy compatibility token, same accent anchor |
| `--ubc-blue-600` | `#11263A` | Tonal lift of the accent family |
| `--ubc-blue-500` | `#23415A` | Tonal lift of the accent family |
| `--ubc-blue-300` | `#506A81` | Tonal lift of the accent family |
| `--ubc-blue-200` | `#8E9EAF` | Tonal lift of the accent family |
| `--ubc-blue-100` | `#CFD7DE` | Tonal lift of the accent family |
| `--ubc-earth` | `#878343` | Rare warm accent only |
| `--ink-100` | `#E6EDF8` | Light theme background; dark theme primary text |
| `--ink-70` | `#A9B6CC` | Secondary text (dark) / muted UI (light) |
| `--ink-45` | `#6E7C95` | Labels / meta text |

### Shadcn Semantic Token Mapping

Shadcn semantic tokens (`--background`, `--foreground`, `--card`, etc.) are mapped to a neutral light/dark theme system with `#001328` as the only branded UI accent family.
- Current implementation keeps the existing theme preference behavior:
  - `:root` = light theme semantic tokens
  - `.dark` = dark theme semantic tokens
  - root class is controlled by theme preference (`system` resolves via `prefers-color-scheme`)

## Shared Components

| Component | Path | Usage |
|---|---|---|
| `PageContainer` | `src/lib/components/PageContainer.tsx` | Max-width content wrapper for all pages. Use `narrow` prop for survey/task flows. |
| `RAFloatingChrome` | `src/lib/components/RAFloatingChrome.tsx` | Floating RA chrome for shipped RA pages. Provides top-left profile/utility menu plus bottom floating dock navigation. |
| `ThemeToggle` | `src/lib/components/ThemeToggle.tsx` | Toggles between `light` and `dark`; startup still resolves from `system` when no preference is stored. |
| `WeatherUnifiedCard` | `src/lib/components/WeatherUnifiedCard.tsx` | Unified weather display + Highcharts 3-series line chart (Temperature/Precipitation/Sunlight) + internal date range filter (default: study start → anchor date, usually the latest study day or Vancouver today). Replaces the former `WeatherCard` + `WeatherTrendChart` pair (T69–T70). |
| `SurveyForm` | `src/lib/components/SurveyForm.tsx` | Reusable survey renderer for all four instruments with shared progress bar + calm card-shell styling. |

## Layout Structure

### RA Pages (`/dashboard`, `/import-export`, `/users`, `/account/password`)
```
<html class="dark|light">
  <body>
    <RALayout>           ← auth guard
      <RAFloatingChrome /> ← top-left profile/utility menu + bottom dock
      <main>
        <PageContainer>  ← max-w-5xl, responsive padding
          {page content}
        </PageContainer>
      </main>
    </RALayout>
  </body>
</html>
```

**Information architecture (Phase 3, T51 implemented):**
- `/dashboard` is the primary RA landing page.
- `/import-export` is the admin data operations page.
- RA pages `/participants` and `/sessions` have been removed. The backend endpoints remain available for internal operations and debugging.

### RA Profile / Utility Menu

The top-left menu in `RAFloatingChrome` is the self-service RA profile and
utility surface. It appears on shipped RA pages that use the floating chrome.

Required content:
- Signed-in email from the current Supabase Auth session.
- Human-readable role label from `app_metadata.role`: `Admin` for `admin`,
  `Research Assistant` for `ra`, and a safe title-case fallback for unknown
  strings.
- Lab name from `app_metadata.lab_name` when available.
- Theme toggle.
- Change password action.
- Sign out action.

Role and lab are read-only in this menu. They are admin-controlled metadata and
must continue to be changed only through the admin user-management flow.

Password change behavior:
- Opens a lightweight RA-only screen from the profile menu at
  `/account/password`.
- Uses the existing RA auth guard and floating chrome; unauthenticated users are
  redirected through the normal login flow.
- Requires new password and confirm password fields.
- Enforces the same minimum password length used by invite activation: 8
  characters.
- Rejects mismatched confirmation before calling Supabase.
- Calls Supabase Auth with the active browser session to update only the signed
  in user's own password.
- Shows inline success or error feedback and keeps the user signed in after a
  successful change unless Supabase returns a session-invalidating state.

Visual expectations:
- Keep the password screen light, focused, and styled: a single concise form in
  the standard RA page layout, with restrained explanatory copy and inline
  status feedback.
- Use the existing shadcn input, label, and button patterns.
- Avoid adding a broader account-management page or extra admin controls.
- Use icon+label rows consistent with the rest of the floating chrome.

### Participant Pages (`/session/[id]/*`)
```
<html class="dark|light">
  <body>
    <SessionLayout>      ← no-auth, max-w-3xl centered shell
      {page content}
    </SessionLayout>
  </body>
</html>
```

## RA Dashboard Page (T22)

The dashboard at `/dashboard` is the RA home after login. Layout (top to bottom):

1. **Hero action zone** — raised neutral card with a restrained tonal accent glow, headline “Start a New Entry”, description (“Present the consent form, collect participant details, and open a supervised session.”), primary shadcn `Button` (size lg, semantic `primary`) that navigates to `/new-session`.
2. **WeatherUnifiedCard** — single card combining current-day weather summary, “Update Weather” ingest trigger, and an interactive Highcharts chart with an internal date-range filter. See below for full spec.
3. **Temperature summary section** — standalone descriptive analytics surface below the weather card and above the mixed-model section. It owns its own date-range controls plus a dedicated compute/recompute action, loads independently of the mixed-model analytics section, and remains visible even when the broader analytics payload is missing.
4. **Analytics snapshot section** — separate statistical surface below the temperature summary card. It reads the dashboard analytics payload via the same-origin analytics Route Handler, owns its own study-window controls, defaults to the study window (`2025-03-03` → latest study day or Vancouver today), and does not block weather rendering.

The KPI cards row has been removed from the shipped dashboard. The “Recent Sessions” panel has also been removed. The top-level “Dashboard Range” filter section has been removed (T70); date filtering now lives entirely inside `WeatherUnifiedCard`.

**Analytics model cards (implemented in T90):**
- The operational KPI row remains unchanged and loads independently from analytics.
- The analytics section reads the latest stored snapshot by default through
  `/api/ra/dashboard/analytics?mode=snapshot`. If no snapshot exists yet for the
  selected study window, the UI shows a concise empty state and keeps live
  recompute behind the manual **Refresh Analytics** action.
- The section header shows the active study window and a manual **Refresh
  Analytics** action that requests a live recompute without blocking the rest
  of the dashboard.
- Model results are rendered as per-term cards grouped by outcome. Each card
  shows:
  - outcome
  - term / predictor label
  - coefficient
  - 95% confidence interval
  - p-value + significance flag
  - direction (`positive` / `negative` / `neutral`)
  - model convergence state
  - sample/day counts and any backend warnings
- The section keeps the most useful snapshot metadata visible in compact form
  and tucks lower-signal details like row counts and exclusion reasons into a
  lightweight disclosure panel.
- Analytics states handled in UI:
  - `ready` — show cards with a simple "latest snapshot ready" status
  - `stale` — keep prior snapshot visible with a short warning
  - `recomputing` — keep prior snapshot visible while a background refresh runs
  - `insufficient_data` — show an empty-state message instead of cards
  - `failed` — show an error-state message while operational surfaces remain usable

**Effect plot card (implemented T94):**
- A separate `AnalyticsEffectPlotCard` is rendered directly below `EffectCard` in the analytics section.
- The card shows a Highcharts scatter (partial residuals) + fitted spline for the selected outcome/term.
- Interaction terms are excluded from v1 plots (an empty-state message is shown instead).
- The effect plot remains semantically distinct from the weather chart: its x-axis is a z-scored predictor value, not a date.

**Temperature summary section (canonical target):**
- A separate `AnalyticsTemperatureSummaryCard` is rendered between `WeatherUnifiedCard` and `DashboardAnalyticsSection`.
- The section owns its own summary date range initialized to `2025-03-03` → latest study day or Vancouver today.
- The section exposes fixed tabs for `overall`, `fall_winter`, and `spring_summer` within the currently selected summary range.
- The selected window shows day count, participant count, mean temperature, standard deviation, and cold/hot participant counts.
- One conclusive Highcharts 1°C histogram summarizes day-level temperature frequency for the active window.
- The histogram overlays the selected window's mean temperature plus descriptive cold/hot threshold markers derived from the same window-specific day-level z-score rule used for the summary groups.
- A planned histogram drilldown layer adds bin-level participant-session hover cards rendered in React from chart point events rather than via an interactive Highcharts tooltip.
- Hovered bins list participant-session rows as `Participant #<number> · <session date>` using additive metadata on each `frequency_bins[]` item.
- Clicking a participant row opens a pinned side panel with participant demographics only in the first version.
- When threshold values are unavailable because the selected window has too few unique days or zero variance, the chart falls back to frequency-plus-mean only and the UI explains that the threshold overlay is unavailable.
- Cold/hot panels list qualifying dates and participant counts, with a benign empty state when no days cross the threshold.
- The section uses short RA-facing status labels plus a dedicated compute/recompute button, and it keeps the last available summary visible while a background recompute is in progress.

**Weather chart defaults:**
- The weather chart loads with the temperature series visible by default.
- Precipitation and sunlight remain available through the existing toggles, but they start hidden and stay user-controlled across preset and range changes.

**Weather and analytics are separate surfaces (implemented T124):**
- `WeatherUnifiedCard` keeps only weather summary and weather-range chart state.
- `DashboardAnalyticsSection` owns the analytics study-window controls and model cards independently.
- The weather chart does not show analytics-linked badges or plot bands.
- No predictor values, residuals, or model series are placed on the weather time-series chart.
- An RA-only **Undo Last Session** control is implemented in the dashboard hero
  card (T98). It appears as a ghost button directly below the Start New Entry
  button, requires explicit confirmation + reason in a Dialog, and targets only
  the most recently created native session. It never exposes a general
  session-management delete UI.

**Start New Entry flow (Phase 3 — implemented T51a + T51b + T52 revised):**
- Clicking “Start New Entry” navigates to `/new-session` (see `/new-session` spec below). The demographics form and consent step are no longer on the dashboard.
- The supervised workflow treats participant↔session as 1:1 (a new participant is created for each new session); the DB does not enforce this constraint.

**Undo-last-session flow (implemented T98):**
- RA triggers **Undo Last Session** from the ghost button below Start New Entry in the hero card.
- UI fetches the last native session candidate and opens a Dialog showing:
  - participant number
  - session status badge
  - created time
- Explicit confirmation + a non-empty reason field are required before delete.
- On success, the analytics section remounts (re-fetches snapshot) and the dashboard bundle is refreshed live.
- On success, the analytics section remounts (re-fetches snapshot) and the default dashboard weather bundle is refreshed live.
- This flow is intended for accidental test runs / obvious supervised-entry mistakes, not arbitrary historical record deletion.

**Data loading (T41–T43, implemented):**
- Dashboard uses a stale-while-revalidate pattern via a same-origin Route Handler (`/api/ra/dashboard`): attempt to render quickly from cache first, then (optionally) refresh from the live Render backend and update the UI when fresh data arrives. The dashboard avoids triggering a live refresh on every visit when cached data is still recent (prevents waking the Render backend unnecessarily).
- The cached/live dashboard bundle includes only today's weather data (`WeatherDailyResponse`) because the shipped page no longer renders operational KPI summary cards.
- `WeatherUnifiedCard` receives the base `weather` prop from the bundle (for current-day summary display) — no independent on-mount fetch for the summary. The chart section fetches its own range data internally.
- Route handlers enforce backend fetch timeouts (15s) and use stale-cache fallback when `mode=live` fails, so dashboard loading does not hang indefinitely on Render outages.

**Analytics loading (implemented through T123):**
- Statistical dashboard content uses a separate analytics payload and cache key
  from the operational dashboard bundle.
- Default render path uses the most recent successful analytics snapshot.
- When snapshot mode returns `404` for the selected study window, the dashboard
  shows a non-blocking empty state instead of auto-triggering a live recompute.
- Manual analytics refresh requests use live mode, but the UI keeps the prior
  snapshot visible whenever the backend returns `stale` or `recomputing`.

**Weather anchor date (implemented T122):**
- The dashboard page loads `latest_study_day` once via `GET /api/ra/dashboard/study-window` and uses `latest_study_day ?? Vancouver today` as the weather anchor date.
- `WeatherUnifiedCard` keeps its own internal date-range controls and uses that anchor date for preset end dates plus the custom `To` max date.
- The weather card no longer emits `onDateRangeChange`; weather interactions do not drive analytics refetches.
- `DashboardAnalyticsSection` receives the same anchor date, but its own state now owns the analytics study-window controls and fetches snapshot/live analytics for that range independently of the weather card.
- `AnalyticsTemperatureSummaryCard` also receives the shared anchor date, but owns its own summary `dateFrom` / `dateTo` state and does not follow the analytics section's active range.

**Analytics loading now stays decoupled from weather (T124):**
- The analytics payload's `weather_annotations` remains serialized as date-based metadata only.
- The effect plot renders in its own card (`AnalyticsEffectPlotCard`) and is not overlaid on the weather chart.
- The backend analytics contract also includes a day-level `temperature_summary`
  payload (`overall`, `fall_winter`, `spring_summer`) for hot/cold day analysis.
  The intended dashboard renders that summary in its own standalone section.

Loading state shows `—` in KPI values. Error state shows an inline destructive banner.

**WeatherUnifiedCard spec (Phase 4 — implemented T69):**

The `WeatherUnifiedCard` component at `src/lib/components/WeatherUnifiedCard.tsx` replaces the former `WeatherCard` + `WeatherTrendChart` pair. Layout within the card (top to bottom):

1. **Header row**: cloud icon + “Weather” label | “Update Weather” button (triggers `triggerWeatherIngest()`; shows spinner + inline feedback)
2. **Current-day weather summary**: large temperature, forecast ↑/↓ high/low, condition text, precipitation pill, ingest run status badge (success/partial/fail). Sourced from the base `weather` prop passed by the dashboard page (last item in the bundle).
3. **Divider**
4. **Graph controls row**: preset filter buttons (Study Start, Last 7 days, Last 30 days, Last 90 days, Custom) | series visibility toggle buttons (Temp / Precip / Sunlight — all default visible)
5. **Custom date pickers row** (visible only when “Custom” preset is active): Date From input, Date To input, Apply button
6. **Inline loading / error feedback** (range fetch state)
7. **Highcharts line chart** (h-72)

**Chart defaults and behavior:**
- Default filter range: `2025-03-03` (study start) → latest study day or Vancouver today.
- Chart library: Highcharts (`highcharts` + `highcharts-react-official`). Recharts is removed.
- Chart type: line only (no bars). Three series:
  - **Temperature** — `weather_daily.current_temp_c`, left Y-axis (°C), solid line, `--chart-1` color, full opacity
  - **Precipitation** — `weather_daily.current_precip_today_mm`, right Y-axis (mm), semi-transparent line (`opacity: 0.5`), `--chart-2` color
  - **Sunlight Hours** — `weather_daily.sunshine_duration_hours`, right Y-axis (h), semi-transparent line (`opacity: 0.5`), `--chart-3` color. Silently renders empty until backfill data (T64–T66) is available.
- Highcharts theming: CSS variable colors are read at mount via `getComputedStyle(document.documentElement)` and re-applied on light/dark theme change. Grid: `--border`; tick labels: `--muted-foreground`; chart background: `transparent`.
- Shared tooltip (`tooltip.shared: true`) shows date + all three series values.
- Legend: disabled (custom toggle UI used instead).
- Range data is fetched internally via `getWeatherRangeBundle('cached'|'live', dateFrom, dateTo)` (same-origin `/api/ra/weather/range`) — cached-first with live fallback; no bare fetch.
- Inline loading copy distinguishes cache lookup from live backend fetch (`"Checking cached chart data…"` vs `"Fetching live chart data from backend…"`).
- On transient live fetch failures (for example a 5xx or timeout during a cold start), the chart retries the live weather-range request once before surfacing an error.
- After a successful manual weather ingest, the component refreshes the active range and also warms the default `study_start → latest study day` weather-range cache in the background so the next dashboard visit is more likely to render from cache.

**Filter anchor behavior (implemented T122):**
- Preset buttons (`Study Start`, `Last 7 days`, `Last 30 days`, `Last 90 days`) anchor their end date to the most recent available `study_days.date_local`.
- If there are no `study_days` rows yet, the weather card falls back to Vancouver "today" so the dashboard remains usable before the first session lands.
- Custom date pickers cap their max date at that same anchor date.

**Chart color assignments:**

| Series | CSS Variable | Light hex | Dark hex |
|--------|-------------|-----------|----------|
| Temperature | `--chart-1` | `#28455d` | `#7993a8` |
| Precipitation | `--chart-2` | `#597188` | `#a4b4c1` |
| Sunlight Hours | `--chart-3` | `#8a9bab` | `#5f7387` |

---

## Participant Flow Pages (T24)

### `/new-session` — Consent + Demographics (RA-protected, implemented T52)

This is an RA-only two-step page (`src/app/(ra)/new-session/page.tsx`) that runs **before** any session is created.

**Step 1 — Consent:**
- Displays the official lab consent form (`reference/Consent Form 2.pdf`) in a full-height `<iframe>` (served from `frontend/public/consent-form.pdf`). Do not replicate the PDF text in code.
- No consent record is written to the database (UI-only gating).
- **"I Do Not Consent"** → `/dashboard` (no participant or session is created).
- **"I Consent"** → Step 2.

**Step 2 — Participant Details:**
- Same demographics form fields as the former dashboard dialog (age band, gender, origin, commute method, time outside).
- **"Back"** → returns to Step 1 (form state is reset).
- Launch actions:
  - **Start Session** → `POST /sessions/start` (creates participant + session atomically) → navigates to `result.start_path` (`/session/<id>/uls8`).
  - **Run Test Trial** → skips `POST /sessions/start`, creates a fake frontend-only session id, and navigates to `/session/<fake-id>/uls8`.
- Error states preserved on failure; spinner + "Starting…" while in flight.

> There is no `/session/[id]/consent` page. Consent happens before session creation.

### Digit Span Task (`/session/[id]/digitspan`)

- **Instruction screens:** full-viewport centered (`flex min-h-screen items-center justify-center`); "STUDY TASK" uppercase muted label above bold title; example shown in a `rounded-xl border border-border` card; "Press Space to continue" in muted text below.
- **Digit display phase:** `text-8xl font-bold text-foreground select-none` centered; uses `\u00A0` to hold space when digit is blank.
- **Input phase:** "PRACTICE TRIAL" / "TRIAL N OF 14" uppercase label at top; `border-b-2 border-border` input line; large mono (`text-4xl`) entered digits; `text-muted-foreground` hint row at bottom.
- **Practice feedback:** uses theme-aware success/error text (`text-emerald-700 dark:text-emerald-300` / `text-red-700 dark:text-red-300`).
- **End of task / Continue button:** semantic `primary` styling, same as primary buttons on RA pages.

### Survey Pages (`/session/[id]/uls8|cesd10|gad7|cogfunc`)

All four surveys use the shared `SurveyForm` component with:
- **Card-shell presentation:** rounded neutral panel with restrained tonal accent treatment; calm, high-contrast typography for long-form completion.
- **`stepLabel` + progress bar:** "Survey 1 of 4" … "Survey 4 of 4" label with auto-derived progress fill when pattern matches `N of M`.
- **Question blocks:** each item is rendered in its own rounded bordered panel for easier scanning.
- **Selected radio option:** semantic `primary` fill with `text-primary-foreground`.
- **Unselected radio option:** muted bordered chips with hover/focus ring states.
- **Submit button:** shared shadcn `Button` styling, disabled until all items answered and not currently submitting. Shows "Submitting…" while pending.
- **Completion helper:** answered count (`X/Y answered`) shown near submit action.
- **Error state:** bordered destructive banner (same pattern as RA pages). Error messages are participant-safe (non-technical) via `getParticipantErrorMessage()`. Form state is preserved on error so the participant can retry.
- **Duplicate submission prevention:** `SurveyForm.handleSubmit` guards against `submitting === true` so concurrent submissions cannot occur even via non-button paths.

### Branding + Favicon (Phase 4 polish, T63)

- RA top bar uses the provided logo mark (`frontend/public/ww-mark.png`) and capsule navigation treatment inspired by the navbar references.
- App icon is wired from `src/app/icon.png` (derived from the provided logo reference).
- Browser theme colors are declared via `viewport.themeColor` for light and dark modes (`#f6f7f8` / `#12161c`) to keep top-bar coloring aligned with the active theme.

### Completion Page (`/session/[id]/complete`)

- Vertically centered primary-accent checkmark circle, bold "Thank You" heading, muted instruction paragraph.
- No scores or stored data are shown. Completion provides a clear return-to-dashboard action for supervised lab use.

---

## RA Import/Export Page (implemented T50)

The Import/Export page at `/import-export` is RA-only and contains two sections:

1. **Import (drag + drop)** — accepts `.csv` or `.xlsx` files (authoritative workbook: `reference/data_complete.xlsx`; historical predecessor: `reference/data_full_1-230.xlsx`). Upload flow is preview-first:
   - On file selection, the backend returns a preview (counts + row-level validation issues).
   - UI shows a confirmation panel including the number of participants/sessions that will be created/updated.
   - A single explicit "Confirm import" action performs the write.
   - The reference workbook carries aggregate legacy outcome values only: `anxiety`, `loneliness`, `depression`, `self_report`, and `digit_span_score`. Import does not reconstruct raw survey item rows or Digit Span trials.
   - Extra workbook-only derived columns such as `day`, `daylight`, `age_simple`, `*_z`, `month`, and `season_bin` are retained for audit/reference only and do not change the current analytics formulas.
2. **Export** — two download buttons:
   - Export XLSX: one workbook with a README sheet plus one sheet per DB table. Filename: `Weather and wellness - YYYY-MM-DD.xlsx`
   - Export CSV: a zip containing one CSV per DB table. Filename: `Weather and wellness - YYYY-MM-DD.zip`
   - Exports are schema-faithful and include join keys (`participant_uuid`, `session_id`, `study_day_id` where applicable) so tables can be linked offline.

## Admin User Management Page (implemented, RESOLVED-19)

The User Management page is admin-only and provides the front-facing control
surface for RA/admin onboarding and access management. Non-admin RAs must not
see the nav item and must receive a guarded access state if they reach the route
directly.

Route: `/users`.

Required capabilities:

1. **Create invite** — admin enters email, role (`admin` or `ra`), and
   `lab_name`; the backend creates a 7-day app-owned invite and sends a custom
   email using `backend/app/services/email_templates/admin_invite.html` plus the
   matching plain-text fallback.
2. **View status** — table shows email, role, lab, Supabase account status,
   invite status, expiry, last sent time, and last sign-in when available.
3. **Resend invite** — available only for pending invitations; updates send
   metadata and sends through the configured email provider.
4. **Revoke invite** — prevents a pending invite token from being accepted.
5. **Edit user** — updates existing user role/lab metadata through admin-only
   backend endpoints.
6. **Revoke access** — UI may label this as delete/remove, but behavior is
   access revocation/disablement rather than normal hard deletion of Supabase
   Auth rows.

Interaction and visual expectations:
- Use the existing RA page layout, navigation, table, dialog, input, button,
  badge, and inline error patterns.
- Use icon buttons where actions are compact and repeated; provide tooltips for
  less obvious icons.
- Confirmation is required before revoke invite or revoke access actions.
- Error copy should distinguish expired invite, revoked invite, already accepted
  invite, duplicate pending invite, and email delivery failure.
- No service-role keys, token hashes, raw invite tokens, or provider secrets are
  exposed in the browser.

---

## Component Style Conventions

- **Cards/panels:** `rounded-2xl border border-border` + `background: var(--card)`
- **Section headings inside cards:** `text-xs font-semibold uppercase tracking-widest text-muted-foreground`
- **Primary buttons:** `background: var(--primary)` + `text-primary-foreground`
- **Secondary/activate buttons:** neutral support surface or semantic `secondary`
- **Inputs:** `border border-border bg-input/30` + focus ring on `--ring`
- **Status badges:** colored border + bg at 15% opacity (yellow/emerald/white for created/active/complete)
- **Tables:** `rounded-2xl border border-border overflow-hidden` + muted header row; responsive columns use `hidden sm:table-cell`
- **Success banners:** `border-emerald-500/30 bg-emerald-500/10 text-emerald-300 rounded-lg`
- **Error banners:** `border-destructive/30 bg-destructive/10 text-destructive rounded-lg` (inline, no toast)
- **Participant number badge:** `w-8 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold`
