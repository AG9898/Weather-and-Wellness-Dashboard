# Weather Component Schema

> Component schema reference for Weather-Wellness weather data, legacy imports,
> native survey/cognitive task results, and analytics storage. Shared identity,
> session, invitation, audit, and `study_days` tables live in `docs/SCHEMA.md`.

---

## Entity Relationships

```text
study_days (1) ────────────────── (many) sessions
sessions (1) ──────────────────── (1) digitspan_runs
digitspan_runs (1) ─────────────── (14) digitspan_trials
sessions (1) ──────────────────── (1) stroop_runs
stroop_runs (1) ───────────────── (many) stroop_trials
sessions (1) ──────────────────── (1) card_sorting_runs
card_sorting_runs (1) ─────────── (many) card_sorting_trials
sessions (1) ──────────────────── (1) survey_uls8
sessions (1) ──────────────────── (1) survey_cesd10
sessions (1) ──────────────────── (1) survey_gad7
sessions (1) ──────────────────── (1) survey_cogfunc8a
sessions (1) ──────────────────── (0..1) imported_session_measures
study_days (1) ────────────────── (many) weather_daily
weather_ingest_runs (1) ───────── (many) weather_daily
analytics_runs (1) ────────────── (many) analytics_snapshots
```

Weather-Wellness cognitive battery additions cover task order, raw task trials,
and task-level scores only; they do not add weather analytics/modeling tables or
derived analysis outputs. Planned statistical analysis rules derived from
`reference/labs/weather-wellness/Weather_MLM.R` are documented in
`docs/labs/weather-wellness/weather/ANALYTICS.md`; that analytics dataset is a
logical query-layer construct, not an existing transactional table.

---

## Weather Ingestion Tables

> Added by migration `20260226_000005`. Canonical feature spec:
> `docs/labs/weather-wellness/weather/WEATHER_INGESTION.md`.

### Table: `weather_daily` (applied)


| Column                        | Type             | Constraints   | Notes                                                                                                                                                                                            |
| ----------------------------- | ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| daily_id                      | UUID             | PK            | Generated server-side                                                                                                                                                                            |
| station_id                    | INT              | NOT NULL      | Current station: 3510                                                                                                                                                                            |
| study_day_id                  | UUID             | FK, NOT NULL  | → study_days.study_day_id                                                                                                                                                                        |
| date_local                    | DATE             | NOT NULL      | Denormalized for convenience; must match study_days.date_local                                                                                                                                   |
| source_run_id                 | UUID             | FK, NOT NULL  | → weather_ingest_runs.run_id                                                                                                                                                                     |
| updated_at                    | TIMESTAMPTZ      | DEFAULT NOW() | Updated on upsert                                                                                                                                                                                |
| current_observed_at           | TIMESTAMPTZ      | NULLABLE      | Metadata only (display/debug)                                                                                                                                                                    |
| current_temp_c                | DOUBLE PRECISION | NULLABLE      |                                                                                                                                                                                                  |
| current_relative_humidity_pct | INT              | NULLABLE      |                                                                                                                                                                                                  |
| current_wind_speed_kmh        | DOUBLE PRECISION | NULLABLE      |                                                                                                                                                                                                  |
| current_wind_gust_kmh         | DOUBLE PRECISION | NULLABLE      |                                                                                                                                                                                                  |
| current_wind_dir_deg          | INT              | NULLABLE      |                                                                                                                                                                                                  |
| current_pressure_kpa          | DOUBLE PRECISION | NULLABLE      |                                                                                                                                                                                                  |
| current_precip_today_mm       | DOUBLE PRECISION | NULLABLE      |                                                                                                                                                                                                  |
| forecast_high_c               | DOUBLE PRECISION | NULLABLE      | Day-level summary                                                                                                                                                                                |
| forecast_low_c                | DOUBLE PRECISION | NULLABLE      | Day-level summary                                                                                                                                                                                |
| forecast_precip_prob_pct      | INT              | NULLABLE      | Day-level summary                                                                                                                                                                                |
| forecast_precip_mm            | DOUBLE PRECISION | NULLABLE      | Day-level summary                                                                                                                                                                                |
| forecast_condition_text       | VARCHAR          | NULLABLE      | Day-level summary                                                                                                                                                                                |
| forecast_periods              | JSONB            | NOT NULL      | List of structured forecast blocks                                                                                                                                                               |
| structured_json               | JSONB            | NOT NULL      | Full normalized per-day payload                                                                                                                                                                  |
| sunshine_duration_hours       | DOUBLE PRECISION | NULLABLE      | Hours of sunshine (0–24). Populated by Open-Meteo historical backfill; null for UBC EOS live rows and legacy import rows unless enhanced by backfill. See `docs/labs/weather-wellness/weather/HISTORICAL_WEATHER_BACKFILL.md`. |
| created_at                    | TIMESTAMPTZ      | DEFAULT NOW() |                                                                                                                                                                                                  |


