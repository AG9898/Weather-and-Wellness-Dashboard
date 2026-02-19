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

## Table: `participants`

| Column             | Type           | Constraints       | Notes                                      |
|--------------------|----------------|-------------------|--------------------------------------------|
| participant_uuid   | UUID           | PK                | Generated server-side                      |
| participant_number | INT            | UNIQUE, NOT NULL  | Auto-incremented from 1; assigned by server |
| first_name         | VARCHAR        | NOT NULL          |                                            |
| last_name          | VARCHAR        | NOT NULL          |                                            |
| created_at         | TIMESTAMPTZ    | DEFAULT NOW()     |                                            |

---

## Table: `sessions`

| Column           | Type        | Constraints   | Notes                                   |
|------------------|-------------|---------------|-----------------------------------------|
| session_id       | UUID        | PK            |                                         |
| participant_uuid | UUID        | FK, NOT NULL  | → participants.participant_uuid         |
| status           | VARCHAR     | NOT NULL      | "created" → "active" → "complete"       |
| created_at       | TIMESTAMPTZ | DEFAULT NOW() |                                         |
| completed_at     | TIMESTAMPTZ | NULLABLE      | Set when status transitions to "complete" |

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
| —    | —    | No migrations applied yet |
