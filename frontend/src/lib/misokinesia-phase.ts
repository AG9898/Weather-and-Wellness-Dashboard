export type PostSurveyKey = "mkaq" | "gad7" | "maq";

export function getPhaseAfterBegin(): "playing" {
  return "playing";
}

export function getPhaseAfterVideoComplete(order: PostSurveyKey[]): PostSurveyKey {
  return order[0] ?? "mkaq";
}

export function getNextPostSurveyPhase(
  order: PostSurveyKey[],
  completedIndex: number
): PostSurveyKey | "end_of_task" {
  return order[completedIndex + 1] ?? "end_of_task";
}

export function getPhaseAfterQuestionnaireComplete(
  isComplete: boolean,
  _postSurveyOrder?: string
): "mkaq" | "playing" {
  return isComplete ? "mkaq" : "playing";
}

export function getPhaseAfterMkaqComplete(): "end_of_task" {
  return "end_of_task";
}
