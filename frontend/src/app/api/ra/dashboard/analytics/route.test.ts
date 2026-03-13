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
    keyPrefix: "ww:ra:analytics:snapshot:v1",
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
        analytics: { status: "ready" },
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
  });

  it("returns a refreshed snapshot bundle on success", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "miss",
      value: null,
    });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ status: "ready", metadata: { generated_at: "2026-03-12T00:00:00Z" } })
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
    expect(writeCacheValue).toHaveBeenCalledWith(
      "ww:ra:analytics:snapshot:v1:2026-03-01:2026-03-12",
      expect.objectContaining({
        analytics: { status: "ready", metadata: { generated_at: "2026-03-12T00:00:00Z" } },
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

  it("bypasses Redis on successful live recompute responses", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ status: "ready", metadata: { generated_at: "2026-03-12T00:00:00Z" } })
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/ra/dashboard/analytics?mode=live&date_from=2026-03-01&date_to=2026-03-12"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ww-cache")).toBe("bypass");
    expect(writeCacheValue).not.toHaveBeenCalled();
  });

  it("falls back to the cached snapshot when live recompute fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend).mockRejectedValue(new Error("Timed out calling backend"));
    vi.mocked(readCacheValue).mockResolvedValue({
      state: "hit",
      value: {
        analytics: { status: "stale" },
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
  });

  it("falls back to backend snapshot mode when live recompute and Redis snapshot both miss", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({ ok: true, token: "token" });
    vi.mocked(fetchBackend)
      .mockRejectedValueOnce(new Error("Timed out calling backend"))
      .mockResolvedValueOnce(
        Response.json({ status: "ready", metadata: { generated_at: "2026-03-12T00:00:00Z" } })
      );
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
  });
});
