# SCHEMA.md — Database Schema

> Full reference for all core study tables. Read before writing SQLAlchemy models, Alembic
> migrations, Pydantic schemas, or any DB query. Updated in-place when columns change;
> Migration History section is append-only.

---

## Overview

- **Database:** Supabase-hosted PostgreSQL
- **PKs:** UUID v4, generated server-side via `uuid.uuid4()`
- **Timestamps:** `TIMESTAMPTZ DEFAULT NOW()` on all tables
- **Connection:** `DATABASE_URL` environment variable only — never hardcoded
- **Lab read access:** Supabase Studio (no read API endpoints in Phase 1)
- **FKs:** Enforced at DB level, not just application level

> Migration head check: `alembic current -v` should report
> `Rev: 20260519_000001 (head)`.
> Keep this value in sync after every new migration.

> Planned statistical analysis rules derived from `reference/Weather_MLM.R` are
> documented in `docs/labs/weather-wellness/weather/ANALYTICS.md`. That analytics dataset is currently a
> logical query-layer construct, not an existing transactional table.

> Planned admin correction tooling includes an append-only audit table for
> RA-triggered undo of the most recent native session. This is intended as a
> narrow operational safety feature, not a soft-delete layer across all tables.

---

## Entity Relationships

```
participants (1) ──────────────── (many) sessions
study_days (1) ────────────────── (many) sessions
sessions (1) ──────────────────── (1) digitspan_runs
digitspan_runs (1) ─────────────── (14) digitspan_trials
sessions (1) ──────────────────── (1) survey_uls8
sessions (1) ──────────────────── (1) survey_cesd10
sessions (1) ──────────────────── (1) survey_gad7
sessions (1) ──────────────────── (1) survey_cogfunc8a
sessions (1) ──────────────────── (0..1) imported_session_measures
study_days (1) ────────────────── (many) weather_daily
weather_ingest_runs (1) ───────── (many) weather_daily
analytics_runs (1) ────────────── (many) analytics_snapshots
ra_invitations (many) ──────────── (0..1) Supabase Auth users (by email/user_id)
misokinesia_test_sets (1) ──────── (many) misokinesia_stimuli
misokinesia_test_sets (1) ──────── (many) misokinesia_participants
sessions (1) ──────────────────── (0..1) misokinesia_participants
participants (1) ──────────────── (many) misokinesia_participants
misokinesia_participants (1) ───── (many) misokinesia_trial_responses
misokinesia_stimuli (1) ────────── (many) misokinesia_trial_responses
misokinesia_participants (1) ───── (0..1) misokinesia_mkaq_responses
misokinesia_participants (1) ───── (0..1) misokinesia_gad7_responses
misokinesia_participants (1) ───── (0..1) misokinesia_maq_responses
```

`admin_session_undo_log` is an append-only audit table that stores deleted
session and participant identifiers by value for the RA-only undo feature
(applied by migration `20260311_000001`, T96).

`ra_invitations` is the app-owned invitation table for admin-managed RA
onboarding (applied T150). It does not replace Supabase Auth; it stores durable
invite state and links invite acceptance to Supabase Auth user creation/update.

`analytics_runs` and `analytics_snapshots` store the durable backend analytics
state. Redis remains an optional read cache only and is not the source of truth
for analytics payloads.

---

## Admin User Management — Invitations

> Applied by migration `20260512_000001` (T150). Supabase Auth remains the
> source of authenticated sessions; this table stores app-owned invite state.

### Table: `ra_invitations`


| Column                   | Type        | Constraints      | Notes                                                                                                |
| ------------------------ | ----------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| invitation_id            | UUID        | PK               | Generated server-side                                                                                |
| email                    | VARCHAR     | NOT NULL         | Lowercased invitee email                                                                             |
| role                     | VARCHAR     | NOT NULL         | `admin` or `ra`                                                                                      |
| lab_name                 | VARCHAR     | NOT NULL         | Lab scope to write into Supabase `app_metadata.lab_name`; empty allowed only for unrestricted admins |
| token_hash               | VARCHAR     | NOT NULL, UNIQUE | Hash of the invite token; raw token is never stored                                                  |
| status                   | VARCHAR     | NOT NULL         | `pending`, `accepted`, `revoked`, `expired`                                                          |
| expires_at               | TIMESTAMPTZ | NOT NULL         | Defaults to 7 days after creation                                                                    |
| accepted_at              | TIMESTAMPTZ | NULLABLE         | Set once a token is successfully accepted                                                            |
| revoked_at               | TIMESTAMPTZ | NULLABLE         | Set when an admin revokes the invite                                                                 |
| revoked_by_lab_member_id | UUID        | NULLABLE         | Supabase Auth subject for the admin who revoked                                                      |
| created_by_lab_member_id | UUID        | NOT NULL         | Supabase Auth subject for the admin who created                                                      |
| supabase_user_id         | UUID        | NULLABLE         | Supabase Auth user id after acceptance or when linked to an existing user                            |
| last_sent_at             | TIMESTAMPTZ | NULLABLE         | Last custom invite email send time                                                                   |
| send_count               | INT         | NOT NULL         | Number of invite emails sent                                                                         |
| provider_message_id      | VARCHAR     | NULLABLE         | Email provider message id when available                                                             |
| created_at               | TIMESTAMPTZ | DEFAULT NOW()    |                                                                                                      |
| updated_at               | TIMESTAMPTZ | DEFAULT NOW()    |                                                                                                      |


