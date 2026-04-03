# New Shared-DB Multi-Lab Schema

> Status: draft design for the new backend + database migration.
> This document proposes the target schema shape for a shared database that
> hosts multiple labs and studies while keeping participant data anonymous and
> allowing each lab to own its own result/scoring tables.

---

## Confirmed Direction

These decisions are assumed for this draft:

- One shared database.
- Isolation is row-level, not per-schema or per-deployment.
- Participants remain anonymous in v1.
- Shared participant fields stay minimal.
- Variable lab/study demographics move into a separate participant profile table.
- Tests use a shared catalog and study-specific mapping table.
- Score/result tables are lab-specific.
- Analytics/statistics are stored as derived study outputs, not as generic
  transactional participant tables.

---

## Why This Shape

This schema is designed to avoid both extremes:

1. A single giant `participants` table that keeps accumulating unrelated
   demographics and identifier fields from every lab.
2. A completely separate table tree per lab for everything, which would make
   shared workflows, auth scoping, and migrations harder than necessary.

The split is:

- Shared core for ownership, session flow, and test administration.
- Shared catalog for "what tests exist" and "which tests a study uses".
- Lab-specific result tables for "what was actually collected and how it is scored".

---

## Entity Overview

```text
labs
  -> studies
      -> participants
          -> participant_profiles
          -> sessions
              -> test_administrations
                  -> <lab-specific result tables>
      -> study_days
          -> weather_daily (optional, study-specific feature)

tests
  -> study_tests
      -> test_administrations

analytics_runs
analytics_snapshots
```

---

## Shared Core Tables

### `labs`

One row per lab.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `lab_id` | UUID | PK | Generated server-side |
| `slug` | VARCHAR(64) | UNIQUE, NOT NULL | Stable auth/db key, e.g. `weather-wellness` |
| `name` | VARCHAR(255) | NOT NULL | Human-readable lab name |
| `timezone_name` | VARCHAR(64) | NOT NULL | Default timezone for the lab |
| `active` | BOOLEAN | NOT NULL DEFAULT true | Soft operational toggle |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended indexes:

- UNIQUE (`slug`)

Notes:

- Auth metadata should resolve to `labs.slug`.
- This replaces the current implicit `app_metadata.lab_name`-only model with a
  real database owner table.

### `studies`

One row per study inside a lab.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `study_id` | UUID | PK | Generated server-side |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `slug` | VARCHAR(64) | NOT NULL | Stable per-lab study key |
| `name` | VARCHAR(255) | NOT NULL | Human-readable study name |
| `status` | VARCHAR(32) | NOT NULL DEFAULT `'active'` | Suggested values: `draft`, `active`, `paused`, `archived` |
| `timezone_name` | VARCHAR(64) | NULL | Null means "inherit from lab" |
| `starts_on` | DATE | NULL | Optional planning field |
| `ends_on` | DATE | NULL | Optional planning field |
| `consent_form_path` | VARCHAR(255) | NULL | Optional frontend/admin pointer |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`lab_id`, `slug`)

Notes:

- A participant belongs to one study, not to multiple studies.
- This keeps cross-study joins explicit and avoids ambiguous reuse of anonymous
  participants across studies.

### `participants`

Minimal anonymous participant spine shared by all labs.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `participant_uuid` | UUID | PK | Stable internal key |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `participant_number` | INT | NOT NULL | Human-facing per-study running number |
| `anonymous` | BOOLEAN | NOT NULL DEFAULT true | v1 always true |
| `status` | VARCHAR(32) | NOT NULL DEFAULT `'active'` | Suggested values: `active`, `withdrawn`, `archived` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `archived_at` | TIMESTAMPTZ | NULL | Optional lifecycle marker |

Recommended constraints:

- UNIQUE (`study_id`, `participant_number`)

Recommended indexes:

- INDEX (`lab_id`, `study_id`)

Do not store here:

- Names
- Emails
- Student IDs
- Phone numbers
- Any other direct identifiers
- Lab-specific demographic fields

Rationale:

- This table should stay stable even as labs diverge.
- The moment this table becomes the place for every study-specific field, it
  loses most of the value of being shared.

### `participant_profiles`

Shared extension table for demographic and profile fields that vary by study.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `profile_id` | UUID | PK | Generated server-side |
| `participant_uuid` | UUID | FK, NOT NULL | `-> participants.participant_uuid` |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `schema_key` | VARCHAR(64) | NOT NULL | Profile shape key, e.g. `ww-start-session-v1` |
| `age_band` | VARCHAR(64) | NULL | Shared general field |
| `gender` | VARCHAR(64) | NULL | Shared general field |
| `profile_data_json` | JSONB | NOT NULL DEFAULT `'{}'::jsonb` | Lab/study-specific fields |
| `collected_at` | TIMESTAMPTZ | NULL | When profile questions were collected |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`participant_uuid`)

