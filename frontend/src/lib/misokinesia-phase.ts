export type PostSurveyKey = "mkaq" | "gad7" | "maq";

export type TransitionCardPhase =
  | "transition_mkaq"
  | "transition_gad7"
  | "transition_maq";

export function getTransitionPhase(key: PostSurveyKey): TransitionCardPhase {
  return `transition_${key}` as TransitionCardPhase;
}

export function getSurveyPhaseFromTransition(
  transition: TransitionCardPhase
): PostSurveyKey {
  return transition.replace("transition_", "") as PostSurveyKey;
}

export function getPhaseAfterBegin(): "pre_play" {
  return "pre_play";
}

export function getPhaseAfterVideoComplete(
  order: PostSurveyKey[]
): TransitionCardPhase {
  const first = order[0] ?? "mkaq";
  return getTransitionPhase(first);
}

export function getNextPostSurveyPhase(
  order: PostSurveyKey[],
  completedIndex: number
): TransitionCardPhase | "end_of_task" {
  const next = order[completedIndex + 1];
  if (!next) return "end_of_task";
  return getTransitionPhase(next);
}

export function getPhaseAfterQuestionnaireComplete(
  isComplete: boolean,
  _postSurveyOrder?: string
): "mkaq" | "playing" {
  void _postSurveyOrder;
  return isComplete ? "mkaq" : "playing";
}

export function getPhaseAfterMkaqComplete(): "end_of_task" {
  return "end_of_task";
}
