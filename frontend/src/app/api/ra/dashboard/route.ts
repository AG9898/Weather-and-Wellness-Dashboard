/**
 * GET /api/ra/dashboard?mode=cached|live
 *
 * Server-only Vercel Route Handler for RA dashboard data.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - mode=cached  → returns bundle from Upstash Redis (fast path)
 * - mode=live    → fetches fresh data from the Render backend, writes to Redis, returns bundle
 *
 * Redis credentials (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) are server-only env vars
 * set by the Vercel Upstash integration. If absent the cache layer is skipped gracefully.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Redis } from "@upstash/redis";
import type { DashboardSummaryResponse, WeatherDailyResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardBundle {
  summary: DashboardSummaryResponse;
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

export interface DashboardRouteResponse {
  cached: boolean;
  data: DashboardBundle | null;
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

const CACHE_KEY = "ww:ra:dashboard:v1";
// Keep cache around long enough to survive backend cold starts; UI can still refresh live when needed.
const CACHE_TTL = 60 * 60 * 24; // 24 hours — matches weather/range TTL; ensures stale fallback survives overnight cold starts

// ── JWT verification ──────────────────────────────────────────────────────────

// Lazy JWKS set — created once on first request; jose caches the fetched keys.
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

/**
 * Verify a Supabase JWT.
 * Tries ES256 via JWKS first; falls back to HS256 using SUPABASE_JWT_SECRET if set.
 * Returns true if the token is valid, false otherwise.
 */
async function verifySupabaseJWT(token: string): Promise<boolean> {
  // Primary: ES256 via JWKS
  const jwksSet = getJWKS();
  if (jwksSet) {
    try {
      await jwtVerify(token, jwksSet);
      return true;
    } catch {
      // Fall through to HS256 fallback
    }
  }

  // Fallback: HS256 using JWT secret
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

// ── Live bundle fetch ─────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
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

async function fetchLiveBundle(token: string): Promise<DashboardBundle> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const [summaryRes, weatherRes] = await Promise.all([
    fetchWithTimeout(`${BACKEND_URL}/dashboard/summary`, { headers }),
    fetchWithTimeout(`${BACKEND_URL}/weather/daily?start=${today}&end=${today}`, {
      headers,
    }),
  ]);

  if (!summaryRes.ok) {
    throw new Error(
      `Backend /dashboard/summary returned ${summaryRes.status}`
    );
  }
  if (!weatherRes.ok) {
    throw new Error(
      `Backend /weather/daily returned ${weatherRes.status}`
    );
  }

  const [summary, weather] = (await Promise.all([
    summaryRes.json(),
    weatherRes.json(),
  ])) as [DashboardSummaryResponse, WeatherDailyResponse];

  return { summary, weather, cached_at: new Date().toISOString() };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 1. Extract and verify JWT
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

  // 2. Dispatch by mode
  const mode = req.nextUrl.searchParams.get("mode") ?? "cached";

  if (mode === "cached") {
    if (redis) {
      try {
        const cached = await redis.get<DashboardBundle>(CACHE_KEY);
        if (cached) {
          return NextResponse.json<DashboardRouteResponse>(
            { cached: true, data: cached },
            { headers: { "x-ww-cache": "hit" } }
          );
        }
      } catch {
        // Redis unavailable — fall through to indicate cache miss
      }
    }
    // Cache miss or Redis unavailable
    return NextResponse.json<DashboardRouteResponse>(
      { cached: false, data: null },
      { headers: { "x-ww-cache": redis ? "miss" : "disabled" } }
    );
  }

  // mode === "live": fetch fresh data, populate cache, return
  try {
    const bundle = await fetchLiveBundle(token);

    // Write to Redis (awaited) — in serverless environments, fire-and-forget writes may be
    // dropped when the function returns.
    if (redis) {
      try {
        await redis.set(CACHE_KEY, bundle, { ex: CACHE_TTL });
      } catch {
        // Ignore Redis write errors — live data is still returned
      }
    }

    return NextResponse.json<DashboardRouteResponse>(
      { cached: false, data: bundle },
      { headers: { "x-ww-cache": "refresh" } }
    );
  } catch (err) {
    // If live fetch fails, best-effort stale fallback to existing cache.
    if (redis) {
      try {
        const cached = await redis.get<DashboardBundle>(CACHE_KEY);
        if (cached) {
          return NextResponse.json<DashboardRouteResponse>(
            { cached: true, data: cached },
            { headers: { "x-ww-cache": "stale-fallback" } }
          );
        }
      } catch {
        // Ignore stale fallback errors and return the live failure below.
      }
    }

    const message =
      err instanceof Error ? err.message : "Failed to fetch live data";
    return NextResponse.json(
      { detail: message },
      { status: 502, headers: { "x-ww-cache": "error" } }
    );
  }
}