Constraints/indexes (applied):

- UNIQUE (`station_id`, `study_day_id`) for idempotent upserts
- Index (`station_id`, `date_local`)

### Table: `weather_ingest_runs` (applied)


| Column                     | Type        | Constraints   | Notes                                                  |
| -------------------------- | ----------- | ------------- | ------------------------------------------------------ |
| run_id                     | UUID        | PK            | Generated server-side                                  |
| station_id                 | INT         | NOT NULL      | 3510                                                   |
| date_local                 | DATE        | NOT NULL      | Local day (America/Vancouver) of the ingestion attempt |
| ingested_at                | TIMESTAMPTZ | DEFAULT NOW() | Debug/ops                                              |
| requested_via              | VARCHAR     | NOT NULL      | `github_actions` or `ra_manual`                        |
| requested_by_lab_member_id | UUID        | NULLABLE      | From JWT `sub` when RA triggers                        |
| source_primary_url         | VARCHAR     | NOT NULL      |                                                        |
| source_secondary_url       | VARCHAR     | NOT NULL      |                                                        |
| http_primary_status        | SMALLINT    | NULLABLE      |                                                        |
| http_secondary_status      | SMALLINT    | NULLABLE      |                                                        |
| raw_html_primary           | TEXT        | NULLABLE      | Stored for debugging HTML changes                      |
| raw_html_secondary         | TEXT        | NULLABLE      | Stored for debugging HTML changes                      |
| raw_html_primary_sha256    | CHAR(64)    | NULLABLE      | Hash for change detection                              |
| raw_html_secondary_sha256  | CHAR(64)    | NULLABLE      | Hash for change detection                              |
| parsed_json                | JSONB       | NOT NULL      | Canonical merged payload                               |
| parse_status               | VARCHAR     | NOT NULL      | `success` / `partial` / `fail`                         |
| parse_errors               | JSONB       | NOT NULL      | Array of structured error objects                      |
| parser_version             | VARCHAR     | NOT NULL      | e.g. `ubc-eos-v1`                                      |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW() |                                                        |


Indexes (applied):

- Index (`station_id`, `ingested_at` DESC)
- Index (`station_id`, `date_local`)

**Phase 4 note (T56):** Legacy backfill rows use `requested_via="legacy_backfill"` and `parser_version="legacy-import-v1"`. `source_primary_url` and `source_secondary_url` are empty strings for backfill runs (no HTTP fetch performed).

**Historical backfill note (planned):** Open-Meteo backfill rows use `requested_via="historical_api_backfill"` and `parser_version="open-meteo-v1"`. `source_primary_url` is the Open-Meteo Archive URL used. See `docs/labs/weather-wellness/weather/HISTORICAL_WEATHER_BACKFILL.md`.

---

## Table: `imported_session_measures`

> Added by migration `20260228_000007` (T47). Stores imported legacy aggregate outcomes without forcing them into survey item tables.
> This table is 1:1 with sessions and exists to preserve imported values and audit the original row mapping.