Expected indexes/constraints:

- UNIQUE active pending invite per lowercased email where `status = 'pending'`,
`accepted_at IS NULL`, and `revoked_at IS NULL`
- Index on `email`
- Index on `status`
- Index on `expires_at`

Behavior:

- Invite links expire after 7 days.
- Creating a fresh invite retires any expired pending invite for the same email
by setting `status = 'expired'` before inserting the new pending row.
- Resend rotates the token without extending `expires_at`, records
`last_sent_at`, and increments `send_count`.
- Revoking an invite prevents acceptance even if the token has not expired.
- Admin UI "delete user" means access revocation/disablement by default. Hard
deletion of Supabase Auth rows is not part of normal user management.

---

## Phase 2 Additions — Weather Ingestion (T29, applied 2026-02-26)

> These tables were added by migration `20260226_000005`. They are live in the database.
> Canonical feature spec: `docs/labs/weather-wellness/weather/WEATHER_INGESTION.md`

### Day Dimension: `study_days`

> Added by migration `20260226_000005` (T29). `tz_name` default corrected from `America/Edmonton` to `America/Vancouver` by migration `20260228_000008` (T47a).


| Column       | Type        | Constraints      | Notes                            |
| ------------ | ----------- | ---------------- | -------------------------------- |
| study_day_id | UUID        | PK               | Generated server-side            |
| date_local   | DATE        | UNIQUE, NOT NULL | Local day in `America/Vancouver` |
| tz_name      | VARCHAR     | NOT NULL         | Default `"America/Vancouver"`    |
| created_at   | TIMESTAMPTZ | DEFAULT NOW()    |                                  |


**Purpose:** Provide a stable relational key for day-level analysis joins without relying on
computed date derivation at query time.

### Sessions: FK to `study_days` (added T29)

Addition to `sessions` applied in migration `20260226_000005`:


| Column       | Type | Constraints  | Notes                                                                   |
| ------------ | ---- | ------------ | ----------------------------------------------------------------------- |
| study_day_id | UUID | FK, NULLABLE | Set when session becomes `complete`; links to `study_days.study_day_id` |


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
| sunshine_duration_hours       | DOUBLE PRECISION | NULLABLE      | Hours of sunshine (0–24). Populated by Open-Meteo historical backfill; null for UBC EOS live rows and legacy import rows unless enhanced by backfill. See `docs/HISTORICAL_WEATHER_BACKFILL.md`. |
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

**Historical backfill note (planned):** Open-Meteo backfill rows use `requested_via="historical_api_backfill"` and `parser_version="open-meteo-v1"`. `source_primary_url` is the Open-Meteo Archive URL used. See `docs/HISTORICAL_WEATHER_BACKFILL.md`.

---

## Table: `participants`

Participants are anonymous: no names or other direct identifiers are stored. The only human-facing identifier is `participant_number`; `participant_uuid` is the internal stable key.

> Phase 3 demographic/exposure columns were added by migration `20260228_000007` (T47). All columns are nullable; collected at session start or populated by legacy import.


| Column                    | Type        | Constraints      | Notes                                                                                                                                                  |
| ------------------------- | ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| participant_uuid          | UUID        | PK               | Generated server-side                                                                                                                                  |
| participant_number        | INT         | UNIQUE, NOT NULL | Auto-incremented from 1; assigned by server                                                                                                            |
| created_at                | TIMESTAMPTZ | DEFAULT NOW()    |                                                                                                                                                        |
| age_band                  | VARCHAR     | NULLABLE         | Categorical age band (e.g. "18-24")                                                                                                                    |
| gender                    | VARCHAR     | NULLABLE         | Stored as free-text/category string                                                                                                                    |
| origin                    | VARCHAR     | NULLABLE         | Stored as free-text/category string                                                                                                                    |
| origin_other_text         | VARCHAR     | NULLABLE         | Detail when `origin` is `"Other"` (length-limited; avoid PII)                                                                                          |
| commute_method            | VARCHAR     | NULLABLE         | Stored as free-text/category string                                                                                                                    |
| commute_method_other_text | VARCHAR     | NULLABLE         | Detail when `commute_method` is `"Other"` (length-limited; avoid PII)                                                                                  |
| time_outside              | VARCHAR     | NULLABLE         | Stored as categorical label from instruments                                                                                                           |
| daylight_exposure_minutes | INT         | NULLABLE         | Minutes since `DAYLIGHT_START_LOCAL_TIME` (default 06:00 local) at session start time. Set by `POST /sessions/start` (T51a) and by admin import (T48). |


