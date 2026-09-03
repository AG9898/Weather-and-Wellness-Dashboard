import type { MisokinesiaDemographicsRequest } from "@/lib/api";
import {
  MISO_OPTION_LABELS,
  misoOptionLabel,
  type MisoLocale,
  type MisoMessageKey,
  type MisoOptionField,
  type MisoOptionKey,
  type MisoOptionLabelSet,
} from "@/lib/i18n";

export const MISO_DEMOGRAPHICS_SPLIT_THRESHOLD = 6;

export const MISO_DEMOGRAPHICS_PAYLOAD_FIELDS = [
  "age",
  "sex",
  "gender_identity",
  "years_lived_canada",
  "residence_status",
  "residence_status_other_text",
  "student_type",
  "total_years_education",
  "cumulative_gpa",
  "majors_text",
  "highest_education_completed",
  "ethnicity",
  "ethnicity_other_text",
  "native_language",
  "english_fluency",
  "fluent_languages",
  "fluent_languages_other_text",
  "english_speaking_frequency",
  "non_english_schooling",
  "instruction_languages",
  "instruction_languages_other_text",
  "diagnosed_disorders",
  "diagnosed_disorders_other_text",
  "adhd_diagnosis",
  "adhd_medication",
  "avid_videogamer",
  "video_game_hours_per_week",
  "prescription_stimulants",
  "regular_substances",
  "regular_substances_other_text",
  "relationship_status",
  "relationship_status_other_text",
  "occupational_status",
  "occupational_status_other_text",
] as const satisfies readonly (keyof MisokinesiaDemographicsRequest)[];

export type MisoDemographicsField = (typeof MISO_DEMOGRAPHICS_PAYLOAD_FIELDS)[number];

export type MisoDemographicsValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | undefined;

export type MisoDemographicsValues = Partial<
  Record<MisoDemographicsField, MisoDemographicsValue>
>;

export type MisoDemographicsCondition =
  | {
      field: MisoDemographicsField;
      operator: "equals";
      value: string | number | boolean;
    }
  | {
      field: MisoDemographicsField;
      operator: "includes";
      value: string;
    };

export interface MisoDemographicsOtherTextConfig {
  field: MisoDemographicsField;
  requiredWhen: MisoDemographicsCondition;
}

/**
 * A choice option.
 *
 * `key` is the **stored value** — it is what the payload carries and what the
 * backend validates, so it is identical in every locale. `labels` is the
 * display side, one entry per locale, with `null` marking a locale that does
 * not offer the option (LOCALIZATION.md section 2, Case B). Never render `key`
 * and never store a label.
 */
export interface MisoDemographicsChoiceOption {
  key: string;
  labels: MisoOptionLabelSet;
  exclusive?: boolean;
}

interface MisoDemographicsQuestionBase {
  sourceId: string;
  field: MisoDemographicsField;
  /** Message-catalogue key for the question stem. Never an inline literal. */
  labelKey: MisoMessageKey;
  required: true;
  visibleWhen?: MisoDemographicsCondition;
}

export interface MisoDemographicsSliderQuestion
  extends MisoDemographicsQuestionBase {
  input: "slider";
  min: number;
  /** Widest bound across locales. `maxByLocale` narrows it where it differs. */
  max: number;
  /**
   * Per-locale upper bound. Present only where the instrument diverges
   * (`cumulative_gpa`: 5.0 en / 4.5 ko — LOCALIZATION.md section 3).
   */
  maxByLocale?: Readonly<Record<MisoLocale, number>>;
  step: number;
}

export interface MisoDemographicsTextQuestion
  extends MisoDemographicsQuestionBase {
  input: "text";
  multiline?: boolean;
}

export interface MisoDemographicsSingleChoiceQuestion
  extends MisoDemographicsQuestionBase {
  input: "single_choice";
  optionField: MisoOptionField;
  options: readonly MisoDemographicsChoiceOption[];
  otherText?: MisoDemographicsOtherTextConfig;
}

export interface MisoDemographicsMultiSelectQuestion
  extends MisoDemographicsQuestionBase {
  input: "multi_select";
  optionField: MisoOptionField;
  options: readonly MisoDemographicsChoiceOption[];
  otherText?: MisoDemographicsOtherTextConfig;
}

