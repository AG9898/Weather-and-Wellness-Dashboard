# CARD_SORTING.md - WCST-64-Inspired Card Sorting Task Specification

> Planned Weather-Wellness cognitive task. This is a WCST-64-inspired browser
> card sorting task, not a licensed or proprietary WCST clone.

---

## Overview

Participants sort response cards by choosing one of four reference cards. Each
card varies by:

- Color
- Form / shape
- Number

The active sorting rule is hidden. Participants learn the rule through
correct/incorrect feedback. After enough consecutive correct responses, the rule
changes without warning.

The task is part of the randomized WW cognitive task battery after all four
surveys. The battery contains Backward Digit Span, Stroop, and card sorting in a
stored per-session order.

Reference implementation pattern: PsyToolkit documents an open WCST-inspired
task that avoids copying the proprietary test while preserving the core
category-learning structure:
https://www.psytoolkit.org/experiment-library/wcst.html.

Scoring reference: computerized WCST literature commonly reports categories
completed, total errors, perseverative responses/errors, non-perseverative
errors, and related set-maintenance measures. Preserve raw trials so these
metrics can be recomputed if the scoring policy is refined later. See Miles et
al. 2021:
https://link.springer.com/article/10.3758/s13428-021-01551-3.

---

## Rule Schedule

Use a hidden six-category schedule built from the three category dimensions:
`color`, `shape`, and `number`.

Requirements:

- The first category is `color`.
- Across the six possible category blocks, each dimension appears twice.
- Adjacent blocks must not use the same dimension.
- The order must not be the predictable recurring sequence
  `color -> shape -> number -> color -> shape -> number`.
- The assigned rule order is generated or selected per participant session and
  stored for audit/review.
- Native WW sessions receive this order at `POST /sessions/start`; active
  participant sessions read it through `GET /sessions/{session_id}/cognitive-battery`.
- Participant-facing UI must not reveal the rule names, total number of
  possible categories, rule order, or any recurring pattern.

---

## Shift Trigger

- The participant must achieve exactly 10 consecutive correct responses under
  the current rule before the task advances to the next rule.
- The rule changes on the next trial after the 10th consecutive correct
  response.
- The rule change is automatic and has no warning or notification.
- If a participant reaches 9 consecutive correct responses and then makes an
  error, the streak resets to 0.
- After the sixth category is completed, the task continues through card 64 with
  the final rule active. `categories_completed` remains capped at 6.

---

## Termination

- The task ends immediately when all 64 response cards are sorted.
- It does not end early when all 6 category blocks are completed.
- Maximum `categories_completed` is 6.

---

## Trial Mode

- Full Trial mirrors the production 64-card task but skips all backend writes.
- Short Trial uses the same screens with a smaller response-card set for fast RA
  rehearsal.
- Trial mode uses local simulated submit success and routes to the next trial
  section without calling `POST /card-sorting/runs`.
- The WW trial section jumper may enter card sorting directly in trial mode only.

---

## Participant Feedback

After every sort, show simple feedback:

- Correct
- Incorrect

Do not state the active category, upcoming category, streak count, number of
categories completed, or remaining rule schedule.

---

## Server-Side Scoring

Persist raw scored trials and task-level summary fields. Do not add
Weather-Wellness analytics/modeling outputs in this work.

Perseverative scoring can be disputed if only aggregates are stored, so every
scored trial must be persisted with enough raw state to recompute scores later.

Planned run-level metrics:

| Metric | Computation |
|---|---|
| `total_trials` | Count of response cards sorted, max 64 |
| `categories_completed` | Count of 10-correct category completions, capped at 6 |
| `total_correct` | Count of trials matching the active rule |
| `total_errors` | Count of trials not matching the active rule |
| `perseverative_responses` | Responses matching the previous active rule after a category shift |
| `perseverative_errors` | Perseverative responses that are incorrect under the current rule |
| `nonperseverative_errors` | Incorrect responses that are not perseverative errors |
| `trials_to_first_category` | Trial number where the first category is completed, or null |
| `failure_to_maintain_set_count` | Incorrect response after 5-9 consecutive correct responses in a category |

---

## Planned API Shape

`POST /card-sorting/runs`

Payload:

```json
{
  "session_id": "uuid",
  "trials": [
    {
      "trial_number": 1,
      "card_color": "red",
      "card_shape": "triangle",
      "card_number": 2,
      "selected_reference_index": 3,
      "reaction_time_ms": 2310
    }
  ]
}
```

The backend reads the stored `rule_order` for the session, recomputes
correctness, streaks, category shifts, and all score fields before persistence.
Response includes the persisted `run_id` plus the run-level metrics above.

---

## Planned Data Storage

See `docs/SCHEMA.md` for the migrated table shape.

**Per run** (`card_sorting_runs`): one row per `session_id`, including
`participant_uuid`, hidden rule order, category count, correctness/error
summaries, perseverative summaries, and completion timestamps.

**Per trial** (`card_sorting_trials`): one row per sorted response card with
trial number, card attributes, selected reference, active rule, previous rule,
correctness, category streak before/after the response, category index, reaction
time, and feedback shown.
