import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/route-handler-auth", () => ({
  requireRaBearerToken: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-backend", () => ({
  fetchBackend: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-cache", () => ({
  DASHBOARD_WEATHER_CACHE_POLICY: {
    keyPrefix: "ww:ra:dashboard:v1",
    ttlSeconds: 60 * 60 * 24,
    renewal: "fixed-expiry-on-write",
  },
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

describe("GET /api/ra/dashboard", () => {
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

    const response = await GET(new NextRequest("http://localhost/api/ra/dashboard"));

    expect(response.status).toBe(401);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
  });

  it("returns a cached dashboard bundle on cache hit", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        weather: { items: [], forecast_periods: [] },
        cached_at: "2026-03-12T00:00:00.000Z",
      },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard?mode=cached")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("hit");
    expect(response.headers.get("x-ww-cache-renewal")).toBe("fixed-expiry-on-write");
    expect(response.headers.get("x-ww-cache-ttl")).toBe("86400");
    expect(body.cached).toBe(true);
    expect(body.data.weather.items).toEqual([]);
  });

  it("returns a cache miss when no bundle is stored", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "miss",
      value: null,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard?mode=cached")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("miss");
    expect(body).toEqual({ cached: false, data: null });
  });

  it("returns a refreshed live bundle on success", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValueOnce(
      Response.json({ items: [], forecast_periods: [] })
    );
    vi.mocked(writeCacheValue).mockResolvedValue("refresh");

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard?mode=live")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("refresh");
    expect(body.cached).toBe(false);
    expect(body.data.weather.items).toEqual([]);
    expect(fetchBackend).toHaveBeenCalledOnce();
    expect(fetchBackend).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/weather\/daily\?start=\d{4}-\d{2}-\d{2}&end=\d{4}-\d{2}-\d{2}&include_forecast_periods=false$/
      ),
      { token: "token" }
    );
    expect(writeCacheValue).toHaveBeenCalledWith(
      "ww:ra:dashboard:v1",
      expect.objectContaining({
        cached_at: expect.any(String),
        weather: { items: [], forecast_periods: [] },
      }),
      86400
    );
  });

  it("marks live success as disabled when Redis is unavailable", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValueOnce(
      Response.json({ items: [], forecast_periods: [] })
    );
    vi.mocked(writeCacheValue).mockResolvedValue("disabled");

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard?mode=live")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("disabled");
  });

  it("falls back to stale cached data when the live fetch fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockRejectedValue(new Error("Timed out calling backend"));
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        weather: { items: [], forecast_periods: [] },
        cached_at: "2026-03-12T00:00:00.000Z",
      },
    });

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard?mode=live")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("stale-fallback");
    expect(body.cached).toBe(true);
    expect(body.data.weather.items).toEqual([]);
  });

  it("rejects unsupported mode values", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });

    const response = await GET(
      new NextRequest("http://localhost/api/ra/dashboard?mode=invalid")
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
    expect(body).toEqual({ detail: "mode must be cached or live" });
    expect(fetchBackend).not.toHaveBeenCalled();
  });
});
