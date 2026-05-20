# Handoff: Misokinesia Module — UI Redesign (Direction A)

## Overview

A visual redesign of the participant-facing **Misokinesia** module and its RA-facing launch page, in the **Quiet Editorial** direction. Covers five surfaces:

| # | Surface | Route in repo |
|---|---|---|
| **A1** | RA Operational Dashboard | `/misokinesia` (RA) — `frontend/src/app/(ra)/misokinesia/page.tsx` |
| **A2** | Participant Demographics | first phase of `/misokinesia/[id]` |
| **A3** | Per-clip Questionnaire | rendered after each returned manifest clip |
| **A4** | MkAQ / MAQ paned carousel | post-video survey (pane 3 of 4 shown) |
| **A5** | Survey Transition Card | shown before each of MkAQ / GAD-7 / MAQ |

The goal is to replace the current shadcn card-stack / ambient-glow recipe with a tighter editorial system: kicker labels, hairline dividers, asymmetric composition, and intentional whitespace — while keeping the repo's JetBrains Mono identity, semantic-token theming, and shadcn primitives.

## Repo-Specific Decisions

This handoff is a template. Current repo docs are the source of truth when they differ:

- `docs/styleguide.md` is the canonical UI guide. The paper-toned light palette is now intended to be global, not scoped only to misokinesia routes.
- `docs/labs/weather-wellness/misokinesia/MISOKINESIA.md` is the canonical task-flow and instrument spec.
- Participant progress must use the returned manifest length at runtime instead of hardcoded `25` or historical seeded counts.
- Apply the transition card template to all three post-video surveys with survey-specific copy.
- Apply the carousel template to MkAQ and MAQ. Keep GAD-7 single-screen, but restyle it with the same fieldset/chip visual system.
- Apply the quiet editorial system to unmocked non-video states too: intro, end-of-task, completion, loading, and error screens.
- For `/misokinesia` v1, include active stimuli, recent sessions, and trial-vs-production split. Do not add completed-session or average-session-duration metrics. Do not add module-health rows in v1.

## About the Design Files

The files in this bundle are **design references created in HTML/React** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these layouts in the existing Next.js + shadcn/ui codebase** (`frontend/`), reusing established patterns:

- shadcn `Button`, `Dialog`, `Popover`, `Select` from `frontend/src/components/ui/`
- Semantic tokens in `frontend/src/app/globals.css` (extend, don't replace)
- The lib component pattern in `frontend/src/lib/components/` (one file per component)
- JetBrains Mono — already loaded for both `font-sans` and `font-mono`
- Theme toggle at `frontend/src/lib/components/ThemeToggle.tsx` (no changes needed — the new components consume the same `--background`, `--card`, `--border`, `--primary`, etc.)

Open `reference.html` in a browser to see all ten mocks (5 surfaces × 2 themes).

## Fidelity

**High-fidelity.** Final colors, typography, spacing, hairlines, and component states are intentional and should be reproduced as-is. Where Tailwind utility classes can express a value, prefer them over inline styles. Where the existing repo conventions (e.g. `rounded-2xl`, `shadow-[var(--shadow-card)]`, `text-muted-foreground`) already cover something, use them.

## Theme Strategy

This redesign introduces **two new design tokens** that should be added to `frontend/src/app/globals.css`:

```css
:root {
  /* ... existing tokens ... */

  /* New: brand-ink — high-contrast heading colour that flips with theme.
     In light, this is the UBC anchor blue; in dark, a near-white. */
  --brand-ink: var(--ubc-video-blue);

  /* New: fieldset-bg — subtle surface lift for question containers. */
  --fieldset-bg: color-mix(in srgb, var(--foreground) 3%, transparent);
}

.dark {
  /* ... existing tokens ... */
  --brand-ink: #e6edf8;
  --fieldset-bg: color-mix(in srgb, white 3%, transparent);
}
```

For the **light theme palette swap** (paper-toned light mode), update the global `:root` semantic tokens in `frontend/src/app/globals.css` so the whole project uses the paper light theme:

```css
:root {
  --background: #fbfaf6;           /* warm off-white instead of #f6f7f8 */
  --card: #ffffff;                 /* white cards lifted on paper */
  --border: rgb(24 33 43 / 16%);   /* slightly stronger hairlines */
  --hairline: rgb(24 33 43 / 16%);
  --muted: color-mix(in srgb, #fbfaf6 86%, var(--foreground) 6%);
  --fieldset-bg: rgb(24 33 43 / 8%);
}
```

**Existing dark theme is unchanged.** It already matches the design exactly.

## Screens / Views

### A1 · RA Operational Dashboard — `/misokinesia` (RA-facing)

**Purpose:** RA's entry point for launching a participant session, running a rehearsal trial, or reviewing recent activity. Replaces the current launch hero + empty stats card.

**Layout:**
- Full-bleed page with `padding: 56px 64px`.
- Editorial masthead row: kicker + H1 + subtitle on the left (`max-width: 540px`), action cluster on the right.
- Lean metric/split area below: active stimuli plus recent sessions and trial/production split.
- Two-column row below: Recent sessions ledger (`1.8fr`) + Trial/Production split (`1fr`).

**Components:**
1. **Masthead** — `<p>` kicker (11px, weight 600, letter-spacing 0.18em, uppercase, muted-foreground), `<h1>` (30px, weight 700, letter-spacing -0.02em), `<p>` body (13px, line-height 1.6, muted).
2. **Primary action button** — "Start Misokinesia Session" with play icon. 44px height, 22px horizontal padding, 12px radius, `bg-primary text-primary-foreground`. Hover: `var(--primary-hover)`.
3. **Trial buttons** — "Short Trial" / "Full Trial", ghost variant: transparent bg, `border: 1px solid var(--border)`, foreground text. Hover: `bg-muted`.
4. **Active stimuli card** — `bg-card`, `border: 1px solid var(--border)`, `border-radius: 16px`, shadow `var(--shadow-card)`, padding `20px 24px`. Use a compact label / 30px bold tabular value / 11px helper line (`color: var(--ink-45)`). Do not add completed-session or average-session-duration metrics in v1.
5. **Recent sessions ledger** — 5 rows. Grid columns: `110px 1fr 110px 110px` (ID / timestamp / clips / status badge). Each row 12px padding, separated by 1px `border-bottom`. ID column tabular monospace, weight 600. Status badges: small pill, 10px text, uppercase, `bg-primary` when production-complete else neutral.
6. **Undo last session button** — ghost variant, 32px height, anchored top-right of the sessions card.
7. **Trial/Production split** — kicker, 8px-tall stacked bar (72% `var(--primary)`, 28% `var(--ubc-blue-300)`, 999px radius, overflow hidden on `bg-muted`), legend row below with two 8×8px swatches + 22px tabular values.

**Copy:**
- Kicker: "Misokinesia Study · Lab Operations"
- H1: "Misokinesia Task"
- Subtitle: "Launch a participant session, run a rehearsal trial, or review recent activity for this lab module."
- Trial hint: "Trials use fake ids · no data is written"

---

### A2 · Participant Demographics

**Purpose:** First screen the participant sees. Collects optional demographics. Submits via `PATCH /misokinesia/participants/{id}/demographics` (existing endpoint, no contract change).

**Layout:**
- Centered single column, `max-width: 760px`, `padding: 64px 32px`.
- Step indicator row at top: `01 / 04` tag, hairline rule, "Demographics → Intro → Task → Surveys" breadcrumb.
- Kicker + H1 + body.
- One card containing 4 form rows (`grid-template-columns: 200px 1fr`), each separated by `border-bottom: 1px solid var(--border)`, padded `22px 0`.
- Footer: estimated time on the left, "Continue →" primary button on the right.

**Components:**
1. **Step indicator** — small "01 / 04" tabular meta, expanding 1px rule, breadcrumb text in muted meta.
2. **Form row** — left column: 13px weight-600 label + optional hint. Right column: control (chip group or input).
3. **Chip group** — flex-wrap row of buttons, 8px gap. Each chip: 36px height, 14px horizontal padding, 10px radius, `border: 1px solid var(--border)`, `bg-card`, 12px weight-500 muted text. Selected: `bg-primary text-primary-foreground border-primary`, with light shadow. Hover (unselected): foreground text, ring-border.
4. **Free-text input** — `width: 100%`, 40px height, 10px radius, `bg-background`, `border: 1px solid var(--border)`, 14px horizontal padding, 13px text.
5. **Continue button** — 44px height, 22px padding, 12px radius, primary, `min-width: 160px`.

**Options:**
- Age: Under 18 / 18-24 / 25-31 / 32-38 / Over 38
- Gender: Woman / Man / Nonbinary person / Prefer not to say / Not listed (Not listed → reveal text input)
- Country: Canada / South Korea / Not listed (Not listed → reveal text input)
- Nationality: free text

**Copy:**
- Kicker: "Before we begin"
- H1: "About you"
- Body: "All questions are optional. You can skip any you prefer not to answer. Your answers are stored anonymously."
- Footer hint: "Roughly 18 minutes to complete"

---

### A3 · Per-clip Questionnaire

**Purpose:** Shown after every returned manifest clip. Collects 4 Likert ratings (1–5). Submits via `POST /misokinesia/participants/{id}/responses`.

**Layout:**
- Centered single column, `max-width: 760px`, `padding: 56px 32px`.
- Progress strip at top: "Clip 12 of 25" tabular, 2px-tall progress bar (current percentage, primary fill on muted track), "48%" tabular on right.
- Kicker + H2 + scale-explanation body.
- 4 stacked fieldsets, 14px gap.
- Footer: `{n}/4 answered` meta + Continue button.

**Components:**
1. **Progress strip** — 16px gap, 2px-tall rounded bar (999px radius), filled with primary, track `bg-muted`.
2. **Question fieldset** — `var(--fieldset-bg)` (subtle ink wash), `border: 1px solid var(--border)`, `border-radius: 14px`, padding `14px 16px`. Question label row: `Q1` 11px tabular meta (24px min-width) + 14px weight-500 statement. Scale row below: `padding-left: 36px`, flex-wrap chips with 8px gap.
3. **Scale chip** — column layout, `padding: 8px 12px`, `min-width: 64px`. Top line: 13px weight-600 numeral. Bottom line: 10px label, opacity 0.8.

**Questions (positional):**
1. "I find this video unpleasant"
2. "I felt physical discomfort during the video"
3. "I felt upset during the video"
4. "I wanted to stop the video early / or close my eyes"

**Scale:** 1 Strongly Disagree · 2 Disagree · 3 Neutral · 4 Agree · 5 Strongly Agree

---

### A4 · MkAQ / MAQ Carousel · Pane 3 of 4

**Purpose:** 21-item paned carousel (5 / 5 / 5 / 6 split). Same component drives MkAQ and MAQ (different copy, same shape). Submits the whole 21-item payload via `POST /misokinesia/participants/{id}/mkaq` (or `/maq`).

**Layout:**
- Centered single column, `max-width: 760px`, `padding: 56px 32px`.
- Header row: section meta + expanding hairline + 4 pane dots (filled left-of-current, primary on current, muted right-of-current) + "Part 3 / 4" tabular.
- Kicker ("Items 11–15 of 21") + H2 + scale legend body.
- 5 item rows, 12px gap.
- Footer: `n/5 answered on this part · 13/21 overall` meta + Previous (ghost) + Next (primary).

**Components:**
1. **Pane dots** — 4 × `28×4px` 999px-radius bars. Past = `var(--ubc-blue-300)`, current = `var(--primary)`, future = `var(--muted)`.
2. **Item row** — fieldset, `padding: 14px 18px`. `grid-template-columns: 32px 1fr auto`, 16px gap. Left: 11px tabular item number (zero-padded). Center: 14px weight-500 statement. Right: 4 compact chips (0–3), each `min-width: 40px`, weight 600.

**Scale:** 0 Not at all · 1 A little of the time · 2 A good deal of the time · 3 Almost all the time

**Pane structure (frontend-only, server still receives all 21):**
- Pane 1: items 1–5
- Pane 2: items 6–10
- Pane 3: items 11–15
- Pane 4: items 16–21 (absorbs the short remainder)

Previous preserves all selected answers. Next is enabled only when every item on the current pane is answered. Final submit only when all 21 are answered.

---

### A5 · Survey Transition Card

**Purpose:** Shown immediately before each of the three post-video surveys (MkAQ, GAD-7, MAQ). Frontend-only — no backend involvement. The reference shows the MkAQ transition; **GAD-7 and MAQ swap only the `NEXT` object** (kicker, title, description, meta values).

**Layout:**
- Centered, `max-width: 620px`, vertically centered (`min-height: 100vh`, flex center).
- Stage strip at top: "Clips complete ✓" meta + check glyph + expanding rule + 3 pane dots (current first highlighted) + "1 / 3 surveys" tabular.
- Card containing: kicker / 34px H1 / 14px body / hairline-bordered 4-row meta ledger / pause note / right-aligned primary button.

**Components:**
1. **Check glyph** — 18px diameter, `bg-primary text-primary-foreground`, 10px white checkmark stroke inside.
2. **Stage dots** — 3 × `24×4px`, current = primary, others = muted.
3. **Card** — `bg-card`, `border-radius: 16px`, padding `40px 44px`, shadow `var(--shadow-card)`.
4. **Meta ledger** — top-bordered, then each row: `grid 140px 1fr`, 24px gap, `padding: 12px 0`, separated by `border-bottom: 1px solid var(--border)` (last row no border).
5. **Pause note** — `bg-[var(--fieldset-bg)]`, 10px radius, `padding: 12px 14px`, pause-glyph icon + 12px body text.

**Copy (MkAQ — template):**
- Kicker: "Up next · Survey 1 of 3"
- Title: "Misokinesia Assessment"
- Description: "A short questionnaire about how certain visual stimuli affect you. Answer based on the past two weeks. There are no right or wrong answers."
- Meta: Items "21 statements" · Format "4 panes · Previous available" · Scale "0–3 · Not at all → Almost all" · Estimated "≈ 5 minutes"
- Pause note: "Take a breath before continuing — you can pause between questions."
- Button: "Begin assessment →"

**Copy swaps for GAD-7 / MAQ:**
- GAD-7 — Title: "Anxiety Questionnaire" · Description: "Seven short questions about feelings of anxiety over the past two weeks." · Items: "7 statements" · Format: "Single screen" · Scale: "1–4 · Never → Often" · Estimated: "≈ 1 minute"
- MAQ — Title: "Misophonia Assessment" · Description swaps "visual stimuli" for "certain sounds". Meta same as MkAQ (21 items / 4 panes — actually MAQ uses 3 production panes per spec; adjust meta accordingly: "3 panes" / "≈ 5 minutes").

---

## Interactions & Behavior

- **Restrained motion.** 150–300ms transitions on background and border-color for chips/buttons. No bouncy easing. Respect `prefers-reduced-motion`.
- **Chip selection** — single-select per question. Selected state has no shadow ring; it's a flat primary fill. Hover lifts the border color to `var(--ring)` and the text to `var(--foreground)`.
- **Focus rings** — keep the repo default (`outline-ring/50`); don't introduce new focus styling.
- **Disabled buttons** — `disabled` attribute drives styling; opacity drop is handled by shadcn `Button`.
- **Pane navigation** (A4) — preserves all answers across Previous/Next. Final submit posts the entire `q1…q21` payload to the existing endpoint.
- **No new keyboard shortcuts.** Existing `Enter`-to-submit and tab order are sufficient.
- **Fullscreen** — A2–A5 inherit the existing fullscreen behavior of `/misokinesia/[id]`. No changes.

## State Management

The existing state machine in `frontend/src/app/misokinesia/[misokinesia_participant_id]/page.tsx` is **unchanged**:

```
demographics → intro → playing → questionnaire → (loop × manifest clips)
             → [transition_card → post_survey] × 3 → end_of_task → complete
```

Components are pure-presentation refactors of the existing ones (`MisokinesiaDemographicsForm`, `MisokinesiaQuestionnaire`, `MisokinesiaMkaqForm`, the inline `TransitionCard`). API contracts, trial-mode handling, fullscreen, survey-order randomization, and score computation all stay backend-driven exactly as today.

The RA launch page (A1) becomes a lean operational view. It may use stub/mock data until backend support exists:

| Datum | Suggested source |
|---|---|
| Active stimuli count | Existing manifest/stimulus metadata if available; otherwise static/stubbed v1 data. |
| Recent sessions (last 5) | Future dashboard endpoint, with a `sessions[]` array including `participant_id`, `started_at`, `clips_completed/total`, `kind` (`production`/`short_trial`/`full_trial`), `status`. |
| 30d trial/prod split | Future dashboard endpoint or stubbed local data until real counts exist. |

**Don't block the redesign on these.** Ship the new layout with stubbed numbers behind a feature flag if backend isn't ready.

## Design Tokens

### Colors (all UBC anchor + tonal lifts, unchanged from style guide)

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--background` | `#fbfaf6` | `#12161c` | Outer canvas |
| `--card` | `#ffffff` | `#181d24` | Lifted surfaces |
| `--foreground` | `#18212b` | `#edf1f5` | Body text |
| `--muted` | `#f1f3f4` | `#1c2229` | Quiet fills |
| `--muted-foreground` | `#5d6773` | `#9aa5b1` | Secondary text |
| `--border` | `rgb(24 33 43 / 16%)` | `rgb(255 255 255 / 10%)` | Hairlines |
| `--primary` | `#001328` (UBC Video Blue) | `#39556e` | Action fills |
| `--primary-foreground` | `#f8fafc` | `#f8fafc` | Action text |
| `--primary-hover` | `#23415a` (`--ubc-blue-500`) | `#4a6885` | Button hover |
| `--ring` | `#36506b` | `#607f99` | Focus ring |
| `--brand-ink` ⚠ **new** | `#001328` | `#e6edf8` | Heading colour that flips with theme |
| `--fieldset-bg` ⚠ **new** | 3% ink wash | 3% white wash | Question container lift |
| `--shadow-card` | `0 1px 2px rgb(15 23 42 / 4%), 0 8px 20px rgb(15 23 42 / 5%)` | `0 1px 2px rgb(0 0 0 / 30%), 0 12px 28px rgb(0 0 0 / 40%)` | Card elevation |

### Typography

- Family: **JetBrains Mono** (already loaded; both `font-sans` and `font-mono` map to it).
- H1 (RA dashboard): 30px / 1.15 / weight 700 / letter-spacing -0.02em
- H1 (participant transition): 34px / 1.15 / weight 700 / letter-spacing -0.02em
- H2 (per-clip / MkAQ): 22px / 1.2 / weight 700 / letter-spacing -0.01em
- Body: 13–14px / 1.55–1.6 / weight 400–500
- Kicker: 11px / weight 600 / letter-spacing 0.18em / uppercase / muted-foreground
- Meta tabular: 11–12px / `font-variant-numeric: tabular-nums`
- Question label: 14px / weight 500 / line-height 1.45

### Radii

- Cards: **16px**
- Inputs / chips / fieldsets: **10–14px**
- Buttons: **12px**

### Spacing

8px base rhythm. Generous: 56–64px page padding on dashboards, 96px between major sections. Cards padded `20–40px` depending on density.

## Assets

No images or custom icons are required. The reference uses small inline SVG glyphs (play, flask, undo, check, pause) — replace with the repo's existing `lucide-react` equivalents:

| Reference glyph | lucide-react equivalent |
|---|---|
| Play | `Play` (or `Video`, matches current launch page) |
| Flask | `FlaskConical` (already used) |
| Undo | `Undo2` |
| Check (transition stage) | `Check` |
| Pause (transition note) | `Pause` |

## Files

In this bundle:

- **`reference.html`** — open in a browser to see all 10 mocks (5 surfaces × 2 themes).
- **`direction-a.jsx`** — React component source for the 5 surfaces (`SafeLaunch`, `SafeDemographics`, `SafePerClip`, `SafeMkaq`, `SafeTransition`). The `Safe*` names are arbitrary; rename to your component naming convention (suggested: `MisokinesiaLaunchPage`, `MisokinesiaDemographicsForm`, `MisokinesiaPerClipQuestionnaire`, `MisokinesiaMkaqForm`, `MisokinesiaSurveyTransitionCard`).
- **`styles.css`** — full CSS used by the reference. The new tokens (`--brand-ink`, `--fieldset-bg`, `--hairline`) and global paper light semantic mapping are documented in **Theme Strategy** above and should be merged into `frontend/src/app/globals.css`. The rest (`.safe-*`) is reference-only — translate to Tailwind utility classes in the production implementation.

## Implementation Sequence (suggested)

1. **Add new tokens and global paper light mapping** (`--brand-ink`, `--fieldset-bg`, `--hairline`, and paper `:root` values) to `globals.css`.
2. **Refactor `MisokinesiaQuestionnaire`** (A3) — smallest, used most. Validate the new chip + fieldset pattern.
3. **Refactor `MisokinesiaMkaqForm`** (A4) and reuse for MAQ — same `<MkaqForm>` component, different items prop.
4. **Refactor `MisokinesiaDemographicsForm`** (A2) — extract `<ChipGroup>` for reuse.
5. **Refactor inline `TransitionCard`** in `[misokinesia_participant_id]/page.tsx` (A5) — extract to `MisokinesiaSurveyTransitionCard.tsx`.
6. **Refactor unmocked participant states** — intro, GAD-7, end-of-task, completion, loading, and error states should use the same quiet editorial system.
7. **Refactor `MisokinesiaLaunchPage`** (A1) — add the lean operational view: start/trial actions, active stimuli, recent sessions, and trial/prod split. Stub data until a backend endpoint lands. Do not add completed-session, average-session-duration, or module-health blocks in v1.
8. **Verify light/dark mode** — light should use the global paper theme; dark should require minimal additional work because tokens already flip.

## Out of Scope

- Pre-clip black buffer
- Mobile / tablet adaptations
- Backend changes (any new metric endpoints are tracked separately)
- The platform-wide RA chrome (`RAFloatingChrome`, `RANavBar`) — no changes needed

## Open Questions for Product

1. Sessions ledger (A1) — do we want a "View all" affordance to a fuller participants page, or is "last 5" the permanent surface area?
2. Trial/Production split window — 30 days, or align with the existing study-window selector elsewhere in the RA dashboard?
