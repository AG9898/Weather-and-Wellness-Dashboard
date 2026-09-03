# Misokinesia Localization

Canonical source of Misokinesia locale data: the locale registry, the demographics
option-key registry, per-locale validation overrides, and the English-text-to-key
migration mapping.

Sections 1-4 cover **structure** — locales, option keys, and validation deltas.
Sections 5-6 cover the **string catalogue** — every participant-visible instrument
string and every participant-facing UI chrome string, keyed so code never holds an
inline literal.

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

---

## 5. Instrument String Catalogue

Every participant-visible instrument string, keyed. Code must look strings up by
key; no component may hold an inline literal for any row below.

**Key namespaces are distinct from option keys.** Section 2 keys (`sex_male`,
`timing_immediately`, …) are *stored values* — they go into the database. Section 5
and 6 keys are dotted (`vma.item.q1`, `chrome.button.submit`) and are *display-only
lookups*. Never store a dotted key.

Source of every `workbook` row: `reference/labs/Misokinesia/VMA_Questionnaires_EN-KO.xlsx`.
Sheet is named per subsection.

### 5.1 VMA per-clip questionnaire

Sheet `VMA questions`. Rendered by `MisokinesiaQuestionnaire.tsx`, once after each
clip.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `vma.item.q1` | I find this video unpleasant | 영상이 불쾌하였다. | workbook |
| `vma.item.q2` | I felt physical discomfort during the video | 영상 시청 중 신체적 불편감을 느꼈다. | workbook |
| `vma.item.q3` | I felt upset during the video | 영상 시청 중 정서적 불편감을 느꼈다. | workbook |
| `vma.item.q4` | I wanted to stop the video early / or close my eyes | 영상을 멈추거나 눈을 감고 싶었다. | workbook |
| `vma.scale.1` | Strongly Disagree | 전혀 동의하지 않음 | workbook |
| `vma.scale.2` | Disagree | 동의하지 않음 | workbook |
| `vma.scale.3` | Neutral | 보통 | workbook |
| `vma.scale.4` | Agree | 동의함 | workbook |
| `vma.scale.5` | Strongly Agree | 매우 동의함 | workbook |

### 5.2 MkAQ — Misokinesia Assessment Questionnaire

Sheet `MkAQ`. Rendered by `MisokinesiaMkaqForm.tsx` (`MKAQ_ITEMS`).

| Key | EN | KO | Provenance |
|---|---|---|---|
| `mkaq.item.q1` | My visual issues currently make me unhappy. | 나는 시각 자극 문제로 인해 현재 불행하다. | workbook |
| `mkaq.item.q2` | My visual issues currently create problems for me. | 나는 시각 자극 문제로 인해 현재 어려움을 겪고 있다. | workbook |
| `mkaq.item.q3` | My visual issues have recently made me feel angry. | 나는 시각 자극 문제로 인해 최근 화가 났다. | workbook |
| `mkaq.item.q4` | I feel that no one understands my problems with certain visuals. | 특정 시각 자극에 대한 나의 문제를 아무도 이해하지 못한다고 느낀다. | workbook |
| `mkaq.item.q5` | My visual issues do not seem to have a known cause. | 나의 시각 자극 문제는 알려진 원인이 없는 것 같다. | workbook |
| `mkaq.item.q6` | My visual issues currently make me feel helpless. | 나는 시각 자극 문제로 인해 현재 무력감을 느낀다. | workbook |
| `mkaq.item.q7` | My visual issues currently interfere with my social life. | 나의 시각 자극 문제가 현재 사회생활을 방해하고 있다. | workbook |
| `mkaq.item.q8` | My visual issues currently make me feel isolated. | 나는 시각 자극 문제로 인해 현재 고립감을 느낀다. | workbook |
| `mkaq.item.q9` | My visual issues have recently created problems for me in groups. | 나는 시각 자극 문제로 인해 최근 집단 내에서 어려움을 겪었다. | workbook |
| `mkaq.item.q10` | My visual issues negatively affect my work/school life (currently or recently). | 나의 시각 자극 문제가 직장/학교생활에 부정적 영향을 미치고 있다(현재 또는 최근). | workbook |
| `mkaq.item.q11` | My visual issues currently make me feel frustrated. | 나는 시각 자극 문제로 인해 현재 좌절감을 느낀다. | workbook |
| `mkaq.item.q12` | My visual issues currently impact my entire life negatively. | 나의 시각 자극 문제가 현재 삶 전체에 부정적 영향을 미치고 있다. | workbook |
| `mkaq.item.q13` | My visual issues have recently made me feel guilty. | 나는 시각 자극 문제로 인해 최근 죄책감을 느꼈다. | workbook |
| `mkaq.item.q14` | My visual issues are classified as ‘crazy’. | 나의 시각 자극 문제는 '미쳤다'고 간주된다. | workbook |
| `mkaq.item.q15` | I feel that no one can help me with my visual issues. | 나의 시각 자극 문제를 도와줄 수 있는 사람이 아무도 없다고 느낀다. | workbook |
| `mkaq.item.q16` | My visual issues currently make me feel hopeless. | 나는 시각 자극 문제로 인해 현재 절망감을 느낀다. | workbook |
| `mkaq.item.q17` | I feel that my visual issues will only get worse with time. | 나의 시각 자극 문제가 시간이 갈수록 악화될 것이라고 느낀다. | workbook |
| `mkaq.item.q18` | My visual issues currently impact my family relationships. | 나의 시각 자극 문제가 현재 가족 관계에 영향을 미치고 있다. | workbook |
| `mkaq.item.q19` | My visual issues have recently affected my ability to be with other people. | 나는 시각 자극 문제로 인해 최근 다른 사람들과 함께 있는 것이 어려웠다. | workbook |
| `mkaq.item.q20` | My visual issues have not been recognized as legitimate. | 나의 시각 자극 문제는 정당한 것으로 인정받지 못하고 있다. | workbook |
| `mkaq.item.q21` | I am worried that my whole life will be affected by visual issues. | 나의 시각 자극 문제는 평생 나에게 영향을 미칠까 봐 걱정된다. | workbook |
| `mkaq.scale.0` | Not at all | 전혀 아니다 | workbook |
| `mkaq.scale.1` | A little of the time | 가끔 그렇다 | workbook |
| `mkaq.scale.2` | A good deal of the time | 자주 그렇다 | workbook |
| `mkaq.scale.3` | Almost all the time | 거의 항상 그렇다 | workbook |

