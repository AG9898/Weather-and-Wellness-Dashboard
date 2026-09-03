# Misokinesia Localization

Canonical source of Misokinesia locale data: the locale registry, the demographics
option-key registry, per-locale validation overrides, and the English-text-to-key
migration mapping.

This document covers **structure** — locales, option keys, and validation deltas.
The instrument and UI string catalogue (question stems, scale labels, participant
flow chrome) is a separate deliverable and is not written here.

Related: [`SCHEMA.md`](SCHEMA.md) for column definitions, [`API.md`](API.md) for the
demographics contract, [`DESIGN_SPEC.md`](DESIGN_SPEC.md) for participant UX.

---

## 1. Locale Registry

| Locale code | Language | Default | Reference country | Status |
|---|---|---|---|---|
| `en` | English | Yes | Canada | Active |
| `ko` | Korean (한국어) | No | Korea | Active |

Rules:

- **Component-scoped, not platform-wide.** This registry applies to the Misokinesia
  component only. The Weather component and the RA dashboard remain English-only.
  Do not treat `ko` as an available locale anywhere outside
  `docs/labs/weather-wellness/misokinesia/`.
- `en` is the default. A session with no recorded locale is `en`.
- Locale is fixed for the lifetime of a Misokinesia session. It is selected by the RA
  at session start, not by the participant mid-flow.
- Locale selects **labels only**. Stored values are language-independent option keys
  (section 2), so a KO session and an EN session produce directly comparable rows.

### Provenance flags

Every KO label in this document carries a provenance flag:

| Flag | Meaning |
|---|---|
| `workbook` | Sourced from `reference/labs/Misokinesia/VMA_Questionnaires_EN-KO.xlsx`, sheet `Demographics`. Lab-supplied translation. |
| `drafted` | Rough Korean written in-repo. Correctable by the lab without a code change; only the label changes, never the key. |

Workbook demographics coverage was verified complete: all 27 questions and every
option list match the live form in count and order.

---

## 2. Demographics Option-Key Registry

Key naming convention: `<field-slug>_<option-slug>`, lowercase ASCII, underscore
separated (e.g. `residence_citizenship`, `ethnicity_european`).

Two distinct localization cases exist, and they must not be conflated:

- **Case A — shared key, different label.** The option means the same thing in both
  locales; only the display text is localized. One key serves both locales.
- **Case B — divergent option set.** The KO instrument replaces an option with a
  different one. Each locale gets its **own key**, and the divergent slot is *not*
  modelled positionally. A KO participant selecting 영어 stores
  `fluent_lang_english`, never `fluent_lang_korean`.

