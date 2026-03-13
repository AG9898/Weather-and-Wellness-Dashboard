import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/route-handler-auth", () => ({
  requireRaBearerToken: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-backend", () => ({
  fetchBackend: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-cache", () => ({
  WEATHER_RANGE_CACHE_POLICY: {
    keyPrefix: "ww:ra:weather:range:v1",
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

describe("GET /api/ra/weather/range", () => {
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
      new NextRequest("http://localhost/api/ra/weather/range?date_from=2026-03-01&date_to=2026-03-12")
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
  });

  it("returns disabled when the cached weather route has no Redis client", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "disabled",
      value: null,
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/weather/range?date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("disabled");
    expect(body).toEqual({ cached: false, data: null });
  });

  it("returns a refreshed live range bundle on success", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ items: [{ date_local: "2026-03-01" }], forecast_periods: [] })
    );
    vi.mocked(writeCacheValue).mockResolvedValue("refresh");

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/weather/range?mode=live&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("refresh");
    expect(response.headers.get("x-ww-cache-renewal")).toBe("fixed-expiry-on-write");
    expect(response.headers.get("x-ww-cache-ttl")).toBe("86400");
    expect(body.cached).toBe(false);
    expect(fetchBackend).toHaveBeenCalledWith(
      "/weather/daily?start=2026-03-01&end=2026-03-12&include_forecast_periods=false&include_latest_run=false",
      { token: "token", cache: "no-store" }
    );
    expect(writeCacheValue).toHaveBeenCalledWith(
      "ww:ra:weather:range:v1:2026-03-01:2026-03-12",
      expect.objectContaining({
        cached_at: expect.any(String),
        weather: { items: [{ date_local: "2026-03-01" }], forecast_periods: [] },
      }),
      86400
    );
  });

  it("falls back to stale cached weather data when the live fetch fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockRejectedValue(new Error("Timed out calling backend"));
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        weather: { items: [{ date_local: "2026-03-01" }], forecast_periods: [] },
        cached_at: "2026-03-12T00:00:00.000Z",
      },
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/weather/range?mode=live&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("stale-fallback");
    expect(body.cached).toBe(true);
  });

  it("rejects unsupported mode values", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/weather/range?mode=invalid&date_from=2026-03-01&date_to=2026-03-12"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
    expect(body).toEqual({ detail: "mode must be cached or live" });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("rejects inverted date ranges before calling the backend", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/weather/range?mode=live&date_from=2026-03-12&date_to=2026-03-01"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(response.headers.get("x-ww-cache")).toBe("skip");
    expect(body).toEqual({ detail: "date_from must not be after date_to" });
    expect(fetchBackend).not.toHaveBeenCalled();
  });
});