The live EN for `mkaq.item.q14` uses curly quotes (`‘crazy’`); the MAQ twin uses
straight quotes (`'crazy'`). Cosmetic only — do not change either displayed string.

### 5.3 GAD-7

Sheet `GAD-7`. Rendered by `MisokinesiaGAD7Form.tsx`.

**The Korean here is the validated Korean GAD-7, not a new translation.** The
workbook records this explicitly (`Validated Korean version used (not a new
translation)`). Do not re-translate, reword, or "improve" any `gad7.*` KO string:
doing so invalidates the instrument. A lab correction to a `gad7.*` KO label is the
one case where the `drafted`-style "labels are freely correctable" rule does **not**
apply.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `gad7.stem` | Over the last two weeks, how often have you been bothered by the following problems? | 지난 2주 동안 당신은 다음의 문제들로 인해서 얼마나 자주 방해를 받았습니까? | workbook (validated) |
| `gad7.item.r1` | Feeling nervous, anxious, or on edge | 초조하거나 불안하거나 조마조마하게 느낀다. | workbook (validated) |
| `gad7.item.r2` | Not being able to stop or control worrying | 걱정하는 것을 멈추거나 조절할 수가 없다. | workbook (validated) |
| `gad7.item.r3` | Worrying too much about different things | 여러 가지 것들에 대해 걱정을 너무 많이 한다. | workbook (validated) |
| `gad7.item.r4` | Trouble relaxing | 편하게 있기가 어렵다. | workbook (validated) |
| `gad7.item.r5` | Being so restless that it is hard to sit still | 너무 안절부절못해서 가만히 있기가 힘들다. | workbook (validated) |
| `gad7.item.r6` | Becoming easily annoyed or irritable | 쉽게 짜증이 나거나 쉽게 성을 내게 된다. | workbook (validated) |
| `gad7.item.r7` | Feeling afraid, as if something awful might happen | 마치 끔찍한 일이 생길 것처럼 두렵게 느껴진다. | workbook (validated) |
| `gad7.scale.0` | Not at all | 전혀 방해받지 않았다 | workbook (validated) |
| `gad7.scale.1` | Several days | 며칠 동안 방해 받았다 | workbook (validated) |
| `gad7.scale.2` | More than half the days | 2주 중 절반 이상 방해 받았다 | workbook (validated) |
| `gad7.scale.3` | Nearly every day | 거의 매일 방해 받았다 | workbook (validated) |
| `gad7.difficulty.stem` | If you checked any problems, how difficult have they made it for you to do your work, take care of things at home, or get along with other people? | 위의 문제들 중 하나라도 해당되는 것이 있다면, 이러한 문제들로 인해 업무를 하거나, 집안일을 처리하거나, 다른 사람과 어울리는 것이 얼마나 어려웠습니까? | workbook (validated) |
| `gad7.difficulty.not_at_all` | Not difficult at all | 전혀 어렵지 않았다 | workbook (validated) |
| `gad7.difficulty.somewhat` | Somewhat difficult | 다소 어려웠다 | workbook (validated) |
| `gad7.difficulty.very` | Very difficult | 매우 어려웠다 | workbook (validated) |
| `gad7.difficulty.extremely` | Extremely difficult | 극도로 어려웠다 | workbook (validated) |

The four `gad7.difficulty.*` options are stored as the **English label string**, not
as an option key. `misokinesia_gad7.difficulty_impact` is a `String` column and
`backend/app/schemas/misokinesia.py` validates it against a whitelist of those four
exact English labels (`_VALID_GAD7_DIFFICULTY_IMPACTS`). Section 4 therefore has no
mapping rows for it. A KO session must still submit the English label so the column
stays poolable; only the displayed KO label comes from this table.

