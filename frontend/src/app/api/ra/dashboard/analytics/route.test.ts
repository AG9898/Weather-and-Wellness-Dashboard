import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/route-handler-auth", () => ({
  requireRaBearerToken: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-backend", () => {
  class BackendRequestError extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
      this.name = "BackendRequestError";
    }
  }

  return {
    BackendRequestError,
    fetchBackend: vi.fn(),
    throwIfBackendNotOk: vi.fn(async (response: Response, endpoint: string) => {
      if (!response.ok) {
        throw new BackendRequestError(`${endpoint} returned ${response.status}`, response.status);
      }
    }),
  };
});

vi.mock("@/lib/server/route-handler-cache", () => ({
  ANALYTICS_SNAPSHOT_CACHE_POLICY: {
    keyPrefix: "ww:ra:analytics:snapshot:v2",
    ttlSeconds: 60 * 60 * 24,
    renewal: "fixed-expiry-on-write",
  },
  buildCacheKey: vi.fn((prefix: string, ...parts: string[]) => [prefix, ...parts].join(":")),
  jsonWithCacheState: vi.fn(
    (
      body: unknown,
      init?: ResponseInit & {
        cachePolicy?: { renewal: string; ttlSeconds: number };
        cacheState?: string;
      }
    ) => {
      const headers = new Headers(init?.headers);
      if (init?.cacheState) {
        headers.set("x-ww-cache", init.cacheState);
      }
      if (init?.cachePolicy) {
        headers.set("x-ww-cache-renewal", init.cachePolicy.renewal);
        headers.set("x-ww-cache-ttl", String(init.cachePolicy.ttlSeconds));
      }
      return NextResponse.json(body, { status: init?.status, headers });
    }
  ),
  readCacheValue: vi.fn(),
  writeCacheValue: vi.fn(),
}));

import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";
import {
  readCacheValue,
  writeCacheValue,
} from "@/lib/server/route-handler-cache";
import { GET } from "./route";

function buildAnalyticsResponse(status: "ready" | "stale" | "recomputing") {
  const generatedAt = "2026-03-12T00:00:00Z";
  return {
    status,
    response_version: "dashboard-analytics-v2",
    snapshot: {
      mode: status === "ready" ? "snapshot" : "live",
      response_version: "dashboard-analytics-v2",
      model_version: "weather-mlm-v2",
      generated_at: generatedAt,
      is_stale: status !== "ready",
      recompute_started_at: status === "ready" ? null : generatedAt,
      recompute_finished_at: status === "stale" ? generatedAt : null,
    },
    dataset: {
      date_from: "2026-03-01",
      date_to: "2026-03-08",
      included_sessions: 24,
      included_days: 8,
      native_rows: 20,
      imported_rows: 4,
      excluded_rows: 2,
      exclusion_reasons: [],
      generated_at: generatedAt,
    },
    models: [],
    temperature_summary: {
      windows: [],
    },
    visualizations: null,
  };
}

describe("GET /api/ra/dashboard/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { detail: "Missing Authorization header" },
        { status: 401, headers: { "x-ww-cache": "skip" } }
      ),
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?date_from=2026-03-01&date_to=2026-03-12"
      )
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
  });

  it("returns the cached snapshot on snapshot hit", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        analytics: buildAnalyticsResponse("ready"),
        cached_at: "2026-03-12T00:00:00.000Z",
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=snapshot&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("hit");
    expect(response.headers.get("x-ww-cache-renewal")).toBe("fixed-expiry-on-write");
    expect(response.headers.get("x-ww-cache-ttl")).toBe("86400");
    expect(body.cached).toBe(true);
    expect(body.data.analytics.status).toBe("ready");
    expect(body.data.analytics.response_version).toBe("dashboard-analytics-v2");
    expect(body.data.analytics.temperature_summary).toEqual({ windows: [] });
    expect(body.refresh).toEqual({
      requested: false,
      state: "idle",
      detail: "Serving the latest stored analytics snapshot for this study window.",
    });
  });

  it("returns a refreshed snapshot bundle on success", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "miss",
      value: null,
    });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json(buildAnalyticsResponse("ready"))
    );
    vi.mocked(writeCacheValue).mockResolvedValue("refresh");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=snapshot&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("refresh");
    expect(body.cached).toBe(false);
    expect(body.refresh.state).toBe("idle");
    expect(writeCacheValue).toHaveBeenCalledWith(
      "ww:ra:analytics:snapshot:v2:2026-03-01:2026-03-12",
      expect.objectContaining({
        analytics: expect.objectContaining({
          status: "ready",
          response_version: "dashboard-analytics-v2",
          temperature_summary: { windows: [] },
        }),
        cached_at: expect.any(String),
      }),
      86400
    );
  });

  it("returns a snapshot miss when Redis is healthy but no snapshot exists", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "miss",
      value: null,
    });
    vi.mocked(fetchBackend).mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=snapshot&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get("x-ww-cache")).toBe("miss");
    expect(body.detail).toContain("returned 404");
  });

  it("writes the returned analytics state on successful live refresh requests", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ status: "recomputing", metadata: { generated_at: "2026-03-12T00:00:00Z" } })
    );
    vi.mocked(writeCacheValue).mockResolvedValue("refresh");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=live&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("refresh");
    expect(body.refresh).toEqual({
      requested: true,
      state: "recomputing",
      detail:
        "Background recompute requested. Showing the last successful snapshot until the backend finishes.",
    });
    expect(writeCacheValue).toHaveBeenCalledTimes(1);
  });

  it("falls back to the cached snapshot when live recompute fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockRejectedValue(new Error("Timed out calling backend"));
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        analytics: buildAnalyticsResponse("stale"),
        cached_at: "2026-03-12T00:00:00.000Z",
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=live&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("stale-fallback");
    expect(body.cached).toBe(true);
    expect(body.refresh.requested).toBe(true);
  });

  it("falls back to backend snapshot mode when live recompute and Redis snapshot both miss", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend)
      .mockRejectedValueOnce(new Error("Timed out calling backend"))
      .mockResolvedValueOnce(Response.json(buildAnalyticsResponse("ready")));
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "miss",
      value: null,
    });
    vi.mocked(writeCacheValue).mockResolvedValue("refresh");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=live&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("snapshot-fallback");
    expect(body.cached).toBe(false);
    expect(body.data.analytics.status).toBe("ready");
    expect(body.refresh.requested).toBe(true);
  });

  it("revalidates cached recomputing snapshots against the backend", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        analytics: buildAnalyticsResponse("recomputing"),
        cached_at: "2026-03-12T00:00:00.000Z",
      },
    });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json(buildAnalyticsResponse("ready"))
    );
    vi.mocked(writeCacheValue).mockResolvedValue("refresh");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=snapshot&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("refresh");
    expect(body.cached).toBe(false);
    expect(body.data.analytics.status).toBe("ready");
    expect(body.data.analytics.response_version).toBe("dashboard-analytics-v2");
  });
});
