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

import type { WeatherDailyResponse } from "@/lib/api";
import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";
import {
  DASHBOARD_WEATHER_CACHE_POLICY,
  jsonWithCacheState,
  readCacheValue,
  writeCacheValue,
} from "@/lib/server/route-handler-cache";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardWeatherBundle {
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

export interface DashboardWeatherRouteResponse {
  cached: boolean;
  data: DashboardWeatherBundle | null;
}

const CACHE_KEY = DASHBOARD_WEATHER_CACHE_POLICY.keyPrefix;
type DashboardRouteMode = "cached" | "live";

function isDashboardRouteMode(value: string): value is DashboardRouteMode {
  return value === "cached" || value === "live";
}

// ── Live bundle fetch ─────────────────────────────────────────────────────────

async function fetchLiveBundle(token: string): Promise<DashboardWeatherBundle> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
  }).format(new Date());

  const weatherRes = await fetchBackend(
    `/weather/daily?start=${today}&end=${today}&include_forecast_periods=false`,
    { token }
  );
  if (!weatherRes.ok) {
    throw new Error(`Backend /weather/daily returned ${weatherRes.status}`);
  }

  const weather = (await weatherRes.json()) as WeatherDailyResponse;

  return { weather, cached_at: new Date().toISOString() };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireRaBearerToken(req, { failureCacheState: "skip" });
  if (!auth.ok) {
    return auth.response;
  }

  const token = auth.token;
  const mode = req.nextUrl.searchParams.get("mode") ?? "cached";
  if (!isDashboardRouteMode(mode)) {
    return jsonWithCacheState(
      { detail: "mode must be cached or live" },
      {
        status: 422,
        cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
        cacheState: "skip",
      }
    );
  }

  if (mode === "cached") {
    const cached = await readCacheValue<DashboardWeatherBundle>(CACHE_KEY);
    if (cached.state === "hit") {
      return jsonWithCacheState<DashboardWeatherRouteResponse>(
        { cached: true, data: cached.value },
        {
          cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
          cacheState: "hit",
        }
      );
    }

    return jsonWithCacheState<DashboardWeatherRouteResponse>(
      { cached: false, data: null },
      {
        cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
        cacheState: cached.state,
      }
    );
  }

  try {
    const bundle = await fetchLiveBundle(token);
    const cacheState = await writeCacheValue(
      CACHE_KEY,
      bundle,
      DASHBOARD_WEATHER_CACHE_POLICY.ttlSeconds
    );

    return jsonWithCacheState<DashboardWeatherRouteResponse>(
      { cached: false, data: bundle },
      {
        cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
        cacheState,
      }
    );
  } catch (err) {
    const cached = await readCacheValue<DashboardWeatherBundle>(CACHE_KEY);
    if (cached.state === "hit") {
      return jsonWithCacheState<DashboardWeatherRouteResponse>(
        { cached: true, data: cached.value },
        {
          cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
          cacheState: "stale-fallback",
        }
      );
    }

    const message =
      err instanceof Error ? err.message : "Failed to fetch live data";
    return jsonWithCacheState(
      { detail: message },
      {
        status: 502,
        cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
        cacheState: "error",
      }
    );
  }
}
