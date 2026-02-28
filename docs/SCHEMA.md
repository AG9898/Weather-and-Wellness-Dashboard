# SCHEMA.md — Database Schema

> Full reference for all 8 tables. Read before writing SQLAlchemy models, Alembic
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

---

## Entity Relationships

```
participants (1) ──────────────── (many) sessions
sessions (1) ──────────────────── (1) digitspan_runs
digitspan_runs (1) ─────────────── (14) digitspan_trials
sessions (1) ──────────────────── (1) survey_uls8
sessions (1) ──────────────────── (1) survey_cesd10
sessions (1) ──────────────────── (1) survey_gad7
sessions (1) ──────────────────── (1) survey_cogfunc8a
```

---

## Phase 2 Additions — Weather Ingestion (T29, applied 2026-02-26)

> These tables were added by migration `20260226_000005`. They are live in the database.
> Canonical feature spec: `docs/WEATHER_INGESTION.md`

### Day Dimension: `study_days` (planned)

| Column       | Type        | Constraints            | Notes |
|--------------|-------------|------------------------|------|
| study_day_id | UUID        | PK                     | Generated server-side |
| date_local   | DATE        | UNIQUE, NOT NULL       | Local day in `America/Edmonton` |
| tz_name      | VARCHAR     | NOT NULL               | Default `"America/Edmonton"` |
| created_at   | TIMESTAMPTZ | DEFAULT NOW()          |      |

**Purpose:** Provide a stable relational key for day-level analysis joins without relying on
computed date derivation at query time.

### Sessions: FK to `study_days` (added T29)

Addition to `sessions` applied in migration `20260226_000005`:

| Column       | Type | Constraints | Notes |
|--------------|------|-------------|------|
| study_day_id | UUID | FK, NULLABLE | Set when session becomes `complete`; links to `study_days.study_day_id` |

### Table: `weather_daily` (planned)

| Column                 | Type        | Constraints   | Notes |
|------------------------|-------------|---------------|-------|
| daily_id               | UUID        | PK            | Generated server-side |
| station_id             | INT         | NOT NULL      | Current station: 3510 |
| study_day_id           | UUID        | FK, NOT NULL  | → study_days.study_day_id |
| date_local             | DATE        | NOT NULL      | Denormalized for convenience; must match study_days.date_local |
| source_run_id          | UUID        | FK, NOT NULL  | → weather_ingest_runs.run_id |
| updated_at             | TIMESTAMPTZ | DEFAULT NOW() | Updated on upsert |
| current_observed_at    | TIMESTAMPTZ | NULLABLE      | Metadata only (display/debug) |
| current_temp_c         | DOUBLE PRECISION | NULLABLE      |      |
| current_relative_humidity_pct | INT  | NULLABLE      |      |
| current_wind_speed_kmh | DOUBLE PRECISION | NULLABLE      |      |
| current_wind_gust_kmh  | DOUBLE PRECISION | NULLABLE      |      |
| current_wind_dir_deg   | INT         | NULLABLE      |      |
| current_pressure_kpa   | DOUBLE PRECISION | NULLABLE      |      |
| current_precip_today_mm| DOUBLE PRECISION | NULLABLE      |      |
| forecast_high_c        | DOUBLE PRECISION | NULLABLE      | Day-level summary |
| forecast_low_c         | DOUBLE PRECISION | NULLABLE      | Day-level summary |
| forecast_precip_prob_pct | INT       | NULLABLE      | Day-level summary |
| forecast_precip_mm     | DOUBLE PRECISION | NULLABLE      | Day-level summary |
| forecast_condition_text| VARCHAR     | NULLABLE      | Day-level summary |
| forecast_periods       | JSONB       | NOT NULL      | List of structured forecast blocks |
| structured_json        | JSONB       | NOT NULL      | Full normalized per-day payload |
| created_at             | TIMESTAMPTZ | DEFAULT NOW() |      |

Constraints/indexes (planned):
- UNIQUE (`station_id`, `study_day_id`) for idempotent upserts
- Index (`station_id`, `date_local`)

### Table: `weather_ingest_runs` (planned)

