import type {
  PoffenbergerBlockManifest,
  PoffenbergerManifest,
  PoffenbergerSubmittedTrial,
} from "@/lib/api";
import { isTrialRunId, type TrialRunPoffenbergerState } from "@/lib/trial-mode";

export const POFFENBERGER_RESPONSE_CUTOFF_MS = 2000;
export const POFFENBERGER_RUN_STORAGE_KEY = "ihtt:poffenberger:run";

export interface PoffenbergerStoredRun {
  flow: "ihtt-poffenberger";
  mode: "production";
  run_id: string;
  session_id: string;
  participant_uuid: string;
  start_path: string;
  manifest: PoffenbergerManifest;
  created_at: string;
}

export type PoffenbergerRunState = PoffenbergerStoredRun | TrialRunPoffenbergerState;

export interface PoffenbergerTaskTrial {
  phase: "practice" | "experimental";
  block_number: number;
  trial_number: number;
  global_trial_number: number;
  response_hand: "left" | "right";
  visual_field: "lvf" | "rvf";
  expected_key: "f" | "j";
  jitter_ms: number;
  is_practice: boolean;
}

export interface PoffenbergerTrialTiming {
  client_trial_started_at_ms: number;
  client_stimulus_onset_ms: number;
  client_response_at_ms: number | null;
  client_trial_ended_at_ms: number;
}

export function persistPoffenbergerRunState(state: PoffenbergerStoredRun): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(POFFENBERGER_RUN_STORAGE_KEY, JSON.stringify(state));
}

export function readPoffenbergerRunState(runId: string): PoffenbergerStoredRun | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(POFFENBERGER_RUN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPoffenbergerStoredRun(parsed)) return null;
    return parsed.run_id === runId ? parsed : null;
  } catch {
    return null;
  }
}

export function isPoffenbergerTrialRunState(
  value: unknown,
  runId?: string
): value is TrialRunPoffenbergerState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrialRunPoffenbergerState>;
  if (candidate.mode !== "trial" || candidate.flow !== "ihtt-poffenberger") return false;
  if (runId && candidate.run_id !== runId) return false;
  return Boolean(
    candidate.run_id &&
      isTrialRunId(candidate.run_id) &&
      candidate.session_id &&
      isTrialRunId(candidate.session_id) &&
      candidate.participant_uuid &&
      isTrialRunId(candidate.participant_uuid) &&
      candidate.manifest
  );
}

export function flattenPoffenbergerManifest(
  manifest: PoffenbergerManifest
): PoffenbergerTaskTrial[] {
  const practiceTrials = manifest.practice_trials.map((trial) => ({
    phase: "practice" as const,
    block_number: 0,
    trial_number: trial.trial_number,
    global_trial_number: trial.trial_number,
    response_hand: trial.response_hand,
    visual_field: trial.visual_field,
    expected_key: trial.expected_key,
    jitter_ms: trial.jitter_ms,
    is_practice: true,
  }));

  const practiceCount = manifest.practice_trials.length;
  const experimentalTrials = manifest.blocks.flatMap((block) =>
    flattenPoffenbergerBlock(block, practiceCount)
  );

  return [...practiceTrials, ...experimentalTrials];
}

export function isExpectedPoffenbergerKey(key: string, expectedKey: string): boolean {
  return normalizePoffenbergerKey(key) === expectedKey;
}

export function createPoffenbergerSubmittedTrial(
  trial: PoffenbergerTaskTrial,
  timing: PoffenbergerTrialTiming,
  pressedKey: string | null
): PoffenbergerSubmittedTrial {
  const normalizedKey = pressedKey ? normalizePoffenbergerKey(pressedKey) : null;
  const reactionTime =
    normalizedKey && timing.client_response_at_ms !== null
      ? Math.max(1, Math.round(timing.client_response_at_ms - timing.client_stimulus_onset_ms))
      : null;

  return {
    block_number: trial.block_number,
    trial_number: trial.trial_number,
    global_trial_number: trial.global_trial_number,
    response_hand: trial.response_hand,
    visual_field: trial.visual_field,
    expected_key: trial.expected_key,
    pressed_key: normalizedKey,
    reaction_time_ms: reactionTime,
    is_timeout: reactionTime === null || reactionTime > POFFENBERGER_RESPONSE_CUTOFF_MS,
    is_practice: trial.is_practice,
    client_trial_started_at_ms: timing.client_trial_started_at_ms,
    client_stimulus_onset_ms: timing.client_stimulus_onset_ms,
    client_response_at_ms: timing.client_response_at_ms,
    client_trial_ended_at_ms: timing.client_trial_ended_at_ms,
  };
}

export function buildPoffenbergerSubmitPayload(
  state: PoffenbergerRunState,
  trials: PoffenbergerSubmittedTrial[]
) {
  return {
    run_id: state.run_id,
    session_id: state.session_id,
    trials,
  };
}

function flattenPoffenbergerBlock(
  block: PoffenbergerBlockManifest,
  practiceCount: number
): PoffenbergerTaskTrial[] {
  return block.trials.map((trial) => ({
    phase: "experimental" as const,
    block_number: block.block_number,
    trial_number: trial.trial_number,
    global_trial_number: practiceCount + trial.global_trial_number,
    response_hand: block.response_hand,
    visual_field: trial.visual_field,
    expected_key: block.expected_key,
    jitter_ms: trial.jitter_ms,
    is_practice: false,
  }));
}

function normalizePoffenbergerKey(key: string): string {
  return key.trim().toLowerCase();
}

function isPoffenbergerStoredRun(value: unknown): value is PoffenbergerStoredRun {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PoffenbergerStoredRun>;
  return Boolean(
    candidate.flow === "ihtt-poffenberger" &&
      candidate.mode === "production" &&
      candidate.run_id &&
      candidate.session_id &&
      candidate.participant_uuid &&
      candidate.start_path &&
      candidate.manifest
  );
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
