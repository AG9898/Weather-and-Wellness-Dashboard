# Design Spec — Phase 1 + Phase 2 + Phase 3 (planned)

Visual language baseline: [docs/styleguide.md](styleguide.md) · Animation library: [docs/animejs.md](animejs.md)

## UX Goals
- Guided, simple flow — one screen per step, no back navigation during session
- Keyboard-only digit span (no mouse interaction)
- Exact survey wording from lab instrument forms (present-tense, "Right now..." framing)

## RA Flow
1. Login
2. Click "Start New Entry" → navigates to `/new-session`
3. **Step 1 (consent):** Participant reads the official consent PDF; clicks "I Consent" to proceed or "I Do Not Consent" to cancel and return to dashboard (no DB record in either case)
4. **Step 2 (demographics):** RA fills required participant details; submits → backend creates anonymous participant + active session atomically
5. RA is navigated directly into the participant survey flow (`/session/<id>/uls8`)
6. After completion, return to RA dashboard; KPIs reflect the new complete session
7. View data via Supabase Studio

## Participant Flow
1. ULS-8 survey
2. CES-D 10 survey
3. GAD-7 survey
4. Cognitive Function 8a survey
5. Digit Span instructions → practice trial → 14 scored trials → session marked complete
6. Completion screen (thank you) → return to RA dashboard

> **Note:** Consent is obtained at `/new-session` (Step 1 of the RA flow) before the participant session is created. There is no consent page within the `/session/[id]/` route tree.

---

## Digit Span UI Flow

Full specification: [docs/DIGITSPAN.md](DIGITSPAN.md)

1. **Instruction screen** — title, explanation, example (Sequence: 1 2 3 4 5 → Correct: 5 4 3 2 1), advance on spacebar/button
2. **Practice intro** — "We will begin with a practice trial...", advance on spacebar/button
3. **Practice trial** — show digits one at a time (1000ms each, 100ms gap), then input screen with "Type the sequence in backwards order:" prompt; after submit show green "Correct" or red "Incorrect" for 2000ms
4. **Main trials intro** — "We will now begin the main trials...", advance on spacebar/button
5. **14 scored trials** — same digit display + input flow as practice, but NO feedback after each trial
6. **End of task** — "End of task", then POST trial data to backend and route to first survey on 2xx

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
- **POST to backend on submit** — route to next survey only after 2xx response
- **No back navigation** — participant cannot return to a previous survey

### Response scales by instrument

| Survey     | Scale | Labels                                           | Details doc |
|------------|-------|--------------------------------------------------|-------------|
| ULS-8      | 1-4   | Never / Rarely / Sometimes / Often               | [ULS8.md](ULS8.md) |
| CES-D 10   | 1-4   | Never / Rarely / Sometimes / Often               | [CESD10.md](CESD10.md) |
| GAD-7      | 1-4   | Never / Rarely / Sometimes / Often               | [GAD7.md](GAD7.md) |
| CogFunc 8a | 1-5   | Never / Rarely / Sometimes / Often / Very Often   | [COGFUNC8A.md](COGFUNC8A.md) |

---

## Survey Scoring (summary)

All scoring is server-side. See per-instrument docs for full formulas.

- **ULS-8:** reverse items 3 & 6 (`5 - raw`), mean → 0-100 transform
- **CES-D 10:** raw 1-4, convert to 0-3 (`raw - 1`), reverse items 5 & 8 (`4 - raw`), sum → total 0-30
- **GAD-7:** raw 1-4, convert to 0-3 (`raw - 1`), sum → total 0-21 + severity band
- **CogFunc 8a:** raw 1-5, reverse all (`6 - raw`) for computed scores, sum (8-40) + mean (1.0-5.0)

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
| `--ubc-video-blue` | `#001328` | Primary “ink” / deepest anchor (light); background anchor (dark) |
| `--ubc-navy` | `#000847` | Deepest surfaces / nav bar (dark) |
| `--ubc-blue-700` | `#0052F5` | Primary actions / emphasis |
| `--ubc-blue-600` | `#00A2FA` | Secondary emphasis / interactive |
| `--ubc-blue-500` | `#33E0FC` | Focus ring / highlight |
| `--ubc-blue-300` | `#5CE5FC` | Soft accent / glow |
| `--ubc-blue-200` | `#7AF2F7` | Softer accent tint |
| `--ubc-blue-100` | `#9EFAF2` | Lightest accent tint |
| `--ubc-earth` | `#878343` | Rare warm accent only |
| `--ink-100` | `#E6EDF8` | Light theme background; dark theme primary text |
| `--ink-70` | `#A9B6CC` | Secondary text (dark) / muted UI (light) |
| `--ink-45` | `#6E7C95` | Labels / meta text |

### Shadcn Semantic Token Mapping

Shadcn semantic tokens (`--background`, `--foreground`, `--card`, etc.) are mapped to the UBC palette.
- Current implementation is **light-first**:
  - `:root` = light theme semantic tokens
  - `.dark` = tonal dark theme semantic tokens
  - root class is controlled by theme preference (`system` resolves via `prefers-color-scheme`)

