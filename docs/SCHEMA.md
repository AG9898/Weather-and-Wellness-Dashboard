# SCHEMA.md — Platform Database Schema

> Shared database reference for platform-wide tables and invariants. Component-owned
> result and workflow tables live in the component schema docs listed below. Read this
> file before changing shared SQLAlchemy models, Alembic migrations, Pydantic schemas,
> or any cross-lab DB query. Migration History is append-only.

---

## Overview

- **Database:** Supabase-hosted PostgreSQL
- **PKs:** UUID v4, generated server-side via `uuid.uuid4()`
- **Timestamps:** `TIMESTAMPTZ DEFAULT NOW()` on all tables
- **Connection:** `DATABASE_URL` environment variable only — never hardcoded
- **Lab read access:** Supabase Studio (no participant-facing export)
- **FKs:** Enforced at DB level, not just application level

> Migration head check: `alembic current -v` should report
> `Rev: 20260624_000001 (head)`.
> Keep this value in sync after every new migration.

---

## Component Schema Docs

Use the narrowest schema reference that matches the work:

| Path | Scope |
| --- | --- |
| [`docs/labs/weather-wellness/weather/SCHEMA.md`](labs/weather-wellness/weather/SCHEMA.md) | Weather-Wellness weather component: weather ingest, legacy import, surveys, Digit Span, Stroop, card sorting, analytics |
| [`docs/labs/weather-wellness/misokinesia/SCHEMA.md`](labs/weather-wellness/misokinesia/SCHEMA.md) | Weather-Wellness Misokinesia video task and post-video surveys |
| [`docs/labs/ihtt/poffenberger/SCHEMA.md`](labs/ihtt/poffenberger/SCHEMA.md) | IHTT Poffenberger run and trial persistence |

---

## Shared Entity Relationships

```text
participants (1) ──────────────── (many) sessions
study_days (1) ────────────────── (many) sessions
ra_invitations (many) ──────────── (0..1) Supabase Auth users (by email/user_id)
```

`admin_session_undo_log` is an append-only audit table that stores deleted
session and participant identifiers by value for the RA-only undo feature
(applied by migration `20260311_000001`, T96).

`ra_invitations` is the app-owned invitation table for admin-managed RA
onboarding (applied T150). It does not replace Supabase Auth; it stores durable
invite state and links invite acceptance to Supabase Auth user creation/update.

`chat_tool_invocations` records approved RA data chatbot tool calls for audit.
Component-owned result table relationships are documented in the component schema
files above.

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

## Day Dimension: `study_days`

> Added by migration `20260226_000005` (T29). `tz_name` default corrected from
> `America/Edmonton` to `America/Vancouver` by migration `20260228_000008` (T47a).
> Component-level weather ingest details live in
> `docs/labs/weather-wellness/weather/SCHEMA.md`.


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

---

## Table: `participants`

Participants are anonymous: no names or other direct identifiers are stored. The only human-facing identifier is `participant_number`; `participant_uuid` is the internal stable key.

> Phase 3 demographic/exposure columns were added by migration `20260228_000007` (T47). `handedness` was added by migration `20260624_000001` for IHTT Poffenberger demographics. All columns are nullable; collected by component-specific session starts or populated by legacy import where applicable.


| Column                    | Type        | Constraints      | Notes                                                                                                                                                  |
| ------------------------- | ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| participant_uuid          | UUID        | PK               | Generated server-side                                                                                                                                  |
| participant_number        | INT         | UNIQUE, NOT NULL | Auto-incremented from 1; assigned by server                                                                                                            |
| created_at                | TIMESTAMPTZ | DEFAULT NOW()    |                                                                                                                                                        |
| age_band                  | VARCHAR     | NULLABLE         | Categorical age band (e.g. "18-24")                                                                                                                    |
| gender                    | VARCHAR     | NULLABLE         | Stored as free-text/category string                                                                                                                    |
| handedness                | VARCHAR     | NULLABLE         | IHTT Poffenberger categorical handedness (`Left-handed`, `Right-handed`, `Ambidextrous`, `Prefer not to say`)                                         |
| origin                    | VARCHAR     | NULLABLE         | Stored as free-text/category string                                                                                                                    |
| origin_other_text         | VARCHAR     | NULLABLE         | Detail when `origin` is `"Other"` (length-limited; avoid PII)                                                                                          |
| commute_method            | VARCHAR     | NULLABLE         | Stored as free-text/category string                                                                                                                    |
| commute_method_other_text | VARCHAR     | NULLABLE         | Detail when `commute_method` is `"Other"` (length-limited; avoid PII)                                                                                  |
| time_outside              | VARCHAR     | NULLABLE         | Stored as categorical label from instruments                                                                                                           |
| daylight_exposure_minutes | INT         | NULLABLE         | Minutes since `DAYLIGHT_START_LOCAL_TIME` (default 06:00 local) at session start time. Set by `POST /sessions/start` (T51a) and by admin import (T48). |


