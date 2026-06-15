# Design Spec — Phase 1 + Phase 2 + Phase 3 + Phase 4

Visual language baseline: [docs/styleguide.md](../../../styleguide.md) · Animation library: [docs/animejs.md](../../../animejs.md)

## UX Goals
- Guided, simple flow — one screen per step, no back navigation during session
- Keyboard-first cognitive tasks with clear focus states and no back navigation during session
- Exact survey wording from lab instrument forms (present-tense, "Right now..." framing)
- WW participant surveys, Digit Span, and completion screens share the quiet
  editorial task shell from `docs/styleguide.md`: compact step metadata,
  hairline/progress rhythm, flat response controls, and mobile-safe spacing.

## RA Flow
1. Login
   - App-owned RA/admin invitation links use `/set-password?invite=<token>`; successful activation sets the Supabase Auth password through the backend invitation acceptance endpoint, then returns the user to normal email/password login.
2. Click "Start New Entry" → navigates to `/new-session`
3. **Step 1 (consent):** Participant reads the official consent PDF; clicks "I Consent" to proceed or "I Do Not Consent" to cancel and return to dashboard (no DB record in either case)
4. **Step 2 (demographics):** RA fills required participant details and chooses either production start or rehearsal start:
   - **Start Session:** backend creates anonymous participant + active session atomically
   - **Run Short Trial:** frontend enters local-only trial mode with fake ids, shortened cognitive tasks, and no backend writes
   - **Run Full Trial:** frontend enters local-only trial mode with fake ids, production-length tasks, and no backend writes
5. RA is navigated directly into the participant survey flow (`/session/<id>/uls8`) for either mode
6. After completion, return to RA dashboard:
   - production mode: KPIs reflect the new complete session
   - trial mode: no KPI/data changes (no writes)
7. View data via Supabase Studio
8. To run a Misokinesia session: click the **Misokinesia** entry in the floating dock → navigates to `/misokinesia` → click either "Start Misokinesia Session" (backend-backed write path), "Run Short Trial", or "Run Full Trial" (read-only rehearsal paths) → app navigates to `/misokinesia/[id]` participant task page (same device). See [Misokinesia Design Spec](../misokinesia/DESIGN_SPEC.md).

## Participant Flow
1. ULS-8 survey
2. CES-D 10 survey
3. GAD-7 survey
4. Cognitive Function 8a survey
5. Randomized cognitive task battery:
   - Backward Digit Span
   - Stroop
   - WCST-64-inspired card sorting
6. Completion screen (thank you) → return to RA dashboard

The four surveys always remain first and in fixed order. The three cognitive
tasks are assigned in a randomized order per participant session. Production
mode stores the assigned order so later review can account for task-order
effects. Trial mode generates an equivalent local-only order unless the RA uses
the trial section jumper.

Each cognitive task submits its own task data, then routes to the next task in
the assigned order. Only the final task in the randomized battery marks the
session complete.

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
  - Never writes rows to `participants`, `sessions`, survey tables, digit span tables, Stroop tables, card sorting tables, or misokinesia tables
  - WW Short Trial uses shortened cognitive task protocols for fast rehearsal; WW Full Trial mirrors production-length cognitive tasks without writes
  - WW trial mode includes a trial-only section jumper so RAs can jump to consent/demographics, any survey, the battery intro, each cognitive task, and completion
  - Misokinesia Trial Run locally generates the post-video survey order and never persists that assignment
- Misokinesia video behavior:
  - Short Trial samples 5 active videos by `stimulus_id`
  - Plays the sampled videos from public Supabase Storage CDN URLs
  - Does not serve or proxy video bytes through FastAPI
- UX behavior:
  - Preserves the same end-to-end screen order as production flow
  - Shows a compact centered top-screen "Trial Run" watermark on WW participant
    trial-mode screens; Misokinesia participant task screens do not show this
    badge. The badge and any trial-only controls must stay clear of prompts,
    inputs, feedback, and primary actions on mobile and desktop.
  - Ends on the standard completion screens

## WW Cognitive Task Battery

Full task specifications:
- Backward Digit Span: [DIGITSPAN.md](DIGITSPAN.md)
- Stroop: [STROOP.md](STROOP.md)
- WCST-64-inspired card sorting: [CARD_SORTING.md](CARD_SORTING.md)

The battery order contains exactly one instance of each key:
`digitspan`, `stroop`, `card_sorting`.

The assigned order is participant/session scoped. It must be stable across
refreshes and submitted task transitions, and it must be available for later
data review. Production sessions receive their stored task order and hidden card
sorting rule order when `/sessions/start` creates the active session. The
post-survey battery reads the stored manifest from
`GET /sessions/{session_id}/cognitive-battery`. Do not compute or store weather
analytics/modeling outputs as part of this task-order work.

### WW Trial Section Jumper

- Rendered only in WW trial mode; never shown in recorded participant sessions.
- Available in both Short Trial and Full Trial.
- Provides direct jump targets for major sections:
  `Consent`, `Demographics`, `ULS-8`, `CES-D`, `GAD-7`, `CogFunc`, `Battery`,
  `Digit Span`, `Stroop`, `Card Sort`, and `Done`.
- Jumping is local-only state navigation. It must not create participant rows,
  sessions, survey rows, task rows, or session-complete writes.
- Targets and routing come from the pure helper
  `weatherWellnessSectionPath(section, sessionId)` in
  `frontend/src/lib/trial-mode.ts` (sections enumerated by
  `WEATHER_WELLNESS_SECTIONS`). Consent and Demographics resolve to
  `/new-session`; surveys, CogFunc, the battery intro, each cognitive task, and
  Done resolve to `/session/{id}/...` routes carrying `?trial=1`. The helper is
  side-effect free and makes no API calls. The selected variant is recorded on
  `TrialRunState.weather_wellness_trial_mode`.
- The jumper should use a compact segmented control or menu that stays clear of
  the trial watermark and primary task controls on mobile and desktop.

---
