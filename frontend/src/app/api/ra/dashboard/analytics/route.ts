/**
 * GET /api/ra/dashboard/analytics?mode=snapshot|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Server-only Vercel Route Handler for RA dashboard analytics reads.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - mode=snapshot → returns a cached snapshot bundle when available, otherwise proxies backend snapshot mode
 * - mode=live     → attempts a backend recompute with a timeout and falls back to the latest snapshot
 */

import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Redis } from "@upstash/redis";
import type { DashboardAnalyticsResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

type AnalyticsRouteMode = "snapshot" | "live";

interface DashboardAnalyticsBundle {
  analytics: DashboardAnalyticsResponse;
  cached_at: string;
}

interface DashboardAnalyticsRouteResponse {
  cached: boolean;
  data: DashboardAnalyticsBundle | null;
}

const redis =
  (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
  (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)
    ? new Redis({
        url: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
        token: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
      })
    : null;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BACKEND_FETCH_TIMEOUT_MS = 15_000;
const CACHE_KEY_PREFIX = "ww:ra:analytics:snapshot:v1";
const CACHE_TTL = 60 * 60 * 6; // 6 hours
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class BackendRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> | null {
  if (jwks) return jwks;
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl) return null;
  jwks = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
  );
  return jwks;
}

async function verifySupabaseJWT(token: string): Promise<boolean> {
  const jwksSet = getJWKS();
  if (jwksSet) {
    try {
      await jwtVerify(token, jwksSet);
      return true;
    } catch {
      // Fall through to HS256 fallback.
    }
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      await jwtVerify(token, secret);
      return true;
    } catch {
      // Invalid token.
    }
  }

  return false;
}

function isIsoDate(value: string): boolean {
  return DATE_RE.test(value);
}

function isAnalyticsRouteMode(value: string): value is AnalyticsRouteMode {
  return value === "snapshot" || value === "live";
}

function getCacheKey(dateFrom: string, dateTo: string): string {
  return `${CACHE_KEY_PREFIX}:${dateFrom}:${dateTo}`;
}

