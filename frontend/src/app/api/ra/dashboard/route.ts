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
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const CACHE_KEY = "ww:ra:dashboard:v1";
const CACHE_TTL = 300; // seconds

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

async function fetchLiveBundle(token: string): Promise<DashboardBundle> {
  const today = new Date().toISOString().slice(0, 10);
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const [summaryRes, weatherRes] = await Promise.all([
    fetch(`${BACKEND_URL}/dashboard/summary`, { headers }),
    fetch(`${BACKEND_URL}/weather/daily?start=${today}&end=${today}`, {
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
      { status: 401 }
    );
  }

  const valid = await verifySupabaseJWT(token);
  if (!valid) {
    return NextResponse.json(
      { detail: "Invalid or expired token" },
      { status: 401 }
    );
  }

  // 2. Dispatch by mode
  const mode = req.nextUrl.searchParams.get("mode") ?? "cached";

  if (mode === "cached") {
    if (redis) {
      try {
        const cached = await redis.get<DashboardBundle>(CACHE_KEY);
        if (cached) {
          return NextResponse.json<DashboardRouteResponse>({
            cached: true,
            data: cached,
          });
        }
      } catch {
        // Redis unavailable — fall through to indicate cache miss
      }
    }
    // Cache miss or Redis unavailable
    return NextResponse.json<DashboardRouteResponse>({
      cached: false,
      data: null,
    });
  }

  // mode === "live": fetch fresh data, populate cache, return
  try {
    const bundle = await fetchLiveBundle(token);

    // Write to Redis — fire-and-forget so a slow/failing Redis doesn't block the response
    if (redis) {
      redis.set(CACHE_KEY, bundle, { ex: CACHE_TTL }).catch(() => {
        // Ignore Redis write errors — live data is still returned
      });
    }

    return NextResponse.json<DashboardRouteResponse>({
      cached: false,
      data: bundle,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch live data";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