### 5.4 MAQ / MpAQ — Misophonia Assessment Questionnaire

Sheet `MpAQ`. Rendered by `MisokinesiaMAQForm.tsx` (`MAQ_ITEMS`). The platform calls
this instrument **MAQ**; the workbook sheet calls it **MpAQ**. Same instrument.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `maq.item.q1` | My sound issues currently make me unhappy. | 나는 청각 자극 문제로 인해 현재 불행하다. | workbook |
| `maq.item.q2` | My sound issues currently create problems for me. | 나는 청각 자극 문제로 인해 현재 어려움을 겪고 있다. | workbook |
| `maq.item.q3` | My sound issues have recently made me feel angry. | 나는 청각 자극 문제로 인해 최근 화가 났다. | workbook |
| `maq.item.q4` | I feel that no one understands my problems with certain sounds. | 특정 청각 자극에 대한 나의 문제를 아무도 이해하지 못한다고 느낀다. | workbook |
| `maq.item.q5` | My sound issues do not seem to have a known cause. | 나의 청각 자극 문제는 알려진 원인이 없는 것 같다. | workbook |
| `maq.item.q6` | My sound issues currently make me feel helpless. | 나는 청각 자극 문제로 인해 현재 무력감을 느낀다. | workbook |
| `maq.item.q7` | My sound issues currently interfere with my social life. | 나의 청각 자극 문제가 현재 사회생활을 방해하고 있다. | workbook |
| `maq.item.q8` | My sound issues currently make me feel isolated. | 나는 청각 자극 문제로 인해 현재 고립감을 느낀다. | workbook |
| `maq.item.q9` | My sound issues have recently created problems for me in groups. | 나는 청각 자극 문제로 인해 최근 집단 내에서 어려움을 겪었다. | workbook |
| `maq.item.q10` | My sound issues negatively affect my work/school life (currently or recently). | 나의 청각 자극 문제가 직장/학교생활에 부정적 영향을 미치고 있다(현재 또는 최근). | workbook |
| `maq.item.q11` | My sound issues currently make me feel frustrated. | 나는 청각 자극 문제로 인해 현재 좌절감을 느낀다. | workbook |
| `maq.item.q12` | My sound issues currently impact my entire life negatively. | 나의 청각 자극 문제가 현재 삶 전체에 부정적 영향을 미치고 있다. | workbook |
| `maq.item.q13` | My sound issues have recently made me feel guilty. | 나는 청각 자극 문제로 인해 최근 죄책감을 느꼈다. | workbook |
| `maq.item.q14` | My sound issues are classified as 'crazy'. | 나의 청각 자극 문제는 '미쳤다'고 간주된다. | workbook |
| `maq.item.q15` | I feel that no one can help me with my sound issues. | 나의 청각 자극 문제를 도와줄 수 있는 사람이 아무도 없다고 느낀다. | workbook |
| `maq.item.q16` | My sound issues currently make me feel hopeless. | 나는 청각 자극 문제로 인해 현재 절망감을 느낀다. | workbook |
| `maq.item.q17` | I feel that my sound issues will only get worse with time. | 나의 청각 자극 문제가 시간이 갈수록 악화될 것이라고 느낀다. | workbook |
| `maq.item.q18` | My sound issues currently impact my family relationships. | 나의 청각 자극 문제가 현재 가족 관계에 영향을 미치고 있다. | workbook |
| `maq.item.q19` | My sound issues have recently affected my ability to be with other people. | 나는 청각 자극 문제로 인해 최근 다른 사람들과 함께 있는 것이 어려웠다. | workbook |
| `maq.item.q20` | My sound issues have not been recognized as legitimate. | 나의 청각 자극 문제는 정당한 것으로 인정받지 못하고 있다. | workbook |
| `maq.item.q21` | I am worried that my whole life will be affected by sound issues. | 나의 청각 자극 문제는 평생 나에게 영향을 미칠까 봐 걱정된다. | workbook |
| `maq.scale.0` | Not at all | 전혀 아니다 | workbook |
| `maq.scale.1` | A little of the time | 가끔 그렇다 | workbook |
| `maq.scale.2` | A good deal of the time | 자주 그렇다 | workbook |
| `maq.scale.3` | Almost all the time | 거의 항상 그렇다 | workbook |

### 5.5 End-of-task items

