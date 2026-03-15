export const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const BACKEND_FETCH_TIMEOUT_MS = 55_000;

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

export interface FetchBackendOptions extends Omit<RequestInit, "headers"> {
  token: string;
  timeoutMs?: number;
  headers?: HeadersInit;
}

export async function fetchBackend(
  path: string,
  options: FetchBackendOptions
): Promise<Response> {
  const { token, timeoutMs = BACKEND_FETCH_TIMEOUT_MS, headers, ...init } =
    options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Authorization", `Bearer ${token}`);
  requestHeaders.set("Content-Type", "application/json");

  try {
    return await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: requestHeaders,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timed out calling ${BACKEND_URL}${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function throwIfBackendNotOk(
  response: Response,
  endpoint: string
): Promise<void> {
  if (response.ok) {
    return;
  }

  const body = await response.json().catch(() => ({} as { detail?: unknown }));
  const detail =
    typeof body.detail === "string"
      ? body.detail
      : `${endpoint} returned ${response.status}`;

  throw new BackendRequestError(detail, response.status);
}