| Column                       | Type             | Constraints   | Notes                                                                                                                                           |
| ---------------------------- | ---------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| session_id                   | UUID             | PK, FK        | → sessions.session_id (1:1)                                                                                                                     |
| participant_uuid             | UUID             | FK, NOT NULL  | → participants.participant_uuid                                                                                                                 |
| precipitation_mm             | DOUBLE PRECISION | NULLABLE      | Legacy import column `precipitation` (units as provided)                                                                                        |
| temperature_c                | DOUBLE PRECISION | NULLABLE      | Legacy import column `temperature` (units as provided)                                                                                          |
| anxiety_mean                 | DOUBLE PRECISION | NULLABLE      | Legacy import column `anxiety` (aggregate/mean)                                                                                                 |
| loneliness_mean              | DOUBLE PRECISION | NULLABLE      | Legacy import column `loneliness` (aggregate/mean)                                                                                              |
| depression_mean              | DOUBLE PRECISION | NULLABLE      | Legacy import column `depression` (aggregate/mean)                                                                                              |
| digit_span_max_span          | INT              | NULLABLE      | Legacy import column `digit_span_score` stored as provided (0–14). Phase 4 treats this as Digit Span run outcome (total correct), not max span. |
| self_report                  | DOUBLE PRECISION | NULLABLE      | Legacy import column `self_report` (stored as provided)                                                                                         |
| supplemental_attributes_json | JSONB            | NOT NULL      | Structured storage for extra workbook-only fields such as `daylight`, `*_z`, `month`, and `season_bin` when present                             |
| source_row_json              | JSONB            | NOT NULL      | Full raw row payload for audit/future remapping                                                                                                 |
| created_at                   | TIMESTAMPTZ      | DEFAULT NOW() |                                                                                                                                                 |


**Scoring semantics note:** In the authoritative workbook
`reference/data_complete.xlsx`, `anxiety`, `loneliness`, `depression`, and
`self_report` are imported aggregate scores, not raw item responses.
`self_report` is the legacy aggregate for CogFunc / PROMIS Cognitive Function
8a. The older `reference/labs/weather-wellness/data_full_1-230.xlsx` file remains a historical
pre-extension snapshot. The column name `digit_span_max_span` is retained for
compatibility, but the stored `digit_span_score` value reflects the legacy
stop-after-two-errors-at-the-same-span rule and is not a reconstructed native
`max_span`.

**Legacy import mapping (Phase 3):** `reference/data_complete.xlsx`

- Measures map 1:1 from columns `precipitation`, `temperature`, `anxiety`, `loneliness`, `depression`, `digit_span_score`, `self_report`.
- Workbook-only derived fields such as `day`, `daylight`, `age_simple`, `*_z`, `month`, and `season_bin` are preserved in `supplemental_attributes_json` when present, but are not used by the current transactional import or analytics pipeline.
- `source_row_json` stores the complete row (including demographic fields and the original `date`) to preserve auditability and enable future remapping without re-uploading the original file.

---

## Phase 4 Additions — Legacy Import Remapping into Canonical Tables (T54, applied 2026-03-01)

Goal: preserve imported aggregate values inside the canonical outcome tables used for analysis/exports, **without** fabricating raw survey item rows or digit span trials.

Applied by migration `20260301_000010`:

- Added `data_source VARCHAR(16) DEFAULT 'native' NOT NULL` to:
  - `digitspan_runs`
  - `survey_uls8`
  - `survey_cesd10`
  - `survey_gad7`
  - Values: `native` = submitted via the live app; `imported` = remapped from legacy data.
