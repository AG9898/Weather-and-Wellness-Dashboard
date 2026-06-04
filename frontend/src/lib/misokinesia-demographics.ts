import type { MisokinesiaDemographicsRequest } from "@/lib/api";

export const MISO_DEMOGRAPHICS_MAX_QUESTIONS_PER_PANE = 5;

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

export interface MisoDemographicsChoiceOption {
  value: string;
  label: string;
  exclusive?: boolean;
}

interface MisoDemographicsQuestionBase {
  sourceId: string;
  field: MisoDemographicsField;
  label: string;
  required: true;
  visibleWhen?: MisoDemographicsCondition;
}

export interface MisoDemographicsSliderQuestion
  extends MisoDemographicsQuestionBase {
  input: "slider";
  min: number;
  max: number;
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
  options: readonly MisoDemographicsChoiceOption[];
  otherText?: MisoDemographicsOtherTextConfig;
}

export interface MisoDemographicsMultiSelectQuestion
  extends MisoDemographicsQuestionBase {
  input: "multi_select";
  options: readonly MisoDemographicsChoiceOption[];
  otherText?: MisoDemographicsOtherTextConfig;
}

export interface MisoDemographicsBooleanQuestion
  extends MisoDemographicsQuestionBase {
  input: "boolean";
  trueLabel: string;
  falseLabel: string;
}

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
  title: string;
  panes: readonly MisoDemographicsPane[];
}

export const MISO_DEMOGRAPHICS_CONSENT_GATE = {
  sourceId: "Q1",
  label: "Consent",
  yesLabel: "Yes",
  noLabel: "No",
} as const;

const YES_NO = {
  trueLabel: "Yes",
  falseLabel: "No",
} as const;

