/**
 * Misokinesia option-key display labels.
 *
 * Transcribed from `docs/labs/weather-wellness/misokinesia/LOCALIZATION.md`
 * section 2 (demographics) and the end-of-task `stronger_responses_timing`
 * table. Keys here are **stored values** — they go to the API and into the
 * database — and they are a different namespace from the dotted display-only
 * keys in `miso-messages.ts`. Never store a dotted key; never rename an option
 * key to fix a label.
 *
 * Two localization cases, which must not be conflated:
 *
 * - **Case A — shared key, different label.** The option means the same thing in
 *   both locales; only the display text is localized (e.g.
 *   `residence_citizenship` is Canadian citizenship in EN and 대한민국 국적 in
 *   KO — still "citizen of the reference country").
 * - **Case B — divergent option set.** The KO instrument replaces an option with
 *   a different one, so each locale gets its own key. A `null` label marks an
 *   option that locale does not offer: `fluent_lang_korean` is EN-only,
 *   `fluent_lang_english` is KO-only, and the same split applies to
 *   `instruction_lang_*`. Do not model this positionally.
 *
 * Typing contract: every entry is a total `Record<MisoLocale, string | null>`,
 * so a label missing for either locale is a compile error.
 */

import { MISO_LOCALES, type MisoLocale } from "./miso-locale";

/** A label per locale. `null` means the locale does not offer this option. */
export type MisoOptionLabelSet = Readonly<Record<MisoLocale, string | null>>;