export interface MisoDemographicsBooleanQuestion
  extends MisoDemographicsQuestionBase {
  input: "boolean";
  trueLabelKey: MisoMessageKey;
  falseLabelKey: MisoMessageKey;
}

export type MisoDemographicsChoiceQuestion =
  | MisoDemographicsSingleChoiceQuestion
  | MisoDemographicsMultiSelectQuestion;

export type MisoDemographicsQuestion =
  | MisoDemographicsSliderQuestion
  | MisoDemographicsTextQuestion
  | MisoDemographicsSingleChoiceQuestion
  | MisoDemographicsMultiSelectQuestion
  | MisoDemographicsBooleanQuestion;

export interface MisoDemographicsPane {
  questions: readonly MisoDemographicsQuestion[];
}

export interface MisoDemographicsBlock {
  sourceBlock: 1 | 2 | 3 | 4 | 5;
  /** Message-catalogue key for the block title. */
  titleKey: MisoMessageKey;
  panes: readonly MisoDemographicsPane[];
}

/**
 * Consent gate (Q1). UI-only: it gates the flow and writes no consent row.
 * Every string is a catalogue key.
 */
export const MISO_DEMOGRAPHICS_CONSENT_GATE = {
  sourceId: "Q1",
  kickerKey: "chrome.consent.kicker",
  titleKey: "chrome.consent.title",
  bodyKey: "chrome.consent.body",
  yesKey: "chrome.choice.yes",
  noKey: "chrome.choice.no",
} as const;

const YES_NO = {
  trueLabelKey: "chrome.choice.yes",
  falseLabelKey: "chrome.choice.no",
} as const;

/**
 * Build a question's option list from the option-key registry, preserving
 * registry order so the two locales stay positionally comparable.
 *
 * Options are never spelled out here: the registry in
 * `frontend/src/lib/i18n/miso-option-labels.ts` is the single source of truth
 * for both the key set and the per-locale labels.
 */
function choiceOptions<F extends MisoOptionField>(
  field: F,
  exclusiveKeys: readonly MisoOptionKey<F>[] = [],
): readonly MisoDemographicsChoiceOption[] {
  const registry = MISO_OPTION_LABELS[field] as Readonly<
    Record<string, MisoOptionLabelSet>
  >;
  const exclusive = new Set<string>(exclusiveKeys);
  return Object.keys(registry).map((key) => ({
    key,
    labels: registry[key],
    ...(exclusive.has(key) ? { exclusive: true as const } : {}),
  }));
}

