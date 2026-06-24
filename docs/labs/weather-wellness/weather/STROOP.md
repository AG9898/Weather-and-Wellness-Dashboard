# STROOP.md - Stroop Task Specification

> Planned Weather-Wellness cognitive task. Implements a browser-based color-word
> Stroop task with client-side response timing and server-side scoring.

---

## Overview

Participants see color words rendered in colored text. They must respond to the
ink color, not the word meaning.

The task is part of the randomized WW cognitive task battery after all four
surveys. The battery contains Backward Digit Span, Stroop, and card sorting in a
stored per-session order.

Reference implementation pattern: PsyToolkit Stroop task documentation
describes compatible/incompatible color-word trials, keypress response
collection, response time, and error recording:
https://www.psytoolkit.org/experiment-library/stroop.html.

---

## Trial Mode

- Full Trial mirrors the production-length task but skips all backend writes.
- Short Trial uses the same screens with fewer scored trials for fast rehearsal.
- Trial mode uses local simulated submit success and routes to the next trial
  section without calling `POST /stroop/runs`.
- The WW trial section jumper may enter Stroop directly in trial mode only.

---

## Stimuli

Use a small fixed color set with one response key per color. Responses are bound
to the number keys `1`–`4` (number-row and numpad both emit these), shown on the
participant UI as labelled keycaps next to each color swatch:

| Ink color | Word | Response key |
|---|---|---|
| red | RED | 1 |
| blue | BLUE | 2 |
| green | GREEN | 3 |
| yellow | YELLOW | 4 |

Trials are either:

- `congruent`: word meaning matches ink color.
- `incongruent`: word meaning differs from ink color.

The participant-facing instructions must emphasize responding to ink color.

---

## Trial Counts

Production target:

- Practice: short unscored block with feedback.
- Scored: 80 trials, balanced between congruent and incongruent conditions.
- Expected duration: about 3-5 minutes.

Short Trial target:

- Practice: optional 2-4 trials.
- Scored: 8-12 trials, balanced enough to verify both conditions and routing.

---

## Timing And Input

- Measure reaction time on the client from stimulus render to accepted keypress.
- Accepted keys are the configured color keys only.
- Ignore unrelated keys.
- A timeout may be used for non-response trials; timed-out trials are stored and
  excluded from correct-trial reaction-time means.
- Frontend records raw timing and response data. Backend recomputes correctness
  and all score fields before persistence.

---

## Server-Side Scoring

Persist raw scored trials and task-level summary fields. Do not add
Weather-Wellness analytics/modeling outputs in this work.

Planned run-level metrics:

| Metric | Computation |
|---|---|
| `total_trials` | Count of scored trials submitted |
| `correct_trials` | Count of trials where response color equals ink color |
| `error_trials` | Count of non-timeout incorrect responses |
| `timeout_trials` | Count of trials with no accepted response before timeout |
| `overall_accuracy` | `correct_trials / total_trials` |
| `congruent_accuracy` | Correct congruent trials / total congruent trials |
| `incongruent_accuracy` | Correct incongruent trials / total incongruent trials |
| `mean_rt_congruent_ms` | Mean RT for correct, non-timeout congruent trials |
| `mean_rt_incongruent_ms` | Mean RT for correct, non-timeout incongruent trials |
| `stroop_interference_ms` | `mean_rt_incongruent_ms - mean_rt_congruent_ms` |

---

## Planned API Shape

`POST /stroop/runs`

Payload:

```json
{
  "session_id": "uuid",
  "trials": [
    {
      "trial_number": 1,
      "condition": "congruent",
      "word": "RED",
      "ink_color": "red",
      "response_key": "1",
      "response_color": "red",
      "reaction_time_ms": 742,
      "timed_out": false
    }
  ]
}
```

Response includes the persisted `run_id` plus the run-level metrics above.

**Implementation (T208):** `POST /stroop/runs` is implemented in
`backend/app/routers/stroop.py` with pure scoring in
`backend/app/scoring/stroop.py`. The endpoint validates that the session exists
(`404` otherwise) and is `active` (`409` otherwise), rejects a second run for the
same session (`409`, one run per session), and recomputes correctness from
`response_color` vs `ink_color` rather than trusting the client. Submission
validation (`422`) rejects unknown `condition` values, duplicate `trial_number`s
within a run, non-timeout trials missing `response_color`, and timed-out trials
that carry a `reaction_time_ms`. Correctness uses case-insensitive,
whitespace-trimmed color comparison. The persisted scored trials store the
backend-computed `correct` flag, and timed-out trials have their stored
`reaction_time_ms` cleared to null.

---

## Planned Data Storage

See `docs/labs/weather-wellness/weather/SCHEMA.md` for the migrated table shape.

**Per run** (`stroop_runs`): one row per `session_id`, including
`participant_uuid`, trial counts, accuracy fields, condition RT means, and
`stroop_interference_ms`.

**Per trial** (`stroop_trials`): one row per scored trial with trial number,
condition, word, ink color, response key/color, backend-computed correctness,
reaction time, timeout flag, and timestamp.

---

## Participant UI (T211)

The participant page is `frontend/src/app/session/[session_id]/stroop/page.tsx`,
built on the shared WW trial/test shell (`EditorialTaskShell` /
`EditorialTaskPanel` / `EditorialTaskHeader`) used by Backward Digit Span.

Flow: instructions → 4 unscored practice trials with feedback → scored block →
end-of-task submit. A fixation `+` is shown between scored trials.

- **Stimuli/keys.** Ink colors red/blue/green/yellow bound to number keys
  `1`/`2`/`3`/`4` respectively. Only those keys are accepted; all other keys are
  ignored. Space advances instruction screens. The number→color mapping is shown
  on-screen as labelled keycaps (`ColorKeyLegend`) on every instruction, practice,
  and scored trial.
- **Balanced scored trials.** Production runs 80 scored trials (40 congruent /
  40 incongruent), shuffled. Incongruent stimuli always render a word whose
  meaning differs from the ink color.
- **RT capture.** Reaction time is measured client-side from stimulus render
  (`performance.now()`) to the accepted keypress and rounded to whole ms.
- **Timeout.** Each scored trial has a 3000 ms response window. Timed-out trials
  are recorded with `timed_out: true` and null `response_key`/`response_color`/
  `reaction_time_ms`; practice timeouts show a "Too slow" feedback line.
- **No client scoring.** The page records raw `word`, `ink_color`, `condition`,
  `response_key`, `response_color`, `reaction_time_ms`, `timed_out`, and
  `trial_number` only. No correctness or run metrics are computed or displayed
  in the participant UI.
- **Production submit.** Posts the trial array to `POST /stroop/runs` via the
  typed `apiPost<StroopRunResponse>` wrapper (`StroopRunResponse` added to
  `frontend/src/lib/api/index.ts`), then routes to the next battery task — or
  patches the session to `complete` when Stroop is the last task — using the
  shared battery helpers in `frontend/src/lib/trial-mode.ts`.
- **Trial mode.** A shortened scored block of 12 trials (6 / 6 balanced) runs
  with a local simulated submit (no `/stroop/runs` call) and routes to the next
  trial section via `buildTrialRunPath`.
