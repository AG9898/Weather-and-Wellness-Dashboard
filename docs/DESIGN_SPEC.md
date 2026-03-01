# Design Spec — Phase 1 + Phase 2 + Phase 3 (planned)

Visual language baseline: [docs/styleguide.md](styleguide.md)

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

# Design System — Phase 2 (T19+) + Phase 4 Theme Toggle (planned)

> Implemented in T19. All new pages must follow this system.

## Design Tokens

All brand and semantic tokens are defined in `frontend/src/app/globals.css`.

**Phase 4 (planned):** Add a light/dark theme toggle:
- Default = **system** (`prefers-color-scheme`)
- Persist explicit user choice in `localStorage`
- References are **inspiration only** (not 1:1 remakes); preserve the clean, shipped research-tool aesthetic

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

Shadcn semantic tokens (`--background`, `--foreground`, `--card`, etc.) are mapped to the UBC palette.
- Current implementation uses `.dark` tokens as the baseline.
- Phase 4 will make `:root` represent light tokens and `.dark` represent dark tokens so shadcn components switch cleanly.

## Shared Components

| Component | Path | Usage |
|---|---|---|
| `PageContainer` | `src/lib/components/PageContainer.tsx` | Max-width content wrapper for all pages. Use `narrow` prop for survey/task flows. |
| `RANavBar` | `src/lib/components/RANavBar.tsx` | Sticky top nav for RA pages (brand, nav links, sign-out). |
| `SurveyForm` | `src/lib/components/SurveyForm.tsx` | Reusable survey renderer for all four instruments. |

## Layout Structure

### RA Pages (`/dashboard`, `/import-export`)
```
<html class="dark|light">
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

1. **Weather card** — top-of-page card showing the last fetched weather data for today (current temp, forecast high/low, condition text) plus ingest run status (success/partial/fail and time-ago). Includes an "Update Weather" action.
2. **Hero action zone** — card with blue glow accent, headline "Start a New Entry", description ("Present the consent form, collect participant details, and open a supervised session."), primary shadcn `Button` (size lg, ubc-blue-700) that navigates to `/new-session` to begin the two-step consent + demographics flow.
3. **KPI cards row** — 5 cards: Participants, Active Sessions, Total Sessions, Created (7d), Completed (7d). Each card: rounded icon chip + large bold number + uppercase label.

**Phase 4 (planned):** Remove the "Recent Sessions" panel from the dashboard. The dashboard remains KPI + weather + filter + graph focused (RA navigation stays minimal).

**Start New Entry flow (Phase 3 — implemented T51a + T51b + T52 revised):**
- Clicking “Start New Entry” navigates to `/new-session` (see `/new-session` spec below). The demographics form and consent step are no longer on the dashboard.
- The supervised workflow treats participant↔session as 1:1 (a new participant is created for each new session); the DB does not enforce this constraint.

**Data loading (T41–T43, implemented):**
- Dashboard uses a stale-while-revalidate pattern via a same-origin Route Handler (`/api/ra/dashboard`): attempt to render quickly from cache first, then refresh from the live Render backend and update the UI when fresh data arrives.
- The cached/live dashboard bundle includes: dashboard summary KPIs + today's weather data (`WeatherDailyResponse`).
- WeatherCard receives data from the bundle via the `weather` prop — no independent on-mount fetch. Manual "Update Weather" button still works (triggers ingest, overrides displayed run status locally).

Loading state shows `—` in KPI values and weather card skeleton/loading text. Error state shows an inline destructive banner.

**Filtering (Phase 4 — planned):**
- Dashboard adds a date-range filter control that affects:
  - the **Created** KPI (sessions created within the selected range), and
  - the **Completed** KPI (sessions completed within the selected range),
  - and the weather card **date context** (see below).
- Default view (no custom range selected) uses the cached dashboard bundle (`/api/ra/dashboard?mode=cached` then SWR live refresh).
- Filtered views bypass Redis initially and fetch live from Render using the planned `/dashboard/summary/range` contract plus `GET /weather/daily` for the selected date.

**Weather behavior under filtering (Phase 4 — planned):**
- If the selected range is a single day (`date_from == date_to`), the weather card shows that day's `weather_daily` (if present).
- If the selected range spans multiple days, the weather card shows the **end date** (`date_to`) as the most relevant day context for the filtered KPIs.

**Weather graph behavior under filtering (Phase 4 — planned):**
- Dashboard renders a weather graph that is driven by the same date-range filter state.
- Graph shows:
  - temperature (`weather_daily.current_temp_c`) as a line,
  - participants-per-day as bars (derived from sessions completed on that `study_days.date_local`),
  - precipitation (`weather_daily.current_precip_today_mm`) in hover/tooltip when available.

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