export const MISO_DEMOGRAPHICS_BLOCKS: readonly MisoDemographicsBlock[] = [
  {
    sourceBlock: 1,
    titleKey: "chrome.demographics.block_title.1",
    panes: [
      {
        questions: [
          {
            sourceId: "Q2",
            field: "age",
            labelKey: "demo.q2",
            input: "slider",
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q3",
            field: "sex",
            labelKey: "demo.q3",
            input: "single_choice",
            optionField: "sex",
            options: choiceOptions("sex"),
            required: true,
          },
          {
            sourceId: "Q4",
            field: "gender_identity",
            labelKey: "demo.q4",
            input: "text",
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 2,
    titleKey: "chrome.demographics.block_title.2",
    panes: [
      {
        questions: [
          {
            // Column reused across locales: `en` reads Canada, `ko` reads
            // Korea. See LOCALIZATION.md section 3.
            sourceId: "Q5",
            field: "years_lived_canada",
            labelKey: "demo.q5",
            input: "slider",
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q6",
            field: "residence_status",
            labelKey: "demo.q6",
            input: "single_choice",
            optionField: "residence_status",
            options: choiceOptions("residence_status"),
            otherText: {
              field: "residence_status_other_text",
              requiredWhen: {
                field: "residence_status",
                operator: "equals",
                value: "residence_other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q7",
            field: "student_type",
            labelKey: "demo.q7",
            input: "single_choice",
            optionField: "student_type",
            options: choiceOptions("student_type"),
            required: true,
          },
          {
            sourceId: "Q8",
            field: "total_years_education",
            labelKey: "demo.q8",
            input: "slider",
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q9",
            field: "cumulative_gpa",
            labelKey: "demo.q9",
            input: "slider",
            min: 0,
            max: 5,
            maxByLocale: { en: 5, ko: 4.5 },
            step: 0.1,
            required: true,
          },
        ],
      },
      {
        questions: [
          {
            sourceId: "Q10",
            field: "majors_text",
            labelKey: "demo.q10",
            input: "text",
            required: true,
          },
          {
            sourceId: "Q27",
            field: "highest_education_completed",
            labelKey: "demo.q27",
            input: "single_choice",
            optionField: "highest_education_completed",
            options: choiceOptions("highest_education_completed"),
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 3,
    titleKey: "chrome.demographics.block_title.3",
    panes: [
      {
        questions: [
          {
            sourceId: "Q11",
            field: "ethnicity",
            labelKey: "demo.q11",
            input: "multi_select",
            optionField: "ethnicity",
            options: choiceOptions("ethnicity"),
            otherText: {
              field: "ethnicity_other_text",
              requiredWhen: {
                field: "ethnicity",
                operator: "includes",
                value: "ethnicity_other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q12",
            field: "native_language",
            labelKey: "demo.q12",
            input: "text",
            required: true,
          },
          {
            sourceId: "Q13",
            field: "english_fluency",
            labelKey: "demo.q13",
            input: "single_choice",
            optionField: "english_fluency",
            options: choiceOptions("english_fluency"),
            required: true,
          },
          {
            // Case B: the option set itself differs by locale.
            sourceId: "Q14",
            field: "fluent_languages",
            labelKey: "demo.q14",
            input: "multi_select",
            optionField: "fluent_languages",
            options: choiceOptions("fluent_languages", ["fluent_lang_none"]),
            otherText: {
              field: "fluent_languages_other_text",
              requiredWhen: {
                field: "fluent_languages",
                operator: "includes",
                value: "fluent_lang_other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q15",
            field: "english_speaking_frequency",
            labelKey: "demo.q15",
            input: "single_choice",
            optionField: "english_speaking_frequency",
            options: choiceOptions("english_speaking_frequency"),
            required: true,
          },
        ],
      },
      {
        questions: [
          {
            sourceId: "Q16",
            field: "non_english_schooling",
            labelKey: "demo.q16",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            // Case B, same rule as Q14.
            sourceId: "Q17",
            field: "instruction_languages",
            labelKey: "demo.q17",
            input: "multi_select",
            optionField: "instruction_languages",
            visibleWhen: {
              field: "non_english_schooling",
              operator: "equals",
              value: true,
            },
            options: choiceOptions("instruction_languages"),
            otherText: {
              field: "instruction_languages_other_text",
              requiredWhen: {
                field: "instruction_languages",
                operator: "includes",
                value: "instruction_lang_other",
              },
            },
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 4,
    titleKey: "chrome.demographics.block_title.4",
    panes: [
      {
        questions: [
          {
            sourceId: "Q18",
            field: "diagnosed_disorders",
            labelKey: "demo.q18",
            input: "multi_select",
            optionField: "diagnosed_disorders",
            options: choiceOptions("diagnosed_disorders", ["disorder_na"]),
            otherText: {
              field: "diagnosed_disorders_other_text",
              requiredWhen: {
                field: "diagnosed_disorders",
                operator: "includes",
                value: "disorder_other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q19",
            field: "adhd_diagnosis",
            labelKey: "demo.q19",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q20",
            field: "adhd_medication",
            labelKey: "demo.q20",
            input: "single_choice",
            optionField: "adhd_medication",
            options: choiceOptions("adhd_medication"),
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 5,
    titleKey: "chrome.demographics.block_title.5",
    panes: [
      {
        questions: [
          {
            sourceId: "Q21",
            field: "avid_videogamer",
            labelKey: "demo.q21",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q28",
            field: "video_game_hours_per_week",
            labelKey: "demo.q28",
            input: "slider",
            visibleWhen: {
              field: "avid_videogamer",
              operator: "equals",
              value: true,
            },
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q22",
            field: "prescription_stimulants",
            labelKey: "demo.q22",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q23",
            field: "regular_substances",
            labelKey: "demo.q23",
            input: "multi_select",
            optionField: "regular_substances",
            options: choiceOptions("regular_substances", ["substance_none"]),
            otherText: {
              field: "regular_substances_other_text",
              requiredWhen: {
                field: "regular_substances",
                operator: "includes",
                value: "substance_other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q24",
            field: "relationship_status",
            labelKey: "demo.q24",
            input: "single_choice",
            optionField: "relationship_status",
            options: choiceOptions("relationship_status"),
            otherText: {
              field: "relationship_status_other_text",
              requiredWhen: {
                field: "relationship_status",
                operator: "equals",
                value: "relationship_other",
              },
            },
            required: true,
          },
        ],
      },
      {
        questions: [
          {
            sourceId: "Q25",
            field: "occupational_status",
            labelKey: "demo.q25",
            input: "single_choice",
            optionField: "occupational_status",
            options: choiceOptions("occupational_status"),
            otherText: {
              field: "occupational_status_other_text",
              requiredWhen: {
                field: "occupational_status",
                operator: "equals",
                value: "occupation_other",
              },
            },
            required: true,
          },
        ],
      },
    ],
  },
];

/** Options a locale actually offers, in registry order (Case B filtering). */
export function getMisoDemographicsOptions(
  question: MisoDemographicsChoiceQuestion,
  locale: MisoLocale,
): readonly MisoDemographicsChoiceOption[] {
  return question.options.filter((option) => option.labels[locale] !== null);
}

/** Display label for one option key in one locale. */
export function getMisoDemographicsOptionLabel(
  question: MisoDemographicsChoiceQuestion,
  option: MisoDemographicsChoiceOption,
  locale: MisoLocale,
): string {
  return misoOptionLabel(question.optionField, option.key, locale);
}

/**
 * Upper bound for a slider in one locale.
 *
 * Mirrors `validate_demographics_for_locale` server-side: a `ko` participant
 * must not be able to enter a GPA above 4.5, by slider or by keyboard.
 */
export function getMisoDemographicsSliderMax(
  question: MisoDemographicsSliderQuestion,
  locale: MisoLocale,
): number {
  return question.maxByLocale ? question.maxByLocale[locale] : question.max;
}

export function misoDemographicsConditionMatches(
  condition: MisoDemographicsCondition,
  values: MisoDemographicsValues
): boolean {
  const value = values[condition.field];
  if (condition.operator === "equals") {
    return value === condition.value;
  }
  return Array.isArray(value) && value.includes(condition.value);
}

export function isMisoDemographicsQuestionVisible(
  question: MisoDemographicsQuestion,
  values: MisoDemographicsValues
): boolean {
  return (
    !question.visibleWhen ||
    misoDemographicsConditionMatches(question.visibleWhen, values)
  );
}

function splitVisibleQuestions(
  questions: readonly MisoDemographicsQuestion[]
): MisoDemographicsPane[] {
  if (questions.length < MISO_DEMOGRAPHICS_SPLIT_THRESHOLD) {
    return [{ questions }];
  }

  const splitAt = Math.floor(questions.length / 2);
  return [
    { questions: questions.slice(0, splitAt) },
    { questions: questions.slice(splitAt) },
  ];
}

export function getMisokinesiaDemographicsBlockPanes(
  block: MisoDemographicsBlock,
  values: MisoDemographicsValues = {}
): readonly MisoDemographicsPane[] {
  const visibleQuestions = block.panes
    .flatMap((pane) => pane.questions)
    .filter((question) => isMisoDemographicsQuestionVisible(question, values));
  if (block.sourceBlock === 5) {
    return [{ questions: visibleQuestions }];
  }
  return splitVisibleQuestions(visibleQuestions);
}

export function getMisokinesiaDemographicsPanes(
  values: MisoDemographicsValues = {}
): readonly MisoDemographicsPane[] {
  return MISO_DEMOGRAPHICS_BLOCKS.flatMap((block) =>
    getMisokinesiaDemographicsBlockPanes(block, values)
  );
}