export const MISO_DEMOGRAPHICS_BLOCKS: readonly MisoDemographicsBlock[] = [
  {
    sourceBlock: 1,
    title: "Participant basics",
    panes: [
      {
        questions: [
          {
            sourceId: "Q2",
            field: "age",
            label: "Age",
            input: "slider",
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q3",
            field: "sex",
            label: "Sex",
            input: "single_choice",
            options: [
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
            ],
            required: true,
          },
          {
            sourceId: "Q4",
            field: "gender_identity",
            label: "Gender Identity",
            input: "text",
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 2,
    title: "Residence and education",
    panes: [
      {
        questions: [
          {
            sourceId: "Q5",
            field: "years_lived_canada",
            label: "For how many years have you lived in Canada?",
            input: "slider",
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q6",
            field: "residence_status",
            label: "What is your Residence Status?",
            input: "single_choice",
            options: [
              { value: "Canadian Citizenship", label: "Canadian Citizenship" },
              { value: "Permanent Resident", label: "Permanent Resident" },
              { value: "Student Visa", label: "Student Visa" },
              { value: "Other", label: "Other" },
            ],
            otherText: {
              field: "residence_status_other_text",
              requiredWhen: {
                field: "residence_status",
                operator: "equals",
                value: "Other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q7",
            field: "student_type",
            label: "What type of student are you?",
            input: "single_choice",
            options: [
              { value: "Domestic", label: "Domestic" },
              { value: "International", label: "International" },
            ],
            required: true,
          },
          {
            sourceId: "Q8",
            field: "total_years_education",
            label:
              "What is your total number of years of education (excluding Kindergarten)?",
            input: "slider",
            min: 0,
            max: 100,
            step: 1,
            required: true,
          },
          {
            sourceId: "Q9",
            field: "cumulative_gpa",
            label: "What is your cumulative GPA?",
            input: "slider",
            min: 0,
            max: 5,
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
            label: "What is/are your major(s)?",
            input: "text",
            required: true,
          },
          {
            sourceId: "Q27",
            field: "highest_education_completed",
            label: "What is the highest level of education you have completed?",
            input: "single_choice",
            options: [
              {
                value: "Elementary or middle school",
                label: "Elementary or middle school",
              },
              {
                value: "High school or equivalent (e.g., GED)",
                label: "High school or equivalent (e.g., GED)",
              },
              { value: "College diploma", label: "College diploma" },
              { value: "Bachelors degree", label: "Bachelors degree" },
              { value: "Masters degree", label: "Masters degree" },
              { value: "Doctorate degree", label: "Doctorate degree" },
            ],
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 3,
    title: "Language and ethnicity",
    panes: [
      {
        questions: [
          {
            sourceId: "Q11",
            field: "ethnicity",
            label: "What is your ethnicity? Please check all that apply.",
            input: "multi_select",
            options: [
              { value: "European Canadian", label: "European Canadian" },
              { value: "Chinese", label: "Chinese" },
              { value: "South Asian", label: "South Asian" },
              { value: "Filipino", label: "Filipino" },
              { value: "Southeast Asian", label: "Southeast Asian" },
              { value: "Japanese", label: "Japanese" },
              { value: "Latin American", label: "Latin American" },
              { value: "Korean", label: "Korean" },
              { value: "Other", label: "Other" },
            ],
            otherText: {
              field: "ethnicity_other_text",
              requiredWhen: {
                field: "ethnicity",
                operator: "includes",
                value: "Other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q12",
            field: "native_language",
            label: "What is your native language?",
            input: "text",
            required: true,
          },
          {
            sourceId: "Q13",
            field: "english_fluency",
            label: "I am fluent in English",
            input: "single_choice",
            options: [
              { value: "Strongly agree", label: "Strongly agree" },
              { value: "Agree", label: "Agree" },
              {
                value: "Neither agree nor disagree",
                label: "Neither agree nor disagree",
              },
              { value: "Disagree", label: "Disagree" },
              { value: "Strongly disagree", label: "Strongly disagree" },
            ],
            required: true,
          },
          {
            sourceId: "Q14",
            field: "fluent_languages",
            label:
              "In addition to English, which languages do you speak fluently? Please check all that apply.",
            input: "multi_select",
            options: [
              { value: "French", label: "French" },
              { value: "Mandarin", label: "Mandarin" },
              { value: "Cantonese", label: "Cantonese" },
              { value: "Hindi", label: "Hindi" },
              { value: "Punjabi", label: "Punjabi" },
              { value: "Korean", label: "Korean" },
              { value: "None", label: "None", exclusive: true },
              { value: "Other", label: "Other" },
            ],
            otherText: {
              field: "fluent_languages_other_text",
              requiredWhen: {
                field: "fluent_languages",
                operator: "includes",
                value: "Other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q15",
            field: "english_speaking_frequency",
            label: "In your everyday life, how often do you speak English?",
            input: "single_choice",
            options: [
              { value: "Always", label: "Always" },
              { value: "Often", label: "Often" },
              { value: "Sometimes", label: "Sometimes" },
              { value: "Rarely", label: "Rarely" },
              { value: "Never", label: "Never" },
            ],
            required: true,
          },
        ],
      },
      {
        questions: [
          {
            sourceId: "Q16",
            field: "non_english_schooling",
            label:
              "Have you attended school where the language of instruction was different from English?",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q17",
            field: "instruction_languages",
            label: "Which language(s) of instruction were used?",
            input: "multi_select",
            visibleWhen: {
              field: "non_english_schooling",
              operator: "equals",
              value: true,
            },
            options: [
              { value: "French", label: "French" },
              { value: "Mandarin", label: "Mandarin" },
              { value: "Cantonese", label: "Cantonese" },
              { value: "Hindi", label: "Hindi" },
              { value: "Punjabi", label: "Punjabi" },
              { value: "Korean", label: "Korean" },
              { value: "Other", label: "Other" },
            ],
            otherText: {
              field: "instruction_languages_other_text",
              requiredWhen: {
                field: "instruction_languages",
                operator: "includes",
                value: "Other",
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
    title: "Clinical history",
    panes: [
      {
        questions: [
          {
            sourceId: "Q18",
            field: "diagnosed_disorders",
            label:
              "Have you ever been diagnosed with any of the following disorders? Please check all that apply.",
            input: "multi_select",
            options: [
              {
                value: "Neurological Disorder",
                label: "Neurological Disorder",
              },
              {
                value: "Generalized Anxiety Disorder",
                label: "Generalized Anxiety Disorder",
              },
              { value: "Depression", label: "Depression" },
              { value: "Mood Disorder", label: "Mood Disorder" },
              {
                value: "Substance Use Disorder",
                label: "Substance Use Disorder",
              },
              { value: "Other", label: "Other" },
              { value: "N/A", label: "N/A", exclusive: true },
            ],
            otherText: {
              field: "diagnosed_disorders_other_text",
              requiredWhen: {
                field: "diagnosed_disorders",
                operator: "includes",
                value: "Other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q19",
            field: "adhd_diagnosis",
            label: "Have you ever been diagnosed with ADHD by a physician?",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q20",
            field: "adhd_medication",
            label:
              "Have you ever been prescribed medication by a physician for ADHD or to reduce ADHD symptoms?",
            input: "single_choice",
            options: [
              { value: "Yes", label: "Yes" },
              { value: "Maybe", label: "Maybe" },
              { value: "No", label: "No" },
            ],
            required: true,
          },
        ],
      },
    ],
  },
  {
    sourceBlock: 5,
    title: "Lifestyle and status",
    panes: [
      {
        questions: [
          {
            sourceId: "Q21",
            field: "avid_videogamer",
            label: "Do you consider yourself an avid videogamer?",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q28",
            field: "video_game_hours_per_week",
            label:
              "How many hours per week do you estimate you play video games?",
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
            label: "Do you take any prescription stimulants?",
            input: "boolean",
            ...YES_NO,
            required: true,
          },
          {
            sourceId: "Q23",
            field: "regular_substances",
            label:
              "Do you regularly use any of the following? Please check all that apply.",
            input: "multi_select",
            options: [
              { value: "Alcohol", label: "Alcohol" },
              { value: "Cannabis", label: "Cannabis" },
              { value: "Tobacco", label: "Tobacco" },
              { value: "Vaping", label: "Vaping" },
              {
                value: "Caffeinated Stimulants (coffee, energy drinks, etc.)",
                label: "Caffeinated Stimulants (coffee, energy drinks, etc.)",
              },
              { value: "Other", label: "Other" },
              {
                value: "None of the Above",
                label: "None of the Above",
                exclusive: true,
              },
            ],
            otherText: {
              field: "regular_substances_other_text",
              requiredWhen: {
                field: "regular_substances",
                operator: "includes",
                value: "Other",
              },
            },
            required: true,
          },
          {
            sourceId: "Q24",
            field: "relationship_status",
            label: "What is your relationship status?",
            input: "single_choice",
            options: [
              { value: "Single", label: "Single" },
              { value: "In a relationship", label: "In a relationship" },
              {
                value: "Married (and not separated)",
                label: "Married (and not separated)",
              },
              { value: "Common-law", label: "Common-law" },
              { value: "Seperated", label: "Seperated" },
              { value: "Divorced", label: "Divorced" },
              { value: "Widowed", label: "Widowed" },
              { value: "Other", label: "Other" },
              {
                value: "None of the Above",
                label: "None of the Above",
              },
            ],
            otherText: {
              field: "relationship_status_other_text",
              requiredWhen: {
                field: "relationship_status",
                operator: "equals",
                value: "Other",
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
            label: "What is your occupational status?",
            input: "single_choice",
            options: [
              { value: "Employed full-time", label: "Employed full-time" },
              { value: "Employed part-time", label: "Employed part-time" },
              {
                value: "Out of work but looking for work",
                label: "Out of work but looking for work",
              },
              {
                value: "Out of work and not looking for work",
                label: "Out of work and not looking for work",
              },
              { value: "Homemaker", label: "Homemaker" },
              { value: "Student", label: "Student" },
              { value: "Military", label: "Military" },
              { value: "Retired", label: "Retired" },
              { value: "Unable to work", label: "Unable to work" },
              { value: "Other", label: "Other" },
              { value: "None of the above", label: "None of the above" },
            ],
            otherText: {
              field: "occupational_status_other_text",
              requiredWhen: {
                field: "occupational_status",
                operator: "equals",
                value: "Other",
              },
            },
            required: true,
          },
        ],
      },
    ],
  },
] as const;

export function getMisokinesiaDemographicsPanes(): readonly MisoDemographicsPane[] {
  return MISO_DEMOGRAPHICS_BLOCKS.flatMap((block) => block.panes);
}