## Shared Components

| Component | Path | Usage |
|---|---|---|
| `PageContainer` | `src/lib/components/PageContainer.tsx` | Max-width content wrapper for all pages. Use `narrow` prop for survey/task flows. |
| `RANavBar` | `src/lib/components/RANavBar.tsx` | Sticky capsule-style top nav for RA pages (logo mark, icon-first nav links, theme control, sign-out). |
| `ThemeToggle` | `src/lib/components/ThemeToggle.tsx` | Toggles between `light` and `dark`; startup still resolves from `system` when no preference is stored. |
| `WeatherUnifiedCard` | `src/lib/components/WeatherUnifiedCard.tsx` | Unified weather display + Highcharts 3-series line chart (Temperature/Precipitation/Sunlight) + internal date range filter (default: study start → today). Replaces the former `WeatherCard` + `WeatherTrendChart` pair (T69–T70). |
| `SurveyForm` | `src/lib/components/SurveyForm.tsx` | Reusable survey renderer for all four instruments with shared progress bar + calm card-shell styling. |

## Layout Structure

### RA Pages (`/dashboard`, `/import-export`)
```
<html class="dark|light">
  <body>
    <RALayout>           ← auth guard
      <RANavBar />       ← sticky nav with theme control
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

1. **Hero action zone** — card with blue glow accent, headline “Start a New Entry”, description (“Present the consent form, collect participant details, and open a supervised session.”), primary shadcn `Button` (size lg, ubc-blue-700/600 gradient) that navigates to `/new-session`.
2. **KPI cards row** — 5 cards: Participants, Active Sessions, Total Sessions, Created (7d), Completed (7d). KPI values are sourced from the base dashboard bundle and are always all-time totals / last-7-day counts (not range-filtered).
3. **WeatherUnifiedCard** — single card combining current-day weather summary, “Update Weather” ingest trigger, and an interactive Highcharts chart with an internal date-range filter. See below for full spec.

The “Recent Sessions” panel has been removed. The top-level “Dashboard Range” filter section has been removed (T70); date filtering now lives entirely inside `WeatherUnifiedCard`.

**Start New Entry flow (Phase 3 — implemented T51a + T51b + T52 revised):**
- Clicking “Start New Entry” navigates to `/new-session` (see `/new-session` spec below). The demographics form and consent step are no longer on the dashboard.
- The supervised workflow treats participant↔session as 1:1 (a new participant is created for each new session); the DB does not enforce this constraint.

**Data loading (T41–T43, implemented):**
- Dashboard uses a stale-while-revalidate pattern via a same-origin Route Handler (`/api/ra/dashboard`): attempt to render quickly from cache first, then refresh from the live Render backend and update the UI when fresh data arrives.
- The cached/live dashboard bundle includes: dashboard summary KPIs + today's weather data (`WeatherDailyResponse`).
- `WeatherUnifiedCard` receives the base `weather` prop from the bundle (for current-day summary display) — no independent on-mount fetch for the summary. The chart section fetches its own range data internally.

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
- Default filter range: `2025-03-03` (study start) → today (America/Vancouver).
- Chart library: Highcharts (`highcharts` + `highcharts-react-official`). Recharts is removed.
- Chart type: line only (no bars). Three series:
  - **Temperature** — `weather_daily.current_temp_c`, left Y-axis (°C), solid line, `--chart-1` color, full opacity
  - **Precipitation** — `weather_daily.current_precip_today_mm`, right Y-axis (mm), semi-transparent line (`opacity: 0.5`), `--chart-2` color
  - **Sunlight Hours** — `weather_daily.sunshine_duration_hours`, right Y-axis (h), semi-transparent line (`opacity: 0.5`), `--chart-3` color. Silently renders empty until backfill data (T64–T66) is available.
- Highcharts theming: CSS variable colors are read at mount via `getComputedStyle(document.documentElement)` and re-applied on light/dark theme change. Grid: `--border`; tick labels: `--muted-foreground`; chart background: `transparent`.
- Shared tooltip (`tooltip.shared: true`) shows date + all three series values.
- Legend: disabled (custom toggle UI used instead).
- Range data is fetched internally via `getDashboardRangeBundle(dateFrom, dateTo)` — no bare fetch.

**Chart color assignments:**

| Series | CSS Variable | Light hex | Dark hex |
|--------|-------------|-----------|----------|
| Temperature | `--chart-1` | `#0052f5` | `#00a2fa` |
| Precipitation | `--chart-2` | `#00a2fa` | `#33e0fc` |
| Sunlight Hours | `--chart-3` | `#33e0fc` | `#0052f5` |

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
- On submit → `POST /sessions/start` (creates participant + session atomically) → navigates to `result.start_path` (`/session/<id>/uls8`).
- Error states preserved on failure; spinner + "Starting…" while in flight.