- Added UNIQUE constraint on `session_id` for each of the above four tables (at most one row per session).
- For imported rows:
  - raw response columns (`r1…`) are now nullable (native submissions still provide all items via Pydantic validation)
  - canonical computed columns are nullable where no deterministic mapping exists from legacy aggregates
  - legacy aggregate values stored in dedicated columns:
    - `survey_uls8.legacy_mean_1_4` NUMERIC NULLABLE — loneliness mean (1–4 scale)
    - `survey_cesd10.legacy_mean_1_4` NUMERIC NULLABLE — depression mean (1–4 scale)
    - `survey_gad7.legacy_mean_1_4` NUMERIC NULLABLE — anxiety mean (1–4 scale)
    - `survey_gad7.legacy_total_score` SMALLINT NULLABLE — integer 0–21 when legacy anxiety maps exactly; null otherwise
  - `digitspan_runs.max_span` is now nullable; `total_correct` stays NOT NULL
  - Digit span import maps legacy `digit_span_score` (0–14) to `digitspan_runs.total_correct`; `max_span` remains null.
  - Legacy column mappings implemented:
    - T55: `loneliness_mean` → `survey_uls8.legacy_mean_1_4`; `depression_mean` → `survey_cesd10.legacy_mean_1_4`; `anxiety_mean` → `survey_gad7.legacy_mean_1_4` (and `total_score`/`severity_band` if value is an exact integer 0–21)
    - T78: `self_report` → `survey_cogfunc8a.legacy_mean_1_5`

`imported_session_measures` remains the audit/source-of-truth mapping table and retains the full `source_row_json`.

Legacy CogFunc / PROMIS aggregate `self_report` remains in `imported_session_measures.self_report`
for audit/source preservation and is now also remapped into
`survey_cogfunc8a.legacy_mean_1_5` with `data_source='imported'`.

The imported Digit Span value stored in `digitspan_runs.total_correct` is the legacy workbook
score under the stop-after-two-errors-at-the-same-span rule and is not equivalent to the native
fixed-14-trial `max_span`.

**Analytics note (planned):** `survey_cogfunc8a` is now the canonical imported
CogFunc outcome table; `imported_session_measures.self_report` remains the raw
audit/source copy of the original workbook value.

**Re-import safety:** `_get_sessions_with_native_rows` now filters by
`data_source='native'` across all five imported-capable outcome tables:
`digitspan_runs`, `survey_uls8`, `survey_cesd10`, `survey_gad7`, and
`survey_cogfunc8a`. The `ON CONFLICT ... DO UPDATE WHERE data_source='imported'`
clause provides an additional DB-level guard against overwriting native rows.

---

## Table: `digitspan_runs`

> Phase 4 additions (T54, applied 2026-03-01): `data_source` column, `max_span` made nullable, UNIQUE constraint on `session_id`.


| Column           | Type        | Constraints          | Notes                                            |
| ---------------- | ----------- | -------------------- | ------------------------------------------------ |
| run_id           | UUID        | PK                   |                                                  |
| session_id       | UUID        | FK, NOT NULL, UNIQUE | → sessions.session_id; at most 1 run per session |
| participant_uuid | UUID        | FK, NOT NULL         | → participants.participant_uuid                  |
| total_correct    | INT         | NOT NULL             | 0–14                                             |
| max_span         | INT         | NULLABLE             | 0–9 for native rows; null for imported rows      |
| data_source      | VARCHAR(16) | NOT NULL             | `native` (default) or `imported`                 |
| created_at       | TIMESTAMPTZ | DEFAULT NOW()        |                                                  |


---

## Table: `digitspan_trials`


| Column           | Type    | Constraints  | Notes                            |
| ---------------- | ------- | ------------ | -------------------------------- |
| trial_id         | UUID    | PK           |                                  |
| run_id           | UUID    | FK, NOT NULL | → digitspan_runs.run_id          |
| trial_number     | INT     | NOT NULL     | 1–14                             |
| span_length      | INT     | NOT NULL     | 3–9                              |
| sequence_shown   | VARCHAR | NOT NULL     | Space-separated, e.g. `"4 7 2"`  |
| sequence_entered | VARCHAR | NOT NULL     | Participant's backwards response |
| correct          | BOOLEAN | NOT NULL     |                                  |


---

## Tables: Weather-Wellness Cognitive Battery