export const MISO_OPTION_LABELS = {
  // Q3
  sex: {
    sex_male: { en: "Male", ko: "남성" },
    sex_female: { en: "Female", ko: "여성" },
  },

  // Q6 — Case A: option 1 localizes the reference country, key is shared.
  residence_status: {
    residence_citizenship: { en: "Canadian Citizenship", ko: "대한민국 국적" },
    residence_permanent_resident: { en: "Permanent Resident", ko: "영주권자" },
    residence_student_visa: { en: "Student Visa", ko: "학생 비자" },
    residence_other: { en: "Other", ko: "기타" },
  },

  // Q7
  student_type: {
    student_domestic: { en: "Domestic", ko: "내국인 학생" },
    student_international: { en: "International", ko: "외국인 유학생" },
  },

  // Q27
  highest_education_completed: {
    education_elementary_middle: {
      en: "Elementary or middle school",
      ko: "초등학교 또는 중학교 졸업",
    },
    education_high_school: {
      en: "High school or equivalent (e.g., GED)",
      ko: "고등학교 졸업 또는 동등 학력",
    },
    education_college_diploma: { en: "College diploma", ko: "전문대학 졸업" },
    education_bachelors: { en: "Bachelors degree", ko: "학사 졸업" },
    education_masters: { en: "Masters degree", ko: "석사 졸업" },
    education_doctorate: { en: "Doctorate degree", ko: "박사 졸업" },
  },

  // Q11 — Case A: KO drops the Canadian qualifier on `ethnicity_european`.
  ethnicity: {
    ethnicity_european: { en: "European Canadian", ko: "유럽계" },
    ethnicity_chinese: { en: "Chinese", ko: "중국계" },
    ethnicity_south_asian: { en: "South Asian", ko: "남아시아계" },
    ethnicity_filipino: { en: "Filipino", ko: "필리핀계" },
    ethnicity_southeast_asian: { en: "Southeast Asian", ko: "동남아시아계" },
    ethnicity_japanese: { en: "Japanese", ko: "일본계" },
    ethnicity_latin_american: { en: "Latin American", ko: "중남미계" },
    ethnicity_korean: { en: "Korean", ko: "한국인" },
    ethnicity_other: { en: "Other", ko: "기타" },
  },

  // Q13 — Case A: the stem localizes the reference language; the agreement
  // scale itself is shared.
  english_fluency: {
    fluency_strongly_agree: { en: "Strongly agree", ko: "매우 동의함" },
    fluency_agree: { en: "Agree", ko: "동의함" },
    fluency_neutral: {
      en: "Neither agree nor disagree",
      ko: "동의하지도 동의하지 않지도 않음",
    },
    fluency_disagree: { en: "Disagree", ko: "동의하지 않음" },
    fluency_strongly_disagree: { en: "Strongly disagree", ko: "전혀 동의하지 않음" },
  },

  // Q14 — Case B. `fluent_lang_none` is exclusive; `fluent_lang_other` gates
  // `fluent_languages_other_text`.
  fluent_languages: {
    fluent_lang_french: { en: "French", ko: "프랑스어" },
    fluent_lang_mandarin: { en: "Mandarin", ko: "중국어(보통화)" },
    fluent_lang_cantonese: { en: "Cantonese", ko: "중국어(광동어)" },
    fluent_lang_hindi: { en: "Hindi", ko: "힌디어" },
    fluent_lang_punjabi: { en: "Punjabi", ko: "펀자브어" },
    fluent_lang_korean: { en: "Korean", ko: null },
    fluent_lang_english: { en: null, ko: "영어" },
    fluent_lang_none: { en: "None", ko: "없음" },
    fluent_lang_other: { en: "Other", ko: "기타" },
  },

  // Q15 — Case A.
  english_speaking_frequency: {
    frequency_always: { en: "Always", ko: "항상" },
    frequency_often: { en: "Often", ko: "자주" },
    frequency_sometimes: { en: "Sometimes", ko: "가끔" },
    frequency_rarely: { en: "Rarely", ko: "거의 사용하지 않음" },
    frequency_never: { en: "Never", ko: "전혀 사용하지 않음" },
  },

  // Q17 — Case B, same rule as Q14. No `None` option here.
  instruction_languages: {
    instruction_lang_french: { en: "French", ko: "프랑스어" },
    instruction_lang_mandarin: { en: "Mandarin", ko: "중국어(보통화)" },
    instruction_lang_cantonese: { en: "Cantonese", ko: "중국어(광동어)" },
    instruction_lang_hindi: { en: "Hindi", ko: "힌디어" },
    instruction_lang_punjabi: { en: "Punjabi", ko: "펀자브어" },
    instruction_lang_korean: { en: "Korean", ko: null },
    instruction_lang_english: { en: null, ko: "영어" },
    instruction_lang_other: { en: "Other", ko: "기타" },
  },

  // Q18 — `disorder_na` is exclusive.
  diagnosed_disorders: {
    disorder_neurological: { en: "Neurological Disorder", ko: "신경학적 장애" },
    disorder_generalized_anxiety: {
      en: "Generalized Anxiety Disorder",
      ko: "범불안장애",
    },
    disorder_depression: { en: "Depression", ko: "우울증" },
    disorder_mood: { en: "Mood Disorder", ko: "기분장애" },
    disorder_substance_use: { en: "Substance Use Disorder", ko: "물질사용장애" },
    disorder_other: { en: "Other", ko: "기타" },
    disorder_na: { en: "N/A", ko: "해당 없음" },
  },

  // Q20
  adhd_medication: {
    adhd_med_yes: { en: "Yes", ko: "예" },
    adhd_med_maybe: { en: "Maybe", ko: "잘 모르겠음" },
    adhd_med_no: { en: "No", ko: "아니오" },
  },

  // Q23 — `substance_none` is exclusive.
  regular_substances: {
    substance_alcohol: { en: "Alcohol", ko: "음주" },
    substance_cannabis: { en: "Cannabis", ko: "대마초" },
    substance_tobacco: { en: "Tobacco", ko: "담배" },
    substance_vaping: { en: "Vaping", ko: "전자담배" },
    substance_caffeine: {
      en: "Caffeinated Stimulants (coffee, energy drinks, etc.)",
      ko: "카페인 음료(커피, 에너지 드링크 등)",
    },
    substance_other: { en: "Other", ko: "기타" },
    substance_none: { en: "None of the Above", ko: "해당 없음" },
  },

  // Q24 — the legacy stored string was the misspelled `Seperated`; the key
  // spells it correctly and the backfill has landed, so the display label is
  // the corrected spelling.
  relationship_status: {
    relationship_single: { en: "Single", ko: "미혼" },
    relationship_in_relationship: { en: "In a relationship", ko: "연애 중" },
    relationship_married: {
      en: "Married (and not separated)",
      ko: "기혼(별거 중 아님)",
    },
    relationship_common_law: { en: "Common-law", ko: "사실혼" },
    relationship_separated: { en: "Separated", ko: "별거 중" },
    relationship_divorced: { en: "Divorced", ko: "이혼" },
    relationship_widowed: { en: "Widowed", ko: "사별" },
    relationship_other: { en: "Other", ko: "기타" },
    relationship_none: { en: "None of the Above", ko: "해당 없음" },
  },

  // Q25
  occupational_status: {
    occupation_employed_full_time: { en: "Employed full-time", ko: "정규직" },
    occupation_employed_part_time: {
      en: "Employed part-time",
      ko: "비정규직/파트타임",
    },
    occupation_out_of_work_looking: {
      en: "Out of work but looking for work",
      ko: "실직 중이나 구직 활동 중",
    },
    occupation_out_of_work_not_looking: {
      en: "Out of work and not looking for work",
      ko: "실직 중이며 구직 활동 없음",
    },
    occupation_homemaker: { en: "Homemaker", ko: "전업주부" },
    occupation_student: { en: "Student", ko: "학생" },
    occupation_military: { en: "Military", ko: "군 복무 중" },
    occupation_retired: { en: "Retired", ko: "은퇴" },
    occupation_unable_to_work: { en: "Unable to work", ko: "근무 불가" },
    occupation_other: { en: "Other", ko: "기타" },
    occupation_none: { en: "None of the above", ko: "해당 없음" },
  },

  // End-of-task. Display side of `end.timing.*` in the message catalogue —
  // key and label must stay in sync.
  stronger_responses_timing: {
    timing_immediately: { en: "Immediately", ko: "즉시" },
    timing_after_5s: { en: "After 5 seconds", ko: "5초 후" },
    timing_after_10s: { en: "After 10 seconds", ko: "10초 후" },
    timing_end_of_video: { en: "At the end of the video", ko: "영상이 끝날 무렵" },
  },
} as const satisfies Readonly<
  Record<string, Readonly<Record<string, MisoOptionLabelSet>>>
