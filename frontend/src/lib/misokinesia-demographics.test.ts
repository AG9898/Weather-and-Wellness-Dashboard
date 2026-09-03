import { describe, expect, it } from "vitest";
import { MISO_MESSAGES } from "@/lib/i18n";
import {
  MISO_DEMOGRAPHICS_BLOCKS,
  MISO_DEMOGRAPHICS_PAYLOAD_FIELDS,
  MISO_DEMOGRAPHICS_SPLIT_THRESHOLD,
  getMisoDemographicsOptionLabel,
  getMisoDemographicsOptions,
  getMisoDemographicsSliderMax,
  getMisokinesiaDemographicsBlockPanes,
  getMisokinesiaDemographicsPanes,
  type MisoDemographicsChoiceQuestion,
  type MisoDemographicsQuestion,
  type MisoDemographicsSliderQuestion,
} from "./misokinesia-demographics";

function allQuestions(): MisoDemographicsQuestion[] {
  return MISO_DEMOGRAPHICS_BLOCKS.flatMap((block) =>
    block.panes.flatMap((pane) => pane.questions)
  );
}

function questionByField(field: string): MisoDemographicsQuestion {
  const question = allQuestions().find((item) => item.field === field);
  if (!question) throw new Error(`no question for ${field}`);
  return question;
}

function choiceQuestion(field: string): MisoDemographicsChoiceQuestion {
  const question = questionByField(field);
  if (question.input !== "single_choice" && question.input !== "multi_select") {
    throw new Error(`${field} is not a choice question`);
  }
  return question;
}

function sliderQuestion(field: string): MisoDemographicsSliderQuestion {
  const question = questionByField(field);
  if (question.input !== "slider") throw new Error(`${field} is not a slider`);
  return question;
}

function collectQuestionFields(question: MisoDemographicsQuestion): string[] {
  const fields = [question.field];
  if ("otherText" in question && question.otherText) {
    fields.push(question.otherText.field);
  }
  return fields;
}