> Applied by migration `20260614_000001` (T206). Scope is limited to recording
> per-session task order, raw task trials, and task-level scores/statistics from
> the participant task itself. Weather analytics/modeling outputs remain out of
> scope.

### Addition to `sessions`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| cognitive_task_order | JSONB | NULLABLE, CHECK array when set | Ordered array containing exactly `digitspan`, `stroop`, and `card_sorting` for native WW sessions |
| card_sorting_rule_order | JSONB | NULLABLE, CHECK array when set | Hidden ordered category schedule for native WW card sorting |

These orders are assigned at session start and remain stable across page
refreshes and task transitions. Imported legacy sessions may remain null unless
a future import policy defines a mapping.

### Table: `stroop_runs`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| run_id | UUID | PK | Generated server-side |
| session_id | UUID | FK, NOT NULL, UNIQUE | -> sessions.session_id; at most 1 Stroop run per session |
| participant_uuid | UUID | FK, NOT NULL | -> participants.participant_uuid |
| total_trials | INT | NOT NULL | Planned production value: 80 |
| correct_trials | INT | NOT NULL | Backend-computed |
| error_trials | INT | NOT NULL | Incorrect non-timeout responses |
| timeout_trials | INT | NOT NULL | No accepted response before timeout |
| overall_accuracy | NUMERIC(8,4) | NOT NULL | `correct_trials / total_trials` |
| congruent_accuracy | NUMERIC(8,4) | NULLABLE | Null if no congruent trials are scoreable |
| incongruent_accuracy | NUMERIC(8,4) | NULLABLE | Null if no incongruent trials are scoreable |
| mean_rt_congruent_ms | NUMERIC(10,2) | NULLABLE | Correct, non-timeout congruent trials |
| mean_rt_incongruent_ms | NUMERIC(10,2) | NULLABLE | Correct, non-timeout incongruent trials |
| stroop_interference_ms | NUMERIC(10,2) | NULLABLE | `mean_rt_incongruent_ms - mean_rt_congruent_ms` |
| data_source | VARCHAR(16) | NOT NULL | `native` by default |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table: `stroop_trials`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| trial_id | UUID | PK | Generated server-side |
| run_id | UUID | FK, NOT NULL | -> stroop_runs.run_id |
| trial_number | INT | NOT NULL, UNIQUE with `run_id` | 1-based scored trial number |
| condition | VARCHAR | NOT NULL | `congruent` or `incongruent` |
| word | VARCHAR | NOT NULL | Displayed color word |
| ink_color | VARCHAR | NOT NULL | Correct response color |
| response_key | VARCHAR | NULLABLE | Pressed key; null for timeout |
| response_color | VARCHAR | NULLABLE | Mapped response color; null for timeout |
| correct | BOOLEAN | NOT NULL | Backend-computed |
| reaction_time_ms | INT | NULLABLE | Null for timeout |
| timed_out | BOOLEAN | NOT NULL | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table: `card_sorting_runs`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| run_id | UUID | PK | Generated server-side |
| session_id | UUID | FK, NOT NULL, UNIQUE | -> sessions.session_id; at most 1 card sorting run per session |
| participant_uuid | UUID | FK, NOT NULL | -> participants.participant_uuid |
| rule_order | JSONB | NOT NULL, CHECK array | Hidden ordered category schedule, max 6 blocks |
| total_trials | INT | NOT NULL | Max 64 |
| categories_completed | INT | NOT NULL | 0-6 |
| total_correct | INT | NOT NULL | Backend-computed |
| total_errors | INT | NOT NULL | Backend-computed |
| perseverative_responses | INT | NOT NULL | Backend-computed |
| perseverative_errors | INT | NOT NULL | Backend-computed |
| nonperseverative_errors | INT | NOT NULL | Backend-computed |
| trials_to_first_category | INT | NULLABLE | Trial number where first category completes |
| failure_to_maintain_set_count | INT | NOT NULL | Errors after 5-9 consecutive correct responses |
| data_source | VARCHAR(16) | NOT NULL | `native` by default |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

