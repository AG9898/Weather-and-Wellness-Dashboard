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

No leaderboard, export UI, or weather-style analytics view is included in v1.

## RA Launch Page (operations dashboard)

Route recommendation: `/ihtt/poffenberger`.

The front surface is an operations dashboard that mirrors the misokinesia launch
board, rather than opening directly into the demographics form. It shows:

- A header with the launch actions (below).
- A **Completed runs** headline metric (`completed_runs` of `total_runs`).
- A **Recent runs** ledger (up to 10 runs: participant number, relative start
  time, demographics, and the IHTT difference for completed runs / "In progress"
  otherwise).
- A **Run summary** panel (completed, in progress, average IHTT difference).

These are backed by `GET /ihtt/poffenberger/dashboard` (see `API.md`).

Required actions:

- **Start Poffenberger Session** - opens a dialog that collects the IHTT
  anonymous demographics (age band, gender, handedness), then creates a recorded
  participant/session/run and navigates to the participant task route.
- **Short Trial** - creates local fake trial state and opens a shortened no-write
  rehearsal.
- **Full Trial** - creates local fake trial state and opens a production-length
  no-write rehearsal.

Because the no-write trials create no records, they launch directly and do **not**
require demographics; only the recorded Start collects them (in the dialog).

The launch page is RA-only and available to authenticated users scoped to
`app_metadata.lab_name == "ihtt"` plus admins.

Implementation note: the launch surface is `frontend/src/app/(ra)/ihtt/poffenberger/page.tsx`,
served at `/ihtt/poffenberger` inside the `(ra)` auth-guarded route group (RA
navigation chrome wraps it). It fetches the dashboard via
`getPoffenbergerDashboard` (`frontend/src/lib/api/ihtt-poffenberger.ts`) and
renders the presentational `PoffenbergerLaunchPage` component, gating access
client-side to ihtt lab members and admins (non-matching RAs are redirected to
`/unauthorized`); the backend endpoints remain the authoritative lab-scope check.
The recorded Start action stores the backend start response via
`persistPoffenbergerRunState` before navigating to the participant task route,
and the trial actions persist a local no-write `TrialRunPoffenbergerState`.

Navigation: the RA floating dock (`RAFloatingChrome`) is lab-scoped. Dock items
come from the per-lab registry in `frontend/src/lib/labs.ts`; for the `ihtt` lab
this page is surfaced as the lab's **Dashboard** entry (IHTT has no separate
weather dashboard in v1). IHTT RAs land here by default; admins reach it by
selecting IHTT in the admin-only lab switcher in the dock's utility menu, which
swaps the dock to that lab's items. Weather-Wellness items (weather dashboard,
Chat, Misokinesia) are not shown while IHTT is the active lab.

Recorded session launch must collect age band, gender, and handedness before
calling the recorded start endpoint. The RA-provided IHTT brief does not define
a broader demographic instrument, and Weather-Wellness exposure questions
(`origin`, `commute_method`, `time_outside`) do not apply to Poffenberger.

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

Implementation note: the participant route is `/ihtt/poffenberger/[run_id]`.
For recorded sessions it expects the RA launch flow to place the backend start
response in browser session storage before navigation. For trial runs it can use
the local no-write Poffenberger trial state. No RA layout or floating RA chrome
wraps the timed route.

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
- Completion is shown only after the backend submit succeeds in recorded mode;
  local trial runs simulate submit success without writing rows.
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
