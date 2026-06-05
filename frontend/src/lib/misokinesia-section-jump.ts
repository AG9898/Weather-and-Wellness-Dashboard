import type { PostSurveyKey } from "@/lib/misokinesia-phase";

export type MisokinesiaSectionTarget =
  | "intro"
  | "clips"
  | "mkaq"
  | "gad7"
  | "maq"
  | "end"
  | "done";

export type MisokinesiaSectionJumpPhase =
  | "intro"
  | "pre_play"
  | PostSurveyKey
  | "end_of_task"
  | "complete";

export interface MisokinesiaSectionJumpSection {
  target: MisokinesiaSectionTarget;
  label: string;
}

export interface MisokinesiaSectionJumpState {
  phase: MisokinesiaSectionJumpPhase;
  currentClipIndex?: number;
  surveyIndex?: number;
}

export const MISOKINESIA_SECTION_JUMP_SECTIONS: readonly MisokinesiaSectionJumpSection[] =
  [
    { target: "intro", label: "Intro" },
    { target: "clips", label: "Clips" },
    { target: "mkaq", label: "MkAQ" },
    { target: "gad7", label: "GAD-7" },
    { target: "maq", label: "MAQ" },
    { target: "end", label: "End" },
    { target: "done", label: "Done" },
  ] as const;

export function getMisokinesiaSectionJumpState(
  target: MisokinesiaSectionTarget,
  surveyOrder: readonly PostSurveyKey[]
): MisokinesiaSectionJumpState {
  switch (target) {
    case "intro":
      return { phase: "intro" };
    case "clips":
      return { phase: "pre_play", currentClipIndex: 0 };
    case "end":
      return { phase: "end_of_task" };
    case "done":
      return { phase: "complete" };
    case "mkaq":
    case "gad7":
    case "maq": {
      const surveyIndex = surveyOrder.indexOf(target);
      if (surveyIndex < 0) {
        throw new Error(`Survey target "${target}" is missing from surveyOrder.`);
      }

      return { phase: target, surveyIndex };
    }
  }

  target satisfies never;
  throw new Error(`Unsupported misokinesia section target: ${target}`);
}
