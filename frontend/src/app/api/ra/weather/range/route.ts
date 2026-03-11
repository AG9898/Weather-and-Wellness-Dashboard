/**
 * GET /api/ra/weather/range?mode=cached|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Server-only Vercel Route Handler for RA weather range data.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - mode=cached → returns bundle from Upstash Redis (fast path)
 * - mode=live   → fetches fresh data from the Render backend, writes to Redis, returns bundle
 */

import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Redis } from "@upstash/redis";
import type { WeatherDailyResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherRangeBundle {
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

export interface WeatherRangeRouteResponse {
  cached: boolean;
  data: WeatherRangeBundle | null;
}

// ── Redis client (server-only; graceful no-op if env vars absent) ─────────────

const redis =
  (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
  (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)
    ? new Redis({
        url: (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
        token: (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
      })
    : null;

const CACHE_KEY_PREFIX = "ww:ra:weather:range:v1";
const CACHE_TTL = 60 * 60 * 24; // 24 hours

// ── JWT verification ──────────────────────────────────────────────────────────

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
      // Fall through to HS256 fallback
    }
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      await jwtVerify(token, secret);
      return true;
    } catch {
      // Invalid token
    }
  }

  return false;
}

// ── Live fetch ────────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BACKEND_FETCH_TIMEOUT_MS = 15_000;

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

function isIsoDate(value: string): boolean {
  return DATE_RE.test(value);
}

async function fetchLiveWeatherRange(
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<WeatherRangeBundle> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const weatherRes = await fetchWithTimeout(
    `${BACKEND_URL}/weather/daily?start=${dateFrom}&end=${dateTo}&include_forecast_periods=false`,
    { headers, cache: "no-store" }
  );
  if (!weatherRes.ok) {
    throw new Error(`Backend /weather/daily returned ${weatherRes.status}`);
  }
  const weather = (await weatherRes.json()) as WeatherDailyResponse;
  return { weather, cached_at: new Date().toISOString() };
}

function getCacheKey(dateFrom: string, dateTo: string): string {
  return `${CACHE_KEY_PREFIX}:${dateFrom}:${dateTo}`;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

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

  const mode = req.nextUrl.searchParams.get("mode") ?? "cached";
  const dateFrom = req.nextUrl.searchParams.get("date_from") ?? "";
  const dateTo = req.nextUrl.searchParams.get("date_to") ?? "";

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

  const cacheKey = getCacheKey(dateFrom, dateTo);

  if (mode === "cached") {
    if (redis) {
      try {
        const cached = await redis.get<WeatherRangeBundle>(cacheKey);
        if (cached) {
          return NextResponse.json<WeatherRangeRouteResponse>(
            { cached: true, data: cached },
            { headers: { "x-ww-cache": "hit" } }
          );
        }
      } catch {
        // fall through
      }
    }
    return NextResponse.json<WeatherRangeRouteResponse>(
      { cached: false, data: null },
      { headers: { "x-ww-cache": redis ? "miss" : "disabled" } }
    );
  }

  try {
    const bundle = await fetchLiveWeatherRange(token, dateFrom, dateTo);
    if (redis) {
      try {
        await redis.set(cacheKey, bundle, { ex: CACHE_TTL });
      } catch {
        // ignore write errors
      }
    }
    return NextResponse.json<WeatherRangeRouteResponse>(
      { cached: false, data: bundle },
      { headers: { "x-ww-cache": "refresh" } }
    );
  } catch (err) {
    // If live fetch fails, best-effort stale fallback to existing cache.
    if (redis) {
      try {
        const cached = await redis.get<WeatherRangeBundle>(cacheKey);
        if (cached) {
          return NextResponse.json<WeatherRangeRouteResponse>(
            { cached: true, data: cached },
            { headers: { "x-ww-cache": "stale-fallback" } }
          );
        }
      } catch {
        // Ignore stale fallback errors and return the live failure below.
      }
    }

    const message =
      err instanceof Error ? err.message : "Failed to fetch live weather range";
    return NextResponse.json(
      { detail: message },
      { status: 502, headers: { "x-ww-cache": "error" } }
    );
  }
}
