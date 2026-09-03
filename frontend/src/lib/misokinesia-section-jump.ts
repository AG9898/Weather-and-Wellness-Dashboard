import type { PostSurveyKey } from "@/lib/misokinesia-phase";
import { misoMessage, type MisoLocale, type MisoMessageKey } from "@/lib/i18n";

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

/**
 * Jump targets in the order the jumper renders them. Labels are not baked in:
 * they come from the catalogue via `misokinesiaSectionJumpSections`, so the
 * jumper holds no inline string.
 */
export const MISOKINESIA_SECTION_JUMP_TARGETS: readonly MisokinesiaSectionTarget[] =
  ["intro", "clips", "mkaq", "gad7", "maq", "end", "done"] as const;

const SECTION_LABEL_KEYS: Readonly<
  Record<MisokinesiaSectionTarget, MisoMessageKey>
> = {
  intro: "chrome.jumper.intro",
  clips: "chrome.jumper.clips",
  mkaq: "chrome.jumper.mkaq",
  gad7: "chrome.jumper.gad7",
  maq: "chrome.jumper.maq",
  end: "chrome.jumper.end",
  done: "chrome.jumper.done",
};

/**
 * Ordered jumper sections with labels resolved for `locale`.
 *
 * The jumper is trial-only, so a KO run is a rehearsal an RA is driving; the
 * labels follow session locale anyway rather than stranding one English strip
 * inside an otherwise Korean flow.
 */
export function misokinesiaSectionJumpSections(
  locale: MisoLocale
): readonly MisokinesiaSectionJumpSection[] {
  return MISOKINESIA_SECTION_JUMP_TARGETS.map((target) => ({
    target,
    label: misoMessage(SECTION_LABEL_KEYS[target], locale),
  }));
}

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