The `EN label` column is the exact string currently stored in the database, taken
from the backend validators in `backend/app/schemas/misokinesia.py`. Two of these
differ typographically from the workbook (`Bachelors degree` vs the workbook's
`Bachelor's degree`; `Seperated` vs the workbook's `Separated`). The stored string
is authoritative for migration matching; the key normalizes both away.

### Q3 — `sex`

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `sex_male` | Male | 남성 | en, ko | workbook |
| `sex_female` | Female | 여성 | en, ko | workbook |

### Q6 — `residence_status` (Case A)

The KO instrument localizes option 1 from Canadian to Korean citizenship. This is a
**label difference only** — the option still means "citizen of the reference
country", so the key is shared.

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `residence_citizenship` | Canadian Citizenship | 대한민국 국적 | en, ko | workbook |
| `residence_permanent_resident` | Permanent Resident | 영주권자 | en, ko | workbook |
| `residence_student_visa` | Student Visa | 학생 비자 | en, ko | workbook |
| `residence_other` | Other | 기타 | en, ko | workbook |

`residence_other` gates `residence_status_other_text`.

### Q7 — `student_type`

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `student_domestic` | Domestic | 내국인 학생 | en, ko | workbook |
| `student_international` | International | 외국인 유학생 | en, ko | workbook |

### Q27 — `highest_education_completed`

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `education_elementary_middle` | Elementary or middle school | 초등학교 또는 중학교 졸업 | en, ko | workbook |
| `education_high_school` | High school or equivalent (e.g., GED) | 고등학교 졸업 또는 동등 학력 | en, ko | workbook |
| `education_college_diploma` | College diploma | 전문대학 졸업 | en, ko | workbook |
| `education_bachelors` | Bachelors degree | 학사 졸업 | en, ko | workbook |
| `education_masters` | Masters degree | 석사 졸업 | en, ko | workbook |
| `education_doctorate` | Doctorate degree | 박사 졸업 | en, ko | workbook |

### Q11 — `ethnicity` (Case A, multi-select)

`European Canadian` is a Canada-specific category. The KO instrument drops the
Canadian qualifier and generalizes to 유럽계 (European). This is a **label
difference only** — the key is shared.

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `ethnicity_european` | European Canadian | 유럽계 | en, ko | workbook |
| `ethnicity_chinese` | Chinese | 중국계 | en, ko | workbook |
| `ethnicity_south_asian` | South Asian | 남아시아계 | en, ko | workbook |
| `ethnicity_filipino` | Filipino | 필리핀계 | en, ko | workbook |
| `ethnicity_southeast_asian` | Southeast Asian | 동남아시아계 | en, ko | workbook |
| `ethnicity_japanese` | Japanese | 일본계 | en, ko | workbook |
| `ethnicity_latin_american` | Latin American | 중남미계 | en, ko | workbook |
| `ethnicity_korean` | Korean | 한국인 | en, ko | workbook |
| `ethnicity_other` | Other | 기타 | en, ko | workbook |

`ethnicity_other` gates `ethnicity_other_text`.

### Q13 — `english_fluency` (Case A, agreement scale)

The KO stem localizes the reference language (English → 한국어). The scale options
themselves are a plain agreement scale, so keys are shared.

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `fluency_strongly_agree` | Strongly agree | 매우 동의함 | en, ko | workbook |
| `fluency_agree` | Agree | 동의함 | en, ko | workbook |
| `fluency_neutral` | Neither agree nor disagree | 동의하지도 동의하지 않지도 않음 | en, ko | workbook |
| `fluency_disagree` | Disagree | 동의하지 않음 | en, ko | workbook |
| `fluency_strongly_disagree` | Strongly disagree | 전혀 동의하지 않음 | en, ko | workbook |

### Q14 — `fluent_languages` (Case B, multi-select)

**Divergent option set.** The question asks which languages the participant speaks
fluently *in addition to the base language*. The EN base language is English, so the
EN set offers Korean. The KO base language is Korean, so the workbook replaces the
Korean option with English **in the same position**.

Do not model this positionally. Each locale's option set contains its own key:

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `fluent_lang_french` | French | 프랑스어 | en, ko | workbook |
| `fluent_lang_mandarin` | Mandarin | 중국어(보통화) | en, ko | workbook |
| `fluent_lang_cantonese` | Cantonese | 중국어(광동어) | en, ko | workbook |
| `fluent_lang_hindi` | Hindi | 힌디어 | en, ko | workbook |
| `fluent_lang_punjabi` | Punjabi | 펀자브어 | en, ko | workbook |
| `fluent_lang_korean` | Korean | — | **en only** | workbook |
| `fluent_lang_english` | — | 영어 | **ko only** | workbook |
| `fluent_lang_none` | None (exclusive) | 없음 | en, ko | workbook |
| `fluent_lang_other` | Other | 기타 | en, ko | workbook |

- A KO participant selecting 영어 stores `fluent_lang_english`.
- A KO session must reject `fluent_lang_korean`; an EN session must reject
  `fluent_lang_english`.
- `fluent_lang_none` is exclusive with every other option.
- `fluent_lang_other` gates `fluent_languages_other_text`.

### Q15 — `english_speaking_frequency` (Case A)

The KO stem localizes the reference language (English → 한국어); frequency options
are shared.

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `frequency_always` | Always | 항상 | en, ko | workbook |
| `frequency_often` | Often | 자주 | en, ko | workbook |
| `frequency_sometimes` | Sometimes | 가끔 | en, ko | workbook |
| `frequency_rarely` | Rarely | 거의 사용하지 않음 | en, ko | workbook |
| `frequency_never` | Never | 전혀 사용하지 않음 | en, ko | workbook |

### Q17 — `instruction_languages` (Case B, multi-select)

**Divergent option set**, same rule as Q14. The question is gated on
`non_english_schooling` (Q16), whose KO stem asks about instruction in a language
other than 한국어.

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `instruction_lang_french` | French | 프랑스어 | en, ko | workbook |
| `instruction_lang_mandarin` | Mandarin | 중국어(보통화) | en, ko | workbook |
| `instruction_lang_cantonese` | Cantonese | 중국어(광동어) | en, ko | workbook |
| `instruction_lang_hindi` | Hindi | 힌디어 | en, ko | workbook |
| `instruction_lang_punjabi` | Punjabi | 펀자브어 | en, ko | workbook |
| `instruction_lang_korean` | Korean | — | **en only** | workbook |
| `instruction_lang_english` | — | 영어 | **ko only** | workbook |
| `instruction_lang_other` | Other | 기타 | en, ko | workbook |

- A KO participant selecting 영어 stores `instruction_lang_english`.
- Q17 has no `None` option; Q14 does.
- `instruction_lang_other` gates `instruction_languages_other_text`.

### Q18 — `diagnosed_disorders` (multi-select)

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `disorder_neurological` | Neurological Disorder | 신경학적 장애 | en, ko | workbook |
| `disorder_generalized_anxiety` | Generalized Anxiety Disorder | 범불안장애 | en, ko | workbook |
| `disorder_depression` | Depression | 우울증 | en, ko | workbook |
| `disorder_mood` | Mood Disorder | 기분장애 | en, ko | workbook |
| `disorder_substance_use` | Substance Use Disorder | 물질사용장애 | en, ko | workbook |
| `disorder_other` | Other | 기타 | en, ko | workbook |
| `disorder_na` | N/A (exclusive) | 해당 없음 | en, ko | workbook |

`disorder_na` is exclusive; `disorder_other` gates `diagnosed_disorders_other_text`.

### Q20 — `adhd_medication`

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `adhd_med_yes` | Yes | 예 | en, ko | workbook |
| `adhd_med_maybe` | Maybe | 잘 모르겠음 | en, ko | workbook |
| `adhd_med_no` | No | 아니오 | en, ko | workbook |

### Q23 — `regular_substances` (multi-select)

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `substance_alcohol` | Alcohol | 음주 | en, ko | workbook |
| `substance_cannabis` | Cannabis | 대마초 | en, ko | workbook |
| `substance_tobacco` | Tobacco | 담배 | en, ko | workbook |
| `substance_vaping` | Vaping | 전자담배 | en, ko | workbook |
| `substance_caffeine` | Caffeinated Stimulants (coffee, energy drinks, etc.) | 카페인 음료(커피, 에너지 드링크 등) | en, ko | workbook |
| `substance_other` | Other | 기타 | en, ko | workbook |
| `substance_none` | None of the Above (exclusive) | 해당 없음 | en, ko | workbook |

`substance_none` is exclusive; `substance_other` gates
`regular_substances_other_text`.

### Q24 — `relationship_status`

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `relationship_single` | Single | 미혼 | en, ko | workbook |
| `relationship_in_relationship` | In a relationship | 연애 중 | en, ko | workbook |
| `relationship_married` | Married (and not separated) | 기혼(별거 중 아님) | en, ko | workbook |
| `relationship_common_law` | Common-law | 사실혼 | en, ko | workbook |
| `relationship_separated` | Seperated | 별거 중 | en, ko | workbook |
| `relationship_divorced` | Divorced | 이혼 | en, ko | workbook |
| `relationship_widowed` | Widowed | 사별 | en, ko | workbook |
| `relationship_other` | Other | 기타 | en, ko | workbook |
| `relationship_none` | None of the Above | 해당 없음 | en, ko | workbook |

The stored EN label `Seperated` is a legacy misspelling. The key spells it
correctly, so the EN display label can be corrected to `Separated` in the string
catalogue once the backfill lands. Match on the misspelled string when migrating.

`relationship_other` gates `relationship_status_other_text`.

### Q25 — `occupational_status`

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `occupation_employed_full_time` | Employed full-time | 정규직 | en, ko | workbook |
| `occupation_employed_part_time` | Employed part-time | 비정규직/파트타임 | en, ko | workbook |
| `occupation_out_of_work_looking` | Out of work but looking for work | 실직 중이나 구직 활동 중 | en, ko | workbook |
| `occupation_out_of_work_not_looking` | Out of work and not looking for work | 실직 중이며 구직 활동 없음 | en, ko | workbook |
| `occupation_homemaker` | Homemaker | 전업주부 | en, ko | workbook |
| `occupation_student` | Student | 학생 | en, ko | workbook |
| `occupation_military` | Military | 군 복무 중 | en, ko | workbook |
| `occupation_retired` | Retired | 은퇴 | en, ko | workbook |
| `occupation_unable_to_work` | Unable to work | 근무 불가 | en, ko | workbook |
| `occupation_other` | Other | 기타 | en, ko | workbook |
| `occupation_none` | None of the above | 해당 없음 | en, ko | workbook |

`occupation_other` gates `occupational_status_other_text`.

### End-of-task — `stronger_responses_timing`

Asked only when `stronger_responses` is true. This question is part of the
end-of-task form, not the demographics workbook, so the Korean is **drafted**.

| Key | EN label | KO label | Locales | Provenance |
|---|---|---|---|---|
| `timing_immediately` | Immediately | 즉시 | en, ko | drafted |
| `timing_after_5s` | After 5 seconds | 5초 후 | en, ko | drafted |
| `timing_after_10s` | After 10 seconds | 10초 후 | en, ko | drafted |
| `timing_end_of_video` | At the end of the video | 영상이 끝날 무렵 | en, ko | drafted |

---

## 3. Per-Locale Validation Overrides

Only the following validation rules differ by locale. Everything else — required
fields, exclusivity rules, `*_other_text` gating, numeric ranges not listed here —
is identical across locales.

| Field | `en` rule | `ko` rule | Provenance |
|---|---|---|---|
| `cumulative_gpa` | `0.0` – `5.0` | `0.0` – `4.5` | workbook |
| `fluent_languages` | option set includes `fluent_lang_korean`, excludes `fluent_lang_english` | option set includes `fluent_lang_english`, excludes `fluent_lang_korean` | workbook |
| `instruction_languages` | option set includes `instruction_lang_korean`, excludes `instruction_lang_english` | option set includes `instruction_lang_english`, excludes `instruction_lang_korean` | workbook |

### `cumulative_gpa`

Korean universities use a 4.5 or 4.3 maximum, so a 4.5 cap covers both. The
backend must reject a KO submission above 4.5 and the KO slider must stop at 4.5.
The column type (`NUMERIC`) is unchanged; only the accepted range narrows.

### `years_lived_canada` — column reused, not duplicated

The `years_lived_canada` column is **reused unchanged** for `ko`. There is no
second column, and none will be added.

- For `en`, Q5 reads "For how many years have you lived in Canada?" and the value
  means years in Canada.
- For `ko`, Q5 reads 한국에서 거주한 기간(연 단위) and the value means years in
  **Korea**.
- The column name is a historical artifact of the EN-first build. Read it as
  "years lived in the session's reference country", disambiguated by the session
  locale (`en` → Canada, `ko` → Korea).
- Range is `0` – `100` in both locales.

Anyone analysing this column across locales must join on session locale before
pooling. Do not assume a second Korea-specific column exists.

---

## 4. English-Text-to-Key Migration Mapping

Backfill source for T1849. Every row maps an **exact currently-stored English
string** to its key. Match is exact and case-sensitive. Rows whose stored value is
absent from this table must fail the migration rather than be silently dropped.

Array columns (`ethnicity`, `fluent_languages`, `instruction_languages`,
`diagnosed_disorders`, `regular_substances`) are mapped element-wise, preserving
element order. Scalar columns are mapped in place.

All pre-existing rows are `en` sessions, so every divergent-slot value maps to the
EN key (`fluent_lang_korean`, `instruction_lang_korean`). No existing row can
contain a `ko`-only key.

| Column | Stored English text | Key |
|---|---|---|
| `sex` | `Male` | `sex_male` |
| `sex` | `Female` | `sex_female` |
| `residence_status` | `Canadian Citizenship` | `residence_citizenship` |
| `residence_status` | `Permanent Resident` | `residence_permanent_resident` |
| `residence_status` | `Student Visa` | `residence_student_visa` |
| `residence_status` | `Other` | `residence_other` |
| `student_type` | `Domestic` | `student_domestic` |
| `student_type` | `International` | `student_international` |
| `highest_education_completed` | `Elementary or middle school` | `education_elementary_middle` |
| `highest_education_completed` | `High school or equivalent (e.g., GED)` | `education_high_school` |
| `highest_education_completed` | `College diploma` | `education_college_diploma` |
| `highest_education_completed` | `Bachelors degree` | `education_bachelors` |
| `highest_education_completed` | `Masters degree` | `education_masters` |
| `highest_education_completed` | `Doctorate degree` | `education_doctorate` |
| `ethnicity` | `European Canadian` | `ethnicity_european` |
| `ethnicity` | `Chinese` | `ethnicity_chinese` |
| `ethnicity` | `South Asian` | `ethnicity_south_asian` |
| `ethnicity` | `Filipino` | `ethnicity_filipino` |
| `ethnicity` | `Southeast Asian` | `ethnicity_southeast_asian` |
| `ethnicity` | `Japanese` | `ethnicity_japanese` |
| `ethnicity` | `Latin American` | `ethnicity_latin_american` |
| `ethnicity` | `Korean` | `ethnicity_korean` |
| `ethnicity` | `Other` | `ethnicity_other` |
| `english_fluency` | `Strongly agree` | `fluency_strongly_agree` |
| `english_fluency` | `Agree` | `fluency_agree` |
| `english_fluency` | `Neither agree nor disagree` | `fluency_neutral` |
| `english_fluency` | `Disagree` | `fluency_disagree` |
| `english_fluency` | `Strongly disagree` | `fluency_strongly_disagree` |
| `fluent_languages` | `French` | `fluent_lang_french` |
| `fluent_languages` | `Mandarin` | `fluent_lang_mandarin` |
| `fluent_languages` | `Cantonese` | `fluent_lang_cantonese` |
| `fluent_languages` | `Hindi` | `fluent_lang_hindi` |
| `fluent_languages` | `Punjabi` | `fluent_lang_punjabi` |
| `fluent_languages` | `Korean` | `fluent_lang_korean` |
| `fluent_languages` | `None` | `fluent_lang_none` |
| `fluent_languages` | `Other` | `fluent_lang_other` |
| `english_speaking_frequency` | `Always` | `frequency_always` |
| `english_speaking_frequency` | `Often` | `frequency_often` |
| `english_speaking_frequency` | `Sometimes` | `frequency_sometimes` |
| `english_speaking_frequency` | `Rarely` | `frequency_rarely` |
| `english_speaking_frequency` | `Never` | `frequency_never` |
| `instruction_languages` | `French` | `instruction_lang_french` |
| `instruction_languages` | `Mandarin` | `instruction_lang_mandarin` |
| `instruction_languages` | `Cantonese` | `instruction_lang_cantonese` |
| `instruction_languages` | `Hindi` | `instruction_lang_hindi` |
| `instruction_languages` | `Punjabi` | `instruction_lang_punjabi` |
| `instruction_languages` | `Korean` | `instruction_lang_korean` |
| `instruction_languages` | `Other` | `instruction_lang_other` |
| `diagnosed_disorders` | `Neurological Disorder` | `disorder_neurological` |
| `diagnosed_disorders` | `Generalized Anxiety Disorder` | `disorder_generalized_anxiety` |
| `diagnosed_disorders` | `Depression` | `disorder_depression` |
| `diagnosed_disorders` | `Mood Disorder` | `disorder_mood` |
| `diagnosed_disorders` | `Substance Use Disorder` | `disorder_substance_use` |
| `diagnosed_disorders` | `Other` | `disorder_other` |
| `diagnosed_disorders` | `N/A` | `disorder_na` |
| `adhd_medication` | `Yes` | `adhd_med_yes` |
| `adhd_medication` | `Maybe` | `adhd_med_maybe` |
| `adhd_medication` | `No` | `adhd_med_no` |
| `regular_substances` | `Alcohol` | `substance_alcohol` |
| `regular_substances` | `Cannabis` | `substance_cannabis` |
| `regular_substances` | `Tobacco` | `substance_tobacco` |
| `regular_substances` | `Vaping` | `substance_vaping` |
| `regular_substances` | `Caffeinated Stimulants (coffee, energy drinks, etc.)` | `substance_caffeine` |
| `regular_substances` | `Other` | `substance_other` |
| `regular_substances` | `None of the Above` | `substance_none` |
| `relationship_status` | `Single` | `relationship_single` |
| `relationship_status` | `In a relationship` | `relationship_in_relationship` |
| `relationship_status` | `Married (and not separated)` | `relationship_married` |
| `relationship_status` | `Common-law` | `relationship_common_law` |
| `relationship_status` | `Seperated` | `relationship_separated` |
| `relationship_status` | `Divorced` | `relationship_divorced` |
| `relationship_status` | `Widowed` | `relationship_widowed` |
| `relationship_status` | `Other` | `relationship_other` |
| `relationship_status` | `None of the Above` | `relationship_none` |
| `occupational_status` | `Employed full-time` | `occupation_employed_full_time` |
| `occupational_status` | `Employed part-time` | `occupation_employed_part_time` |
| `occupational_status` | `Out of work but looking for work` | `occupation_out_of_work_looking` |
| `occupational_status` | `Out of work and not looking for work` | `occupation_out_of_work_not_looking` |
| `occupational_status` | `Homemaker` | `occupation_homemaker` |
| `occupational_status` | `Student` | `occupation_student` |
| `occupational_status` | `Military` | `occupation_military` |
| `occupational_status` | `Retired` | `occupation_retired` |
| `occupational_status` | `Unable to work` | `occupation_unable_to_work` |
| `occupational_status` | `Other` | `occupation_other` |
| `occupational_status` | `None of the above` | `occupation_none` |
| `stronger_responses_timing` | `Immediately` | `timing_immediately` |
| `stronger_responses_timing` | `After 5 seconds` | `timing_after_5s` |
| `stronger_responses_timing` | `After 10 seconds` | `timing_after_10s` |
| `stronger_responses_timing` | `At the end of the video` | `timing_end_of_video` |

### Not covered by this mapping

The following columns hold free text, numerics, or booleans and are **not**
key-migrated: `age`, `gender_identity`, `years_lived_canada`,
`total_years_education`, `cumulative_gpa`, `majors_text`, `native_language`,
`non_english_schooling`, `adhd_diagnosis`, `avid_videogamer`,
`video_game_hours_per_week`, `prescription_stimulants`, `stronger_responses`,
`end_fidgeting_text`, `end_emotions_text`, and every `*_other_text` column.

Free-text answers (`gender_identity`, `majors_text`, `native_language`, all
`*_other_text`, and the end-of-task prose fields) are stored verbatim in whatever
language the participant typed. They are not localized and not key-mapped.
