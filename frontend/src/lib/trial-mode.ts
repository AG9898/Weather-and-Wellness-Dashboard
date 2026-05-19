import type { PostSurveyKey } from "@/lib/misokinesia-phase";

export const TRIAL_RUN_QUERY_PARAM = "trial";
export const TRIAL_RUN_QUERY_VALUE = "1";
export const TRIAL_RUN_STORAGE_KEY = "ww:trial-run";
export const TRIAL_RUN_ID_PREFIX = "trial-local";

export type TrialRunFlow = "weather-wellness" | "misokinesia";
export type TrialSubmitMode = "production" | "trial";
export type MisokinesiaTrialMode = "short" | "full";

export interface TrialRunState {
  mode: "trial";
  flow: TrialRunFlow;
  misokinesia_trial_mode?: MisokinesiaTrialMode;
  session_id?: string;
  misokinesia_participant_id?: string;
  created_at: string;
}

export interface TrialRunMisokinesiaClip {
  stimulus_id: string;
  public_url: string;
  sort_order: number;
  duration_ms: number;
}

export const TRIAL_MKAQ_ITEM_COUNT = 10;
export const TRIAL_MAQ_ITEM_COUNT = 10;

export interface TrialRunMisokinesiaManifest {
  misokinesia_participant_id: string;
  misokinesia_participant_number: number;
  session_id: string;
  trial_mode?: MisokinesiaTrialMode;
  post_survey_order: string;
  clips: TrialRunMisokinesiaClip[];
}

interface TrialRunLocation {
  pathname: string;
  search: string;
}

/**
 * Trial mode is a frontend-only rehearsal signal. Launch pages should create a
 * fake id, persist the matching TrialRunState, then navigate with ?trial=1 so
 * participant pages can recover the signal after route transitions.
 */
export function createTrialRunState(
  flow: TrialRunFlow,
  misokinesiaTrialMode: MisokinesiaTrialMode = "short"
): TrialRunState {
  const createdAt = new Date().toISOString();
  if (flow === "misokinesia") {
    return {
      mode: "trial",
      flow,
      misokinesia_trial_mode: misokinesiaTrialMode,
      session_id: createTrialRunSessionId(),
      misokinesia_participant_id: createTrialRunMisokinesiaParticipantId(),
      created_at: createdAt,
    };
  }

  return {
    mode: "trial",
    flow,
    session_id: createTrialRunSessionId(),
    created_at: createdAt,
  };
}

export function createTrialRunSessionId(): string {
  return createTrialRunId("session");
}

export function createTrialRunMisokinesiaParticipantId(): string {
  return createTrialRunId("misokinesia-participant");
}

export function isTrialRunId(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(`${TRIAL_RUN_ID_PREFIX}-`);
}