Rendered by `MisokinesiaEndOfTaskForm.tsx`. Q1 and Q2 carry the workbook's Korean
for open-ended prompts O1 and O2 (sheet `VMA questions`). Q3 and its follow-up have
**no workbook Korean at all** and are `drafted`.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `end.item.fidgeting` | Please list any fidgeting stimuli that you are bothered by that did not show up in the task. | 영상에 포함되지 않았으나 본인에게 어려움을 주는 타인의 반복적 움직임이 있다면 어떤 것인지 기술해 주십시오. | workbook (O1) |
| `end.item.emotions` | Please list any emotional responses that you felt during the videos that were not asked in the questionnaire. | 영상에 대해 느꼈으나 앞선 질문들로 포착되지 않은 정서나 반응이 있다면 어떤 것인지 기술해 주십시오. | workbook (O2) |
| `end.item.stronger_responses` | Did viewing the videos create stronger responses over time? | 영상을 계속 시청하면서 반응이 점점 더 강해졌습니까? | **drafted** |
| `end.timing.stem` | When did the responses feel stronger? | 반응이 더 강하게 느껴진 시점은 언제였습니까? | **drafted** |
| `end.timing.immediately` | Immediately | 즉시 | **drafted** |
| `end.timing.after_5s` | After 5 seconds | 5초 후 | **drafted** |
| `end.timing.after_10s` | After 10 seconds | 10초 후 | **drafted** |
| `end.timing.end_of_video` | At the end of the video | 영상이 끝날 무렵 | **drafted** |

The four `end.timing.*` labels are the display side of the option keys
`timing_immediately` / `timing_after_5s` / `timing_after_10s` /
`timing_end_of_video` in section 2. Key and label must stay in sync: correcting the
KO wording never changes the stored key.

### 5.6 Workbook content deliberately not surfaced

Recorded so nobody assumes the data exists.

| Workbook row | Status |
|---|---|
| Sheet `VMA questions`, prompt **O3** ("Our goal in this study is to develop a more accurate way to assess one's sensitivity to the fidgeting behaviours of others…") | **Translated in the workbook but intentionally not collected.** There is no database column, no API field, and no UI control for O3. Do not add one on the strength of the translation existing. |
| Sheet `VMA questions`, rows 3–5 (`Instruction` block: "Participants watch a set of short (15 s) videos…") | Administration note, not a rendered string. The participant-facing equivalent is `chrome.intro.body` (section 6), which is platform copy, not workbook copy. |
| Sheet `MpAQ`, row 4 (parent/caregiver proxy-response instruction) | Present in the original MpAQ, omitted from the Korean version because this is an adult-only study. Not rendered in either locale. |

### 5.7 English wording drift (workbook vs live app)

The live English is authoritative for what participants see and **is not changed by
this task**. The workbook English differs cosmetically in the rows below; the Korean
is unaffected because it maps to the item, not to the exact English phrasing.

| Key | Live EN (kept) | Workbook EN |
|---|---|---|
| `vma.item.q1` | I find this video unpleasant | I found the video unpleasant. |
| `vma.item.q2` | I felt physical discomfort during the video | I felt physical discomfort during the video. |
| `vma.item.q3` | I felt upset during the video | I felt upset during the video. |
| `vma.item.q4` | I wanted to stop the video early / or close my eyes | I wanted to stop the video or close my eyes. |
| `gad7.stem` | Over the last two weeks, … | Over the last 2 weeks, … |
| `gad7.item.r5` | Being so restless that it is hard to sit still | Being so restless that it's hard to sit still |
| `gad7.item.r7` | Feeling afraid, as if something awful might happen | Feeling afraid as if something awful might happen |
| `gad7.scale.2` | More than half the days | Over half the days |
| `gad7.difficulty.stem` | If you checked any problems, how difficult have they made it… | If you checked off any problems, how difficult have these made it… |
| `end.item.fidgeting` | Please list any fidgeting stimuli that you are bothered by that did not show up in the task. | Are there any types of fidgeting behaviours that challenge you that were not included in the video set? If so, what might they be? |
| `end.item.emotions` | Please list any emotional responses that you felt during the videos that were not asked in the questionnaire. | Were there any emotions or reactions you had to one or more videos that were not captured by the questions we asked? If so, what might they be? |

The two `end.item.*` rows are a genuine rewrite, not punctuation drift: the live app
asks the same construct in shorter imperative form. The workbook Korean is kept
because it asks the same construct; if the lab wants the KO shortened to match the
live EN register, that is a label edit under the `drafted` rule, not a key change.

VMA rows differ only in tense/punctuation. Trailing periods: the workbook ends VMA
items with a period, the live app does not. Keep the live form.

---

## 6. UI Chrome String Catalogue

Every participant-facing string with **no workbook source**: flow chrome, buttons,
progress labels, state screens, error text, and screen-reader labels. Verified
against the live components listed per subsection rather than estimated.

**KO here is explicitly rough.** Machine-translation quality is acceptable per the
project owner. Every row is flagged `drafted` unless the workbook happens to supply
the exact same phrase (a few consent and block strings do). The lab can correct any
`drafted` KO label without a code change — only the label moves, never the key.

Placeholders use `{name}`. A row whose EN contains a placeholder is a format string,
not a literal; the KO form may reorder placeholders but must use the same set.

Total: **120 keys.** This exceeds the 70–90 rough estimate because the catalogue
also covers `sr-only` legends, `aria-label`s, format strings, and the immersive
video-player error paths — all participant-reachable, all currently inline literals.

