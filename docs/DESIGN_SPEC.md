# Design Spec — Phase 1 + Phase 2 + Phase 3 (planned)

Visual language baseline: [docs/styleguide.md](styleguide.md)

## UX Goals
- Guided, simple flow — one screen per step, no back navigation during session
- Keyboard-only digit span (no mouse interaction)
- Exact survey wording from lab instrument forms (present-tense, "Right now..." framing)

## RA Flow
1. Login
2. Start new entry (demographics questionnaire required)
3. Backend creates anonymous participant + active session automatically (participant demographics stored on `participants`)
4. RA is redirected into the participant test flow (no copy-link step; begins at consent)
5. After completion, return to RA dashboard; KPIs reflect the new complete session
6. View data via Supabase Studio

## Participant Flow
1. Consent (UI-only gating; no DB record) (planned)
2. ULS-8 survey
3. CES-D 10 survey
4. GAD-7 survey
5. Cognitive Function 8a survey
6. Digit Span instructions → practice trial → 14 scored trials → session marked complete
7. Completion screen (thank you) → return to RA dashboard

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

# Design System — Phase 2 (T19+)

> Implemented in T19. All new pages must follow this system.

## Design Tokens

All brand and semantic tokens are defined in `frontend/src/app/globals.css`. The app is **always dark** (clinical/research tool — no light mode toggle).

### UBC Brand Palette (CSS variables)

| Variable | Hex | Usage |
|---|---|---|
| `--ubc-video-blue` | `#001328` | Global background |
| `--ubc-navy` | `#000847` | Nav bar / deepest surfaces |
| `--ubc-blue-700` | `#0052f5` | Primary action buttons |
| `--ubc-blue-600` | `#00a2fa` | Secondary actions / activate |
| `--ubc-blue-500` | `#33e0fc` | Focus ring / highlight |
| `--ink-100` | `#e6edf8` | Primary text |
| `--ink-70` | `#a9b6cc` | Secondary / muted text |
| `--ink-45` | `#6e7c95` | Labels / meta text |

### Shadcn Semantic Token Mapping

Shadcn semantic tokens (`--background`, `--foreground`, `--card`, etc.) are mapped to the UBC palette in `:root`. The `.dark` block mirrors `:root` so shadcn component dark-variant internals work.

## Shared Components

| Component | Path | Usage |
|---|---|---|
| `PageContainer` | `src/lib/components/PageContainer.tsx` | Max-width content wrapper for all pages. Use `narrow` prop for survey/task flows. |
| `RANavBar` | `src/lib/components/RANavBar.tsx` | Sticky top nav for RA pages (brand, nav links, sign-out). |
| `SurveyForm` | `src/lib/components/SurveyForm.tsx` | Reusable survey renderer for all four instruments. |

## Layout Structure

### RA Pages (`/dashboard`, `/import-export`)
```
<html class="dark">
  <body>
    <RALayout>           ← auth guard
      <RANavBar />       ← sticky navy nav (--ubc-navy)
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
<html class="dark">
  <body>
    <SessionLayout>      ← no-auth, max-w-3xl centered shell
      {page content}
    </SessionLayout>
  </body>
</html>
```

## RA Dashboard Page (T22)

The dashboard at `/dashboard` is the RA home after login. Layout (top to bottom):

1. **Weather card** — top-of-page card showing the last fetched weather data for today (current temp, forecast high/low, condition text) plus ingest run status (success/partial/fail and time-ago). Includes an "Update Weather" action.
2. **Hero action zone** — card with blue glow accent, headline "Start a New Entry", description ("Collect participant details and open a supervised session immediately"), primary shadcn `Button` (size lg, ubc-blue-700) that opens a required demographics questionnaire. On submit, calls `startSession(payload)` and redirects into the participant flow. Shows spinner + "Starting…" while in flight; non-technical inline error message on failure.
3. **KPI cards row** — 5 cards: Participants, Active Sessions, Total Sessions, Created (7d), Completed (7d). Each card: rounded icon chip + large bold number + uppercase label.

**Start New Entry questionnaire (Phase 3 — implemented T51a + T51b):**
- Required fields (preset options) are based on the current legacy import value set (`reference/data_full_1-230.xlsx`):
  - **Age band:** `Under 18`, `18-24`, `25-31`, `32-38`, `>38`
  - **Gender:** `Woman`, `Man`, `Non-binary`, `Prefer not to say`
  - **Origin:** `Home`, `Work`, `Class`, `Library`, `Gym/Recreation Center`, `Other` (if `Other`, require free-text detail)
  - **Commute method:** `Walk`, `Transit`, `Car`, `Bike/Scooter`, `Other` (if `Other`, require free-text detail)
  - **Time outside:** `Never (0-30 minutes)`, `Rarely (31 minutes- 60 minutes)`, `Sometimes (61 minutes - 90 minutes)`, `Often (over 90 minutes)`