| Column                | Type        | Constraints   | Notes |
|-----------------------|-------------|---------------|-------|
| run_id                | UUID        | PK            | Generated server-side |
| station_id            | INT         | NOT NULL      | 3510 |
| date_local            | DATE        | NOT NULL      | Local day (America/Edmonton) of the ingestion attempt |
| ingested_at           | TIMESTAMPTZ | DEFAULT NOW() | Debug/ops |
| requested_via         | VARCHAR     | NOT NULL      | `github_actions` or `ra_manual` |
| requested_by_lab_member_id | UUID   | NULLABLE      | From JWT `sub` when RA triggers |
| source_primary_url    | VARCHAR     | NOT NULL      |      |
| source_secondary_url  | VARCHAR     | NOT NULL      |      |
| http_primary_status   | SMALLINT    | NULLABLE      |      |
| http_secondary_status | SMALLINT    | NULLABLE      |      |
| raw_html_primary      | TEXT        | NULLABLE      | Stored for debugging HTML changes |
| raw_html_secondary    | TEXT        | NULLABLE      | Stored for debugging HTML changes |
| raw_html_primary_sha256 | CHAR(64)  | NULLABLE      | Hash for change detection |
| raw_html_secondary_sha256 | CHAR(64)| NULLABLE      | Hash for change detection |
| parsed_json           | JSONB       | NOT NULL      | Canonical merged payload |
| parse_status          | VARCHAR     | NOT NULL      | `success` / `partial` / `fail` |
| parse_errors          | JSONB       | NOT NULL      | Array of structured error objects |
| parser_version        | VARCHAR     | NOT NULL      | e.g. `ubc-eos-v1` |
| created_at            | TIMESTAMPTZ | DEFAULT NOW() |      |

Indexes (planned):
- Index (`station_id`, `ingested_at` DESC)
- Index (`station_id`, `date_local`)

---

## Table: `participants`

Participants are anonymous: no names or other direct identifiers are stored. The only human-facing identifier is `participant_number`; `participant_uuid` is the internal stable key.

> Phase 3 (planned): `participants` will gain optional demographic/exposure columns to support legacy import mapping and lab ops.
> This is a schema change and will be applied via Alembic (T47).

| Column             | Type           | Constraints       | Notes                                      |
|--------------------|----------------|-------------------|--------------------------------------------|
| participant_uuid   | UUID           | PK                | Generated server-side                      |
| participant_number | INT            | UNIQUE, NOT NULL  | Auto-incremented from 1; assigned by server |
| created_at         | TIMESTAMPTZ    | DEFAULT NOW()     |                                            |
| age_band           | VARCHAR        | NULLABLE          | Planned (T47). Stores categorical age band (e.g. "18-24") |
| gender             | VARCHAR        | NULLABLE          | Planned (T47). Stored as free-text/category string |
| origin             | VARCHAR        | NULLABLE          | Planned (T47). Stored as free-text/category string |
| commute_method     | VARCHAR        | NULLABLE          | Planned (T47). Stored as free-text/category string |
| time_outside       | VARCHAR        | NULLABLE          | Planned (T47). Stored as categorical label from instruments |
| daylight_exposure_minutes | INT     | NULLABLE          | Planned (T47). Derived minutes value from legacy `daytime` column |

---

## Table: `sessions`

| Column           | Type        | Constraints   | Notes                                   |
|------------------|-------------|---------------|-----------------------------------------|
| session_id       | UUID        | PK            |                                         |
| participant_uuid | UUID        | FK, NOT NULL  | → participants.participant_uuid         |
| status           | VARCHAR     | NOT NULL      | "created" / "active" / "complete"       |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() |                                         |
| completed_at     | TIMESTAMPTZ | NULLABLE      | Set when status transitions to "complete" |
| study_day_id     | UUID        | FK, NULLABLE  | Added T29. Set when session becomes complete; links to `study_days.study_day_id` |

---

## Table: `imported_session_measures` (planned)

> Phase 3 (planned, T47): store imported legacy aggregate outcomes without forcing them into survey item tables.
> This table is 1:1 with sessions and exists to preserve imported values and audit the original row mapping.

| Column             | Type        | Constraints       | Notes |
|--------------------|-------------|-------------------|------|
| session_id         | UUID        | PK, FK            | → sessions.session_id (1:1) |
| participant_uuid   | UUID        | FK, NOT NULL      | → participants.participant_uuid |
| precipitation_mm   | DOUBLE PRECISION | NULLABLE    | Legacy import column `precipitation` (units as provided) |
| temperature_c      | DOUBLE PRECISION | NULLABLE    | Legacy import column `temperature` (units as provided) |
| anxiety_mean       | DOUBLE PRECISION | NULLABLE    | Legacy import column `anxiety` (aggregate/mean) |
| loneliness_mean    | DOUBLE PRECISION | NULLABLE    | Legacy import column `loneliness` (aggregate/mean) |
| depression_mean    | DOUBLE PRECISION | NULLABLE    | Legacy import column `depression` (aggregate/mean) |
| digit_span_max_span| INT         | NULLABLE          | Legacy import column `digit_span_score` mapped to max span |
| self_report        | DOUBLE PRECISION | NULLABLE    | Legacy import column `self_report` (mapping TBD) |
| source_row_json    | JSONB       | NOT NULL          | Full raw row payload for audit/future remapping |
| created_at         | TIMESTAMPTZ | DEFAULT NOW()     | |

---

## Table: `digitspan_runs`