### 6.1 Shared chrome

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.task.name` | Misokinesia Task | 미소키네시아 과제 | drafted |
| `chrome.step.trail` | Demographics → Intro → Task → Surveys | 인구통계 → 안내 → 과제 → 설문 | drafted |
| `chrome.step.consent` | Consent | 동의 | drafted |
| `chrome.step.intro_position` | 02 / 04 | 02 / 04 | drafted (numeric) |
| `chrome.step.end_position` | 04 / 04 | 04 / 04 | drafted (numeric) |
| `chrome.choice.yes` | Yes | 예 | workbook |
| `chrome.choice.no` | No | 아니오 | workbook |

`chrome.step.trail` currently renders in two spellings:
`Demographics -> Intro -> Task -> Surveys` (ASCII) in
`MisokinesiaDemographicsForm.tsx`, and `Demographics → Intro → Task → Surveys` in
`page.tsx` and `MisokinesiaEndOfTaskForm.tsx`. One key covers both; unifying the EN
glyph is a cosmetic follow-on, not part of this task.

### 6.2 Buttons and transient state

Used across `page.tsx`, `MisokinesiaDemographicsForm.tsx`, `MisokinesiaQuestionnaire.tsx`,
`MisokinesiaMkaqForm.tsx`, `MisokinesiaMAQForm.tsx`, `MisokinesiaGAD7Form.tsx`,
`MisokinesiaEndOfTaskForm.tsx`.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.button.back` | Back | 이전 | drafted |
| `chrome.button.next` | Next | 다음 | drafted |
| `chrome.button.next_arrow` | Next → | 다음 → | drafted |
| `chrome.button.previous` | ← Previous | ← 이전 | drafted |
| `chrome.button.continue` | Continue | 계속 | drafted |
| `chrome.button.continue_arrow` | Continue → | 계속 → | drafted |
| `chrome.button.submit` | Submit | 제출 | drafted |
| `chrome.button.retry` | Retry | 다시 시도 | drafted |
| `chrome.button.finish` | Finish → | 완료 → | drafted |
| `chrome.state.loading_session` | Loading session… | 세션을 불러오는 중… | drafted |
| `chrome.state.saving` | Saving... | 저장 중... | drafted |
| `chrome.state.saving_kicker` | Saving | 저장 중 | drafted |
| `chrome.state.saving_results` | Saving your results… | 응답을 저장하는 중… | drafted |
| `chrome.state.submitting` | Submitting… | 제출 중… | drafted |
| `chrome.state.submitting_survey` | Submitting questionnaire… | 설문을 제출하는 중… | drafted |

`MisokinesiaMAQForm.tsx` renders `Submitting...` with an ASCII ellipsis while every
other form uses `Submitting…`. Both resolve to `chrome.state.submitting`; normalize
the EN glyph when the key lands.

### 6.3 Errors

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.error.session_kicker` | Session Error | 세션 오류 | drafted |
| `chrome.error.submission_kicker` | Submission Error | 제출 오류 | drafted |
| `chrome.error.manifest_missing` | Session data not found. Please ask the research assistant to restart the session. | 세션 데이터를 찾을 수 없습니다. 연구 보조원에게 세션 재시작을 요청해 주십시오. | drafted |
| `chrome.error.submit_failed` | Submission failed. Please try again. | 제출에 실패했습니다. 다시 시도해 주십시오. | drafted |
| `chrome.error.clip_load` | This clip could not be loaded. Please ask the research assistant to restart the session. | 영상을 불러올 수 없습니다. 연구 보조원에게 세션 재시작을 요청해 주십시오. | drafted |

`chrome.error.manifest_missing` and `chrome.error.clip_load` are the only two error
strings the platform authors itself; every other error banner renders a server
message via `getParticipantErrorMessage`. Server-produced error text is **out of
scope for this catalogue** — it is English-only today and localizing it is a
separate backend concern.

### 6.4 Consent gate and demographics chrome

`MisokinesiaDemographicsForm.tsx`. Question labels and option labels are not
repeated here — they live in section 2 and the demographics workbook sheet.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.consent.kicker` | Before we begin | 시작하기 전에 | drafted |
| `chrome.consent.title` | Consent | 연구 참가 동의 | workbook (Q1) |
| `chrome.consent.body` | Do you consent to participate in this task and continue to the demographics questions? | 본 과제에 참여하고 인구통계 문항으로 계속 진행하는 데 동의하십니까? | drafted |
| `chrome.demographics.block_kicker` | Block {n} of {total} | 블록 {n} / {total} | drafted |
| `chrome.demographics.pane_suffix` | - Pane {n} of {m} | - 페이지 {n} / {m} | drafted |
| `chrome.demographics.block_title.1` | Participant basics | 인적 사항 | workbook |
| `chrome.demographics.block_title.2` | Residence and education | 거주 및 교육 | workbook |
| `chrome.demographics.block_title.3` | Language and ethnicity | 언어 및 민족 | workbook |
| `chrome.demographics.block_title.4` | Clinical history | 병력 | workbook |
| `chrome.demographics.block_title.5` | Lifestyle and status | 생활 및 현재 상태 | workbook |
| `chrome.demographics.pane_help` | Answer each visible question on this pane before continuing. | 계속하기 전에 이 페이지에 표시된 모든 문항에 답해 주십시오. | drafted |
| `chrome.demographics.validation_banner` | Please complete every visible question before continuing. | 계속하려면 표시된 모든 문항에 답해 주십시오. | drafted |
| `chrome.demographics.field_required` | This visible question is required. | 이 문항은 필수입니다. | drafted |
| `chrome.demographics.other_placeholder` | Please specify | 직접 입력해 주십시오 | drafted |

