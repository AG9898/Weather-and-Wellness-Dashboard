export type MisokinesiaMkaqAdministration = "pre" | "post";

export function getPhaseAfterBegin(
  mkaqAdministration: MisokinesiaMkaqAdministration | undefined
): "mkaq" | "playing" {
  return mkaqAdministration === "pre" ? "mkaq" : "playing";
}

export function getPhaseAfterQuestionnaireComplete(
  isComplete: boolean,
  mkaqAdministration: MisokinesiaMkaqAdministration | undefined
): "mkaq" | "playing" | "end_of_task" {
  if (!isComplete) {
    return "playing";
  }
  return mkaqAdministration === "post" ? "mkaq" : "end_of_task";
}

export function getPhaseAfterMkaqComplete(
  mkaqAdministration: MisokinesiaMkaqAdministration | undefined
): "playing" | "end_of_task" {
  return mkaqAdministration === "pre" ? "playing" : "end_of_task";
}
