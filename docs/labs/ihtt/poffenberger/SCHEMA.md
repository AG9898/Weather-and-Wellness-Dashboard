# IHTT Poffenberger Component Schema

> Component schema reference for IHTT Poffenberger run and trial persistence.
> Shared identity, session, invitation, and audit tables live in `docs/SCHEMA.md`.

---

## Entity Relationships

```text
sessions (1) ──────────────────── (1) ihtt_poffenberger_runs
ihtt_poffenberger_runs (1) ────── (many) ihtt_poffenberger_trials
```

Recorded Poffenberger starts also store anonymous demographics on the shared
`participants` row: `age_band`, `gender`, and `handedness`. The `handedness`
column was added by migration `20260624_000001`; the run and trial tables remain
task-persistence tables only.

---

## Tables: IHTT Poffenberger

> Applied by migration `20260621_000001` (T1833). Scope is limited to
> persistence models and schemas for the IHTT Poffenberger component. The
> recorded start endpoint was added by T1834, and the production submit/scoring
> endpoint was added by T1835.

### Table: `ihtt_poffenberger_runs`

One row per recorded Poffenberger session. `session_id` is unique so a recorded
session can have at most one run. The run stores the server-generated manifest
and the server-computed summary outputs.

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| run_id | UUID | PK | Generated server-side |
| session_id | UUID | FK, NOT NULL, UNIQUE | -> sessions.session_id |
| participant_uuid | UUID | FK, NOT NULL | -> participants.participant_uuid |
| manifest_json | JSONB | NOT NULL, CHECK object | Server-generated practice/block/trial assignment manifest |
| started_at | TIMESTAMPTZ | DEFAULT NOW() | Run creation time |
| completed_at | TIMESTAMPTZ | NULLABLE | Set when production submit succeeds |
| is_complete | BOOLEAN | NOT NULL | False until submit/scoring completes; true requires `completed_at` |
| total_practice_trials | INT | NOT NULL | Planned production value: 10 |
| total_experimental_trials | INT | NOT NULL | Planned production value: 600 |
| `<condition>_total_trials` | INT | NOT NULL | Experimental trials assigned to condition |
| `<condition>_valid_rt_trials` | INT | NOT NULL | Accepted-response trials with RT in the scored range |
| `<condition>_timeout_trials` | INT | NOT NULL | No accepted response before timeout |
| `<condition>_invalid_trials` | INT | NOT NULL | Invalid/missing response data not scoreable as accurate |
| `<condition>_accurate_trials` | INT | NOT NULL | Expected key before timeout |
| `<condition>_accuracy` | NUMERIC(8,4) | NULLABLE, 0-1 | `accurate_trials / total_trials` |
| `<condition>_mean_rt_ms` | NUMERIC(10,2) | NULLABLE | Accurate valid-RT trials only |
| `<condition>_median_rt_ms` | NUMERIC(10,2) | NULLABLE | Accurate valid-RT trials only |
| `<condition>_sd_rt_ms` | NUMERIC(10,2) | NULLABLE | Sample SD over accurate valid-RT trials |
| mean_rt_crossed_ms | NUMERIC(10,2) | NULLABLE | Combined `lh_rvf` and `rh_lvf` accurate valid-RT trials |
| mean_rt_uncrossed_ms | NUMERIC(10,2) | NULLABLE | Combined `lh_lvf` and `rh_rvf` accurate valid-RT trials |
| ihtt_difference_ms | NUMERIC(10,2) | NULLABLE | `mean_rt_crossed_ms - mean_rt_uncrossed_ms` |
| accuracy_crossed | NUMERIC(8,4) | NULLABLE, 0-1 | Crossed accurate / crossed experimental trials |
| accuracy_uncrossed | NUMERIC(8,4) | NULLABLE, 0-1 | Uncrossed accurate / uncrossed experimental trials |

Condition prefixes are exactly `lh_lvf`, `lh_rvf`, `rh_lvf`, and `rh_rvf`.

Indexes/constraints:

- UNIQUE (`session_id`)
- Index on `participant_uuid`
- CHECK `manifest_json` is a JSON object
- CHECK `is_complete` implies `completed_at IS NOT NULL`

### Table: `ihtt_poffenberger_trials`