### Table: `card_sorting_trials`

| Column | Type | Constraints | Notes |
| --- | --- | --- | --- |
| trial_id | UUID | PK | Generated server-side |
| run_id | UUID | FK, NOT NULL | -> card_sorting_runs.run_id |
| trial_number | INT | NOT NULL, UNIQUE with `run_id` | 1-64 |
| category_index | INT | NOT NULL | 1-6 current hidden category block |
| active_rule | VARCHAR | NOT NULL | `color`, `shape`, or `number` |
| previous_rule | VARCHAR | NULLABLE | Previous hidden rule after a shift |
| card_color | VARCHAR | NOT NULL | Response-card attribute |
| card_shape | VARCHAR | NOT NULL | Response-card attribute |
| card_number | INT | NOT NULL | Response-card attribute |
| selected_reference_index | INT | NOT NULL | 1-4 |
| correct | BOOLEAN | NOT NULL | Backend-computed |
| perseverative_response | BOOLEAN | NOT NULL | Backend-computed |
| perseverative_error | BOOLEAN | NOT NULL | Backend-computed |
| streak_before | INT | NOT NULL | Consecutive correct count before this response |
| streak_after | INT | NOT NULL | Consecutive correct count after this response |
| category_completed_after_trial | BOOLEAN | NOT NULL | True when this trial triggers the next rule |
| reaction_time_ms | INT | NULLABLE | Client-measured |
| feedback | VARCHAR | NOT NULL | `correct` or `incorrect` |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

---

## Table: `survey_uls8`

> Phase 4 additions (T54, applied 2026-03-01): `data_source`, `legacy_mean_1_4`; raw and computed columns made nullable; UNIQUE on `session_id`.


| Column           | Type         | Constraints          | Notes                                            |
| ---------------- | ------------ | -------------------- | ------------------------------------------------ |
| response_id      | UUID         | PK                   |                                                  |
| session_id       | UUID         | FK, NOT NULL, UNIQUE | → sessions.session_id; at most 1 row per session |
| participant_uuid | UUID         | FK, NOT NULL         | → participants.participant_uuid                  |
| r1–r8            | SMALLINT     | NULLABLE             | Raw response, 1–4; null for imported rows        |
| computed_mean    | NUMERIC(5,4) | NULLABLE             | Mean of reversed items; null for imported rows   |
| score_0_100      | NUMERIC(6,2) | NULLABLE             | 0–100 transform; null for imported rows          |
| legacy_mean_1_4  | NUMERIC      | NULLABLE             | Loneliness mean (1–4 scale) from legacy import   |
| data_source      | VARCHAR(16)  | NOT NULL             | `native` (default) or `imported`                 |
| created_at       | TIMESTAMPTZ  | DEFAULT NOW()        |                                                  |


---

## Table: `survey_cesd10`

> Phase 4 additions (T54, applied 2026-03-01): `data_source`, `legacy_mean_1_4`; raw and computed columns made nullable; UNIQUE on `session_id`.


| Column           | Type        | Constraints          | Notes                                            |
| ---------------- | ----------- | -------------------- | ------------------------------------------------ |
| response_id      | UUID        | PK                   |                                                  |
| session_id       | UUID        | FK, NOT NULL, UNIQUE | → sessions.session_id; at most 1 row per session |
| participant_uuid | UUID        | FK, NOT NULL         | → participants.participant_uuid                  |
| r1–r10           | SMALLINT    | NULLABLE             | Raw responses, 1–4; null for imported rows       |
| total_score      | SMALLINT    | NULLABLE             | 0–30; null for imported rows                     |
| legacy_mean_1_4  | NUMERIC     | NULLABLE             | Depression mean (1–4 scale) from legacy import   |
| data_source      | VARCHAR(16) | NOT NULL             | `native` (default) or `imported`                 |
| created_at       | TIMESTAMPTZ | DEFAULT NOW()        |                                                  |


---

## Table: `survey_gad7`