>;

/** A choice field that renders option keys. */
export type MisoOptionField = keyof typeof MISO_OPTION_LABELS;

/** The option keys registered for a given field, across all locales. */
export type MisoOptionKey<F extends MisoOptionField> =
  keyof (typeof MISO_OPTION_LABELS)[F] & string;

export const MISO_OPTION_FIELDS = Object.keys(
  MISO_OPTION_LABELS,
) as MisoOptionField[];

/**
 * The option keys a locale offers for a field, in registry order.
 *
 * Case B keys are filtered out for the locale that does not offer them, which is
 * what keeps a KO session from rendering `fluent_lang_korean` (and an EN session
 * from rendering `fluent_lang_english`) — the same split the backend enforces.
 */
export function misoOptionKeys<F extends MisoOptionField>(
  field: F,
  locale: MisoLocale,
): MisoOptionKey<F>[] {
  const options = MISO_OPTION_LABELS[field] as Readonly<
    Record<string, MisoOptionLabelSet>
  >;
  return Object.keys(options).filter(
    (key) => options[key][locale] !== null,
  ) as MisoOptionKey<F>[];
}

/**
 * Resolve an option key plus locale to a display label.
 *
 * Falls back across locales, then to the raw key, rather than throwing: a stored
 * key from the other locale (or an unregistered legacy value) must still render
 * something rather than blanking a participant or review screen.
 */
export function misoOptionLabel<F extends MisoOptionField>(
  field: F,
  key: MisoOptionKey<F> | string,
  locale: MisoLocale,
): string {
  const options = MISO_OPTION_LABELS[field] as Readonly<
    Record<string, MisoOptionLabelSet | undefined>
  >;
  const labels = options[key];
  if (!labels) {
    return key;
  }
  const preferred = labels[locale];
  if (preferred !== null) {
    return preferred;
  }
  for (const fallback of MISO_LOCALES) {
    const value = labels[fallback];
    if (value !== null) {
      return value;
    }
  }
  return key;
}