One row per stored practice or experimental trial. Rows duplicate
`session_id` and `participant_uuid` in addition to `run_id` so all result rows
remain session-scoped and participant-scoped.

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| trial_id | UUID | PK | Generated server-side |
| run_id | UUID | FK, NOT NULL | -> ihtt_poffenberger_runs.run_id |
| session_id | UUID | FK, NOT NULL | -> sessions.session_id |
| participant_uuid | UUID | FK, NOT NULL | -> participants.participant_uuid |
| block_number | INT | NOT NULL | 0 for practice, 1-12 for production blocks |
| trial_number | INT | NOT NULL | 1-based within the practice segment or block |
| global_trial_number | INT | NOT NULL, UNIQUE with `run_id` | 1-based persisted full-task trial order; practice rows use `1-10`, experimental rows use `11-610` |
| response_hand | VARCHAR | NOT NULL | `left` or `right` |
| visual_field | VARCHAR | NOT NULL | `lvf` or `rvf` |
| condition_key | VARCHAR | NOT NULL | `lh_lvf`, `lh_rvf`, `rh_lvf`, or `rh_rvf` |
| is_practice | BOOLEAN | NOT NULL | Practice rows are retained for QA |
| is_scored | BOOLEAN | NOT NULL | False for practice; true for experimental rows used in summaries |
| expected_key | VARCHAR | NOT NULL | Server-assigned key for the response hand |
| pressed_key | VARCHAR | NULLABLE | Raw key captured by the client; null for timeout/no response |
| reaction_time_ms | INT | NULLABLE | Client-measured RT; null for no response; late RTs over 2000 ms may be retained for audit but are excluded from scoring |
| is_valid_response | BOOLEAN | NOT NULL | Backend validation result |
| is_timeout | BOOLEAN | NOT NULL | No accepted response before the 2000 ms cutoff |
| is_accurate | BOOLEAN | NOT NULL | Expected key before timeout |
| jitter_ms | INT | NOT NULL | Pre-stimulus jitter duration |
| client_trial_started_at_ms | NUMERIC(14,3) | NULLABLE | Raw client performance timestamp |
| client_stimulus_onset_ms | NUMERIC(14,3) | NULLABLE | Raw client performance timestamp used for RT audit |
| client_response_at_ms | NUMERIC(14,3) | NULLABLE | Raw client performance timestamp; null for timeout/no response |
| client_trial_ended_at_ms | NUMERIC(14,3) | NULLABLE | Raw client performance timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

Indexes/constraints:

- UNIQUE (`run_id`, `global_trial_number`)
- Indexes on `run_id`, `session_id`, and `participant_uuid`
- CHECK allowed values for `response_hand`, `visual_field`, and `condition_key`
- CHECK practice rows are not marked scored

---

## Poffenberger XLSX Export Shape

`GET /ihtt/poffenberger/export.xlsx` produces an analysis-oriented workbook for
IHTT users. It is not a full database backup; it exports the Poffenberger data
needed to analyze recorded runs while preserving explicit join keys.

For layout debugging, `GET /ihtt/poffenberger/export.xlsx?sample_data=true`
returns the same workbook shape populated from hardcoded sample rows. This path
does not read, create, or update database rows.

Workbook sheets:

| Sheet | Row grain | Notes |
| --- | --- | --- |
| `README` | workbook metadata | Export date, sheet descriptions, join keys, and value conventions |
| `poffenberger_runs` | one row per recorded run | Joins `ihtt_poffenberger_runs` to `participants` and `sessions` |
| `poffenberger_trials` | one row per persisted trial | Raw/audit trial rows linked to run/session/participant keys |

`poffenberger_runs` includes:

- `run_id`, `session_id`, `participant_uuid`
- `participant_number`, `age_band`, `gender`, `handedness`
- `session_status`, `session_created_at`, `session_completed_at`
- run timing/completion fields
- `total_practice_trials`, `total_experimental_trials`
- all condition-level count, accuracy, mean, median, and SD summary columns
- crossed/uncrossed mean RT, accuracy, and IHTT difference columns

`poffenberger_trials` includes all columns from `ihtt_poffenberger_trials` in
schema order. It intentionally does not duplicate run summary or participant
demographic columns; analysts should join by `run_id`, `session_id`, or
`participant_uuid`.

Recorded Poffenberger start currently creates a fresh participant, session, and
run for each recorded participant visit. The intended workflow is one recorded
Poffenberger run per participant, while each run has many persisted trial rows.
The workbook preserves both grains explicitly instead of flattening all run
summary columns onto every trial row.