**Start-session mapping (Phase 3, T51a):** `POST /sessions/start` demographics payload

- `age_band`, `gender`, `origin`, `origin_other_text`, `commute_method`, `commute_method_other_text`, `time_outside` stored directly from validated preset values.
- `daylight_exposure_minutes` computed at request time via `compute_daylight_exposure_minutes()` from `backend/app/config.py`.

**Legacy import mapping (Phase 3):** `reference/data_complete.xlsx`

- Historical predecessor only: `reference/data_full_1-230.xlsx`
- `participant ID` → `participants.participant_number` (upsert key)
- `age` → `participants.age_band` (whitespace-trimmed; canonicalize obvious variants like `Over 38` → `>38`)
- See `backend/app/services/import_service.py` normalization helpers for the full canonicalization rules and edge cases (including `Over 38` -> `>38`).
- `gender` → `participants.gender` (trim; canonicalize obvious variants like `Man`  → `Man`)
- `origin` → `participants.origin` (trim)
- If `origin` is an “Other” category, the free-text detail (if present) is stored in `participants.origin_other_text`.
- `commute_method` → `participants.commute_method` (trim)
- If `commute_method` is an “Other” category, the free-text detail (if present) is stored in `participants.commute_method_other_text`.
- `time_outside` → `participants.time_outside` (trim; canonicalize capitalization/wording variants where safe)
- `daytime` → used as the imported session start time-of-day to compute `participants.daylight_exposure_minutes` (nullable; minutes since daylight start)

**Sessions relationship note (Phase 3):** The DB schema allows multiple sessions per participant, but the supervised experiment workflow targets a 1:1 participant↔session relationship. Import validation enforces “0 or 1 sessions per participant” to avoid ambiguity.

**Analytics note (planned):** `participants.daylight_exposure_minutes` remains a
participant/session-start exposure field. It is not currently the same thing as
the R script's derived `daylight_hours` predictor and should not silently
replace day-level weather-derived sunlight duration in analytics queries.

---

## Table: `sessions`


| Column           | Type        | Constraints   | Notes                                                                            |
| ---------------- | ----------- | ------------- | -------------------------------------------------------------------------------- |
| session_id       | UUID        | PK            |                                                                                  |
| participant_uuid | UUID        | FK, NOT NULL  | → participants.participant_uuid                                                  |
| status           | VARCHAR     | NOT NULL      | "created" / "active" / "complete"                                                |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() |                                                                                  |
| completed_at     | TIMESTAMPTZ | NULLABLE      | Set when status transitions to "complete"                                        |
| study_day_id     | UUID        | FK, NULLABLE  | Added T29. Set when session becomes complete; links to `study_days.study_day_id` |


Indexes (applied):

- Partial index (`completed_at`, `session_id`) WHERE `status = 'complete'`
- Partial index (`study_day_id`, `completed_at`, `session_id`) WHERE `status = 'complete' AND study_day_id IS NOT NULL`

---

**Undo-last-session note (T96, implemented):** the RA-only undo flow hard-deletes a
session's dependent survey/digit span rows and then the `sessions` row itself.
This is intentionally limited to the most recently created native session and is
audit-logged in `admin_session_undo_log` instead of introducing soft-delete columns.

## Table: `admin_session_undo_log`

> Added by migration `20260311_000001` (T96). Append-only audit table for the RA-only **Undo Last Session** feature.


| Column                     | Type        | Constraints   | Notes                                            |
| -------------------------- | ----------- | ------------- | ------------------------------------------------ |
| undo_id                    | UUID        | PK            | Generated server-side                            |
| deleted_session_id         | UUID        | NOT NULL      | Stores the deleted session identifier by value   |
| deleted_participant_uuid   | UUID        | NOT NULL      | Stores the deleted participant UUID by value     |
| deleted_participant_number | INT         | NOT NULL      | Human-facing participant number at deletion time |
| session_status_at_delete   | VARCHAR     | NOT NULL      | `created` / `active` / `complete`                |
| deleted_by_lab_member_id   | UUID        | NOT NULL      | RA auth subject who triggered the undo           |
| reason                     | VARCHAR     | NULLABLE      | Short operator-entered reason                    |
| deleted_at                 | TIMESTAMPTZ | DEFAULT NOW() | Audit timestamp                                  |


**Behavior notes:**