> Phase 4 additions (T54, applied 2026-03-01): `data_source`, `legacy_mean_1_4`, `legacy_total_score`; raw and computed columns made nullable; UNIQUE on `session_id`.


| Column             | Type        | Constraints          | Notes                                                                        |
| ------------------ | ----------- | -------------------- | ---------------------------------------------------------------------------- |
| response_id        | UUID        | PK                   |                                                                              |
| session_id         | UUID        | FK, NOT NULL, UNIQUE | → sessions.session_id; at most 1 row per session                             |
| participant_uuid   | UUID        | FK, NOT NULL         | → participants.participant_uuid                                              |
| r1–r7              | SMALLINT    | NULLABLE             | Raw responses, 1–4; null for imported rows                                   |
| total_score        | SMALLINT    | NULLABLE             | 0–21; null for imported rows unless exact mapping available                  |
| severity_band      | VARCHAR     | NULLABLE             | "minimal"/"mild"/"moderate"/"severe"; null for imported rows                 |
| legacy_mean_1_4    | NUMERIC     | NULLABLE             | Anxiety mean (1–4 scale) from legacy import                                  |
| legacy_total_score | SMALLINT    | NULLABLE             | Integer 0–21 when legacy anxiety maps exactly to GAD-7 total; null otherwise |
| data_source        | VARCHAR(16) | NOT NULL             | `native` (default) or `imported`                                             |
| created_at         | TIMESTAMPTZ | DEFAULT NOW()        |                                                                              |


---

## Table: `survey_cogfunc8a`

> Phase 4 additions (T77, applied 2026-03-10): `data_source`,
> `legacy_mean_1_5`; raw and computed columns made nullable; UNIQUE on
> `session_id`.
>
> Phase 4 remap note (T78, implemented 2026-03-10): admin import commit and the
> Phase 4 backfill script now upsert imported CogFunc rows using
> `legacy_mean_1_5` plus `data_source='imported'`. `imported_session_measures.self_report`
> remains the audit/source copy of the original workbook value.
>
> Export note (T79, implemented 2026-03-10): admin XLSX/ZIP exports now include
> `legacy_mean_1_5` and `data_source` on the canonical `survey_cogfunc8a`
> sheet/CSV so imported cognition rows are visible without relying on the audit
> table alone.


| Column           | Type         | Constraints          | Notes                                                         |
| ---------------- | ------------ | -------------------- | ------------------------------------------------------------- |
| response_id      | UUID         | PK                   |                                                               |
| session_id       | UUID         | FK, NOT NULL, UNIQUE | → sessions.session_id; at most 1 row per session              |
| participant_uuid | UUID         | FK, NOT NULL         | → participants.participant_uuid                               |
| r1–r8            | SMALLINT     | NULLABLE             | Raw responses, 1–5; null for imported rows                    |
| total_sum        | SMALLINT     | NULLABLE             | PROMIS reversed-total for native rows; null for imported rows |
| mean_score       | NUMERIC(5,4) | NULLABLE             | PROMIS reversed mean for native rows; null for imported rows  |
| legacy_mean_1_5  | NUMERIC      | NULLABLE             | Legacy `self_report` aggregate on the 1–5 scale               |
| data_source      | VARCHAR(16)  | NOT NULL             | `native` (default) or `imported`                              |
| created_at       | TIMESTAMPTZ  | DEFAULT NOW()        |                                                               |


---

## Table: `analytics_runs`

> Added by migration `20260310_000002` (T84). Append-only audit table for
> analytics recompute attempts. This is the durable status/warning log for
> analytics orchestration; it is not replaced by Redis caching.


