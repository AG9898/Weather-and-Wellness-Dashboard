/**
 * Typed API wrapper for backend communication.
 * All component/page API calls must go through these functions.
 */

import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Get the Supabase access token from the current session. */
async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
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

export interface DashboardSummaryResponse {
  total_participants: number;
  sessions_created: number;
  sessions_active: number;
  sessions_complete: number;
  sessions_created_last_7_days: number;
  sessions_completed_last_7_days: number;
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

export interface WeatherDailyResponse {
  items: unknown[];
  latest_run: WeatherLatestRun | null;
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

/** One-click supervised flow: create anonymous participant + active session. */
export async function startSession(): Promise<StartSessionResponse> {
  return apiPost<StartSessionResponse>("/sessions/start", {}, { auth: true });
}

/** Trigger manual weather ingestion via LabMember JWT (RA-only). */
export async function triggerWeatherIngest(): Promise<WeatherIngestResponse> {
  return apiPost<WeatherIngestResponse>(
    "/weather/ingest/ubc-eos",
    { station_id: 3510 },
    { auth: true }
  );
}

/** Fetch latest ingest run status for the dashboard weather card. */
export async function getWeatherStatus(): Promise<WeatherDailyResponse> {
  const today = new Date().toISOString().slice(0, 10);
  return apiGet<WeatherDailyResponse>(
    `/weather/daily?start=${today}&end=${today}`,
    { auth: true }
  );
}