The consent Yes/No buttons and every boolean demographics question reuse
`chrome.choice.yes` / `chrome.choice.no`. The small monospace `sourceId` badge under
each question label (`Q1`, `Q27`, …) is an identifier, not prose — it is never
localized and gets no key.

### 6.5 Intro card

`page.tsx`, `phase === "intro"`.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.intro.title` | Video Clip Questionnaire | 영상 시청 설문 | drafted |
| `chrome.intro.body` | You will watch {n} short video clips. After each clip, you will be asked a few questions about how you felt. There are no right or wrong answers — just answer honestly. | {n}개의 짧은 영상을 시청하게 됩니다. 각 영상이 끝나면 어떻게 느꼈는지에 대한 몇 가지 질문에 답하게 됩니다. 정답이나 오답은 없으니 솔직하게 답해 주십시오. | drafted |
| `chrome.intro.meta.clips.label` | Clips | 영상 | drafted |
| `chrome.intro.meta.clips.value` | {n} short video clips | 짧은 영상 {n}개 | drafted |
| `chrome.intro.meta.per_clip.label` | Per clip | 영상당 | drafted |
| `chrome.intro.meta.per_clip.value` | 4 questions · scale 1–5 | 문항 4개 · 1–5점 척도 | drafted |
| `chrome.intro.meta.after_clips.label` | After clips | 영상 시청 후 | drafted |
| `chrome.intro.meta.after_clips.value` | 3 short surveys | 짧은 설문 3개 | drafted |
| `chrome.intro.meta.estimated.label` | Estimated | 예상 소요 | drafted |
| `chrome.intro.meta.estimated.value` | ≈ 18 minutes total | 총 약 18분 | drafted |
| `chrome.intro.fullscreen_note` | The task will enter fullscreen when you click Begin. You can exit at any time using the button in the top corner. | Begin을 누르면 과제가 전체 화면으로 전환됩니다. 화면 상단 모서리의 버튼으로 언제든지 종료할 수 있습니다. | drafted |
| `chrome.intro.begin` | Begin → | 시작 → | drafted |

`chrome.intro.fullscreen_note` names the Begin button inline. When `chrome.intro.begin`
is corrected, this string must be corrected with it — they are a pair.

### 6.6 Survey transition cards

`page.tsx`, `TRANSITION_CARD_COPY` and `TransitionCard`.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.transition.strip.clips_complete` | Clips complete | 영상 시청 완료 | drafted |
| `chrome.transition.strip.survey_count` | {n} / {m} surveys | 설문 {n} / {m} | drafted |
| `chrome.transition.kicker` | Up next · Survey {pos} of {total} | 다음 · 설문 {pos} / {total} | drafted |
| `chrome.transition.meta.items.label` | Items | 문항 수 | drafted |
| `chrome.transition.meta.format.label` | Format | 형식 | drafted |
| `chrome.transition.meta.scale.label` | Scale | 척도 | drafted |
| `chrome.transition.meta.estimated.label` | Estimated | 예상 소요 | drafted |
| `chrome.transition.mkaq.title` | Misokinesia Assessment | 미소키네시아 평가 | drafted |
| `chrome.transition.mkaq.description` | A short questionnaire about how certain visual stimuli affect you. Answer based on the past two weeks. There are no right or wrong answers. | 특정 시각 자극이 본인에게 미치는 영향을 묻는 짧은 설문입니다. 지난 2주를 기준으로 답해 주십시오. 정답이나 오답은 없습니다. | drafted |
| `chrome.transition.mkaq.meta.items` | 21 statements | 문항 21개 | drafted |
| `chrome.transition.mkaq.meta.format` | 4 panes · Previous available | 4개 페이지 · 이전으로 돌아가기 가능 | drafted |
| `chrome.transition.mkaq.meta.scale` | 0–3 · Not at all → Almost all | 0–3 · 전혀 아니다 → 거의 항상 | drafted |
| `chrome.transition.mkaq.meta.estimated` | ≈ 5 minutes | 약 5분 | drafted |
| `chrome.transition.gad7.title` | Anxiety Questionnaire | 불안 설문 | drafted |
| `chrome.transition.gad7.description` | Seven short questions about feelings of anxiety. Answer based on the past two weeks. There are no right or wrong answers. | 불안감에 관한 짧은 7문항입니다. 지난 2주를 기준으로 답해 주십시오. 정답이나 오답은 없습니다. | drafted |
| `chrome.transition.gad7.meta.items` | 7 statements | 문항 7개 | drafted |
| `chrome.transition.gad7.meta.format` | Single screen | 한 화면 | drafted |
| `chrome.transition.gad7.meta.scale` | 0–3 · Not at all → Nearly every day | 0–3 · 전혀 방해받지 않았다 → 거의 매일 | drafted |
| `chrome.transition.gad7.meta.estimated` | ≈ 1 minute | 약 1분 | drafted |
| `chrome.transition.maq.title` | Misophonia Assessment | 미소포니아 평가 | drafted |
| `chrome.transition.maq.description` | A short questionnaire about how certain sounds affect you. Answer based on the past two weeks. There are no right or wrong answers. | 특정 소리가 본인에게 미치는 영향을 묻는 짧은 설문입니다. 지난 2주를 기준으로 답해 주십시오. 정답이나 오답은 없습니다. | drafted |
| `chrome.transition.maq.meta.items` | 21 statements | 문항 21개 | drafted |
| `chrome.transition.maq.meta.format` | 3 panes · Previous available | 3개 페이지 · 이전으로 돌아가기 가능 | drafted |
| `chrome.transition.maq.meta.scale` | 0–3 · Not at all → Almost all | 0–3 · 전혀 아니다 → 거의 항상 | drafted |
| `chrome.transition.maq.meta.estimated` | ≈ 5 minutes | 약 5분 | drafted |
| `chrome.transition.begin_assessment` | Begin assessment → | 평가 시작 → | drafted |
| `chrome.transition.begin_questionnaire` | Begin questionnaire → | 설문 시작 → | drafted |
| `chrome.transition.pause_note` | Take a breath before continuing — you can pause between questions. | 계속하기 전에 잠시 쉬어도 됩니다. 문항 사이에 언제든 멈출 수 있습니다. | drafted |