- This table is append-only.
- It records hard-delete actions; it does not preserve recoverable row payloads.
- Weather-domain tables are unaffected by undo-last-session operations.
- No FKs to the deleted rows (identifiers stored by value so audit rows survive hard deletion).

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
8a. The older `reference/data_full_1-230.xlsx` file remains a historical
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

---

## Phase 4 Additions — Misokinesia Module (T104, applied 2026-03-17)

> Added by migration `20260317_000001`. Four new tables for the misokinesia video task.

### Table: `misokinesia_test_sets`

Reusable stimulus configurations. One active row = one active study version.


| Column      | Type        | Constraints           | Notes                 |
| ----------- | ----------- | --------------------- | --------------------- |
| test_set_id | UUID        | PK                    | Generated server-side |
| name        | VARCHAR     | NOT NULL              | e.g. `'v1'`           |
| version     | VARCHAR     | NOT NULL              | e.g. `'1.0'`          |
| description | TEXT        | NULLABLE              |                       |
| active      | BOOLEAN     | NOT NULL DEFAULT true |                       |
| created_at  | TIMESTAMPTZ | DEFAULT NOW()         |                       |


### Table: `misokinesia_stimuli`

Clip metadata. No video bytes stored in DB. Videos served directly from Supabase Storage public bucket `misokinesia-stimuli`.


| Column       | Type        | Constraints                  | Notes                                                                |
| ------------ | ----------- | ---------------------------- | -------------------------------------------------------------------- |
| stimulus_id  | UUID        | PK                           | Generated server-side                                                |
| test_set_id  | UUID        | FK, NOT NULL                 | → misokinesia_test_sets.test_set_id                                  |
| storage_path | VARCHAR     | NOT NULL                     | Supabase Storage object key (filename only, e.g. `ankleWagging.mp4`) |
| filename     | VARCHAR     | NOT NULL                     |                                                                      |
| duration_ms  | INTEGER     | NOT NULL                     | Clip duration in milliseconds                                        |
| mime_type    | VARCHAR     | NOT NULL DEFAULT 'video/mp4' |                                                                      |
| sort_order   | INTEGER     | NOT NULL                     | 1-based canonical stimulus order stored with the seeded metadata     |
| active       | BOOLEAN     | NOT NULL DEFAULT true        |                                                                      |
| created_at   | TIMESTAMPTZ | DEFAULT NOW()                |                                                                      |