describe("misokinesia demographics config", () => {
  it("represents the five sourced DOCX blocks", () => {
    expect(MISO_DEMOGRAPHICS_BLOCKS.map((block) => block.sourceBlock)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("splits blocks from currently visible questions into near-equal panes", () => {
    expect(MISO_DEMOGRAPHICS_SPLIT_THRESHOLD).toBe(6);
    expect(getMisokinesiaDemographicsPanes().map((pane) => pane.questions.length)).toEqual([
      3, 3, 4, 3, 3, 3, 5,
    ]);

    expect(
      getMisokinesiaDemographicsPanes({
        non_english_schooling: true,
        avid_videogamer: true,
      }).map((pane) => pane.questions.length)
    ).toEqual([3, 3, 4, 3, 4, 3, 6]);
  });

  it("does not split blocks with fewer than six visible questions or the block 5 exception", () => {
    const lifestyleBlock = MISO_DEMOGRAPHICS_BLOCKS.find(
      (block) => block.sourceBlock === 5
    );

    expect(lifestyleBlock).toBeDefined();
    expect(
      lifestyleBlock
        ? getMisokinesiaDemographicsBlockPanes(lifestyleBlock).map(
            (pane) => pane.questions.length
          )
        : []
    ).toEqual([5]);
    expect(
      lifestyleBlock
        ? getMisokinesiaDemographicsBlockPanes(lifestyleBlock, {
            avid_videogamer: true,
          }).map((pane) => pane.questions.map((question) => question.field))
        : []
    ).toEqual([
      [
        "avid_videogamer",
        "video_game_hours_per_week",
        "prescription_stimulants",
        "regular_substances",
        "relationship_status",
        "occupational_status",
      ],
    ]);
  });

  it("covers every backend v2 payload field exactly once through questions or other text metadata", () => {
    const configuredFields = MISO_DEMOGRAPHICS_BLOCKS.flatMap((block) =>
      block.panes.flatMap((pane) => pane.questions.flatMap(collectQuestionFields))
    );

    expect(new Set(configuredFields)).toEqual(new Set(MISO_DEMOGRAPHICS_PAYLOAD_FIELDS));
    expect(configuredFields).toHaveLength(MISO_DEMOGRAPHICS_PAYLOAD_FIELDS.length);
  });

  it("captures conditional and exclusive-choice rules needed by the carousel UI", () => {
    const questions = MISO_DEMOGRAPHICS_BLOCKS.flatMap((block) =>
      block.panes.flatMap((pane) => pane.questions)
    );
    const byField = new Map(questions.map((question) => [question.field, question]));

    expect(byField.get("instruction_languages")?.visibleWhen).toEqual({
      field: "non_english_schooling",
      operator: "equals",
      value: true,
    });
    expect(byField.get("video_game_hours_per_week")?.visibleWhen).toEqual({
      field: "avid_videogamer",
      operator: "equals",
      value: true,
    });

    const fluentLanguages = byField.get("fluent_languages");
    const diagnosedDisorders = byField.get("diagnosed_disorders");
    const regularSubstances = byField.get("regular_substances");

    expect(
      fluentLanguages && "options" in fluentLanguages
        ? fluentLanguages.options.find((option) => option.key === "fluent_lang_none")
            ?.exclusive
        : false
    ).toBe(true);
    expect(
      diagnosedDisorders && "options" in diagnosedDisorders
        ? diagnosedDisorders.options.find((option) => option.key === "disorder_na")
            ?.exclusive
        : false
    ).toBe(true);
    expect(
      regularSubstances && "options" in regularSubstances
        ? regularSubstances.options.find((option) => option.key === "substance_none")
            ?.exclusive
        : false
    ).toBe(true);
  });
});

describe("misokinesia demographics locale behaviour", () => {
  it("resolves every question stem and block title through the catalogue", () => {
    for (const block of MISO_DEMOGRAPHICS_BLOCKS) {
      expect(MISO_MESSAGES.en[block.titleKey], block.titleKey).toBeTruthy();
      expect(MISO_MESSAGES.ko[block.titleKey], block.titleKey).toBeTruthy();
    }
    for (const question of allQuestions()) {
      expect(MISO_MESSAGES.en[question.labelKey], question.labelKey).toBeTruthy();
      expect(MISO_MESSAGES.ko[question.labelKey], question.labelKey).toBeTruthy();
    }
  });

  it("submits option keys, never display labels", () => {
    const residence = choiceQuestion("residence_status");
    expect(residence.options.map((option) => option.key)).toEqual([
      "residence_citizenship",
      "residence_permanent_resident",
      "residence_student_visa",
      "residence_other",
    ]);
    expect(getMisoDemographicsOptionLabel(residence, residence.options[0], "en")).toBe(
      "Canadian Citizenship"
    );
    expect(getMisoDemographicsOptionLabel(residence, residence.options[0], "ko")).toBe(
      "대한민국 국적"
    );
  });

  it("offers the korean-language option only in en and the english one only in ko", () => {
    for (const field of ["fluent_languages", "instruction_languages"] as const) {
      const question = choiceQuestion(field);
      const slug = field === "fluent_languages" ? "fluent_lang" : "instruction_lang";
      const enKeys = getMisoDemographicsOptions(question, "en").map((o) => o.key);
      const koKeys = getMisoDemographicsOptions(question, "ko").map((o) => o.key);

      expect(enKeys, field).toContain(`${slug}_korean`);
      expect(enKeys, field).not.toContain(`${slug}_english`);
      expect(koKeys, field).toContain(`${slug}_english`);
      expect(koKeys, field).not.toContain(`${slug}_korean`);
      // Divergent slot only: the two sets are otherwise identical, and the
      // divergent option holds the same position in both.
      expect(enKeys).toHaveLength(koKeys.length);
      expect(enKeys.indexOf(`${slug}_korean`)).toBe(koKeys.indexOf(`${slug}_english`));
    }
  });

  it("keeps Case A option sets identical across locales", () => {
    for (const field of ["sex", "ethnicity", "relationship_status"] as const) {
      const question = choiceQuestion(field);
      expect(
        getMisoDemographicsOptions(question, "en").map((o) => o.key),
        field
      ).toEqual(getMisoDemographicsOptions(question, "ko").map((o) => o.key));
    }
  });

  it("caps the GPA slider at 5.0 in en and 4.5 in ko", () => {
    const gpa = sliderQuestion("cumulative_gpa");
    expect(getMisoDemographicsSliderMax(gpa, "en")).toBe(5);
    expect(getMisoDemographicsSliderMax(gpa, "ko")).toBe(4.5);
    // 4.8 is inside the en range and outside the ko range.
    expect(4.8 <= getMisoDemographicsSliderMax(gpa, "en")).toBe(true);
    expect(4.8 <= getMisoDemographicsSliderMax(gpa, "ko")).toBe(false);
  });

  it("leaves every other slider bound locale-independent", () => {
    for (const question of allQuestions()) {
      if (question.input !== "slider" || question.field === "cumulative_gpa") continue;
      expect(getMisoDemographicsSliderMax(question, "ko"), question.field).toBe(
        getMisoDemographicsSliderMax(question, "en")
      );
    }
  });

  it("asks about Korea in ko while still writing years_lived_canada", () => {
    const years = sliderQuestion("years_lived_canada");
    expect(years.field).toBe("years_lived_canada");
    expect(MISO_MESSAGES.en[years.labelKey]).toContain("Canada");
    expect(MISO_MESSAGES.ko[years.labelKey]).toContain("한국");
  });

  it("gates other-text on option keys rather than the string Other", () => {
    const expected: Record<string, string> = {
      residence_status: "residence_other",
      ethnicity: "ethnicity_other",
      fluent_languages: "fluent_lang_other",
      instruction_languages: "instruction_lang_other",
      diagnosed_disorders: "disorder_other",
      regular_substances: "substance_other",
      relationship_status: "relationship_other",
      occupational_status: "occupation_other",
    };
    for (const [field, otherKey] of Object.entries(expected)) {
      const question = choiceQuestion(field);
      expect(question.otherText?.requiredWhen.value, field).toBe(otherKey);
    }
  });
});