MkAQ and MAQ share `chrome.transition.begin_assessment`; GAD-7 uses
`chrome.transition.begin_questionnaire`. The `meta.scale` values paraphrase the
instrument scale anchors — they are chrome, not instrument strings, and must not be
used to render an actual scale chip. Chips render `mkaq.scale.*`, `gad7.scale.*`,
`maq.scale.*` from section 5.

`chrome.transition.mkaq.meta.format` and `chrome.transition.maq.meta.format` hard-code
pane counts (4 and 3) that the forms compute at runtime. Trial mode shortens the item
list and changes the real pane count, so these strings are already approximate in
trial runs. Keep the literal for now; making them dynamic is a separate change.

### 6.7 Clip playback and post-clip questionnaire

`page.tsx` (`ProgressIndicator`), `MisokinesiaVideoPlayer.tsx`,
`MisokinesiaQuestionnaire.tsx`.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.clip.progress` | Clip {n} of {m} | 영상 {n} / {m} | drafted |
| `chrome.clip.progress_percent` | {pct}% | {pct}% | drafted (numeric) |
| `chrome.clip.kicker` | Post-clip · 4 questions | 영상 시청 후 · 문항 4개 | drafted |
| `chrome.clip.heading` | How did you feel about that clip? | 방금 본 영상에 대해 어떻게 느끼셨습니까? | drafted |
| `chrome.clip.help` | Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree). There are no right answers. | 각 문장을 1(전혀 동의하지 않음)에서 5(매우 동의함)까지로 평가해 주십시오. 정답은 없습니다. | drafted |
| `chrome.clip.legend` | Q{n}: {text} | 문항 {n}: {text} | drafted (sr-only) |
| `chrome.clip.item_number` | Q{n} | 문항 {n} | drafted |
| `chrome.video.play` | Play Clip | 영상 재생 | drafted |
| `chrome.video.unsupported` | Your browser does not support embedded video playback. | 이 브라우저는 내장 영상 재생을 지원하지 않습니다. | drafted |

`chrome.clip.help` embeds the two endpoint anchors of the VMA scale. Its KO must stay
consistent with `vma.scale.1` and `vma.scale.5`; if either anchor is corrected, correct
this string too.

`MisokinesiaVideoPlayer.tsx` is mounted with `immersive`, so its non-immersive
fullscreen button (`Enter fullscreen` / `Exit fullscreen` /
`Fullscreen is unavailable in this browser`) and its non-immersive hint (`The
questionnaire will appear automatically when the clip ends.`) are **unreachable in
the Misokinesia flow** and get no keys. The page-level fullscreen toggle in 6.10 is
the one participants see.

### 6.8 Shared survey-form chrome

`MisokinesiaMkaqForm.tsx`, `MisokinesiaMAQForm.tsx`, `MisokinesiaGAD7Form.tsx`.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.form.answered_count` | {n}/{m} answered | {n}/{m} 응답 완료 | drafted |
| `chrome.form.part_counter` | Part {n} / {m} | 파트 {n} / {m} | drafted |
| `chrome.form.item_range` | Items {a}–{b} of {n} | 문항 {a}–{b} / {n} | drafted |
| `chrome.form.rate_heading` | Please rate each statement | 각 문장을 평가해 주십시오 | drafted |
| `chrome.form.item_legend` | {n}. {text} | {n}. {text} | drafted (sr-only) |
| `chrome.form.pane_progress` | {a}/{b} on this part • {c}/{d} overall | 이 파트 {a}/{b} · 전체 {c}/{d} | drafted |
| `chrome.form.scale_legend_0_3` | 0 · Not at all · 1 · A little · 2 · A good deal · 3 · Almost all the time | 0 · 전혀 아니다 · 1 · 가끔 · 2 · 자주 · 3 · 거의 항상 그렇다 | drafted |
| `chrome.mkaq.instrument_label` | MkAQ · Misokinesia Assessment | MkAQ · 미소키네시아 평가 | drafted |
| `chrome.maq.instrument_label` | MAQ · Misophonia Assessment | MAQ · 미소포니아 평가 | drafted |
| `chrome.gad7.instrument_label` | GAD-7 · Anxiety Assessment | GAD-7 · 불안 평가 | drafted |
| `chrome.gad7.scale_legend` | 0 · Not at all · 1 · Several days · 2 · More than half the days · 3 · Nearly every day | 0 · 전혀 방해받지 않았다 · 1 · 며칠 · 2 · 2주 중 절반 이상 · 3 · 거의 매일 | drafted |