export function buildTrialRunPath(pathname: string): string {
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}${TRIAL_RUN_QUERY_PARAM}=${TRIAL_RUN_QUERY_VALUE}`;
}

export function persistTrialRunState(state: TrialRunState): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(TRIAL_RUN_STORAGE_KEY, JSON.stringify(state));
}

export function readTrialRunState(): TrialRunState | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(TRIAL_RUN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isTrialRunState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearTrialRunState(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(TRIAL_RUN_STORAGE_KEY);
}

export function createTrialRunMisokinesiaManifest(
  state: TrialRunState,
  clips: TrialRunMisokinesiaClip[],
  mode: MisokinesiaTrialMode = state.misokinesia_trial_mode ?? "short"
): TrialRunMisokinesiaManifest {
  if (state.flow !== "misokinesia" || !state.session_id || !state.misokinesia_participant_id) {
    throw new Error("Misokinesia trial mode requires fake session and participant ids.");
  }
  const postSurveyOrder = createTrialSurveyOrder();

  return {
    misokinesia_participant_id: state.misokinesia_participant_id,
    misokinesia_participant_number: 0,
    session_id: state.session_id,
    trial_mode: mode,
    post_survey_order: postSurveyOrder.join(","),
    clips: clips.map((clip) => ({ ...clip })),
  };
}

export function createTrialSurveyOrder(): PostSurveyKey[] {
  const order: PostSurveyKey[] = ["mkaq", "gad7", "maq"];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function getWeatherWellnessSubmitMode(sessionId: string): TrialSubmitMode {
  return isTrialRunId(sessionId) ? "trial" : "production";
}

export function getMisokinesiaSubmitMode(trialMode: boolean): TrialSubmitMode {
  return trialMode ? "trial" : "production";
}

export async function runTrialAwareSubmit<T>(
  mode: TrialSubmitMode,
  handlers: {
    production: () => T | Promise<T>;
    trial: () => T | Promise<T>;
  }
): Promise<T> {
  return mode === "trial" ? handlers.trial() : handlers.production();
}

export function getTrialRunWatermarkLabel(active: boolean): "Trial Run" | null {
  return active ? "Trial Run" : null;
}

export function isTrialRunActiveForLocation(location: TrialRunLocation): boolean {
  const state = readTrialRunState();
  const queryActive = hasTrialRunQuery(location.search);
  const routeId = readTrialRunIdFromPath(location.pathname);

  if (queryActive && routeId && isTrialRunId(routeId)) {
    return true;
  }

  if (!state || !routeId) {
    return false;
  }

  return state.session_id === routeId || state.misokinesia_participant_id === routeId;
}

export function adoptTrialRunStateFromLocation(location: TrialRunLocation): TrialRunState | null {
  if (!hasTrialRunQuery(location.search)) {
    return readTrialRunState();
  }

  const routeId = readTrialRunIdFromPath(location.pathname);
  if (!isTrialRunId(routeId)) {
    return readTrialRunState();
  }

  const existing = readTrialRunState();
  if (existing?.session_id === routeId || existing?.misokinesia_participant_id === routeId) {
    return existing;
  }

  const flow: TrialRunFlow = location.pathname.startsWith("/misokinesia/")
    ? "misokinesia"
    : "weather-wellness";
  const state: TrialRunState =
    flow === "misokinesia"
      ? {
          mode: "trial",
          flow,
          misokinesia_trial_mode: "short",
          session_id: createTrialRunSessionId(),
          misokinesia_participant_id: routeId,
          created_at: new Date().toISOString(),
        }
      : {
          mode: "trial",
          flow,
          session_id: routeId,
          created_at: new Date().toISOString(),
        };

  persistTrialRunState(state);
  return state;
}

function createTrialRunId(scope: string): string {
  return `${TRIAL_RUN_ID_PREFIX}-${scope}-${randomIdPart()}`;
}

function randomIdPart(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function hasTrialRunQuery(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get(TRIAL_RUN_QUERY_PARAM) === TRIAL_RUN_QUERY_VALUE;
}

function readTrialRunIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "session" && parts[1]) {
    return parts[1];
  }
  if (parts[0] === "misokinesia" && parts[1]) {
    return parts[1];
  }
  return null;
}

function isTrialRunState(value: unknown): value is TrialRunState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrialRunState>;
  if (candidate.mode !== "trial") return false;
  if (candidate.flow !== "weather-wellness" && candidate.flow !== "misokinesia") return false;
  if (
    candidate.misokinesia_trial_mode !== undefined &&
    candidate.misokinesia_trial_mode !== "short" &&
    candidate.misokinesia_trial_mode !== "full"
  ) {
    return false;
  }
  if (typeof candidate.created_at !== "string") return false;
  if (candidate.session_id !== undefined && !isTrialRunId(candidate.session_id)) return false;
  if (
    candidate.misokinesia_participant_id !== undefined &&
    !isTrialRunId(candidate.misokinesia_participant_id)
  ) {
    return false;
  }
  return Boolean(candidate.session_id || candidate.misokinesia_participant_id);
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
