/**
 * GET /api/ra/dashboard/analytics?mode=snapshot|live&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Server-only Vercel Route Handler for RA dashboard analytics reads.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - mode=snapshot → returns a cached snapshot bundle when available, otherwise proxies backend snapshot mode
 * - mode=live     → requests a background backend recompute and returns the current snapshot state fast
 */

import { NextRequest, NextResponse } from "next/server";

import type { DashboardAnalyticsResponse } from "@/lib/api";
import {
  BackendRequestError,
  fetchBackend,
  throwIfBackendNotOk,
} from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";
import {
  ANALYTICS_SNAPSHOT_CACHE_POLICY,
  buildCacheKey,
  jsonWithCacheState,
  readCacheValue,
  writeCacheValue,
} from "@/lib/server/route-handler-cache";
import { readRequiredDateRange } from "@/lib/server/route-handler-validation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AnalyticsRouteMode = "snapshot" | "live";
type AnalyticsRefreshState = "idle" | "recomputing" | "ready";

interface DashboardAnalyticsBundle {
  analytics: DashboardAnalyticsResponse;
  cached_at: string;
}

interface DashboardAnalyticsRefreshInfo {
  requested: boolean;
  state: AnalyticsRefreshState;
  detail: string;
}

interface DashboardAnalyticsRouteResponse {
  cached: boolean;
  data: DashboardAnalyticsBundle | null;
  refresh: DashboardAnalyticsRefreshInfo;
}

const CACHE_KEY_PREFIX = ANALYTICS_SNAPSHOT_CACHE_POLICY.keyPrefix;

function isAnalyticsRouteMode(value: string): value is AnalyticsRouteMode {
  return value === "snapshot" || value === "live";
}

function getCacheKey(dateFrom: string, dateTo: string): string {
  return buildCacheKey(CACHE_KEY_PREFIX, dateFrom, dateTo);
}

function toBundle(
  analytics: DashboardAnalyticsResponse
): DashboardAnalyticsBundle {
  return {
    analytics,
    cached_at: new Date().toISOString(),
  };
}

function getRefreshInfo(
  bundle: DashboardAnalyticsBundle | null,
  requested: boolean
): DashboardAnalyticsRefreshInfo {
  const status = bundle?.analytics.status;

  if (requested) {
    if (status === "recomputing") {
      return {
        requested: true,
        state: "recomputing",
        detail:
          "Background recompute requested. Showing the last successful snapshot until the backend finishes.",
      };
    }
    return {
      requested: true,
      state: "ready",
      detail: "Analytics refresh completed and the latest backend result is now visible.",
    };
  }

  if (status === "recomputing") {
    return {
      requested: false,
      state: "recomputing",
      detail:
        "A background analytics recompute is still running. This response is serving the last successful snapshot.",
    };
  }

  return {
    requested: false,
    state: "idle",
    detail: bundle
      ? "Serving the latest stored analytics snapshot for this study window."
      : "No analytics snapshot is stored for this study window yet.",
  };
}

function toRouteResponse(
  bundle: DashboardAnalyticsBundle | null,
  options: { cached: boolean; requested: boolean }
): DashboardAnalyticsRouteResponse {
  return {
    cached: options.cached,
    data: bundle,
    refresh: getRefreshInfo(bundle, options.requested),
  };
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
  const res = await fetchBackend(`/dashboard/analytics?${params.toString()}`, {
    token,
    cache: "no-store",
  });

  await throwIfBackendNotOk(res, "Backend /dashboard/analytics");
  return res.json() as Promise<DashboardAnalyticsResponse>;
}

async function readCachedSnapshot(
  cacheKey: string
){
  return readCacheValue<DashboardAnalyticsBundle>(cacheKey);
}