Recommended usage:

- Put only durable participant-level attributes here.
- Keep one-off task/session answers out of this table.

Example `profile_data_json` for Weather & Wellness:

```json
{
  "origin": "Library",
  "origin_other_text": null,
  "commute_method": "Transit",
  "commute_method_other_text": null,
  "time_outside": "Sometimes (61 minutes - 90 minutes)",
  "daylight_exposure_minutes": 95
}
```

Why JSONB here instead of one profile table per lab:

- It preserves one shared extension mechanism.
- It avoids turning every new demographic variant into a migration.
- It keeps result tables focused on instrument data rather than participant profile data.

### `sessions`

One row per participant session.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `session_id` | UUID | PK | Generated server-side |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `participant_uuid` | UUID | FK, NOT NULL | `-> participants.participant_uuid` |
| `status` | VARCHAR(32) | NOT NULL | Suggested values: `created`, `active`, `complete`, `cancelled` |
| `started_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | Replaces ambiguous "created_at as session start" usage |
| `completed_at` | TIMESTAMPTZ | NULL | |
| `study_day_id` | UUID | FK, NULL | `-> study_days.study_day_id` |
| `created_by_lab_member_id` | UUID | NULL | Supabase Auth `sub`; no DB FK required in v1 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended indexes:

- INDEX (`lab_id`, `study_id`, `started_at`)
- INDEX (`participant_uuid`, `started_at`)
- Partial INDEX (`study_id`, `completed_at`) WHERE `status = 'complete'`

Notes:

- Every result row should still reference both `participant_uuid` and `session_id`.
- This preserves the platform rule that there are no orphaned result rows.

### `study_days`

Day dimension scoped to a study, not globally unique by date.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `study_day_id` | UUID | PK | Generated server-side |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `date_local` | DATE | NOT NULL | Local calendar day in the study timezone |
| `timezone_name` | VARCHAR(64) | NOT NULL | Materialized effective timezone |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`study_id`, `date_local`)

Why this changes from the current schema:

- The current global UNIQUE on `date_local` only works cleanly for one study
  and one timezone.
- Multi-lab support needs the day dimension to be scoped.

---

## Shared Test Definition Layer

These tables answer:

- What tests exist?
- Which tests does a study use?
- In what order and with what config?

They do not store raw responses or scored outcomes.

### `tests`

Shared catalog of tasks/surveys/instruments.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `test_id` | UUID | PK | Generated server-side |
| `key` | VARCHAR(64) | UNIQUE, NOT NULL | Stable system key, e.g. `uls8`, `digitspan_backward`, `misokinesia_videos` |
| `name` | VARCHAR(255) | NOT NULL | Human-readable name |
| `category` | VARCHAR(32) | NOT NULL | Suggested values: `survey`, `task`, `battery_step` |
| `version` | VARCHAR(32) | NOT NULL | Instrument/task version |
| `scoring_mode` | VARCHAR(64) | NOT NULL | Descriptive value, e.g. `server_python`, `manual`, `not_scored` |
| `active` | BOOLEAN | NOT NULL DEFAULT true | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Notes:

- This is metadata only.
- Do not try to push raw response structure into this table.

### `study_tests`

Mapping layer between a study and the tests it uses.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `study_test_id` | UUID | PK | Generated server-side |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `test_id` | UUID | FK, NOT NULL | `-> tests.test_id` |
| `route_key` | VARCHAR(64) | NOT NULL | Frontend/backend route segment for the study flow |
| `display_name` | VARCHAR(255) | NOT NULL | Study-specific label |
| `battery_order` | INT | NOT NULL | Sort order inside the study battery |
| `required` | BOOLEAN | NOT NULL DEFAULT true | |
| `repeatable` | BOOLEAN | NOT NULL DEFAULT false | |
| `active` | BOOLEAN | NOT NULL DEFAULT true | |
| `config_json` | JSONB | NOT NULL DEFAULT `'{}'::jsonb` | Study-specific settings |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`study_id`, `route_key`)
- UNIQUE (`study_id`, `battery_order`)

Example `config_json` values:

```json
{
  "allow_imported_rows": true,
  "show_in_session_flow": true
}
```

```json
{
  "test_set_key": "default-v1",
  "clip_count": 29
}
```

### `test_administrations`

Operational join between a session and a study test.

This is the shared table that all lab-specific result tables hang off of.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `administration_id` | UUID | PK | Generated server-side |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `session_id` | UUID | FK, NOT NULL | `-> sessions.session_id` |
| `participant_uuid` | UUID | FK, NOT NULL | `-> participants.participant_uuid` |
| `study_test_id` | UUID | FK, NOT NULL | `-> study_tests.study_test_id` |
| `status` | VARCHAR(32) | NOT NULL | Suggested values: `created`, `active`, `complete`, `invalidated` |
| `data_source` | VARCHAR(16) | NOT NULL DEFAULT `'native'` | `native`, `imported`, `backfill` |
| `started_at` | TIMESTAMPTZ | NULL | |
| `completed_at` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`session_id`, `study_test_id`) for non-repeatable tests

Recommended indexes:

- INDEX (`lab_id`, `study_id`, `session_id`)
- INDEX (`participant_uuid`, `study_test_id`)

Why this table exists:

- It gives every result table a shared parent row.
- It keeps shared workflow state out of the lab-specific score tables.
- It makes imports and analytics lineage easier because every test outcome is
  tied to one common administration record.

---

## Lab-Specific Result Table Pattern

Result/scoring tables should be explicit per lab and per instrument.

Naming pattern:

- `<lab_slug>_<test_key>_results`
- `<lab_slug>_<test_key>_trials`
- `<lab_slug>_<test_key>_stimuli`

Every primary result table should include these base columns:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `result_id` | UUID | PK | Generated server-side |
| `administration_id` | UUID | FK, NOT NULL | `-> test_administrations.administration_id` |
| `lab_id` | UUID | FK, NOT NULL | `-> labs.lab_id` |
| `study_id` | UUID | FK, NOT NULL | `-> studies.study_id` |
| `session_id` | UUID | FK, NOT NULL | `-> sessions.session_id` |
| `participant_uuid` | UUID | FK, NOT NULL | `-> participants.participant_uuid` |
| `data_source` | VARCHAR(16) | NOT NULL DEFAULT `'native'` | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`administration_id`)

Rules:

- Keep raw response columns and computed score columns together when that is the
  cleanest representation for the instrument.
- Use child tables for repeated units like trials, clips, items, or blocks.
- Do not force unrelated labs into a universal EAV/JSON-only result format.

---

## Example Weather & Wellness Tables

These example tables show how the current study would map into the new model.

### `ww_uls8_results`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| base result columns | see pattern above | | |
| `r1`..`r8` | SMALLINT | NULL | Raw item values; nullable for imported rows |
| `computed_mean` | NUMERIC(5,4) | NULL | Native canonical score |
| `score_0_100` | NUMERIC(6,2) | NULL | Native canonical score |
| `legacy_mean_1_4` | NUMERIC | NULL | Imported legacy aggregate |

### `ww_cesd10_results`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| base result columns | see pattern above | | |
| `r1`..`r10` | SMALLINT | NULL | |
| `total_score` | SMALLINT | NULL | Native canonical score |
| `legacy_mean_1_4` | NUMERIC | NULL | Imported legacy aggregate |

### `ww_gad7_results`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| base result columns | see pattern above | | |
| `r1`..`r7` | SMALLINT | NULL | |
| `total_score` | SMALLINT | NULL | Native canonical score |
| `severity_band` | VARCHAR(32) | NULL | Native derived field |
| `legacy_mean_1_4` | NUMERIC | NULL | Imported legacy aggregate |
| `legacy_total_score` | SMALLINT | NULL | Imported mapped total |

### `ww_cogfunc8a_results`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| base result columns | see pattern above | | |
| `r1`..`r8` | SMALLINT | NULL | |
| `total_sum` | SMALLINT | NULL | Native canonical score |
| `mean_score` | NUMERIC(5,4) | NULL | Native canonical score |
| `legacy_mean_1_5` | NUMERIC | NULL | Imported legacy aggregate |

### `ww_digitspan_runs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| base result columns | see pattern above | | |
| `total_correct` | INT | NOT NULL | Canonical run outcome |
| `max_span` | INT | NULL | Nullable for imported rows |