Public URL pattern: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`

### Table: `misokinesia_participants`

One row per participant's task execution. Contains per-participant progress state, sourced misokinesia demographics, and end-of-task questionnaire responses.


| Column                         | Type        | Constraints   | Notes                                                                                                                                                                          |
| ------------------------------ | ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| misokinesia_participant_id     | UUID        | PK            | Generated server-side                                                                                                                                                          |
| session_id                     | UUID        | FK, NOT NULL  | → sessions.session_id                                                                                                                                                          |
| participant_uuid               | UUID        | FK, NOT NULL  | → participants.participant_uuid                                                                                                                                                |
| test_set_id                    | UUID        | FK, NOT NULL  | → misokinesia_test_sets.test_set_id                                                                                                                                            |
| misokinesia_participant_number | INTEGER     | NOT NULL      | SERIAL from dedicated sequence; independent of participants.participant_number; participant-facing ID starting from 1                                                          |
| started_at                     | TIMESTAMPTZ | DEFAULT NOW() |                                                                                                                                                                                |
| completed_at                   | TIMESTAMPTZ | NULLABLE      | Set server-side when all stimuli have a response row                                                                                                                           |
| created_at                     | TIMESTAMPTZ | DEFAULT NOW() |                                                                                                                                                                                |
| post_survey_order              | VARCHAR(20) | NOT NULL      | Comma-separated ordered list of post-video survey keys assigned randomly at session start, e.g. `"mkaq,gad7,maq"`; null only for legacy rows created before the T168 migration |
| end_fidgeting_text             | TEXT        | NULLABLE      | End-of-task: "Please list any fidgeting stimuli you are bothered by that did not show up in the task"                                                                          |
| end_emotions_text              | TEXT        | NULLABLE      | End-of-task: "Please list any emotional responses felt during the videos not asked in the questionnaire"                                                                       |
| stronger_responses             | BOOLEAN     | NULLABLE      | End-of-task: "Did viewing the videos create stronger responses over time?" (No=false / Yes=true)                                                                               |
| stronger_responses_timing      | VARCHAR     | NULLABLE      | One of: "Immediately", "After 5 seconds", "After 10 seconds", "At the end of the video"; only set when stronger_responses=true                                                 |
| age_band                       | VARCHAR     | NULLABLE      | Current T184 column, superseded by planned sourced demographics replacement                                                                                                    |
| gender                         | VARCHAR     | NULLABLE      | Current T184 column, superseded by planned sourced demographics replacement                                                                                                    |
| gender_other_text              | VARCHAR     | NULLABLE      | Current T184 column, superseded by planned sourced demographics replacement                                                                                                    |
| country                        | VARCHAR     | NULLABLE      | Current T184 column, superseded by planned sourced demographics replacement                                                                                                    |
| country_other_text             | VARCHAR     | NULLABLE      | Current T184 column, superseded by planned sourced demographics replacement                                                                                                    |
| nationality                    | VARCHAR     | NULLABLE      | Current T184 column, superseded by planned sourced demographics replacement                                                                                                    |


Indexes: `misokinesia_participants(session_id)`, `misokinesia_participants(participant_uuid)`

**Planned sourced demographics replacement:** Replace the six T184 columns above with nullable columns sourced from `reference/labs/Misokinesia/Demographics copy2.docx`. Columns remain nullable for legacy/no-write rows, but the production participant UI requires all visible questions before submission.

| Planned column | Type | Notes |
|---|---|---|
| age | INTEGER | Slider/input, `0`-`100` |
| sex | VARCHAR | `"Male"` / `"Female"` |
| gender_identity | TEXT | Free text |
| years_lived_canada | INTEGER | Slider/input, `0`-`100` |
| residence_status | VARCHAR | `"Canadian Citizenship"` / `"Permanent Resident"` / `"Student Visa"` / `"Other"` |
| residence_status_other_text | TEXT | Required when residence status is `"Other"` |
| student_type | VARCHAR | `"Domestic"` / `"International"` |
| total_years_education | INTEGER | Slider/input, `0`-`100` |
| cumulative_gpa | NUMERIC | Slider/input, `0`-`5` |
| majors_text | TEXT | Free text |
| highest_education_completed | VARCHAR | Source Q27 education-level option |
| ethnicity | TEXT[] | Multi-select source Q11 options |
| ethnicity_other_text | TEXT | Required when ethnicity includes `"Other"` |
| native_language | TEXT | Free text |
| english_fluency | VARCHAR | Source Q13 agreement scale |
| fluent_languages | TEXT[] | Multi-select source Q14 options; `"None"` exclusive |
| fluent_languages_other_text | TEXT | Required when fluent languages includes `"Other"` |
| english_speaking_frequency | VARCHAR | `"Always"` / `"Often"` / `"Sometimes"` / `"Rarely"` / `"Never"` |
| non_english_schooling | BOOLEAN | Source Q16 yes/no |
| instruction_languages | TEXT[] | Required only when non-English schooling is true |
| instruction_languages_other_text | TEXT | Required when instruction languages includes `"Other"` |
| diagnosed_disorders | TEXT[] | Multi-select source Q18 options; `"N/A"` exclusive |
| diagnosed_disorders_other_text | TEXT | Required when diagnosed disorders includes `"Other"` |
| adhd_diagnosis | BOOLEAN | Source Q19 yes/no |
| adhd_medication | VARCHAR | `"Yes"` / `"Maybe"` / `"No"` |
| avid_videogamer | BOOLEAN | Source Q21 yes/no |
| video_game_hours_per_week | INTEGER | Slider/input, `0`-`100`; required only when avid videogamer is true |
| prescription_stimulants | BOOLEAN | Source Q22 yes/no |
| regular_substances | TEXT[] | Multi-select source Q23 options; `"None of the Above"` exclusive |
| regular_substances_other_text | TEXT | Required when regular substances includes `"Other"` |
| relationship_status | VARCHAR | Source Q24 option |
| relationship_status_other_text | TEXT | Required when relationship status is `"Other"` |
| occupational_status | VARCHAR | Source Q25 option |
| occupational_status_other_text | TEXT | Required when occupational status is `"Other"` |

### Table: `misokinesia_trial_responses`

One row per clip per participant. Per-clip questionnaire responses (scale 1–5: 1=Strongly Disagree, 5=Strongly Agree).


| Column                     | Type        | Constraints   | Notes                                                       |
| -------------------------- | ----------- | ------------- | ----------------------------------------------------------- |
| response_id                | UUID        | PK            | Generated server-side                                       |
| misokinesia_participant_id | UUID        | FK, NOT NULL  | → misokinesia_participants.misokinesia_participant_id       |
| session_id                 | UUID        | FK, NOT NULL  | → sessions.session_id                                       |
| participant_uuid           | UUID        | FK, NOT NULL  | → participants.participant_uuid                             |
| stimulus_id                | UUID        | FK, NOT NULL  | → misokinesia_stimuli.stimulus_id                           |
| display_order              | INTEGER     | NOT NULL      | 1-based position shown                                      |
| q1                         | SMALLINT    | NOT NULL      | "I find this video unpleasant" (1–5)                        |
| q2                         | SMALLINT    | NOT NULL      | "I felt physical discomfort during the video" (1–5)         |
| q3                         | SMALLINT    | NOT NULL      | "I felt upset during the video" (1–5)                       |
| q4                         | SMALLINT    | NOT NULL      | "I wanted to stop the video early / or close my eyes" (1–5) |
| completed_at               | TIMESTAMPTZ | NULLABLE      |                                                             |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW() |                                                             |


Constraints/indexes:

- UNIQUE (`misokinesia_participant_id`, `stimulus_id`) — prevents duplicate submissions
- Index (`misokinesia_trial_responses(misokinesia_participant_id)`)
- Index (`misokinesia_trial_responses(stimulus_id)`)

RA dashboard read model (T195): `GET /misokinesia/dashboard` joins recent
`misokinesia_participants` rows to `misokinesia_trial_responses` to compute
`avg_clip_score = AVG(q1 + q2 + q3 + q4)` per participant. Participants with no
trial response rows surface `avg_clip_score = null`; no schema migration is
required.

Video score read model (T196): `GET /misokinesia/video-scores` joins active
`misokinesia_stimuli` rows to `misokinesia_trial_responses`, groups by
`stimulus_id`, and computes `avg_score = AVG(q1 + q2 + q3 + q4)` plus
`response_count = COUNT(response_id)`. Stimuli without response rows do not
appear; no schema migration is required.

### Table: `misokinesia_mkaq_responses`

One required 21-item Misokinesia Assessment Questionnaire (MkAQ) response per participant. Always submitted after the video loop (post-video only). All MkAQ rows remain session-scoped through both `session_id` and `participant_uuid`.


| Column                     | Type        | Constraints          | Notes                                                 |
| -------------------------- | ----------- | -------------------- | ----------------------------------------------------- |
| response_id                | UUID        | PK                   | Generated server-side                                 |
| misokinesia_participant_id | UUID        | FK, NOT NULL, UNIQUE | → misokinesia_participants.misokinesia_participant_id |
| session_id                 | UUID        | FK, NOT NULL         | → sessions.session_id                                 |
| participant_uuid           | UUID        | FK, NOT NULL         | → participants.participant_uuid                       |
| q1                         | SMALLINT    | NOT NULL             | MkAQ item 1, 0–3                                      |
| q2                         | SMALLINT    | NOT NULL             | MkAQ item 2, 0–3                                      |
| q3                         | SMALLINT    | NOT NULL             | MkAQ item 3, 0–3                                      |
| q4                         | SMALLINT    | NOT NULL             | MkAQ item 4, 0–3                                      |
| q5                         | SMALLINT    | NOT NULL             | MkAQ item 5, 0–3                                      |
| q6                         | SMALLINT    | NOT NULL             | MkAQ item 6, 0–3                                      |
| q7                         | SMALLINT    | NOT NULL             | MkAQ item 7, 0–3                                      |
| q8                         | SMALLINT    | NOT NULL             | MkAQ item 8, 0–3                                      |
| q9                         | SMALLINT    | NOT NULL             | MkAQ item 9, 0–3                                      |
| q10                        | SMALLINT    | NOT NULL             | MkAQ item 10, 0–3                                     |
| q11                        | SMALLINT    | NOT NULL             | MkAQ item 11, 0–3                                     |
| q12                        | SMALLINT    | NOT NULL             | MkAQ item 12, 0–3                                     |
| q13                        | SMALLINT    | NOT NULL             | MkAQ item 13, 0–3                                     |
| q14                        | SMALLINT    | NOT NULL             | MkAQ item 14, 0–3                                     |
| q15                        | SMALLINT    | NOT NULL             | MkAQ item 15, 0–3                                     |
| q16                        | SMALLINT    | NOT NULL             | MkAQ item 16, 0–3                                     |
| q17                        | SMALLINT    | NOT NULL             | MkAQ item 17, 0–3                                     |
| q18                        | SMALLINT    | NOT NULL             | MkAQ item 18, 0–3                                     |
| q19                        | SMALLINT    | NOT NULL             | MkAQ item 19, 0–3                                     |
| q20                        | SMALLINT    | NOT NULL             | MkAQ item 20, 0–3                                     |
| q21                        | SMALLINT    | NOT NULL             | MkAQ item 21, 0–3                                     |
| total_score                | SMALLINT    | NOT NULL             | Server-computed direct sum of `q1`–`q21`, range 0–63  |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW()        |                                                       |


Constraints/indexes:

- UNIQUE (`misokinesia_participant_id`) — one MkAQ response per participant
- CHECK (`q1` through `q21` are each between 0 and 3)
- CHECK (`total_score` between 0 and 63)
- Index (`misokinesia_mkaq_responses(session_id)`)
- Index (`misokinesia_mkaq_responses(participant_uuid)`)

### `misokinesia_gad7_responses`

One GAD-7 (Generalized Anxiety Disorder-7) response per miso participant. Isolated from the weather-wellness `survey_gad7` table. Always submitted after the video loop as part of the randomised post-video survey block.


| Column                     | Type        | Constraints          | Notes                                                                       |
| -------------------------- | ----------- | -------------------- | --------------------------------------------------------------------------- |
| response_id                | UUID        | PK                   | Generated server-side                                                       |
| misokinesia_participant_id | UUID        | FK, NOT NULL, UNIQUE | → misokinesia_participants.misokinesia_participant_id                       |
| session_id                 | UUID        | FK, NOT NULL         | → sessions.session_id                                                       |
| participant_uuid           | UUID        | FK, NOT NULL         | → participants.participant_uuid                                             |
| r1                         | SMALLINT    | NOT NULL             | GAD-7 item 1, 1–4 (1=Never, 4=Often)                                        |
| r2                         | SMALLINT    | NOT NULL             | GAD-7 item 2, 1–4                                                           |
| r3                         | SMALLINT    | NOT NULL             | GAD-7 item 3, 1–4                                                           |
| r4                         | SMALLINT    | NOT NULL             | GAD-7 item 4, 1–4                                                           |
| r5                         | SMALLINT    | NOT NULL             | GAD-7 item 5, 1–4                                                           |
| r6                         | SMALLINT    | NOT NULL             | GAD-7 item 6, 1–4                                                           |
| r7                         | SMALLINT    | NOT NULL             | GAD-7 item 7, 1–4                                                           |
| total_score                | SMALLINT    | NOT NULL             | Server-computed; raw values converted to 0–3 scale then summed; range 0–21  |
| severity_band              | VARCHAR     | NOT NULL             | `"minimal"` (0–4), `"mild"` (5–9), `"moderate"` (10–14), `"severe"` (15–21) |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW()        |                                                                             |


Constraints/indexes:

- UNIQUE (`misokinesia_participant_id`) — one GAD-7 response per participant
- CHECK (`r1` through `r7` are each between 1 and 4)
- Index (`misokinesia_gad7_responses(session_id)`)
- Index (`misokinesia_gad7_responses(participant_uuid)`)

### `misokinesia_maq_responses`

One Misophonia Assessment Questionnaire (MAQ) response per miso participant. 21-item scale using original "sound issues" wording (source: `reference/labs/Misokinesia/MAQ.pdf` page 1, by Marsha Johnson, revised by Tom Dozier). Always submitted after the video loop as part of the randomised post-video survey block.


| Column                     | Type        | Constraints          | Notes                                                 |
| -------------------------- | ----------- | -------------------- | ----------------------------------------------------- |
| response_id                | UUID        | PK                   | Generated server-side                                 |
| misokinesia_participant_id | UUID        | FK, NOT NULL, UNIQUE | → misokinesia_participants.misokinesia_participant_id |
| session_id                 | UUID        | FK, NOT NULL         | → sessions.session_id                                 |
| participant_uuid           | UUID        | FK, NOT NULL         | → participants.participant_uuid                       |
| q1                         | SMALLINT    | NOT NULL             | MAQ item 1, 0–3                                       |
| q2                         | SMALLINT    | NOT NULL             | MAQ item 2, 0–3                                       |
| q3                         | SMALLINT    | NOT NULL             | MAQ item 3, 0–3                                       |
| q4                         | SMALLINT    | NOT NULL             | MAQ item 4, 0–3                                       |
| q5                         | SMALLINT    | NOT NULL             | MAQ item 5, 0–3                                       |
| q6                         | SMALLINT    | NOT NULL             | MAQ item 6, 0–3                                       |
| q7                         | SMALLINT    | NOT NULL             | MAQ item 7, 0–3                                       |
| q8                         | SMALLINT    | NOT NULL             | MAQ item 8, 0–3                                       |
| q9                         | SMALLINT    | NOT NULL             | MAQ item 9, 0–3                                       |
| q10                        | SMALLINT    | NOT NULL             | MAQ item 10, 0–3                                      |
| q11                        | SMALLINT    | NOT NULL             | MAQ item 11, 0–3                                      |
| q12                        | SMALLINT    | NOT NULL             | MAQ item 12, 0–3                                      |
| q13                        | SMALLINT    | NOT NULL             | MAQ item 13, 0–3                                      |
| q14                        | SMALLINT    | NOT NULL             | MAQ item 14, 0–3                                      |
| q15                        | SMALLINT    | NOT NULL             | MAQ item 15, 0–3                                      |
| q16                        | SMALLINT    | NOT NULL             | MAQ item 16, 0–3                                      |
| q17                        | SMALLINT    | NOT NULL             | MAQ item 17, 0–3                                      |
| q18                        | SMALLINT    | NOT NULL             | MAQ item 18, 0–3                                      |
| q19                        | SMALLINT    | NOT NULL             | MAQ item 19, 0–3                                      |
| q20                        | SMALLINT    | NOT NULL             | MAQ item 20, 0–3                                      |
| q21                        | SMALLINT    | NOT NULL             | MAQ item 21, 0–3                                      |
| total_score                | SMALLINT    | NOT NULL             | Server-computed direct sum of `q1`–`q21`, range 0–63  |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW()        |                                                       |


Constraints/indexes:

- UNIQUE (`misokinesia_participant_id`) — one MAQ response per participant
- CHECK (`q1` through `q21` are each between 0 and 3)
- CHECK (`total_score` between 0 and 63)
- Index (`misokinesia_maq_responses(session_id)`)
- Index (`misokinesia_maq_responses(participant_uuid)`)

---

## Migration History

> Append one row per migration task. Never delete rows. Format:
> `| YYYY-MM-DD | Txx | Description |`


| Date       | Task                  | Migration Description                                                                                                                                                                                               |
| ---------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-19 | T02                   | Alembic initialized with baseline revision                                                                                                                                                                          |
| 2026-02-19 | T03                   | Create participants and sessions tables                                                                                                                                                                             |
| 2026-02-19 | T04                   | Create digitspan_runs and digitspan_trials tables                                                                                                                                                                   |
| 2026-02-19 | T05                   | Create survey tables (ULS-8, CES-D 10, GAD-7, CogFunc 8a)                                                                                                                                                           |
| 2026-02-26 | T29                   | Add study_days + weather_ingest_runs + weather_daily tables; add study_day_id FK to sessions                                                                                                                        |
| 2026-02-27 | T35                   | Drop participants.first_name and participants.last_name (anonymous participants)                                                                                                                                    |
| 2026-02-28 | T47                   | Add participant demographic/exposure columns (age_band, gender, origin, origin_other_text, commute_method, commute_method_other_text, time_outside, daylight_exposure_minutes); add imported_session_measures table |
| 2026-02-28 | T47a                  | Migration `20260228_000008`: fix study_days.tz_name server_default and existing rows from America/Edmonton to America/Vancouver                                                                                     |
| 2026-03-01 | T54                   | Add data_source, legacy columns, nullable relaxation, and UNIQUE session_id constraints to digitspan_runs, survey_uls8, survey_cesd10, survey_gad7                                                                  |
| 2026-03-03 | T64                   | Add `sunshine_duration_hours DOUBLE PRECISION NULL` to `weather_daily` (Open-Meteo historical backfill)                                                                                                             |
| 2026-03-10 | T77                   | Extend `survey_cogfunc8a` with imported-row schema support (`data_source`, `legacy_mean_1_5`, nullable raw/computed columns, UNIQUE session_id)                                                                     |
| 2026-03-10 | T84                   | Add durable `analytics_runs` and `analytics_snapshots` tables for per-range analytics audit/state and snapshot payload storage                                                                                      |
| 2026-03-11 | T96                   | Add append-only `admin_session_undo_log` table for RA-triggered undo-last-session audit                                                                                                                             |
| 2026-03-13 | RC08                  | Add partial `sessions` indexes for analytics date-range reads on `completed_at` and `study_day_id`                                                                                                                  |
| 2026-03-17 | T104                  | Add misokinesia_test_sets, misokinesia_stimuli, misokinesia_participants, misokinesia_trial_responses tables                                                                                                        |
| 2026-04-07 | Import authority prep | Add `imported_session_measures.supplemental_attributes_json` for structured storage of workbook-only legacy fields                                                                                                  |
| 2026-04-20 | T145                  | Add `misokinesia_participants.mkaq_administration` column and `misokinesia_mkaq_responses` table                                                                                                                    |
| 2026-05-12 | T150                  | Add `ra_invitations` table for app-owned RA invitation state                                                                                                                                                        |
| 2026-05-13 | T153 follow-up        | Fix active pending invite uniqueness so expired pending rows do not block a fresh invite                                                                                                                            |
| 2026-05-18 | T168                  | Replace `misokinesia_participants.mkaq_administration` with `post_survey_order`; add `misokinesia_gad7_responses` and `misokinesia_maq_responses` tables                                                            |
| 2026-05-19 | T184                  | Add miso demographics columns to `misokinesia_participants`: `age_band`, `gender`, `gender_other_text`, `country`, `country_other_text`, `nationality` (all VARCHAR NULLABLE)                                        |
| planned    | Miso demographics v2  | Replace T184's six demographics columns with typed sourced-demographics columns from `reference/labs/Misokinesia/Demographics copy2.docx`                                                                                 |


As of 2026-05-19, migration `20260519_000001` is the current head revision.

---

## Session-to-Weather Join Guidance (Day-Level)

Canonical (planned) join key is `study_day_id` via `study_days`.

Temporary fallback (no FK) join key is local-day derivation:

```sql
timezone('America/Vancouver', sessions.completed_at)::date
```