- “Other” free-text inputs must include UI copy warning against entering names/PII and are stored in dedicated DB columns (`origin_other_text`, `commute_method_other_text`).
- Backend computes `participants.daylight_exposure_minutes` at session start as minutes since `DAYLIGHT_START_LOCAL_TIME` (default `06:00` local, `America/Vancouver`); this value is not shown to participants.
- The supervised workflow treats participant↔session as 1:1 (a new participant is created for each new session); the DB does not enforce this constraint.

**Data loading (T41–T43, implemented):**
- Dashboard uses a stale-while-revalidate pattern via a same-origin Route Handler (`/api/ra/dashboard`): attempt to render quickly from cache first, then refresh from the live Render backend and update the UI when fresh data arrives.
- The cached/live dashboard bundle includes: dashboard summary KPIs + today's weather data (`WeatherDailyResponse`).
- WeatherCard receives data from the bundle via the `weather` prop — no independent on-mount fetch. Manual "Update Weather" button still works (triggers ingest, overrides displayed run status locally).

Loading state shows `—` in KPI values and weather card skeleton/loading text. Error state shows an inline destructive banner.

**Filtering (planned):**
- Dashboard adds a date-range filter control that affects:
  - the **Created** KPI (sessions created within the selected range), and
  - the **Completed** KPI (sessions completed within the selected range),
  - and the weather card **date context** (see below).
- Default view (no custom range selected) uses the cached dashboard bundle (`/api/ra/dashboard?mode=cached` then SWR live refresh).
- Filtered views bypass Redis initially and fetch live from Render using the planned `/dashboard/summary/range` contract plus `GET /weather/daily` for the selected date.

**Weather behavior under filtering (planned):**
- If the selected range is a single day (`date_from == date_to`), the weather card shows that day's `weather_daily` (if present).
- If the selected range spans multiple days, the weather card shows the **end date** (`date_to`) as the most relevant day context for the filtered KPIs.

---

## Participant Flow Pages (T24)

### Consent Page (`/session/[id]/consent`) (planned)

- Displays consent content and requires an explicit "I consent" checkbox before continuing.
- No consent record is written to the database (UI-only gating).
- Continue routes to Survey 1 (`/session/[id]/uls8`).

### Digit Span Task (`/session/[id]/digitspan`)

- **Instruction screens:** full-viewport centered (`flex min-h-screen items-center justify-center`); "STUDY TASK" uppercase muted label above bold title; example shown in a `rounded-xl border border-border` card; "Press Space to continue" in muted text below.
- **Digit display phase:** `text-8xl font-bold text-foreground select-none` centered; uses `\u00A0` to hold space when digit is blank.
- **Input phase:** "PRACTICE TRIAL" / "TRIAL N OF 14" uppercase label at top; `border-b-2 border-border` input line; large mono (`text-4xl`) entered digits; `text-muted-foreground` hint row at bottom.
- **Practice feedback:** `text-emerald-400` (Correct) / `text-red-400` (Incorrect).
- **End of task / Continue button:** `--ubc-blue-700` styled, same as primary buttons on RA pages.

### Survey Pages (`/session/[id]/uls8|cesd10|gad7|cogfunc`)

All four surveys use the shared `SurveyForm` component with:
- **`stepLabel` prop:** "Survey 1 of 4" … "Survey 4 of 4" — rendered as `text-xs uppercase tracking-widest text-muted-foreground` above the title.
- **Selected radio option:** `background: var(--ubc-blue-700)` fill with white text.
- **Unselected radio option:** `border-border text-muted-foreground hover:border-ring hover:text-foreground`.
- **Submit button:** `--ubc-blue-700` + `text-primary-foreground`, disabled until all items answered and not currently submitting. Shows "Submitting…" label while pending.
- **Error state:** bordered destructive banner (same pattern as RA pages). Error messages are participant-safe (non-technical) via `getParticipantErrorMessage()`. Form state is preserved on error so the participant can retry.
- **Duplicate submission prevention:** `SurveyForm.handleSubmit` guards against `submitting === true` so concurrent submissions cannot occur even via non-button paths.

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