async function writeCachedSnapshot(
  cacheKey: string,
  bundle: DashboardAnalyticsBundle
){
  return writeCacheValue(
    cacheKey,
    bundle,
    ANALYTICS_SNAPSHOT_CACHE_POLICY.ttlSeconds
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireRaBearerToken(req, { failureCacheState: "skip" });
  if (!auth.ok) {
    return auth.response;
  }

  const token = auth.token;
  const modeParam = req.nextUrl.searchParams.get("mode") ?? "snapshot";
  const dateRange = readRequiredDateRange(req.nextUrl.searchParams, {
    enforceOrder: true,
  });

  if (!isAnalyticsRouteMode(modeParam)) {
    return jsonWithCacheState(
      { detail: "mode must be snapshot or live" },
      {
        status: 422,
        cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
        cacheState: "skip",
      }
    );
  }
  if (!dateRange.ok) {
    return jsonWithCacheState(
      { detail: dateRange.detail },
      {
        status: 422,
        cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
        cacheState: "skip",
      }
    );
  }

  const { dateFrom, dateTo } = dateRange.value;
  const cacheKey = getCacheKey(dateFrom, dateTo);

  if (modeParam === "snapshot") {
    const cached = await readCachedSnapshot(cacheKey);
    const cachedNeedsRevalidation =
      cached.state === "hit" && cached.value.analytics.status === "recomputing";

    if (cached.state === "hit" && !cachedNeedsRevalidation) {
      return jsonWithCacheState<DashboardAnalyticsRouteResponse>(
        toRouteResponse(cached.value, { cached: true, requested: false }),
        {
          cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
          cacheState: "hit",
        }
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
      const cacheState = await writeCachedSnapshot(cacheKey, bundle);
      return jsonWithCacheState<DashboardAnalyticsRouteResponse>(
        toRouteResponse(bundle, { cached: false, requested: false }),
        {
          cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
          cacheState,
        }
      );
    } catch (err) {
      if (cached.state === "hit") {
        return jsonWithCacheState<DashboardAnalyticsRouteResponse>(
          toRouteResponse(cached.value, { cached: true, requested: false }),
          {
            cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
            cacheState: "hit",
          }
        );
      }

      if (err instanceof BackendRequestError) {
        const cacheState = err.status === 404 ? cached.state : "error";
        return jsonWithCacheState(
          { detail: err.message },
          {
            status: err.status,
            cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
            cacheState,
          }
        );
      }

      const message =
        err instanceof Error ? err.message : "Failed to fetch analytics snapshot";
      return jsonWithCacheState(
        { detail: message },
        {
          status: 502,
          cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
          cacheState: "error",
        }
      );
    }
  }

  try {
    const analytics = await fetchAnalyticsResponse(token, dateFrom, dateTo, "live");
    const bundle = toBundle(analytics);
    const cacheState = await writeCachedSnapshot(cacheKey, bundle);
    return jsonWithCacheState<DashboardAnalyticsRouteResponse>(
      toRouteResponse(bundle, { cached: false, requested: true }),
      {
        cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
        cacheState,
      }
    );
  } catch (err) {
    const cached = await readCachedSnapshot(cacheKey);
    if (cached.state === "hit") {
      return jsonWithCacheState<DashboardAnalyticsRouteResponse>(
        toRouteResponse(cached.value, { cached: true, requested: true }),
        {
          cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
          cacheState: "stale-fallback",
        }
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
      return jsonWithCacheState<DashboardAnalyticsRouteResponse>(
        toRouteResponse(bundle, { cached: false, requested: true }),
        {
          cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
          cacheState: "snapshot-fallback",
        }
      );
    } catch (snapshotErr) {
      if (err instanceof BackendRequestError) {
        return jsonWithCacheState(
          { detail: err.message },
          {
            status: err.status,
            cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
            cacheState: "error",
          }
        );
      }

      if (snapshotErr instanceof BackendRequestError && snapshotErr.status !== 404) {
        return jsonWithCacheState(
          { detail: snapshotErr.message },
          {
            status: snapshotErr.status,
            cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
            cacheState: "error",
          }
        );
      }

      const message =
        err instanceof Error ? err.message : "Failed to fetch live analytics";
      return jsonWithCacheState(
        { detail: message },
        {
          status: 502,
          cachePolicy: ANALYTICS_SNAPSHOT_CACHE_POLICY,
          cacheState: "error",
        }
      );
    }
  }
}