The GAD-7 form's `<h2>` is not chrome: it renders `gad7.stem` from section 5. The two
scale-legend strings **abbreviate** the real anchors to fit one line; they are chrome
and must never be substituted for `mkaq.scale.*` / `maq.scale.*` / `gad7.scale.*`. The
chip `title` tooltips do render the real section-5 anchors.

### 6.9 End-of-task and completion

`MisokinesiaEndOfTaskForm.tsx`, `page.tsx` (`phase === "complete"`).

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.end.kicker` | End of task | 과제 종료 | drafted |
| `chrome.end.heading` | A few last questions | 마지막 몇 가지 질문 | drafted |
| `chrome.end.help` | All fields are optional — answer as many as you like. | 모든 문항은 선택 사항입니다. 원하시는 만큼만 답해 주십시오. | drafted |
| `chrome.end.optional_placeholder` | Optional — leave blank if none | 선택 사항 — 없으면 비워 두십시오 | drafted |
| `chrome.complete.kicker` | Session complete | 세션 완료 | drafted |
| `chrome.complete.title` | Thank you | 감사합니다 | drafted |
| `chrome.complete.body` | The session is complete. Please return this device to the research assistant. | 세션이 완료되었습니다. 이 기기를 연구 보조원에게 돌려주십시오. | drafted |
| `chrome.complete.back` | Back to Misokinesia | 미소키네시아로 돌아가기 | drafted |

`chrome.complete.back` navigates to the RA launch page at `/misokinesia`. It is
rendered on a participant screen, so it is localized, but the page it lands on is
RA-facing and stays English.

### 6.10 Fullscreen toggle

`page.tsx`, `FullscreenButton`. Visible label and `aria-label` differ when entering,
so they are two keys.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.fullscreen.enter` | Fullscreen | 전체 화면 | drafted |
| `chrome.fullscreen.enter_aria` | Enter fullscreen | 전체 화면 시작 | drafted (aria) |
| `chrome.fullscreen.exit` | Exit fullscreen | 전체 화면 종료 | drafted |

`chrome.fullscreen.exit` serves as both the visible label and the `aria-label` in the
exit state.

### 6.11 Trial-run section jumper (RA-only)

`MisokinesiaSectionJumper.tsx`, labels from `MISOKINESIA_SECTION_JUMP_SECTIONS` in
`frontend/src/lib/misokinesia-section-jump.ts`. Rendered **only in trial-run mode**,
which no participant ever enters — it is a rehearsal control for the RA.

Keys exist so the component has no inline literals, but KO is optional here: leaving
these English in a KO trial run is acceptable and is not a defect.

| Key | EN | KO | Provenance |
|---|---|---|---|
| `chrome.jumper.aria` | Trial section jumps | 리허설 구간 이동 | drafted (aria) |
| `chrome.jumper.intro` | Intro | 안내 | drafted |
| `chrome.jumper.clips` | Clips | 영상 | drafted |
| `chrome.jumper.mkaq` | MkAQ | MkAQ | drafted |
| `chrome.jumper.gad7` | GAD-7 | GAD-7 | drafted |
| `chrome.jumper.maq` | MAQ | MAQ | drafted |
| `chrome.jumper.end` | End | 종료 | drafted |
| `chrome.jumper.done` | Done | 완료 | drafted |

### 6.12 Out of scope for this catalogue

| Surface | Why excluded |
|---|---|
| `MisokinesiaLaunchPage.tsx` and everything under `frontend/src/app/(ra)/` | RA-facing. The RA dashboard is English-only per section 1. |
| Server error messages surfaced through `getParticipantErrorMessage` | Produced by FastAPI, not the frontend. English-only today; localizing them is a backend change. |
| The browser's native `beforeunload` confirmation (`useTaskExitGuard`) | Text is supplied by the browser and cannot be set by the page. |
| Non-immersive `MisokinesiaVideoPlayer` chrome | Unreachable in the Misokinesia flow (see 6.7). |