### `ww_digitspan_trials`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `trial_id` | UUID | PK | |
| `result_id` | UUID | FK, NOT NULL | `-> ww_digitspan_runs.result_id` |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `session_id` | UUID | FK, NOT NULL | |
| `participant_uuid` | UUID | FK, NOT NULL | |
| `trial_number` | INT | NOT NULL | |
| `span_length` | INT | NOT NULL | |
| `sequence_shown` | VARCHAR | NOT NULL | |
| `sequence_entered` | VARCHAR | NOT NULL | |
| `correct` | BOOLEAN | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

### `ww_misokinesia_test_sets`

Optional study-specific configuration table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `test_set_id` | UUID | PK | |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `study_test_id` | UUID | FK, NOT NULL | `-> study_tests.study_test_id` |
| `key` | VARCHAR(64) | NOT NULL | Stable set key |
| `name` | VARCHAR(255) | NOT NULL | |
| `version` | VARCHAR(32) | NOT NULL | |
| `description` | TEXT | NULL | |
| `active` | BOOLEAN | NOT NULL DEFAULT true | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

### `ww_misokinesia_stimuli`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `stimulus_id` | UUID | PK | |
| `test_set_id` | UUID | FK, NOT NULL | `-> ww_misokinesia_test_sets.test_set_id` |
| `storage_path` | VARCHAR(255) | NOT NULL | Supabase Storage key |
| `filename` | VARCHAR(255) | NOT NULL | |
| `duration_ms` | INT | NOT NULL | |
| `mime_type` | VARCHAR(64) | NOT NULL DEFAULT `'video/mp4'` | |
| `sort_order` | INT | NOT NULL | |
| `active` | BOOLEAN | NOT NULL DEFAULT true | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