function toBundle(
  analytics: DashboardAnalyticsResponse
): DashboardAnalyticsBundle {
  return {
    analytics,
    cached_at: new Date().toISOString(),
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = BACKEND_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Timed out calling ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function throwIfNotOk(res: Response, endpoint: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({} as { detail?: unknown }));
  const detail =
    typeof body.detail === "string"
      ? body.detail
      : `${endpoint} returned ${res.status}`;
  throw new BackendRequestError(detail, res.status);
}

async function fetchAnalyticsResponse(
  token: string,
  dateFrom: string,
  dateTo: string,
  mode: AnalyticsRouteMode
): Promise<DashboardAnalyticsResponse> {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    mode,
  });
  const res = await fetchWithTimeout(
    `${BACKEND_URL}/dashboard/analytics?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );
  await throwIfNotOk(res, "Backend /dashboard/analytics");
  return res.json() as Promise<DashboardAnalyticsResponse>;
}

async function readCachedSnapshot(
  cacheKey: string
): Promise<DashboardAnalyticsBundle | null> {
  if (!redis) {
    return null;
  }

  try {
    return await redis.get<DashboardAnalyticsBundle>(cacheKey);
  } catch {
    return null;
  }
}

async function writeCachedSnapshot(
  cacheKey: string,
  bundle: DashboardAnalyticsBundle
): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKey, bundle, { ex: CACHE_TTL });
  } catch {
    // Ignore Redis write failures; backend data is still returned.
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return NextResponse.json(
      { detail: "Missing Authorization header" },
      { status: 401, headers: { "x-ww-cache": "skip" } }
    );
  }

  const valid = await verifySupabaseJWT(token);
  if (!valid) {
    return NextResponse.json(
      { detail: "Invalid or expired token" },
      { status: 401, headers: { "x-ww-cache": "skip" } }
    );
  }

  const modeParam = req.nextUrl.searchParams.get("mode") ?? "snapshot";
  const dateFrom = req.nextUrl.searchParams.get("date_from") ?? "";
  const dateTo = req.nextUrl.searchParams.get("date_to") ?? "";

  if (!isAnalyticsRouteMode(modeParam)) {
    return NextResponse.json(
      { detail: "mode must be snapshot or live" },
      { status: 422, headers: { "x-ww-cache": "skip" } }
    );
  }
  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { detail: "date_from and date_to are required" },
      { status: 422, headers: { "x-ww-cache": "skip" } }
    );
  }
  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return NextResponse.json(
      { detail: "date_from and date_to must be YYYY-MM-DD" },
      { status: 422, headers: { "x-ww-cache": "skip" } }
    );
  }
  if (dateFrom > dateTo) {
    return NextResponse.json(
      { detail: "date_from must not be after date_to" },
      { status: 422, headers: { "x-ww-cache": "skip" } }
    );
  }

  const cacheKey = getCacheKey(dateFrom, dateTo);

  if (modeParam === "snapshot") {
    const cached = await readCachedSnapshot(cacheKey);
    if (cached) {
      return NextResponse.json<DashboardAnalyticsRouteResponse>(
        { cached: true, data: cached },
        { headers: { "x-ww-cache": "hit" } }
      );
    }

    try {
      const analytics = await fetchAnalyticsResponse(
        token,
        dateFrom,
        dateTo,
        "snapshot"
      );
      const bundle = toBundle(analytics);
      await writeCachedSnapshot(cacheKey, bundle);
      return NextResponse.json<DashboardAnalyticsRouteResponse>(
        { cached: false, data: bundle },
        { headers: { "x-ww-cache": redis ? "refresh" : "disabled" } }
      );
    } catch (err) {
      if (err instanceof BackendRequestError) {
        const cacheState =
          err.status === 404 ? (redis ? "miss" : "disabled") : "error";
        return NextResponse.json(
          { detail: err.message },
          { status: err.status, headers: { "x-ww-cache": cacheState } }
        );
      }

      const message =
        err instanceof Error ? err.message : "Failed to fetch analytics snapshot";
      return NextResponse.json(
        { detail: message },
        { status: 502, headers: { "x-ww-cache": "error" } }
      );
    }
  }

  try {
    const analytics = await fetchAnalyticsResponse(token, dateFrom, dateTo, "live");
    return NextResponse.json<DashboardAnalyticsRouteResponse>(
      { cached: false, data: toBundle(analytics) },
      { headers: { "x-ww-cache": "bypass" } }
    );
  } catch (err) {
    const cached = await readCachedSnapshot(cacheKey);
    if (cached) {
      return NextResponse.json<DashboardAnalyticsRouteResponse>(
        { cached: true, data: cached },
        { headers: { "x-ww-cache": "stale-fallback" } }
      );
    }

    try {
      const snapshot = await fetchAnalyticsResponse(
        token,
        dateFrom,
        dateTo,
        "snapshot"
      );
      const bundle = toBundle(snapshot);
      await writeCachedSnapshot(cacheKey, bundle);
      return NextResponse.json<DashboardAnalyticsRouteResponse>(
        { cached: false, data: bundle },
        { headers: { "x-ww-cache": "snapshot-fallback" } }
      );
    } catch (snapshotErr) {
      if (err instanceof BackendRequestError) {
        return NextResponse.json(
          { detail: err.message },
          { status: err.status, headers: { "x-ww-cache": "error" } }
        );
      }

      if (snapshotErr instanceof BackendRequestError && snapshotErr.status !== 404) {
        return NextResponse.json(
          { detail: snapshotErr.message },
          { status: snapshotErr.status, headers: { "x-ww-cache": "error" } }
        );
      }

      const message =
        err instanceof Error ? err.message : "Failed to fetch live analytics";
      return NextResponse.json(
        { detail: message },
        { status: 502, headers: { "x-ww-cache": "error" } }
      );
    }
  }
}
