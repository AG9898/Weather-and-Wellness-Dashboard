/**
 * Typed API wrapper for backend communication.
 * All component/page API calls must go through these functions.
 */

import { supabase } from "@/lib/supabase";

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

export interface DashboardSummaryRangeResponse {
  date_from: string;
  date_to: string;
  sessions_created: number;
  sessions_completed: number;
  participants_completed: number;
}

export interface DashboardParticipantsPerDayItem {
  date_local: string;
  sessions_completed: number;
  participants_completed: number;
}

export interface DashboardParticipantsPerDayResponse {
  items: DashboardParticipantsPerDayItem[];
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
}

export interface WeatherDailyResponse {
  items: WeatherDailyItem[];
  latest_run: WeatherLatestRun | null;
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

/**
 * Bundle returned by GET /api/ra/dashboard (Vercel Route Handler).
 * Combines dashboard summary + today's weather into a single cached payload.
 */
export interface DashboardBundle {
  summary: DashboardSummaryResponse;
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

/** Response envelope from GET /api/ra/dashboard. */
export interface DashboardRouteResponse {
  cached: boolean;
  data: DashboardBundle | null;
}

/**
 * Bundle returned by GET /api/ra/dashboard/range.
 * Always live (cache-bypass) for filter-specific analytics.
 */
export interface DashboardRangeBundle {
  summary: DashboardSummaryRangeResponse;
  weather: WeatherDailyResponse;
  participants_per_day: DashboardParticipantsPerDayResponse;
  cached_at: string; // ISO 8601
}

/** Response envelope from GET /api/ra/dashboard/range. */
export interface DashboardRangeRouteResponse {
  cached: false;
  data: DashboardRangeBundle;
}

/** One-click supervised flow: create anonymous participant + active session. */
export async function startSession(
  payload: StartSessionCreate
): Promise<StartSessionResponse> {
  return apiPost<StartSessionResponse>("/sessions/start", payload, { auth: true });
}

/**
 * Fetch the RA dashboard bundle from the Vercel Route Handler (same-origin).
 * mode=cached → returns the Upstash Redis bundle if present (fast path).
 * mode=live   → fetches fresh data from the Render backend, refreshes the cache.
 *
 * Note: uses a relative path (/api/ra/dashboard) so it resolves correctly
 * in both local dev (localhost:3000) and Vercel production.
 */
export async function getDashboardBundle(
  mode: "cached" | "live"
): Promise<DashboardRouteResponse> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`/api/ra/dashboard?mode=${mode}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<DashboardRouteResponse>;
}

/**
 * Fetch range-filtered dashboard data from the same-origin Route Handler.
 * This endpoint is intentionally live-only (no Redis read path).
 */
export async function getDashboardRangeBundle(
  dateFrom: string,
  dateTo: string
): Promise<DashboardRangeRouteResponse> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
  });
  const res = await fetch(`/api/ra/dashboard/range?${params.toString()}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<DashboardRangeRouteResponse>;
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
