# TRIAL_MODE.md — Trial Run Canonical Rules

Canonical specification for trial-run behavior across WW and Misokinesia participant flows.

---

## Fake ID Format

- Trial mode IDs must use the `trial-<sequence>` format (for example, `trial-1`, `trial-2`).
- Do not use UUID v4 IDs in trial mode.
- Store trial IDs in session/local storage only.
- Never write trial IDs to the database.

## Watermark Visibility

- Show the `Trial Run` watermark on Weather Wellness participant pages only.
- Always exclude the watermark from the Misokinesia participant task route (`/misokinesia/[id]`), even when `TRIAL_RUN_MODE` is active.
- Keep the Weather Wellness watermark compact, centered at the top of the
  viewport, and visually clear of participant prompts, inputs, feedback, and
  primary actions across mobile and desktop layouts.

## Module Placement

- Trial-mode pure functions, including `getTrialRunWatermarkLabel`, live in `src/lib/trial-mode.ts`.
- Watermark UI rendering lives in a separate component.
- Keep both modules side-effect free and synchronous (no async logic).

## Consent

- Consent gating is UI-only.
- The consent screen gates participant flow before navigation to the first survey.
- Consent does not write a database row.
- Trial mode does not bypass or alter consent gating logic.

## Weather-Wellness Short And Full Trial Modes

- WW exposes separate **Run Short Trial** and **Run Full Trial** controls from
  the consent/demographics launch flow (`src/app/(ra)/new-session/page.tsx`).
  Both controls call `createTrialRunState("weather-wellness", mode)`; the chosen
  variant is stored on `TrialRunState.weather_wellness_trial_mode` (`"short"` |
  `"full"`) in session storage. The old single `Run Test Trial` control is
  removed.
- Both modes are frontend-only rehearsals: they use fake ids, local task order,
  simulated submit success, and no backend writes.
- Full Trial mirrors production-length WW participant flow: four surveys followed
  by the randomized cognitive task battery.
- The trial cognitive battery order is generated and persisted locally on the
  trial run state by `getOrCreateTrialCognitiveTaskOrder` (in
  `frontend/src/lib/trial-mode.ts`) so it stays stable across task transitions
  and never calls `GET /sessions/{id}/cognitive-battery` or any write endpoint.
- Short Trial keeps the same major sections but uses shortened cognitive task
  protocols for fast RA rehearsal.
- Both modes include a WW-only section jumper. The jumper is trial-only and can
  navigate directly to consent/demographics, any survey, the battery intro,
  Digit Span, Stroop, card sorting, and completion.
- Section targets and routing are provided by the pure helper
  `weatherWellnessSectionPath(section, sessionId)` in
  `frontend/src/lib/trial-mode.ts`. Sections are enumerated by
  `WEATHER_WELLNESS_SECTIONS` with labels in
  `WEATHER_WELLNESS_SECTION_LABELS`. Route mapping:
  - `consent`, `demographics` → `/new-session` (pre-session RA launch surface)
  - `uls8` → `/session/{id}/uls8`, `cesd` → `/session/{id}/cesd10`,
    `gad7` → `/session/{id}/gad7`, `cogfunc` → `/session/{id}/cogfunc`
  - `battery` → first task in the local trial battery order, plus `digitspan`,
    `stroop`, `card_sorting` → their `/session/{id}/{task}` routes
  - `done` → `/session/{id}/complete`

  All `/session/{id}` targets carry the `?trial=1` query parameter so
  participant pages recover the trial signal.
- Jumping sections must not call `/sessions/start`, survey submit endpoints,
  task submit endpoints, or session-complete writes. `weatherWellnessSectionPath`
  is pure and performs no API calls.
- The jumper UI is the `WeatherWellnessTrialSectionJumper` client component
  (`frontend/src/lib/components/WeatherWellnessTrialSectionJumper.tsx`), rendered
  once in the session route layout
  (`frontend/src/app/session/[session_id]/layout.tsx`) so it covers every WW
  survey and cognitive task page. It renders only when
  `isTrialRunActiveForLocation` is true (and a trial session id is present), so it
  never appears in recorded participant sessions. The active button is derived
  from the pathname by the pure helper `weatherWellnessSectionFromPath` (in
  `frontend/src/lib/trial-mode.ts`). On click it calls
  `router.push(weatherWellnessSectionPath(section, sessionId))` — local
  navigation only, no writes. It is fixed to the bottom-center of the viewport
  (the Trial Run watermark holds the top-center), and the session shell adds
  bottom padding so the jumper stays clear of task prompts, inputs, feedback, and
  primary buttons on mobile and desktop.
