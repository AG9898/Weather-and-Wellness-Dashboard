# SCORING.md - IHTT Poffenberger Scoring

> Canonical scoring spec for the IHTT Poffenberger component. The frontend
> records timing and response events only. FastAPI validates trials and computes
> all persisted summaries.

---

## Source

The required outputs come from
`reference/labs/ihtt/Poffenberger Paradigm.docx`: categorized reaction time and
categorized accuracy for the four combinations of response hand and visual
field.

## Server-Side Rule

All scoring and derived summary fields are computed server-side. The client must
not submit trusted condition means, accuracy rates, crossed/uncrossed summaries,
or transfer-time differences.

The client may submit raw event data:

- assigned response hand
- visual field
- expected response key
- pressed key, if any
- reaction time in milliseconds, if any
- timeout flag
- practice vs experimental flag
- manifest identifiers

The backend validates those records against the server-generated manifest before
persistence.

## Valid Scored Trials

The RA brief specifies that trials with reaction time longer than 2000 ms are
excluded from further analyses and that each trial ends after a valid response
or after 2000 ms.

For v1:

- Scored summaries include experimental trials only.
- Practice trials are excluded from condition summaries.
- A valid reaction-time trial has an accepted response with
  `0 < reaction_time_ms <= 2000`.
- Timeout trials and late responses are excluded from reaction-time means.
- Timeout trials and invalid-key responses still count in accuracy denominators
  unless the RA later requests a different accuracy definition.
- A trial is accurate when the accepted key matches the expected key for the
  assigned response hand before the 2000 ms cutoff.

If implementation captures an impossible or malformed reaction time, the backend
should reject the payload rather than silently scoring it.

## Required Condition Summaries

Compute these for each of the four RA-required conditions:

| Condition key | Response hand | Visual field | Crossed status |
|---|---|---|---|
| `lh_lvf` | Left | LVF | Uncrossed |
| `lh_rvf` | Left | RVF | Crossed |
| `rh_lvf` | Right | LVF | Crossed |
| `rh_rvf` | Right | RVF | Uncrossed |

Per-condition fields:

| Field | Definition |
|---|---|
| `total_trials` | Experimental trials assigned to this condition |
| `valid_rt_trials` | Trials with accepted response and RT from 1-2000 ms |
| `timeout_trials` | Trials with no accepted response before 2000 ms |
| `invalid_trials` | Trials with invalid/missing response data that cannot be scored as accurate |
| `accurate_trials` | Trials with the expected key before timeout |
| `accuracy` | `accurate_trials / total_trials` |
| `mean_rt_ms` | Mean RT across accurate valid-RT trials |
| `median_rt_ms` | Median RT across accurate valid-RT trials |
| `sd_rt_ms` | Sample standard deviation across accurate valid-RT trials |

The RA only explicitly requested categorized reaction time and categorized
accuracy. The count fields and distribution fields above are recommended
companion outputs because they make the means auditable and help detect unusable
or sparse sessions.

## Complementary Crossed/Uncrossed Summaries

These fields are recommended because they match the usual Poffenberger
interpretation, but they are complementary to the four condition outputs:

| Field | Definition |
|---|---|
| `mean_rt_crossed_ms` | Mean RT across accurate valid trials from `lh_rvf` and `rh_lvf` |
| `mean_rt_uncrossed_ms` | Mean RT across accurate valid trials from `lh_lvf` and `rh_rvf` |
| `ihtt_difference_ms` | `mean_rt_crossed_ms - mean_rt_uncrossed_ms` |
| `accuracy_crossed` | Accurate crossed trials / all crossed experimental trials |
| `accuracy_uncrossed` | Accurate uncrossed trials / all uncrossed experimental trials |

`ihtt_difference_ms` should be null when either crossed or uncrossed mean cannot
be computed from valid trials.

## Persistence Recommendation

Persist both run-level summaries and raw trial rows.

Run-level table should include:

- `run_id`
- `participant_uuid`
- `session_id`
- `started_at`
- `completed_at`
- `total_experimental_trials`
- per-condition RT and accuracy fields
- crossed/uncrossed derived fields

Trial-level table should include:

- `trial_id`
- `run_id`
- `participant_uuid`
- `session_id`
- `block_number`
- `trial_number`
- `global_trial_number`
- `response_hand`
- `visual_field`
- `condition_key`
- `is_practice`
- `expected_key`
- `pressed_key`
- `reaction_time_ms`
- `is_valid_response`
- `is_timeout`
- `is_accurate`
- `jitter_ms`

All rows must be session-scoped and participant-scoped. No result row may be
orphaned from `participant_uuid` or `session_id`.
