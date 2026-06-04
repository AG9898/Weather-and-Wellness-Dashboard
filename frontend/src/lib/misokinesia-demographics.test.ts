import { describe, expect, it } from "vitest";
import {
  MISO_DEMOGRAPHICS_BLOCKS,
  MISO_DEMOGRAPHICS_PAYLOAD_FIELDS,
  MISO_DEMOGRAPHICS_SPLIT_THRESHOLD,
  getMisokinesiaDemographicsBlockPanes,
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