| Column           | Type        | Constraints   | Notes                           |
|------------------|-------------|---------------|---------------------------------|
| run_id           | UUID        | PK            |                                 |
| session_id       | UUID        | FK, NOT NULL  | → sessions.session_id           |
| participant_uuid | UUID        | FK, NOT NULL  | → participants.participant_uuid |
| total_correct    | INT         | NOT NULL      | 0–14                            |
| max_span         | INT         | NOT NULL      | 0–9 (0 if all wrong)            |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() |                                 |

---

## Table: `digitspan_trials`

| Column           | Type        | Constraints  | Notes                                  |
|------------------|-------------|--------------|----------------------------------------|
| trial_id         | UUID        | PK           |                                        |
| run_id           | UUID        | FK, NOT NULL | → digitspan_runs.run_id                |
| trial_number     | INT         | NOT NULL     | 1–14                                   |
| span_length      | INT         | NOT NULL     | 3–9                                    |
| sequence_shown   | VARCHAR     | NOT NULL     | Space-separated, e.g. `"4 7 2"`        |
| sequence_entered | VARCHAR     | NOT NULL     | Participant's backwards response       |
| correct          | BOOLEAN     | NOT NULL     |                                        |

---

## Table: `survey_uls8`

| Column           | Type          | Constraints   | Notes                       |
|------------------|---------------|---------------|-----------------------------|
| response_id      | UUID          | PK            |                             |
| session_id       | UUID          | FK, NOT NULL  | → sessions.session_id       |
| participant_uuid | UUID          | FK, NOT NULL  | → participants.participant_uuid |
| r1               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r2               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r3               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r4               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r5               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r6               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r7               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| r8               | SMALLINT      | NOT NULL      | Raw response, 1–4           |
| computed_mean    | NUMERIC(5,4)  | NOT NULL      | Mean of reversed items      |
| score_0_100      | NUMERIC(6,2)  | NOT NULL      | 0–100 transform             |
| created_at       | TIMESTAMPTZ   | DEFAULT NOW() |                             |

---

## Table: `survey_cesd10`

| Column           | Type        | Constraints   | Notes                          |
|------------------|-------------|---------------|--------------------------------|
| response_id      | UUID        | PK            |                                |
| session_id       | UUID        | FK, NOT NULL  | → sessions.session_id          |
| participant_uuid | UUID        | FK, NOT NULL  | → participants.participant_uuid |
| r1–r10           | SMALLINT    | NOT NULL      | Raw responses, 1–4             |
| total_score      | SMALLINT    | NOT NULL      | 0–30                           |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() |                                |

---

## Table: `survey_gad7`

| Column           | Type        | Constraints   | Notes                                      |
|------------------|-------------|---------------|--------------------------------------------|
| response_id      | UUID        | PK            |                                            |
| session_id       | UUID        | FK, NOT NULL  | → sessions.session_id                      |
| participant_uuid | UUID        | FK, NOT NULL  | → participants.participant_uuid            |
| r1–r7            | SMALLINT    | NOT NULL      | Raw responses, 1–4                         |
| total_score      | SMALLINT    | NOT NULL      | 0–21                                       |
| severity_band    | VARCHAR     | NOT NULL      | "minimal" / "mild" / "moderate" / "severe" |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() |                                            |

---

## Table: `survey_cogfunc8a`

| Column           | Type          | Constraints   | Notes                           |
|------------------|---------------|---------------|---------------------------------|
| response_id      | UUID          | PK            |                                 |
| session_id       | UUID          | FK, NOT NULL  | → sessions.session_id           |
| participant_uuid | UUID          | FK, NOT NULL  | → participants.participant_uuid |
| r1–r8            | SMALLINT      | NOT NULL      | Raw responses, 1–5              |
| total_sum        | SMALLINT      | NOT NULL      |                                 |
| mean_score       | NUMERIC(5,4)  | NOT NULL      |                                 |
| created_at       | TIMESTAMPTZ   | DEFAULT NOW() |                                 |

---

## Migration History

> Append one row per migration task. Never delete rows. Format:
> `| YYYY-MM-DD | Txx | Description |`

| Date | Task | Migration Description |
|------|------|-----------------------|
| 2026-02-19 | T02 | Alembic initialized with baseline revision |
| 2026-02-19 | T03 | Create participants and sessions tables |
| 2026-02-19 | T04 | Create digitspan_runs and digitspan_trials tables |
| 2026-02-19 | T05 | Create survey tables (ULS-8, CES-D 10, GAD-7, CogFunc 8a) |
| 2026-02-26 | T29 | Add study_days + weather_ingest_runs + weather_daily tables; add study_day_id FK to sessions |
| 2026-02-27 | T35 | Drop participants.first_name and participants.last_name (anonymous participants) |

As of 2026-02-27, migrations were applied and verified on Supabase through
revision `20260227_000006` (`head`).

---

## Session-to-Weather Join Guidance (Day-Level)

Canonical (planned) join key is `study_day_id` via `study_days`.

Temporary fallback (no FK) join key is local-day derivation:

```sql
timezone('America/Edmonton', sessions.completed_at)::date
```
