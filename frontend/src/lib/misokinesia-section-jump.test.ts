import { describe, expect, it } from "vitest";

import {
  MISOKINESIA_SECTION_JUMP_SECTIONS,
  getMisokinesiaSectionJumpState,
} from "@/lib/misokinesia-section-jump";
import type { PostSurveyKey } from "@/lib/misokinesia-phase";

const DEFAULT_SURVEY_ORDER: PostSurveyKey[] = ["mkaq", "gad7", "maq"];

describe("misokinesia section jump helper", () => {
  it("exports the ordered trial section labels from the design spec", () => {
    expect(MISOKINESIA_SECTION_JUMP_SECTIONS).toEqual([
      { target: "intro", label: "Intro" },
      { target: "clips", label: "Clips" },
      { target: "mkaq", label: "MkAQ" },
      { target: "gad7", label: "GAD-7" },
      { target: "maq", label: "MAQ" },
      { target: "end", label: "End" },
      { target: "done", label: "Done" },
    ]);
  });

  it("maps intro, end, and done targets to their render phases", () => {
    expect(getMisokinesiaSectionJumpState("intro", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "intro",
    });
    expect(getMisokinesiaSectionJumpState("end", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "end_of_task",
    });
    expect(getMisokinesiaSectionJumpState("done", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "complete",
    });
  });

  it("maps the clips target to the first pre-play clip", () => {
    expect(getMisokinesiaSectionJumpState("clips", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "pre_play",
      currentClipIndex: 0,
    });
  });

  it("maps survey targets to the matching default survey order index", () => {
    expect(getMisokinesiaSectionJumpState("mkaq", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "mkaq",
      surveyIndex: 0,
    });
    expect(getMisokinesiaSectionJumpState("gad7", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "gad7",
      surveyIndex: 1,
    });
    expect(getMisokinesiaSectionJumpState("maq", DEFAULT_SURVEY_ORDER)).toEqual({
      phase: "maq",
      surveyIndex: 2,
    });
  });

  it("derives survey indexes from a non-default survey order", () => {
    const surveyOrder: PostSurveyKey[] = ["gad7", "maq", "mkaq"];

    expect(getMisokinesiaSectionJumpState("gad7", surveyOrder)).toEqual({
      phase: "gad7",
      surveyIndex: 0,
    });
    expect(getMisokinesiaSectionJumpState("maq", surveyOrder)).toEqual({
      phase: "maq",
      surveyIndex: 1,
    });
    expect(getMisokinesiaSectionJumpState("mkaq", surveyOrder)).toEqual({
      phase: "mkaq",
      surveyIndex: 2,
    });
  });

  it("fails when a survey target is absent from the provided order", () => {
    expect(() => getMisokinesiaSectionJumpState("maq", ["mkaq", "gad7"])).toThrow(
      'Survey target "maq" is missing from surveyOrder.'
    );
  });
});
