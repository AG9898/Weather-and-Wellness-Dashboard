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

Use a small fixed color set with one response key per color. The initial planned
set is:

| Ink color | Word | Response key |
|---|---|---|
| red | RED | R |
| blue | BLUE | B |
| green | GREEN | G |
| yellow | YELLOW | Y |

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
      "response_key": "r",
      "response_color": "red",
      "reaction_time_ms": 742,
      "timed_out": false
    }
  ]
}
```

Response includes the persisted `run_id` plus the run-level metrics above.

---

## Planned Data Storage

See `docs/SCHEMA.md` for the migrated table shape.

**Per run** (`stroop_runs`): one row per `session_id`, including
`participant_uuid`, trial counts, accuracy fields, condition RT means, and
`stroop_interference_ms`.

**Per trial** (`stroop_trials`): one row per scored trial with trial number,
condition, word, ink color, response key/color, backend-computed correctness,
reaction time, timeout flag, and timestamp.
