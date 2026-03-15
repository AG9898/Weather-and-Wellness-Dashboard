/**
 * GET /api/ra/weather/range?mode=cached|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Server-only Vercel Route Handler for RA weather range data.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - mode=cached → returns bundle from Upstash Redis (fast path)
 * - mode=live   → fetches fresh data from the Render backend, writes to Redis, returns bundle
 */

import { NextRequest, NextResponse } from "next/server";

import type { WeatherDailyResponse } from "@/lib/api";
import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";
import {
  WEATHER_RANGE_CACHE_POLICY,
  buildCacheKey,
  jsonWithCacheState,
  readCacheValue,
  writeCacheValue,
} from "@/lib/server/route-handler-cache";
import { readRequiredDateRange } from "@/lib/server/route-handler-validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherRangeBundle {
  weather: WeatherDailyResponse;
  cached_at: string; // ISO 8601
}

export interface WeatherRangeRouteResponse {
  cached: boolean;
  data: WeatherRangeBundle | null;
}

const CACHE_KEY_PREFIX = WEATHER_RANGE_CACHE_POLICY.keyPrefix;
type WeatherRangeRouteMode = "cached" | "live";

function isWeatherRangeRouteMode(value: string): value is WeatherRangeRouteMode {
  return value === "cached" || value === "live";
}

// ── Live fetch ────────────────────────────────────────────────────────────────

async function fetchLiveWeatherRange(
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<WeatherRangeBundle> {
  const weatherRes = await fetchBackend(
    `/weather/daily?start=${dateFrom}&end=${dateTo}&include_forecast_periods=false&include_latest_run=false`,
    { token, cache: "no-store" }
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
  if (!isWeatherRangeRouteMode(mode)) {
    return jsonWithCacheState(
      { detail: "mode must be cached or live" },
      {
        status: 422,
        cachePolicy: WEATHER_RANGE_CACHE_POLICY,
        cacheState: "skip",
      }
    );
  }

  const dateRange = readRequiredDateRange(req.nextUrl.searchParams, {
    enforceOrder: true,
  });
  if (!dateRange.ok) {
    return jsonWithCacheState(
      { detail: dateRange.detail },
      {
        status: 422,
        cachePolicy: WEATHER_RANGE_CACHE_POLICY,
        cacheState: "skip",
      }
    );
  }

  const { dateFrom, dateTo } = dateRange.value;
  const cacheKey = buildCacheKey(CACHE_KEY_PREFIX, dateFrom, dateTo);

  if (mode === "cached") {
    const cached = await readCacheValue<WeatherRangeBundle>(cacheKey);
    if (cached.state === "hit") {
      return jsonWithCacheState<WeatherRangeRouteResponse>(
        { cached: true, data: cached.value },
        {
          cachePolicy: WEATHER_RANGE_CACHE_POLICY,
          cacheState: "hit",
        }
      );
    }

    return jsonWithCacheState<WeatherRangeRouteResponse>(
      { cached: false, data: null },
      {
        cachePolicy: WEATHER_RANGE_CACHE_POLICY,
        cacheState: cached.state,
      }
    );
  }

  try {
    const bundle = await fetchLiveWeatherRange(token, dateFrom, dateTo);
    const cacheState = await writeCacheValue(
      cacheKey,
      bundle,
      WEATHER_RANGE_CACHE_POLICY.ttlSeconds
    );

    return jsonWithCacheState<WeatherRangeRouteResponse>(
      { cached: false, data: bundle },
      {
        cachePolicy: WEATHER_RANGE_CACHE_POLICY,
        cacheState,
      }
    );
  } catch (err) {
    const cached = await readCacheValue<WeatherRangeBundle>(cacheKey);
    if (cached.state === "hit") {
      return jsonWithCacheState<WeatherRangeRouteResponse>(
        { cached: true, data: cached.value },
        {
          cachePolicy: WEATHER_RANGE_CACHE_POLICY,
          cacheState: "stale-fallback",
        }
      );
    }

    const message =
      err instanceof Error ? err.message : "Failed to fetch live weather range";
    return jsonWithCacheState(
      { detail: message },
      {
        status: 502,
        cachePolicy: WEATHER_RANGE_CACHE_POLICY,
        cacheState: "error",
      }
    );
  }
}