### `ww_misokinesia_results`

One row per participant's task execution.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| base result columns | see pattern above | | |
| `test_set_id` | UUID | FK, NOT NULL | `-> ww_misokinesia_test_sets.test_set_id` |
| `misokinesia_participant_number` | INT | NOT NULL | Dedicated participant-facing counter |
| `end_fidgeting_text` | TEXT | NULL | |
| `end_emotions_text` | TEXT | NULL | |
| `stronger_responses` | BOOLEAN | NULL | |
| `stronger_responses_timing` | VARCHAR(64) | NULL | |

### `ww_misokinesia_trial_responses`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `response_id` | UUID | PK | |
| `result_id` | UUID | FK, NOT NULL | `-> ww_misokinesia_results.result_id` |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `session_id` | UUID | FK, NOT NULL | |
| `participant_uuid` | UUID | FK, NOT NULL | |
| `stimulus_id` | UUID | FK, NOT NULL | `-> ww_misokinesia_stimuli.stimulus_id` |
| `display_order` | INT | NOT NULL | |
| `q1` | SMALLINT | NOT NULL | |
| `q2` | SMALLINT | NOT NULL | |
| `q3` | SMALLINT | NOT NULL | |
| `q4` | SMALLINT | NOT NULL | |
| `completed_at` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraint:

- UNIQUE (`result_id`, `stimulus_id`)

---

## Shared Optional Extension Tables

These are shared because they are infrastructural, not instrument-specific.

### `weather_ingest_runs`

Use only for studies that actually need weather linkage.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `run_id` | UUID | PK | |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `date_local` | DATE | NOT NULL | |
| `requested_via` | VARCHAR(32) | NOT NULL | |
| `requested_by_lab_member_id` | UUID | NULL | |
| `parser_version` | VARCHAR(64) | NOT NULL | |
| `parse_status` | VARCHAR(32) | NOT NULL | |
| `parsed_json` | JSONB | NOT NULL | |
| `parse_errors` | JSONB | NOT NULL DEFAULT `'[]'::jsonb` | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

### `weather_daily`

Study-scoped weather snapshot.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `daily_id` | UUID | PK | |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `study_day_id` | UUID | FK, NOT NULL | `-> study_days.study_day_id` |
| `date_local` | DATE | NOT NULL | Denormalized convenience field |
| `source_run_id` | UUID | FK, NOT NULL | `-> weather_ingest_runs.run_id` |
| `current_temp_c` | DOUBLE PRECISION | NULL | |
| `current_precip_today_mm` | DOUBLE PRECISION | NULL | |
| `forecast_high_c` | DOUBLE PRECISION | NULL | |
| `forecast_low_c` | DOUBLE PRECISION | NULL | |
| `sunshine_duration_hours` | DOUBLE PRECISION | NULL | |
| `structured_json` | JSONB | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`study_id`, `study_day_id`)

---

## Analytics / Statistics

Do not add a generic transactional `stats` table.

Reason:

- Statistical outputs are derived from sessions/results and versioned by model
  configuration and date range.
- They do not behave like participant-owned rows.

Use shared derived tables instead.

### `analytics_runs`

