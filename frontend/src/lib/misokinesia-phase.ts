export function getPhaseAfterBegin(): "playing" {
  return "playing";
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