| Column                     | Type        | Constraints   | Notes                                                                                 |
| -------------------------- | ----------- | ------------- | ------------------------------------------------------------------------------------- |
| run_id                     | UUID        | PK            | Generated server-side                                                                 |
| date_from                  | DATE        | NOT NULL      | Inclusive local range start (`America/Vancouver`)                                     |
| date_to                    | DATE        | NOT NULL      | Inclusive local range end (`America/Vancouver`)                                       |
| model_version              | VARCHAR(64) | NOT NULL      | Analytics/model version string (for example `weather-mlm-v1`)                         |
| response_version           | VARCHAR(64) | NOT NULL      | Serialized payload contract version                                                   |
| status                     | VARCHAR(32) | NOT NULL      | Planned values include `ready`, `stale`, `recomputing`, `insufficient_data`, `failed` |
| triggered_by_lab_member_id | UUID        | NULLABLE      | Supabase auth subject for an RA-triggered recompute; null for system-triggered runs   |
| warnings_json              | JSONB       | NOT NULL      | Structured warning metadata; defaults to `[]`                                         |
| error_json                 | JSONB       | NULLABLE      | Structured failure/debug metadata when a run does not complete cleanly                |
| result_payload_json        | JSONB       | NULLABLE      | Serialized analytics response produced by this run, when available                    |
| generated_at               | TIMESTAMPTZ | NULLABLE      | Timestamp from the analytics result payload when generation succeeds                  |
| started_at                 | TIMESTAMPTZ | DEFAULT NOW() | Run start time                                                                        |
| finished_at                | TIMESTAMPTZ | NULLABLE      | Run completion time                                                                   |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW() | Audit row creation time                                                               |


Constraints/indexes:

- CHECK `date_from <= date_to`
- Index (`date_from`, `date_to`, `model_version`, `created_at`)
- Index (`status`, `started_at`)

Behavior notes:

- This table is append-only; each recompute attempt creates a new row.
- It allows the app to track recompute state durably even while the last good
snapshot remains unchanged and Redis entries expire.

---

## Table: `analytics_snapshots`

> Added by migration `20260310_000002` (T84). Durable per-range analytics
> payload storage. This table is the canonical persisted source for dashboard
> analytics reads; Redis may cache reads from it but must not replace it.


| Column           | Type        | Constraints   | Notes                                                                           |
| ---------------- | ----------- | ------------- | ------------------------------------------------------------------------------- |
| snapshot_id      | UUID        | PK            | Generated server-side                                                           |
| date_from        | DATE        | NOT NULL      | Inclusive local range start (`America/Vancouver`)                               |
| date_to          | DATE        | NOT NULL      | Inclusive local range end (`America/Vancouver`)                                 |
| model_version    | VARCHAR(64) | NOT NULL      | Analytics/model version string                                                  |
| response_version | VARCHAR(64) | NOT NULL      | Serialized payload contract version                                             |
| status           | VARCHAR(32) | NOT NULL      | Durable snapshot status associated with `payload_json`                          |
| warnings_json    | JSONB       | NOT NULL      | Structured warning metadata; defaults to `[]`                                   |
| payload_json     | JSONB       | NOT NULL      | Full serialized analytics payload served to the dashboard                       |
| source_run_id    | UUID        | FK, NULLABLE  | → `analytics_runs.run_id`; points to the run that produced this snapshot        |
| generated_at     | TIMESTAMPTZ | NOT NULL      | Generation timestamp embedded in the snapshot/result metadata                   |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() | Row creation time                                                               |
| updated_at       | TIMESTAMPTZ | DEFAULT NOW() | Updated when the snapshot row is replaced/upserted for the same versioned range |


Constraints/indexes:

- UNIQUE (`date_from`, `date_to`, `model_version`, `response_version`)
- CHECK `date_from <= date_to`
- Index (`date_from`, `date_to`, `model_version`, `generated_at`)

Behavior notes:

- Snapshot storage is keyed by local date range plus analytics version so
different filter windows and future model revisions can coexist safely.
- The service layer should only replace a snapshot row after a successful
recompute; failed/recomputing attempts are represented in `analytics_runs`.

---

## Session-to-Weather Join Guidance (Day-Level)

Canonical (planned) join key is `study_day_id` via `study_days`.

Temporary fallback (no FK) join key is local-day derivation:

```sql
timezone('America/Vancouver', sessions.completed_at)::date
```
