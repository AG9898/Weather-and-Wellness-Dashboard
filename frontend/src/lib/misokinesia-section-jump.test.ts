import { describe, expect, it } from "vitest";

import {
  MISOKINESIA_SECTION_JUMP_TARGETS,
  getMisokinesiaSectionJumpState,
  misokinesiaSectionJumpSections,
} from "@/lib/misokinesia-section-jump";
import type { PostSurveyKey } from "@/lib/misokinesia-phase";
import { MISO_MESSAGES } from "@/lib/i18n";

const DEFAULT_SURVEY_ORDER: PostSurveyKey[] = ["mkaq", "gad7", "maq"];

describe("misokinesia section jump helper", () => {
  it("keeps the jump targets in the order the design spec lists them", () => {
    expect(MISOKINESIA_SECTION_JUMP_TARGETS).toEqual([
      "intro",
      "clips",
      "mkaq",
      "gad7",
      "maq",
      "end",
      "done",
    ]);
  });

  it("builds the English section labels from the catalogue", () => {
    expect(misokinesiaSectionJumpSections("en")).toEqual([
      { target: "intro", label: "Intro" },
      { target: "clips", label: "Clips" },
      { target: "mkaq", label: "MkAQ" },
      { target: "gad7", label: "GAD-7" },
      { target: "maq", label: "MAQ" },
      { target: "end", label: "End" },
      { target: "done", label: "Done" },
    ]);
  });

  it("follows session locale, keeping instrument acronyms untranslated", () => {
    expect(misokinesiaSectionJumpSections("ko")).toEqual([
      { target: "intro", label: MISO_MESSAGES.ko["chrome.jumper.intro"] },
      { target: "clips", label: MISO_MESSAGES.ko["chrome.jumper.clips"] },
      { target: "mkaq", label: "MkAQ" },
      { target: "gad7", label: "GAD-7" },
      { target: "maq", label: "MAQ" },
      { target: "end", label: MISO_MESSAGES.ko["chrome.jumper.end"] },
      { target: "done", label: MISO_MESSAGES.ko["chrome.jumper.done"] },
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
