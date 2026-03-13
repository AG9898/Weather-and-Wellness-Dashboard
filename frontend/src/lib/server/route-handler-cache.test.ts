import { beforeEach, describe, expect, it, vi } from "vitest";

const redisGet = vi.fn();
const redisSet = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    get = redisGet;
    set = redisSet;
  },
}));

async function importCacheModule() {
  vi.resetModules();
  return import("@/lib/server/route-handler-cache");
}

describe("route-handler-cache", () => {
  beforeEach(() => {
    redisGet.mockReset();
    redisSet.mockReset();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("joins the prefix and all parts with colons", async () => {
    const { buildCacheKey } = await importCacheModule();

    expect(buildCacheKey("ww:ra:weather:range:v1", "2026-03-01", "2026-03-12")).toBe(
      "ww:ra:weather:range:v1:2026-03-01:2026-03-12"
    );
  });

  it("writes cache values with a fixed expiry from the last write", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    redisSet.mockResolvedValue("OK");

    const { writeCacheValue } = await importCacheModule();
    const state = await writeCacheValue("ww:test:key", { ok: true }, 3600);

    expect(state).toBe("refresh");
    expect(redisSet).toHaveBeenCalledWith("ww:test:key", { ok: true }, { ex: 3600 });
  });

  it("treats cache reads as non-renewing lookups", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    redisGet.mockResolvedValue({ ok: true });

    const { readCacheValue } = await importCacheModule();
    const result = await readCacheValue<{ ok: boolean }>("ww:test:key");

    expect(result).toEqual({
      state: "hit",
      value: { ok: true },
    });
    expect(redisGet).toHaveBeenCalledWith("ww:test:key");
    expect(redisSet).not.toHaveBeenCalled();
  });

  it("adds the standardized cache diagnostic headers", async () => {
    const {
      DASHBOARD_WEATHER_CACHE_POLICY,
      jsonWithCacheState,
    } = await importCacheModule();
    const response = jsonWithCacheState(
      { ok: true },
      {
        cachePolicy: DASHBOARD_WEATHER_CACHE_POLICY,
        cacheState: "refresh",
        headers: { "content-language": "en-CA" },
      }
    );

    expect(response.headers.get("x-ww-cache")).toBe("refresh");
    expect(response.headers.get("x-ww-cache-renewal")).toBe("fixed-expiry-on-write");
    expect(response.headers.get("x-ww-cache-ttl")).toBe("86400");
    expect(response.headers.get("content-language")).toBe("en-CA");
  });
});