Audit log of recompute attempts.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `run_id` | UUID | PK | |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `date_from` | DATE | NOT NULL | |
| `date_to` | DATE | NOT NULL | |
| `model_version` | VARCHAR(64) | NOT NULL | |
| `response_version` | VARCHAR(64) | NOT NULL | |
| `status` | VARCHAR(32) | NOT NULL | |
| `triggered_by_lab_member_id` | UUID | NULL | |
| `warnings_json` | JSONB | NOT NULL DEFAULT `'[]'::jsonb` | |
| `error_json` | JSONB | NULL | |
| `result_payload_json` | JSONB | NULL | |
| `generated_at` | TIMESTAMPTZ | NULL | |
| `started_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `finished_at` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended indexes:

- INDEX (`lab_id`, `study_id`, `created_at`)
- INDEX (`lab_id`, `study_id`, `status`, `started_at`)

### `analytics_snapshots`

Durable latest-known derived outputs.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `snapshot_id` | UUID | PK | |
| `lab_id` | UUID | FK, NOT NULL | |
| `study_id` | UUID | FK, NOT NULL | |
| `date_from` | DATE | NOT NULL | |
| `date_to` | DATE | NOT NULL | |
| `model_version` | VARCHAR(64) | NOT NULL | |
| `response_version` | VARCHAR(64) | NOT NULL | |
| `status` | VARCHAR(32) | NOT NULL | |
| `warnings_json` | JSONB | NOT NULL DEFAULT `'[]'::jsonb` | |
| `payload_json` | JSONB | NOT NULL | |
| `source_run_id` | UUID | FK, NULL | `-> analytics_runs.run_id` |
| `generated_at` | TIMESTAMPTZ | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Recommended constraints:

- UNIQUE (`lab_id`, `study_id`, `date_from`, `date_to`, `model_version`, `response_version`)

---

## Cross-Cutting Rules

These rules should apply to every transactional table that stores participant or
study data:

- Include `lab_id` on every study-owned row.
- Include `study_id` on every study-owned row.
- Include both `participant_uuid` and `session_id` on every result table.
- Reject cross-lab and cross-study writes in the backend before insert/update.
- Keep scoring on the server only.
- Keep participant identity anonymous in core shared tables.

---

## Suggested Migration Sequence

This is the recommended order for implementing the schema migration.

### Phase 1: Shared owners and scoping

1. Create `labs` and `studies`.
2. Backfill one lab and one study for the current Weather & Wellness data.
3. Add `lab_id` and `study_id` to current shared tables.

### Phase 2: Participant/profile split

1. Keep current `participants` rows as the new shared participant spine.
2. Move demographic/exposure fields into `participant_profiles`.
3. Leave `participants` minimal going forward.

### Phase 3: Test catalog and administration layer

1. Create `tests`, `study_tests`, and `test_administrations`.
2. Backfill current Weather & Wellness battery into the catalog/mapping tables.
3. Link existing session outcomes to new administration rows.

### Phase 4: Lab-specific result tables

1. Rename or recreate Weather & Wellness result tables using the new naming convention.
2. Preserve raw and imported fields during migration.
3. Re-key trial/child tables to the new parent result tables where needed.

### Phase 5: Derived analytics tables

1. Add `lab_id` and `study_id` to analytics tables.
2. Update snapshot uniqueness to be lab/study scoped.

---

## Weather & Wellness Initial Backfill Mapping

Suggested initial records:

### `labs`

```text
slug: weather-wellness
name: Weather & Wellness Lab
timezone_name: America/Vancouver
```

### `studies`

```text
lab: weather-wellness
slug: weather-wellness-main
name: Weather & Wellness
status: active
timezone_name: America/Vancouver
```

### `tests`

Create catalog entries for:

- `uls8`
- `cesd10`
- `gad7`
- `cogfunc8a`
- `digitspan_backward`
- `misokinesia_videos`

### `study_tests`

Create one row per active battery step for the Weather & Wellness study.

---

## Key Advantages of This Draft

- Shared operational structure without forcing identical result schemas.
- Cleaner long-term participant model.
- Easier auth scoping and multi-lab querying.
- Better compatibility with imported legacy data.
- Clear separation between transactional data and derived analytics/state.

---

## Items Explicitly Not Included In V1

- Per-lab Postgres schemas
- Non-anonymous participant identity tables
- Generic EAV response storage for every instrument
- A universal `scores` table covering all labs
- A universal transactional `stats` table

Those can be added later if a real lab requirement forces them, but they should
not be the default design.
