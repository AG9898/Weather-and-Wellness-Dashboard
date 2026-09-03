# Misokinesia Component Schema

> Component schema reference for the Weather-Wellness Misokinesia video task,
> sourced demographics, per-clip responses, and post-video questionnaires. Shared
> identity, session, invitation, and audit tables live in `docs/SCHEMA.md`.

---

## Entity Relationships

```text
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
| language                       | VARCHAR     | NOT NULL, DEFAULT `'en'` | Session locale, fixed for the session lifetime: `"en"` or `"ko"`. Selects participant-facing labels only; stored choice values are locale-independent option keys. See [`LOCALIZATION.md`](LOCALIZATION.md) |
| end_fidgeting_text             | TEXT        | NULLABLE      | End-of-task: "Please list any fidgeting stimuli you are bothered by that did not show up in the task"                                                                          |
| end_emotions_text              | TEXT        | NULLABLE      | End-of-task: "Please list any emotional responses felt during the videos not asked in the questionnaire"                                                                       |
| stronger_responses             | BOOLEAN     | NULLABLE      | End-of-task: "Did viewing the videos create stronger responses over time?" (No=false / Yes=true)                                                                               |
| stronger_responses_timing      | VARCHAR     | NULLABLE      | Option key: `timing_immediately` / `timing_after_5s` / `timing_after_10s` / `timing_end_of_video`; only set when stronger_responses=true                                       |
| age                            | INTEGER     | NULLABLE      | Sourced demographics v2 slider/input, `0`-`100`                                                                                                                              |
| sex                            | VARCHAR     | NULLABLE      | Option key: `sex_male` / `sex_female`                                                                                                                                        |
| gender_identity                | TEXT        | NULLABLE      | Sourced demographics v2 free text                                                                                                                                            |
| years_lived_canada             | INTEGER     | NULLABLE      | Sourced demographics v2 slider/input, `0`-`100`. Read as "years in the session reference country" (`en` Canada, `ko` Korea); the column name is an EN-first artifact           |
| residence_status               | VARCHAR     | NULLABLE      | Option key: `residence_citizenship` / `residence_permanent_resident` / `residence_student_visa` / `residence_other`                                                          |
| residence_status_other_text    | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when residence_status is `residence_other`                                                                                    |
| student_type                   | VARCHAR     | NULLABLE      | Option key: `student_domestic` / `student_international`                                                                                                                     |
| total_years_education          | INTEGER     | NULLABLE      | Sourced demographics v2 slider/input, `0`-`100`                                                                                                                              |
| cumulative_gpa                 | NUMERIC     | NULLABLE      | Sourced demographics v2 slider/input; range is locale-dependent (`en` `0`-`5`, `ko` `0`-`4.5`)                                                                                |
| majors_text                    | TEXT        | NULLABLE      | Sourced demographics v2 free text                                                                                                                                            |
| highest_education_completed    | VARCHAR     | NULLABLE      | Source Q27 education-level option key (`education_*`)                                                                                                                        |
| ethnicity                      | TEXT[]      | NULLABLE      | Multi-select source Q11 option keys (`ethnicity_*`)                                                                                                                          |
| ethnicity_other_text           | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when ethnicity includes `ethnicity_other`                                                                                     |
| native_language                | TEXT        | NULLABLE      | Sourced demographics v2 free text                                                                                                                                            |
| english_fluency                | VARCHAR     | NULLABLE      | Source Q13 agreement-scale option key (`fluency_*`)                                                                                                                          |
| fluent_languages               | TEXT[]      | NULLABLE      | Multi-select source Q14 option keys (`fluent_lang_*`); `fluent_lang_none` exclusive. Divergent option set: `fluent_lang_korean` is `en`-only, `fluent_lang_english` is `ko`-only |
| fluent_languages_other_text    | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when fluent_languages includes `fluent_lang_other`                                                                             |
| english_speaking_frequency     | VARCHAR     | NULLABLE      | Option key: `frequency_always` / `frequency_often` / `frequency_sometimes` / `frequency_rarely` / `frequency_never`                                                           |
| non_english_schooling          | BOOLEAN     | NULLABLE      | Source Q16 yes/no                                                                                                                                                            |
| instruction_languages          | TEXT[]      | NULLABLE      | Source Q17 option keys (`instruction_lang_*`); required by API/UI only when non_english_schooling is true. Divergent option set, same rule as fluent_languages                |
| instruction_languages_other_text | TEXT      | NULLABLE      | Free text, stored verbatim; required by API/UI when instruction_languages includes `instruction_lang_other`                                                                  |
| diagnosed_disorders            | TEXT[]      | NULLABLE      | Multi-select source Q18 option keys (`disorder_*`); `disorder_na` exclusive                                                                                                  |
| diagnosed_disorders_other_text | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when diagnosed_disorders includes `disorder_other`                                                                            |
| adhd_diagnosis                 | BOOLEAN     | NULLABLE      | Source Q19 yes/no                                                                                                                                                            |
| adhd_medication                | VARCHAR     | NULLABLE      | Option key: `adhd_med_yes` / `adhd_med_maybe` / `adhd_med_no`                                                                                                                 |
| avid_videogamer                | BOOLEAN     | NULLABLE      | Source Q21 yes/no                                                                                                                                                            |
| video_game_hours_per_week      | INTEGER     | NULLABLE      | Slider/input, `0`-`100`; required by API/UI only when avid_videogamer is true                                                                                                |
| prescription_stimulants        | BOOLEAN     | NULLABLE      | Source Q22 yes/no                                                                                                                                                            |
| regular_substances             | TEXT[]      | NULLABLE      | Multi-select source Q23 option keys (`substance_*`); `substance_none` exclusive                                                                                              |
| regular_substances_other_text  | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when regular_substances includes `substance_other`                                                                             |
| relationship_status            | VARCHAR     | NULLABLE      | Source Q24 option key (`relationship_*`)                                                                                                                                     |
| relationship_status_other_text | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when relationship_status is `relationship_other`                                                                              |
| occupational_status            | VARCHAR     | NULLABLE      | Source Q25 option key (`occupation_*`)                                                                                                                                       |
| occupational_status_other_text | TEXT        | NULLABLE      | Free text, stored verbatim; required by API/UI when occupational_status is `occupation_other`                                                                                |


Indexes: `misokinesia_participants(session_id)`, `misokinesia_participants(participant_uuid)`

The sourced demographics v2 columns were added by migration `20260603_000001`
(T199), replacing T184's six superseded columns. Columns remain nullable for
legacy/no-write rows, but the production participant UI requires all visible
questions before submission.

#### Choice columns store option keys, not display text

Migration `20260903_000001` (T1849) added `language` and rewrote every choice
column on this table from English display text to stable, locale-independent
option keys. This covers the ten scalar choice columns (`sex`,
`residence_status`, `student_type`, `highest_education_completed`,
`english_fluency`, `english_speaking_frequency`, `adhd_medication`,
`relationship_status`, `occupational_status`, `stronger_responses_timing`) and
the five `TEXT[]` choice columns (`ethnicity`, `fluent_languages`,
`instruction_languages`, `diagnosed_disorders`, `regular_substances`), which are
mapped element-wise with element order preserved.

- The key registry and the exact English-text-to-key mapping live in
  [`LOCALIZATION.md`](LOCALIZATION.md) sections 2 and 4. That document is the
  single source; the migration holds a frozen copy of the mapping so it never
  depends on application code.
- Numeric, boolean, free-text and every `*_other_text` column were **not**
  rewritten. Free text is stored verbatim in whatever language the participant
  typed.
- `misokinesia_gad7_responses.difficulty_impact` is **not** key-migrated; it
  remains English display text validated against a fixed whitelist.
- Every pre-existing row was stamped `language = 'en'`, so an `en` row and a `ko`
  row are directly comparable on these columns without translation.
- The migration aborts on any stored value with no mapping entry rather than
  nulling it, and `downgrade()` reverses the mapping and drops `language`.

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
| r1                         | SMALLINT    | NOT NULL             | GAD-7 item 1, 0–3 (0=Not at all, 3=Nearly every day)                        |
| r2                         | SMALLINT    | NOT NULL             | GAD-7 item 2, 0–3                                                           |
| r3                         | SMALLINT    | NOT NULL             | GAD-7 item 3, 0–3                                                           |
| r4                         | SMALLINT    | NOT NULL             | GAD-7 item 4, 0–3                                                           |
| r5                         | SMALLINT    | NOT NULL             | GAD-7 item 5, 0–3                                                           |
| r6                         | SMALLINT    | NOT NULL             | GAD-7 item 6, 0–3                                                           |
| r7                         | SMALLINT    | NOT NULL             | GAD-7 item 7, 0–3                                                           |
| difficulty_impact          | VARCHAR     | NULLABLE             | Conditional final difficulty question; required by API when any item > 0    |
| total_score                | SMALLINT    | NOT NULL             | Server-computed direct sum of the 0–3 item values; range 0–21               |
| severity_band              | VARCHAR     | NOT NULL             | `"minimal"` (0–4), `"mild"` (5–9), `"moderate"` (10–14), `"severe"` (15–21) |
| created_at                 | TIMESTAMPTZ | DEFAULT NOW()        |                                                                             |


Constraints/indexes:

- UNIQUE (`misokinesia_participant_id`) — one GAD-7 response per participant
- CHECK (`r1` through `r7` are each between 0 and 3)
- CHECK (`difficulty_impact` is null or one of `"Not difficult at all"`, `"Somewhat difficult"`, `"Very difficult"`, `"Extremely difficult"`)
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