> There is no `/session/[id]/consent` page. Consent happens before session creation.

### Digit Span Task (`/session/[id]/digitspan`)

- **Instruction screens:** full-viewport centered (`flex min-h-screen items-center justify-center`); "STUDY TASK" uppercase muted label above bold title; example shown in a `rounded-xl border border-border` card; "Press Space to continue" in muted text below.
- **Digit display phase:** `text-8xl font-bold text-foreground select-none` centered; uses `\u00A0` to hold space when digit is blank.
- **Input phase:** "PRACTICE TRIAL" / "TRIAL N OF 14" uppercase label at top; `border-b-2 border-border` input line; large mono (`text-4xl`) entered digits; `text-muted-foreground` hint row at bottom.
- **Practice feedback:** uses theme-aware success/error text (`text-emerald-700 dark:text-emerald-300` / `text-red-700 dark:text-red-300`).
- **End of task / Continue button:** `--ubc-blue-700` styled, same as primary buttons on RA pages.

### Survey Pages (`/session/[id]/uls8|cesd10|gad7|cogfunc`)

All four surveys use the shared `SurveyForm` component with:
- **Card-shell presentation:** rounded glass-like panel with subtle blue glow accents; calm, high-contrast typography for long-form completion.
- **`stepLabel` + progress bar:** "Survey 1 of 4" … "Survey 4 of 4" label with auto-derived progress fill when pattern matches `N of M`.
- **Question blocks:** each item is rendered in its own rounded bordered panel for easier scanning.
- **Selected radio option:** blue gradient (`--ubc-blue-700` → `--ubc-blue-600`) with `text-primary-foreground`.
- **Unselected radio option:** muted bordered chips with hover/focus ring states.
- **Submit button:** shared shadcn `Button` styling, disabled until all items answered and not currently submitting. Shows "Submitting…" while pending.
- **Completion helper:** answered count (`X/Y answered`) shown near submit action.
- **Error state:** bordered destructive banner (same pattern as RA pages). Error messages are participant-safe (non-technical) via `getParticipantErrorMessage()`. Form state is preserved on error so the participant can retry.
- **Duplicate submission prevention:** `SurveyForm.handleSubmit` guards against `submitting === true` so concurrent submissions cannot occur even via non-button paths.

### Branding + Favicon (Phase 4 polish, T63)

- RA top bar uses the provided logo mark (`frontend/public/ww-mark.png`) and capsule navigation treatment inspired by the navbar references.
- App icon is wired from `src/app/icon.png` (derived from the provided logo reference).
- Browser theme colors are declared via `viewport.themeColor` for light and dark modes (`#e6edf8` / `#001328`) to keep top-bar coloring aligned with the active theme.

### Completion Page (`/session/[id]/complete`)

- Vertically centered blue checkmark circle (`--ubc-blue-700`), bold "Thank You" heading, muted instruction paragraph.
- No scores or stored data are shown. Completion provides a clear return-to-dashboard action for supervised lab use.

---

## RA Import/Export Page (implemented T50)

The Import/Export page at `/import-export` is RA-only and contains two sections:

1. **Import (drag + drop)** — accepts `.csv` or `.xlsx` files (reference mapping: `reference/data_full_1-230.xlsx`). Upload flow is preview-first:
   - On file selection, the backend returns a preview (counts + row-level validation issues).
   - UI shows a confirmation panel including the number of participants/sessions that will be created/updated.
   - A single explicit "Confirm import" action performs the write.
2. **Export** — two download buttons:
   - Export XLSX: one workbook with a README sheet plus one sheet per DB table. Filename: `Weather and wellness - YYYY-MM-DD.xlsx`
   - Export CSV: a zip containing one CSV per DB table. Filename: `Weather and wellness - YYYY-MM-DD.zip`
   - Exports are schema-faithful and include join keys (`participant_uuid`, `session_id`, `study_day_id` where applicable) so tables can be linked offline.

---

## Component Style Conventions

- **Cards/panels:** `rounded-2xl border border-border` + `background: var(--card)`
- **Section headings inside cards:** `text-xs font-semibold uppercase tracking-widest text-muted-foreground`
- **Primary buttons:** `background: var(--ubc-blue-700)` + `text-primary-foreground`
- **Secondary/activate buttons:** `background: var(--ubc-blue-600)`
- **Inputs:** `border border-border bg-input/30` + focus ring on `--ring`
- **Status badges:** colored border + bg at 15% opacity (yellow/emerald/white for created/active/complete)
- **Tables:** `rounded-2xl border border-border overflow-hidden` + muted header row; responsive columns use `hidden sm:table-cell`
- **Success banners:** `border-emerald-500/30 bg-emerald-500/10 text-emerald-300 rounded-lg`
- **Error banners:** `border-destructive/30 bg-destructive/10 text-destructive rounded-lg` (inline, no toast)
- **Participant number badge:** `w-8 h-8 rounded-lg bg-ubc-blue-700 text-white text-xs font-bold`
