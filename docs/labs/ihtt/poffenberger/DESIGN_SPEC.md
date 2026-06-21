# DESIGN_SPEC.md - IHTT Poffenberger UX

> UX specification for the IHTT Poffenberger launch and participant task flow.
> Follow `docs/styleguide.md` for shared visual language and Tailwind/shadcn
> conventions.

---

## Scope

v1 is intentionally narrow:

- one RA launch page for the IHTT Poffenberger task
- production session launch
- short and full no-write trial runs
- participant task screens
- completion screen

No IHTT dashboard, recent-session ledger, metrics cards, leaderboard, export UI,
or analytics view is included in v1.

## RA Launch Page

Route recommendation: `/ihtt/poffenberger`.

Required actions:

- **Start Poffenberger Session** - creates a recorded participant/session/run and
  navigates to the participant task route.
- **Run Short Trial** - creates local fake trial state and opens a shortened
  no-write rehearsal.
- **Run Full Trial** - creates local fake trial state and opens a production-
  length no-write rehearsal.

The page should be quiet and operational. It should not show placeholder
dashboard cards. If no recorded-session summary endpoint exists, do not mock one.

The launch page is RA-only and available to authenticated users scoped to
`app_metadata.lab == "ihtt"` plus admins.

Recorded session launch must collect the platform-required anonymous
start-session demographics before calling the recorded start endpoint. The
RA-provided IHTT brief does not define additional IHTT-specific demographic
questions.

## Participant Task Route

Route recommendation: `/ihtt/poffenberger/[run_id]`.

The task should be full-screen capable and optimized for precise response
timing:

- minimize layout shifts once the task begins
- keep the fixation/stimulus area stable
- avoid decorative animation during timed trials
- hide RA navigation chrome during active task phases
- keep all task controls keyboard-accessible

The task should use a stable fixed-format stage for fixation, dot presentation,
and response capture. Text-heavy instructions belong before timed trials, not
during them.

## Screen Flow

1. Loading/error state.
2. UI-only consent gate if using the shared participant consent pattern.
3. Instructions.
4. Practice intro.
5. 10 right-hand practice trials.
6. Experimental block intro for the current response hand.
7. Experimental trials for block 1 through block 12.
8. Local completion/submission state.
9. Completion screen.

Practice and block transition screens may show the assigned response hand and
the response key. During timed trials, the UI should show only what is necessary
for the task.

## Trial Presentation

Each timed trial:

1. Shows fixation or blank waiting state.
2. Applies the manifest's 1000-2000 ms jitter before stimulus onset.
3. Presents one dot in LVF or RVF.
4. Starts reaction-time measurement at stimulus onset.
5. Ends on valid response or after 2000 ms.
6. Advances to the next trial without feedback during experimental blocks.

Practice trials may provide minimal feedback if useful for RA verification, but
the RA brief does not require feedback. If feedback is added, keep it out of
experimental blocks.

No audio cue is part of the v1 timed-trial UI. The Millisecond/Inquisit
reference task includes a short tone before the light flash, but the RA-provided
brief does not require it. If added later, audio should be implemented with the
Web Audio API after an explicit start action unlocks an `AudioContext`; schedule
a short low-volume oscillator tone before dot onset, and keep reaction-time
measurement anchored to visual dot onset.

## Response Keys

The RA brief requires response by assigned hand but does not specify exact keys.
Implementation must choose and document keys before build completion.

Selected default:

- left-hand blocks: `f`
- right-hand blocks and practice trials: `j`

The selected key for the current block should be displayed on instruction and
block transition screens. The backend must validate submitted responses against
the key assigned in the manifest.

## Trial Runs

Both trial modes are no-write rehearsals and should be visibly distinguishable
from production before the RA starts them.

Short Trial:

- Exercises the same screens and response handling.
- Uses fewer trials for fast QA.
- Must include both hands and both visual fields.
- Should not call recorded start, submit, or session-complete endpoints.

Full Trial:

- Mirrors production trial counts and timing.
- Uses fake trial IDs.
- Should not call recorded write endpoints.

A section jumper is optional for IHTT v1. If added, it must be trial-only and
must never appear in recorded participant sessions.

## Error Handling

- Start failures return the RA to the launch page with an inline error.
- Participant submit failures preserve captured trial data in memory so the
  participant or RA can retry.
- If timing data is incomplete or malformed, show a clear task error rather than
  silently completing the run.

## Accessibility And Timing Notes

This is a timed visual reaction task, so normal form-style accessibility patterns
do not fully apply during timed trials. Still:

- instruction and transition screens must be readable and keyboard accessible
- focus should not jump during timed trials
- stimulus area dimensions should be stable across viewport sizes
- text must not overlap controls on desktop or mobile
- the task should warn the RA before starting if the viewport is too small for a
  reliable lateralized stimulus presentation
- if a future audio cue is enabled, the task should provide a clear pre-start
  audio readiness check and a non-audio fallback for muted or blocked playback