**Start-session mapping (Phase 3, T51a):** `POST /sessions/start` demographics payload

- `age_band`, `gender`, `origin`, `origin_other_text`, `commute_method`, `commute_method_other_text`, `time_outside` stored directly from validated preset values.
- `daylight_exposure_minutes` computed at request time via `compute_daylight_exposure_minutes()` from `backend/app/config.py`.

**IHTT Poffenberger mapping (2026-06-24):** `POST /ihtt/poffenberger/start` demographics payload

- Stores only `age_band`, `gender`, and `handedness` on `participants`.
- Weather-Wellness-only exposure fields (`origin`, `commute_method`, `time_outside`, and `daylight_exposure_minutes`) remain null for Poffenberger-created participants.

**Legacy import mapping (Phase 3):** `reference/data_complete.xlsx`

- Historical predecessor only: `reference/labs/weather-wellness/data_full_1-230.xlsx`
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

## Table: `chat_tool_invocations`

> Added by migration `20260620_000001` (T1829). Append-only audit table
> recording every approved tool call the LLM coordinator makes, for
> research-ethics review and debugging. SQLAlchemy model:
> `backend/app/models/chat_tool_invocation.py` (`ChatToolInvocation`). One row
> is written per tool invocation from the coordinator loop
> (`backend/app/services/chat_service.py`), including rejected unknown tool
> names (logged with `status="invalid_scope"`). For admin callers `lab_name`
> records the `admin:all` cross-lab marker. See `docs/AI_CHAT.md`
> (Tool-Call Audit) and `docs/DECISIONS.md` RESOLVED-20.


| Column          | Type        | Constraints   | Notes                                                        |
| --------------- | ----------- | ------------- | ------------------------------------------------------------ |
| id              | UUID        | PK            | Generated server-side                                        |
| conversation_id | UUID        | NOT NULL      | Chat conversation the call belongs to (not persisted itself) |
| lab_name        | VARCHAR     | NOT NULL      | Authenticated lab scope at call time (`ww`, or admin marker) |
| tool_name       | VARCHAR     | NOT NULL      | Approved tool invoked (e.g. `weather_study_day_summary`)     |
| params          | JSONB       | NOT NULL      | Tool input parameters the model supplied                     |
| status          | VARCHAR     | NOT NULL      | `ready` / `insufficient_data` / `permission_denied` / `invalid_scope` |
| created_at      | TIMESTAMPTZ | DEFAULT NOW() | Audit timestamp                                              |


**Behavior notes:**

- Append-only; stores tool metadata and status, never raw participant rows or PII.
- No FK to a conversation table (v1 does not persist conversations server-side).
- Inspectable in Supabase Studio for ethics/audit review.

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
| 2026-06-03 | T199                  | Replace T184's six demographics columns with typed sourced-demographics columns from `reference/labs/Misokinesia/Demographics copy2.docx`                                                                                 |
| 2026-06-05 | n/a                   | Revise misokinesia GAD-7 item storage to 0–3 scale and add conditional `difficulty_impact` column                                                                                                                   |
| 2026-06-14 | T206                  | Add Weather-Wellness cognitive battery persistence: session task/rule orders, Stroop run/trial tables, and card sorting run/trial tables                                                                            |
| 2026-06-20 | T1829                 | Add `chat_tool_invocations` append-only audit table for the RA chatbot agentic loop                                                                                                                                |
| 2026-06-21 | T1833                 | Add IHTT Poffenberger run/trial persistence tables, server manifest storage, raw timing fields, and condition/crossed summary columns                                                                               |
| 2026-06-24 | n/a                   | Add nullable `participants.handedness` for IHTT Poffenberger demographics and split Poffenberger start demographics from Weather-Wellness exposure fields                                                           |


As of 2026-06-24, migration `20260624_000001` is the current head revision.

---
