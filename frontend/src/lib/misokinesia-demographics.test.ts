import { describe, expect, it } from "vitest";
import {
  MISO_DEMOGRAPHICS_BLOCKS,
  MISO_DEMOGRAPHICS_MAX_QUESTIONS_PER_PANE,
  MISO_DEMOGRAPHICS_PAYLOAD_FIELDS,
  getMisokinesiaDemographicsPanes,
  type MisoDemographicsQuestion,
} from "./misokinesia-demographics";

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

  it("keeps each carousel pane at or below the five-question limit", () => {
    for (const pane of getMisokinesiaDemographicsPanes()) {
      expect(pane.questions.length).toBeGreaterThan(0);
      expect(pane.questions.length).toBeLessThanOrEqual(
        MISO_DEMOGRAPHICS_MAX_QUESTIONS_PER_PANE
      );
    }
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
        ? fluentLanguages.options.find((option) => option.value === "None")?.exclusive
        : false
    ).toBe(true);
    expect(
      diagnosedDisorders && "options" in diagnosedDisorders
        ? diagnosedDisorders.options.find((option) => option.value === "N/A")?.exclusive
        : false
    ).toBe(true);
    expect(
      regularSubstances && "options" in regularSubstances
        ? regularSubstances.options.find((option) => option.value === "None of the Above")
            ?.exclusive
        : false
    ).toBe(true);
  });
});
