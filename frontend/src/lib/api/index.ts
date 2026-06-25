/**
 * Typed API wrapper for backend communication.
 * All component/page API calls must go through these functions.
 */

import { supabase } from "@/lib/supabase";
import type { PostSurveyKey } from "@/lib/misokinesia-phase";
import type { MisokinesiaTrialMode } from "@/lib/trial-mode";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Get the Supabase access token from the current session. */
async function getAuthToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (error.message.toLowerCase().includes("refresh token")) {
      await supabase.auth.signOut({ scope: "local" });
    }
    return null;
  }
  return data.session?.access_token ?? null;
}

/** Build headers, optionally including Authorization. */
async function buildHeaders(auth: boolean): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

/** Generic typed GET request. */
export async function apiGet<T>(
  path: string,
  options?: { auth?: boolean }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: await buildHeaders(options?.auth ?? false),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Generic typed POST request. */
export async function apiPost<T>(
  path: string,
  data: unknown,
  options?: { auth?: boolean }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: await buildHeaders(options?.auth ?? false),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Generic typed DELETE request (with optional JSON body). */
export async function apiDelete<T>(
  path: string,
  data?: unknown,
  options?: { auth?: boolean }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: await buildHeaders(options?.auth ?? false),
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Generic typed PATCH request. */
export async function apiPatch<T>(
  path: string,
  data: unknown,
  options?: { auth?: boolean }
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: await buildHeaders(options?.auth ?? false),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Structured API error with status code. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Map an unknown thrown value to a participant-facing, non-technical error message.
 * Use this in all participant submit handlers.
 */
export function getParticipantErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      return "A server error occurred. Please try again or ask the research assistant for help.";
    }
    if (err.status === 400 || err.status === 409) {
      return "Your session is not in the expected state. Please ask the research assistant for help.";
    }
    if (err.status === 404) {
      return "Your session could not be found. Please ask the research assistant for help.";
    }
    return "Something went wrong. Please try again or ask the research assistant for help.";
  }
  // Network error (fetch() threw — no response received)
  return "Unable to connect to the server. Please check your connection and try again.";
}

// ── Domain-specific types ──

export interface ParticipantResponse {
  participant_uuid: string;
  participant_number: number;
  created_at: string;
  // Phase 3 demographic / exposure fields (nullable)
  age_band: string | null;
  gender: string | null;
  handedness: string | null;
  origin: string | null;
  origin_other_text: string | null;
  commute_method: string | null;
  commute_method_other_text: string | null;
  time_outside: string | null;
  daylight_exposure_minutes: number | null;
}

export interface SessionResponse {
  session_id: string;
  participant_uuid: string;
  status: "created" | "active" | "complete";
  created_at: string;
  completed_at: string | null;
}

export interface DigitSpanRunResponse {
  run_id: string;
  total_correct: number;
  max_span: number;
}

/** Response from POST /stroop/runs. Run-level scoring is computed server-side. */
export interface StroopRunResponse {
  run_id: string;
  total_trials: number;
  correct_trials: number;
  error_trials: number;
  timeout_trials: number;
  overall_accuracy: number;
  congruent_accuracy: number | null;
  incongruent_accuracy: number | null;
  mean_rt_congruent_ms: number | null;
  mean_rt_incongruent_ms: number | null;
  stroop_interference_ms: number | null;
}

/** Response from POST /card-sorting/runs. Run-level scoring is computed server-side. */
export interface CardSortingRunResponse {
  run_id: string;
  total_trials: number;
  categories_completed: number;
  total_correct: number;
  total_errors: number;
  perseverative_responses: number;
  perseverative_errors: number;
  nonperseverative_errors: number;
  trials_to_first_category: number | null;
  failure_to_maintain_set_count: number;
}

/** One scored card sorting trial submitted to POST /card-sorting/runs. */
export interface CardSortingTrialInput {
  trial_number: number;
  card_color: string;
  card_shape: string;
  card_number: number;
  selected_reference_index: number;
  reaction_time_ms: number;
}

export interface ULS8Response {
  response_id: string;
  computed_mean: number;
  score_0_100: number;
}

export interface CESD10Response {
  response_id: string;
  total_score: number;
}

export interface GAD7Response {
  response_id: string;
  total_score: number;
  severity_band: string;
}

export interface CogFunc8aResponse {
  response_id: string;
  total_sum: number;
  mean_score: number;
}

export type AnalyticsDirection = "positive" | "negative" | "neutral";
export type AnalyticsOutcome = "digit_span" | "self_report";
export type AnalyticsReadMode = "snapshot" | "live";
export type AnalyticsStatus =
  | "ready"
  | "stale"
  | "recomputing"
  | "insufficient_data"
  | "failed";
export type AnalyticsTemperatureSummaryWindowKey =
  | "overall"
  | "fall_winter"
  | "spring_summer";

export interface AnalyticsExclusionReasonResponse {
  reason: string;
  count: number;
}

export interface AnalyticsDatasetMetadataResponse {
  date_from: string;
  date_to: string;
  included_sessions: number;
  included_days: number;
  native_rows: number;
  imported_rows: number;
  excluded_rows: number;
  exclusion_reasons: AnalyticsExclusionReasonResponse[];
  generated_at: string;
}

export interface AnalyticsSnapshotMetadataResponse {
  mode: AnalyticsReadMode;
  response_version: string;
  model_version: string;
  generated_at: string;
  is_stale: boolean;
  recompute_started_at: string | null;
  recompute_finished_at: string | null;
}

export interface AnalyticsEffectCardResponse {
  term: string;
  predictor: string;
  is_interaction: boolean;
  coefficient: number;
  standard_error: number;
  statistic: number;
  p_value: number;
  ci_95_low: number;
  ci_95_high: number;
  direction: AnalyticsDirection;
  significant: boolean;
}

export interface AnalyticsModelSummaryResponse {
  outcome: AnalyticsOutcome;
  formula: string;
  grouping_field: string;
  sample_size: number;
  day_count: number;
  converged: boolean;
  warnings: string[];
  model_version: string;
  generated_at: string;
  effects: AnalyticsEffectCardResponse[];
}

export interface AnalyticsTemperatureSummaryParticipantSessionResponse {
  participant_uuid: string;
  participant_number: number;
  session_id: string;
  date_local: string;
}

export interface AnalyticsTemperatureSummaryFrequencyBinResponse {
  bin_start_c: number;
  bin_end_c: number;
  day_count: number;
  participant_sessions?: AnalyticsTemperatureSummaryParticipantSessionResponse[];
}

export interface AnalyticsTemperatureSummaryDayResponse {
  date_local: string;
  temperature_c: number;
  temperature_z: number;
  participant_ids: string[];
  participant_count: number;
}

export interface AnalyticsTemperatureSummaryGroupResponse {
  day_count: number;
  participant_count: number;
  participant_ids: string[];
  dates: string[];
  days: AnalyticsTemperatureSummaryDayResponse[];
}

export interface AnalyticsTemperatureSummaryWindowResponse {
  window_key: AnalyticsTemperatureSummaryWindowKey;
  date_from: string | null;
  date_to: string | null;
  day_count: number;
  participant_count: number;
  mean_temperature_c: number | null;
  sd_temperature_c: number | null;
  cold_threshold_temperature_c?: number | null;
  hot_threshold_temperature_c?: number | null;
  threshold_method?: "window_day_zscore_v1";
  threshold_z_cutoff?: number | null;
  frequency_bins: AnalyticsTemperatureSummaryFrequencyBinResponse[];
  cold_group: AnalyticsTemperatureSummaryGroupResponse;
  hot_group: AnalyticsTemperatureSummaryGroupResponse;
}

export interface AnalyticsTemperatureSummaryResponse {
  windows: AnalyticsTemperatureSummaryWindowResponse[];
}

export interface AnalyticsEffectPlotPointResponse {
  x: number;
  y: number;
  date_local: string;
}

export interface AnalyticsFittedLinePointResponse {
  x: number;
  y: number;
}

export interface AnalyticsEffectPlotResponse {
  outcome: AnalyticsOutcome;
  term: string;
  x_label: string;
  y_label: string;
  points: AnalyticsEffectPlotPointResponse[];
  fitted_line: AnalyticsFittedLinePointResponse[];
}

export interface AnalyticsWeatherAnnotationsResponse {
  selected_term: string | null;
  date_from: string;
  date_to: string;
  included_dates: string[];
  excluded_dates: string[];
}

export interface AnalyticsVisualizationsResponse {
  default_selected_term: string | null;
  effect_plots: AnalyticsEffectPlotResponse[];
  weather_annotations: AnalyticsWeatherAnnotationsResponse | null;
}

export interface DashboardAnalyticsResponse {
  status: AnalyticsStatus;
  response_version: string;
  snapshot: AnalyticsSnapshotMetadataResponse;
  dataset: AnalyticsDatasetMetadataResponse;
  models: AnalyticsModelSummaryResponse[];
  temperature_summary: AnalyticsTemperatureSummaryResponse;
  visualizations: AnalyticsVisualizationsResponse | null;
}

export interface SessionListItemResponse {
  session_id: string;
  participant_uuid: string;
  participant_number: number;
  status: "created" | "active" | "complete";
  created_at: string;
  completed_at: string | null;
}

export interface SessionListResponse {
  items: SessionListItemResponse[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface WeatherIngestResponse {
  run_id: string;
  station_id: number;
  ingested_at: string;
  parse_status: "success" | "partial" | "fail";
  parse_errors: unknown[];
  upserted_days: number;
}

export interface WeatherLatestRun {
  run_id: string;
  ingested_at: string;
  parse_status: "success" | "partial" | "fail";
}

export interface WeatherDailyItem {
  station_id: number;
  study_day_id: string;
  date_local: string;
  source_run_id: string | null;
  updated_at: string;
  current_temp_c: number | null;
  current_precip_today_mm: number | null;
  forecast_high_c: number | null;
  forecast_low_c: number | null;
  forecast_condition_text: string | null;
  forecast_periods: unknown[];
  sunshine_duration_hours: number | null;
}

export interface WeatherDailyResponse {
  items: WeatherDailyItem[];
  latest_run: WeatherLatestRun | null;
}

export interface DashboardStudyWindowResponse {
  latest_study_day: string | null;
}

export interface StartSessionCreate {
  age_band: string;
  gender: string;
  origin: string;
  origin_other_text: string | null;
  commute_method: string;
  commute_method_other_text: string | null;
  time_outside: string;
}

export interface StartSessionResponse {
  participant_uuid: string;
  participant_number: number;
  session_id: string;
  status: "active";
  created_at: string;
  completed_at: null;
  start_path: string;
}

export type CognitiveTaskKey = "digitspan" | "stroop" | "card_sorting";
export type CardSortingRuleKey = "color" | "shape" | "number";

export interface CognitiveBatteryResponse {
  session_id: string;
  task_order: CognitiveTaskKey[];
  card_sorting_rule_order: CardSortingRuleKey[];
}

export type PoffenbergerResponseHand = "left" | "right";
export type PoffenbergerVisualField = "lvf" | "rvf";
export type PoffenbergerConditionKey =
  | "lh_lvf"
  | "lh_rvf"
  | "rh_lvf"
  | "rh_rvf";

export interface PoffenbergerPracticeTrialManifest {
  trial_number: number;
  response_hand: "right";
  visual_field: PoffenbergerVisualField;
  expected_key: "j";
  jitter_ms: number;
}

export interface PoffenbergerExperimentalTrialManifest {
  trial_number: number;
  global_trial_number: number;
  visual_field: PoffenbergerVisualField;
  jitter_ms: number;
}

export interface PoffenbergerBlockManifest {
  block_number: number;
  response_hand: PoffenbergerResponseHand;
  expected_key: "f" | "j";
  trials: PoffenbergerExperimentalTrialManifest[];
}

export interface PoffenbergerManifest {
  practice_trials: PoffenbergerPracticeTrialManifest[];
  blocks: PoffenbergerBlockManifest[];
}

export interface PoffenbergerStartRequest {
  age_band: string;
  gender: string;
  handedness: string;
}

export interface PoffenbergerStartResponse {
  run_id: string;
  session_id: string;
  participant_uuid: string;
  start_path: string;
  manifest: PoffenbergerManifest;
}

export interface PoffenbergerSubmittedTrial {
  block_number: number;
  trial_number: number;
  global_trial_number: number;
  response_hand: PoffenbergerResponseHand;
  visual_field: PoffenbergerVisualField;
  expected_key: "f" | "j";
  pressed_key: string | null;
  reaction_time_ms: number | null;
  is_timeout: boolean;
  is_practice: boolean;
  client_trial_started_at_ms?: number | null;
  client_stimulus_onset_ms?: number | null;
  client_response_at_ms?: number | null;
  client_trial_ended_at_ms?: number | null;
}

export interface PoffenbergerSubmitRequest {
  run_id: string;
  session_id: string;
  trials: PoffenbergerSubmittedTrial[];
}

export interface PoffenbergerConditionSummary {
  total_trials: number;
  valid_rt_trials: number;
  timeout_trials: number;
  invalid_trials: number;
  accurate_trials: number;
  accuracy: number | string | null;
  mean_rt_ms: number | string | null;
  median_rt_ms: number | string | null;
  sd_rt_ms: number | string | null;
}

export interface PoffenbergerSubmitResponse {
  run_id: string;
  session_id: string;
  condition_summaries: Record<PoffenbergerConditionKey, PoffenbergerConditionSummary>;
  mean_rt_crossed_ms: number | string | null;
  mean_rt_uncrossed_ms: number | string | null;
  ihtt_difference_ms: number | string | null;
  accuracy_crossed: number | string | null;
  accuracy_uncrossed: number | string | null;
  is_complete: boolean;
}

/**
 * Bundle returned by GET /api/ra/dashboard (Vercel Route Handler).
 * Contains only the current-day weather payload rendered by the default dashboard.
 */
export interface DashboardWeatherBundle {
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

/** Response envelope from GET /api/ra/dashboard. */
export interface DashboardWeatherRouteResponse {
  cached: boolean;
  data: DashboardWeatherBundle | null;
}

/**
 * Bundle returned by GET /api/ra/weather/range (Vercel Route Handler).
 * Cached payload for weather-only trend charts.
 */
export interface WeatherRangeBundle {
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

/** Response envelope from GET /api/ra/weather/range. */
export interface WeatherRangeRouteResponse {
  cached: boolean;
  data: WeatherRangeBundle | null;
}

/**
 * Bundle returned by GET /api/ra/dashboard/analytics.
 * Snapshot reads may come from Redis; live reads always proxy same-origin to the backend.
 */
export interface DashboardAnalyticsBundle {
  analytics: DashboardAnalyticsResponse;
  cached_at: string; // ISO 8601
}

export interface DashboardAnalyticsRefreshInfo {
  requested: boolean;
  state: "idle" | "recomputing" | "ready";
  detail: string;
}

/** Response envelope from GET /api/ra/dashboard/analytics. */
export interface DashboardAnalyticsRouteResponse {
  cached: boolean;
  data: DashboardAnalyticsBundle | null;
  refresh: DashboardAnalyticsRefreshInfo;
}

/** One-click supervised flow: create anonymous participant + active session. */
export async function startSession(
  payload: StartSessionCreate
): Promise<StartSessionResponse> {
  return apiPost<StartSessionResponse>("/sessions/start", payload, { auth: true });
}

/** Fetch the stored WW cognitive task manifest for an active participant session. */
export async function getCognitiveBattery(
  sessionId: string
): Promise<CognitiveBatteryResponse> {
  return apiGet<CognitiveBatteryResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/cognitive-battery`
  );
}

/** RA-triggered: creates anonymous IHTT participant + active session + Poffenberger run. */
export async function startPoffenbergerSession(
  payload: PoffenbergerStartRequest
): Promise<PoffenbergerStartResponse> {
  return apiPost<PoffenbergerStartResponse>("/ihtt/poffenberger/start", payload, {
    auth: true,
  });
}

/** Submit raw Poffenberger timing rows. Backend validates manifest and computes scores. */
export async function submitPoffenbergerRun(
  runId: string,
  payload: PoffenbergerSubmitRequest
): Promise<PoffenbergerSubmitResponse> {
  return apiPost<PoffenbergerSubmitResponse>(
    `/ihtt/poffenberger/runs/${encodeURIComponent(runId)}/submit`,
    payload
  );
}

/**
 * Submit raw card sorting trials. The backend reads the hidden stored rule order
 * for the session and recomputes correctness/streaks/category metrics; the client
 * choice is never trusted for scoring.
 */
export async function submitCardSortingRun(
  sessionId: string,
  trials: CardSortingTrialInput[]
): Promise<CardSortingRunResponse> {
  return apiPost<CardSortingRunResponse>("/card-sorting/runs", {
    session_id: sessionId,
    trials,
  });
}

async function buildSameOriginAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch the default dashboard weather bundle from the Vercel Route Handler (same-origin).
 * mode=cached → returns the Upstash Redis bundle if present (fast path).
 * mode=live   → fetches fresh data from the Render backend, refreshes the cache.
 *
 * Note: uses a relative path (/api/ra/dashboard) so it resolves correctly
 * in both local dev (localhost:3000) and Vercel production.
 */
export async function getDashboardWeatherBundle(
  mode: "cached" | "live"
): Promise<DashboardWeatherRouteResponse> {
  const res = await fetch(`/api/ra/dashboard?mode=${mode}`, {
    method: "GET",
    headers: await buildSameOriginAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<DashboardWeatherRouteResponse>;
}

/**
 * Fetch a weather-only range bundle from the same-origin Route Handler.
 * mode=cached → returns the Upstash Redis bundle if present (fast path).
 * mode=live   → fetches fresh data from the Render backend, refreshes the cache.
 */
export async function getWeatherRangeBundle(
  mode: "cached" | "live",
  dateFrom: string,
  dateTo: string
): Promise<WeatherRangeRouteResponse> {
  const params = new URLSearchParams({
    mode,
    date_from: dateFrom,
    date_to: dateTo,
  });
  const res = await fetch(`/api/ra/weather/range?${params.toString()}`, {
    method: "GET",
    headers: await buildSameOriginAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<WeatherRangeRouteResponse>;
}

/**
 * Fetch the dashboard study-window metadata from the same-origin Route Handler.
 * Returns the latest available study day so dashboard filters can anchor on actual study activity.
 */
export async function getDashboardStudyWindow(): Promise<DashboardStudyWindowResponse> {
  const res = await fetch("/api/ra/dashboard/study-window", {
    method: "GET",
    headers: await buildSameOriginAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<DashboardStudyWindowResponse>;
}

/**
 * Fetch analytics from the same-origin Route Handler.
 * mode=snapshot → returns the cached durable snapshot when available.
 * mode=live     → requests a background backend recompute and immediately returns
 *                 the current snapshot state for the selected range.
 */
export async function getDashboardAnalyticsBundle(
  mode: AnalyticsReadMode,
  dateFrom: string,
  dateTo: string
): Promise<DashboardAnalyticsRouteResponse> {
  const params = new URLSearchParams({
    mode,
    date_from: dateFrom,
    date_to: dateTo,
  });
  const res = await fetch(`/api/ra/dashboard/analytics?${params.toString()}`, {
    method: "GET",
    headers: await buildSameOriginAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<DashboardAnalyticsRouteResponse>;
}

/**
 * Fetch a single participant's demographics from the same-origin Route Handler.
 * Returns the full ParticipantResponse including demographic/exposure fields.
 * Throws ApiError with status 404 if the participant is not found.
 */
export async function getParticipantDemographics(
  participantUuid: string
): Promise<ParticipantResponse> {
  const res = await fetch(
    `/api/ra/participants/${encodeURIComponent(participantUuid)}`,
    {
      method: "GET",
      headers: await buildSameOriginAuthHeaders(),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<ParticipantResponse>;
}

// ── RA data chatbot types + wrapper ──

export type RAChatMessageRole = "user" | "assistant";

/** One prior conversation turn sent to the RA chatbot. */
export interface RAChatMessage {
  role: RAChatMessageRole;
  content: string;
}

/** Optional bounded study scope forwarded to approved backend data tools. */
export interface RAChatScope {
  date_from?: string | null;
  date_to?: string | null;
  study_slug?: string | null;
}

/** Request body for POST /api/ra/chat (proxied to backend POST /chat). */
export interface RAChatRequest {
  message: string;
  conversation_id?: string | null;
  history?: RAChatMessage[];
  scope?: RAChatScope;
}

/** Compact user-safe summary of an approved backend tool result. */
export interface RAChatToolResult {
  tool_name: string;
  summary: string;
}

/** Typed response returned by the RA data chatbot coordinator. */
export interface RAChatResponse {
  conversation_id: string;
  message: string;
  model: string;
  tool_results: RAChatToolResult[];
  blocked_reason: string | null;
}

/**
 * Send an RA chatbot request through the same-origin Vercel Route Handler.
 *
 * Uses the relative path /api/ra/chat so the browser never calls the backend or
 * OpenRouter directly; the Route Handler verifies the RA JWT and proxies to the
 * FastAPI coordinator server-side.
 */
export async function postRaChat(
  payload: RAChatRequest
): Promise<RAChatResponse> {
  const res = await fetch("/api/ra/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await buildSameOriginAuthHeaders()),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<RAChatResponse>;
}

// ── RA data chatbot streaming (SSE) ──

/** Incremental assistant text fragment. */
export interface RAChatTokenEvent {
  type: "token";
  text: string;
}

/** A backend tool call has started. */
export interface RAChatToolRunningEvent {
  type: "tool_running";
  tool_name: string;
}

/** A backend tool call has finished. */
export interface RAChatToolResolvedEvent {
  type: "tool_resolved";
  tool_name: string;
  summary: string;
  status: string;
}

/** Terminal success event carrying the full coordinator response. */
export interface RAChatDoneEvent {
  type: "done";
  response: RAChatResponse;
}

/** Terminal user-safe failure event. */
export interface RAChatErrorEvent {
  type: "error";
  message: string;
  blocked_reason?: string | null;
}

/** Discriminated union of every SSE frame emitted by POST /chat/stream. */
export type RAChatStreamEvent =
  | RAChatTokenEvent
  | RAChatToolRunningEvent
  | RAChatToolResolvedEvent
  | RAChatDoneEvent
  | RAChatErrorEvent;

/** Callbacks the panel supplies to react to streamed events. */
export interface RAChatStreamHandlers {
  onToken?: (text: string) => void;
  onToolRunning?: (toolName: string) => void;
  onToolResolved?: (event: RAChatToolResolvedEvent) => void;
  /** Optional escape hatch for events not covered by the typed callbacks. */
  onEvent?: (event: RAChatStreamEvent) => void;
}

function parseSseEvent(raw: string): RAChatStreamEvent | null {
  // Each SSE frame is one or more `data:` lines; the backend emits a single
  // JSON object per frame. Concatenate data payloads, ignore comments/fields.
  const data = raw
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return null;
  try {
    return JSON.parse(data) as RAChatStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Stream an RA chatbot turn over Server-Sent Events through the same-origin
 * Route Handler. Resolves with the terminal {@link RAChatResponse} once the
 * `done` event arrives; throws {@link ApiError} on a transport failure or a
 * terminal `error` event. The browser never calls the backend or OpenRouter
 * directly — the Route Handler verifies the RA JWT and proxies the stream.
 */
export async function streamRaChat(
  payload: RAChatRequest,
  handlers: RAChatStreamHandlers = {},
  options: { signal?: AbortSignal } = {}
): Promise<RAChatResponse> {
  const res = await fetch("/api/ra/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(await buildSameOriginAuthHeaders()),
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!res.ok || res.body === null) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: RAChatResponse | null = null;

  const handle = (event: RAChatStreamEvent): void => {
    handlers.onEvent?.(event);
    switch (event.type) {
      case "token":
        handlers.onToken?.(event.text);
        break;
      case "tool_running":
        handlers.onToolRunning?.(event.tool_name);
        break;
      case "tool_resolved":
        handlers.onToolResolved?.(event);
        break;
      case "done":
        done = event.response;
        break;
      case "error":
        throw new ApiError(503, event.message);
    }
  };

  for (;;) {
    const { value, done: streamDone } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseEvent(frame);
        if (event) handle(event);
      }
    }
    if (streamDone) break;
  }

  // Flush any trailing frame without a terminating blank line.
  const tail = parseSseEvent(buffer);
  if (tail) handle(tail);

  if (done === null) {
    throw new ApiError(502, "The assistant stream ended without a response.");
  }
  return done;
}

/** Trigger manual weather ingestion via LabMember JWT (RA-only). */
export async function triggerWeatherIngest(): Promise<WeatherIngestResponse> {
  return apiPost<WeatherIngestResponse>(
    "/weather/ingest/ubc-eos",
    { station_id: 3510 },
    { auth: true }
  );
}

// ── Admin Import/Export types ──

export interface ImportRowIssue {
  row: number;
  field: string | null;
  message: string;
}

export interface ImportPreviewResponse {
  file_type: "csv" | "xlsx";
  rows_total: number;
  participants_create: number;
  participants_update: number;
  sessions_create: number;
  sessions_update: number;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
}

export interface ImportCommitResponse {
  rows_total: number;
  participants_created: number;
  participants_updated: number;
  sessions_created: number;
  sessions_updated: number;
}

export type AdminUserRole = "admin" | "ra";

export interface AdminUserResponse {
  id: string;
  email: string;
  role: AdminUserRole | string;
  lab_name: string;
  is_banned: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface AdminInvitationResponse {
  invitation_id: string;
  email: string;
  role: AdminUserRole | string;
  lab_name: string;
  status: "pending" | "accepted" | "revoked" | string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  revoked_by_lab_member_id: string | null;
  created_by_lab_member_id: string;
  supabase_user_id: string | null;
  last_sent_at: string | null;
  send_count: number;
  provider_message_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserResponse[];
  invitations: AdminInvitationResponse[];
}

export interface CreateUserInvitationRequest {
  email: string;
  role: AdminUserRole;
  lab_name: string;
}

export interface UpdateAdminUserRequest {
  role: AdminUserRole;
  lab_name: string;
}

export interface AcceptInvitationRequest {
  token: string;
  password: string;
}

export interface AcceptInvitationResponse {
  email: string;
  role: AdminUserRole | string;
  lab_name: string;
  supabase_user_id: string;
  status: "accepted";
}

/**
 * Build auth-only headers (no Content-Type — browser sets it for FormData).
 * Used for multipart file upload requests.
 */
async function buildAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload a file for import preview. No DB writes are performed. */
export async function importPreview(
  file: File
): Promise<ImportPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/import/preview`, {
    method: "POST",
    headers: await buildAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<ImportPreviewResponse>;
}

/** Commit an import. Performs transactional DB writes. */
export async function importCommit(
  file: File
): Promise<ImportCommitResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/import/commit`, {
    method: "POST",
    headers: await buildAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<ImportCommitResponse>;
}

/** Accept an app-owned RA/admin invitation and activate the Supabase Auth account. */
export async function acceptInvitation(
  payload: AcceptInvitationRequest
): Promise<AcceptInvitationResponse> {
  return apiPost<AcceptInvitationResponse>("/auth/invitations/accept", payload);
}

/** Return admin-visible users plus app-owned invitation records. */
export async function getAdminUsers(): Promise<AdminUsersResponse> {
  return apiGet<AdminUsersResponse>("/admin/users", { auth: true });
}

/** Create and email a new app-owned RA/admin invitation. */
export async function createUserInvitation(
  payload: CreateUserInvitationRequest
): Promise<AdminInvitationResponse> {
  return apiPost<AdminInvitationResponse>("/admin/users/invitations", payload, {
    auth: true,
  });
}

/** Resend a pending app-owned invitation, rotating its raw token. */
export async function resendUserInvitation(
  invitationId: string
): Promise<AdminInvitationResponse> {
  return apiPost<AdminInvitationResponse>(
    `/admin/users/invitations/${encodeURIComponent(invitationId)}/resend`,
    {},
    { auth: true }
  );
}

/** Revoke a pending app-owned invitation before acceptance. */
export async function revokeUserInvitation(
  invitationId: string
): Promise<AdminInvitationResponse> {
  return apiPost<AdminInvitationResponse>(
    `/admin/users/invitations/${encodeURIComponent(invitationId)}/revoke`,
    {},
    { auth: true }
  );
}

/** Update an RA/admin user's role and lab assignment. */
export async function updateAdminUser(
  userId: string,
  payload: UpdateAdminUserRequest
): Promise<AdminUserResponse> {
  return apiPatch<AdminUserResponse>(
    `/admin/users/${encodeURIComponent(userId)}`,
    payload,
    { auth: true }
  );
}

/** Revoke RA/admin access without hard-deleting the Supabase Auth user. */
export async function revokeAdminUserAccess(userId: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/admin/users/${encodeURIComponent(userId)}/revoke-access`,
    {
      method: "POST",
      headers: await buildHeaders(true),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
}

// ── Undo Last Session types + wrappers ──

export interface LastNativeSessionResponse {
  session_id: string;
  participant_uuid: string;
  participant_number: number;
  status: "created" | "active" | "complete";
  created_at: string;
}

export interface DeleteLastNativeSessionResponse {
  deleted_session_id: string;
  deleted_participant_uuid: string;
  deleted_participant_number: number;
  session_status_at_delete: "created" | "active" | "complete";
  participant_deleted: boolean;
}

/** Preview the most recently created native session (undo candidate). Returns 404 when none exists. */
export async function getLastNativeSession(): Promise<LastNativeSessionResponse> {
  return apiGet<LastNativeSessionResponse>("/sessions/last-native", { auth: true });
}

/** Delete the most recently created native session with an explicit confirmation + reason. */
export async function deleteLastNativeSession(
  reason: string
): Promise<DeleteLastNativeSessionResponse> {
  return apiDelete<DeleteLastNativeSessionResponse>(
    "/sessions/last-native",
    { confirm: true, reason },
    { auth: true }
  );
}

/** Parse the filename from a Content-Disposition header, or fall back to the given default. */
function filenameFromContentDisposition(
  header: string | null,
  fallback: string
): string {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/** Download the admin XLSX export. Returns the blob and the server-provided filename. */
export async function exportXlsx(): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE}/admin/export.xlsx`, {
    method: "GET",
    headers: await buildAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
    "Weather and wellness - export.xlsx"
  );
  return { blob, filename };
}

/** Download the IHTT Poffenberger XLSX export. */
export async function exportPoffenbergerXlsx(options?: {
  sampleData?: boolean;
}): Promise<{ blob: Blob; filename: string }> {
  const searchParams = new URLSearchParams();
  if (options?.sampleData) searchParams.set("sample_data", "true");
  const query = searchParams.toString();
  const res = await fetch(
    `${API_BASE}/ihtt/poffenberger/export.xlsx${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: await buildAuthHeaders(),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
    "IHTT Poffenberger - export.xlsx"
  );
  return { blob, filename };
}

/** Mark a session as complete. Reused by all participant task flows. */
export async function patchSessionStatus(
  sessionId: string,
  status: "complete"
): Promise<SessionResponse> {
  return apiPatch<SessionResponse>(`/sessions/${sessionId}/status`, { status });
}

// ── Misokinesia types + wrappers ──

export interface MisokinesiaClipMeta {
  stimulus_id: string;
  public_url: string;
  sort_order: number;
  duration_ms: number;
}

export interface MisokinesiaManifest {
  misokinesia_participant_id: string;
  misokinesia_participant_number: number;
  session_id: string;
  trial_mode?: MisokinesiaTrialMode;
  post_survey_order: string;
  clips: MisokinesiaClipMeta[];
}

export function parseSurveyOrder(postSurveyOrder: string): PostSurveyKey[] {
  return postSurveyOrder.split(",").filter((k): k is PostSurveyKey =>
    k === "mkaq" || k === "gad7" || k === "maq"
  );
}

export interface MisokinesiaTrialManifest {
  post_survey_order: string;
  clips: MisokinesiaClipMeta[];
}

export interface MisokinesiaTrialResponsePayload {
  stimulus_id: string;
  display_order: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export interface MisokinesiaTrialResponseResult {
  response_id: string;
  is_complete: boolean;
  session_id: string;
}

export interface MisokinesiaEndOfTaskPayload {
  end_fidgeting_text?: string;
  end_emotions_text?: string;
  stronger_responses?: boolean;
  stronger_responses_timing?: string;
}

export interface MisokinesiaEndOfTaskResult {
  misokinesia_participant_id: string;
}

/** RA-triggered: creates anonymous participant + session + misokinesia_participants row. Returns manifest. */
export async function startMisokinesiaSession(): Promise<MisokinesiaManifest> {
  return apiPost<MisokinesiaManifest>("/misokinesia/start", {}, { auth: true });
}

/** RA-triggered: returns sampled or full active clips for read-only trial mode. */
export async function getMisokinesiaTrialManifest(full?: boolean): Promise<MisokinesiaTrialManifest> {
  const path = full ? "/misokinesia/trial-manifest?full=true" : "/misokinesia/trial-manifest";
  return apiGet<MisokinesiaTrialManifest>(path, { auth: true });
}

/** Submit one per-clip questionnaire response (participant-facing, no auth). */
export async function submitMisokinesiaTrialResponse(
  participantId: string,
  payload: MisokinesiaTrialResponsePayload
): Promise<MisokinesiaTrialResponseResult> {
  return apiPost<MisokinesiaTrialResponseResult>(
    `/misokinesia/participants/${participantId}/responses`,
    payload
  );
}

/** MkAQ 21-item request payload. All items required, each valued 0–3. */
export interface MisokinesiaMkaqRequest {
  q1: number; q2: number; q3: number; q4: number; q5: number;
  q6: number; q7: number; q8: number; q9: number; q10: number;
  q11: number; q12: number; q13: number; q14: number; q15: number;
  q16: number; q17: number; q18: number; q19: number; q20: number;
  q21: number;
}

/** MkAQ response returned by POST /misokinesia/participants/{id}/mkaq. */
export interface MisokinesiaMkaqResponse {
  response_id: string;
  misokinesia_participant_id: string;
  session_id: string;
  total_score: number;
  created_at: string;
}

/** Submit the required 21-item MkAQ (participant-facing, no auth). Server computes total_score. */
export async function submitMisokinesiaMkaq(
  participantId: string,
  payload: MisokinesiaMkaqRequest
): Promise<MisokinesiaMkaqResponse> {
  return apiPost<MisokinesiaMkaqResponse>(
    `/misokinesia/participants/${participantId}/mkaq`,
    payload
  );
}

/** Miso-isolated GAD-7 request payload. All items required, each valued 0-3. */
export interface MisokinesiaGAD7Request {
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  r6: number;
  r7: number;
  difficulty_impact?: string | null;
}

/** GAD-7 response returned by POST /misokinesia/participants/{id}/gad7. */
export interface MisokinesiaGAD7Response {
  response_id: string;
  total_score: number;
  severity_band: string;
}

/** Submit the required post-video GAD-7 survey. Server computes total_score and severity_band. */
export async function submitMisokinesiaGAD7(
  participantId: string,
  payload: MisokinesiaGAD7Request
): Promise<MisokinesiaGAD7Response> {
  return apiPost<MisokinesiaGAD7Response>(
    `/misokinesia/participants/${participantId}/gad7`,
    payload
  );
}

/** MAQ 21-item request payload. All items required, each valued 0-3. */
export interface MisokinesiaMAQRequest {
  q1: number; q2: number; q3: number; q4: number; q5: number;
  q6: number; q7: number; q8: number; q9: number; q10: number;
  q11: number; q12: number; q13: number; q14: number; q15: number;
  q16: number; q17: number; q18: number; q19: number; q20: number;
  q21: number;
}

/** MAQ response returned by POST /misokinesia/participants/{id}/maq. */
export interface MisokinesiaMAQResponse {
  response_id: string;
  total_score: number;
}

/** Submit the required 21-item MAQ. Server computes total_score. */
export async function submitMisokinesiaMAQ(
  participantId: string,
  payload: MisokinesiaMAQRequest
): Promise<MisokinesiaMAQResponse> {
  return apiPost<MisokinesiaMAQResponse>(
    `/misokinesia/participants/${participantId}/maq`,
    payload
  );
}

/** Submit the end-of-task questionnaire (participant-facing, no auth). */
export async function submitMisokinesiaEndOfTask(
  participantId: string,
  payload: MisokinesiaEndOfTaskPayload
): Promise<MisokinesiaEndOfTaskResult> {
  return apiPatch<MisokinesiaEndOfTaskResult>(
    `/misokinesia/participants/${participantId}/end-of-task`,
    payload
  );
}

export type MisoSex = "Male" | "Female";
export type MisoResidenceStatus =
  | "Canadian Citizenship"
  | "Permanent Resident"
  | "Student Visa"
  | "Other";
export type MisoStudentType = "Domestic" | "International";
export type MisoHighestEducationCompleted =
  | "Elementary or middle school"
  | "High school or equivalent (e.g., GED)"
  | "College diploma"
  | "Bachelors degree"
  | "Masters degree"
  | "Doctorate degree";
export type MisoEnglishFluency =
  | "Strongly agree"
  | "Agree"
  | "Neither agree nor disagree"
  | "Disagree"
  | "Strongly disagree";
export type MisoEnglishSpeakingFrequency =
  | "Always"
  | "Often"
  | "Sometimes"
  | "Rarely"
  | "Never";
export type MisoAdhdMedication = "Yes" | "Maybe" | "No";
export type MisoEthnicity =
  | "European Canadian"
  | "Chinese"
  | "South Asian"
  | "Filipino"
  | "Southeast Asian"
  | "Japanese"
  | "Latin American"
  | "Korean"
  | "Other";
export type MisoFluentLanguage =
  | "French"
  | "Mandarin"
  | "Cantonese"
  | "Hindi"
  | "Punjabi"
  | "Korean"
  | "None"
  | "Other";
export type MisoInstructionLanguage =
  | "French"
  | "Mandarin"
  | "Cantonese"
  | "Hindi"
  | "Punjabi"
  | "Korean"
  | "Other";
export type MisoDiagnosedDisorder =
  | "Neurological Disorder"
  | "Generalized Anxiety Disorder"
  | "Depression"
  | "Mood Disorder"
  | "Substance Use Disorder"
  | "Other"
  | "N/A";
export type MisoRegularSubstance =
  | "Alcohol"
  | "Cannabis"
  | "Tobacco"
  | "Vaping"
  | "Caffeinated Stimulants (coffee, energy drinks, etc.)"
  | "Other"
  | "None of the Above";
export type MisoRelationshipStatus =
  | "Single"
  | "In a relationship"
  | "Married (and not separated)"
  | "Common-law"
  | "Seperated"
  | "Divorced"
  | "Widowed"
  | "Other"
  | "None of the Above";
export type MisoOccupationalStatus =
  | "Employed full-time"
  | "Employed part-time"
  | "Out of work but looking for work"
  | "Out of work and not looking for work"
  | "Homemaker"
  | "Student"
  | "Military"
  | "Retired"
  | "Unable to work"
  | "Other"
  | "None of the above";

/** Miso demographics PATCH payload. Mirrors backend MisoDemographicsCreate. */
export interface MisokinesiaDemographicsRequest {
  age?: number | null;
  sex?: MisoSex | null;
  gender_identity?: string | null;
  years_lived_canada?: number | null;
  residence_status?: MisoResidenceStatus | null;
  residence_status_other_text?: string | null;
  student_type?: MisoStudentType | null;
  total_years_education?: number | null;
  cumulative_gpa?: number | null;
  majors_text?: string | null;
  highest_education_completed?: MisoHighestEducationCompleted | null;
  ethnicity?: MisoEthnicity[] | null;
  ethnicity_other_text?: string | null;
  native_language?: string | null;
  english_fluency?: MisoEnglishFluency | null;
  fluent_languages?: MisoFluentLanguage[] | null;
  fluent_languages_other_text?: string | null;
  english_speaking_frequency?: MisoEnglishSpeakingFrequency | null;
  non_english_schooling?: boolean | null;
  instruction_languages?: MisoInstructionLanguage[] | null;
  instruction_languages_other_text?: string | null;
  diagnosed_disorders?: MisoDiagnosedDisorder[] | null;
  diagnosed_disorders_other_text?: string | null;
  adhd_diagnosis?: boolean | null;
  adhd_medication?: MisoAdhdMedication | null;
  avid_videogamer?: boolean | null;
  video_game_hours_per_week?: number | null;
  prescription_stimulants?: boolean | null;
  regular_substances?: MisoRegularSubstance[] | null;
  regular_substances_other_text?: string | null;
  relationship_status?: MisoRelationshipStatus | null;
  relationship_status_other_text?: string | null;
  occupational_status?: MisoOccupationalStatus | null;
  occupational_status_other_text?: string | null;
}

export interface MisokinesiaDemographicsResponse {
  misokinesia_participant_id: string;
}

/** PATCH miso demographics onto an existing misokinesia_participants row (participant-facing, no auth). */
export async function patchMisokinesiaDemographics(
  participantId: string,
  payload: MisokinesiaDemographicsRequest
): Promise<MisokinesiaDemographicsResponse> {
  return apiPatch<MisokinesiaDemographicsResponse>(
    `/misokinesia/participants/${participantId}/demographics`,
    payload
  );
}

/** Download the admin CSV zip export. Returns the blob and the server-provided filename. */
export async function exportZip(): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE}/admin/export.zip`, {
    method: "GET",
    headers: await buildAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
    "Weather and wellness - export.zip"
  );
  return { blob, filename };
}
