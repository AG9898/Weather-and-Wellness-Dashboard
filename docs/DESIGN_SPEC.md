# Design Spec — Phase 1 + Phase 2

Visual language baseline: [docs/styleguide.md](styleguide.md)

## UX Goals
- Guided, simple flow — one screen per step, no back navigation during session
- Keyboard-only digit span (no mouse interaction)
- Exact survey wording from lab instrument forms (present-tense, "Right now..." framing)

## RA Flow
1. Login
2. Start new entry (one click)
3. Backend creates anonymous participant + active session automatically
4. RA is redirected into the participant test flow (no copy-link step)
5. After completion, return to RA dashboard; KPIs reflect the new complete session
6. View data via Supabase Studio

## Participant Flow
1. ULS-8 survey
2. CES-D 10 survey
3. GAD-7 survey
4. Cognitive Function 8a survey
5. Digit Span instructions → practice trial → 14 scored trials → session marked complete
6. Completion screen (thank you) → return to RA dashboard

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

### RA Pages (`/participants`, `/sessions`, future `/dashboard`)
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

1. **Hero action zone** — card with blue glow accent, headline "Start a New Entry", description ("One click enrols an anonymous participant and opens a supervised session immediately"), primary shadcn `Button` (size lg, ubc-blue-700) that calls `startSession()` and redirects to Survey 1. Shows spinner + "Starting…" while in flight; non-technical inline error message on failure.
2. **KPI cards row** — 5 cards: Participants, Active Sessions, Total Sessions, Created (7d), Completed (7d). Each card: rounded icon chip + large bold number + uppercase label.
3. **Recent Sessions list** — up to 8 rows. Each row: participant `#N` badge, truncated session ID, status badge, time-ago. "View all →" link to `/sessions`.

Loading state shows `—` in KPI values and a centered "Loading…" in the sessions panel. Error state shows an inline destructive banner. Empty sessions state shows a link to create the first session.

---

## Participant Flow Pages (T24)

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

## RA Participants Page (T23)

The participants page at `/participants` layout (top to bottom):

1. **Page header** — `text-3xl font-bold` heading + muted subtitle description.
2. **Enrol participant form card** — Participants are anonymous; no names are collected. The form shows a single "Enrol participant" button that creates an anonymous participant. The one-click dashboard flow is the primary path for new entries.
3. **Participants table** — `rounded-2xl` card; columns: `#` (participant number badge) and `Enrolled` (date). No name column.

## RA Sessions Page (T23)

The sessions page at `/sessions` layout (top to bottom):

1. **Page header** — `text-3xl font-bold` heading + muted subtitle description.
2. **Create session card** — may remain as a debugging/administrative tool, but the primary Phase 2 path is the one-click dashboard start.
3. **Active session panel** — Participant info shows `#N` only (no name). The dashboard one-click flow is the primary path; this page remains for administrative use.
4. **All Sessions table** — section label with count; `rounded-2xl` card. Columns: `#` (blue-700 badge), `Session ID` (8-char truncated, hidden on mobile), `Status` (colored badge), `Created` (time-ago). Loads on mount; refreshes after create/activate/complete.

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
