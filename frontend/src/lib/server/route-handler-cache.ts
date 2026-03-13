import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export type RouteCacheState =
  | "skip"
  | "hit"
  | "miss"
  | "disabled"
  | "refresh"
  | "stale-fallback"
  | "error"
  | "bypass"
  | "snapshot-fallback";

export type CacheRenewalPolicy = "fixed-expiry-on-write";

export interface RouteCachePolicy {
  keyPrefix: string;
  ttlSeconds: number;
  renewal: CacheRenewalPolicy;
}

export type CacheReadResult<T> =
  | {
      state: "hit";
      value: T;
    }
  | {
      state: "miss" | "disabled";
      value: null;
    };

export type CacheWriteResult = "refresh" | "disabled";

export const DASHBOARD_WEATHER_CACHE_POLICY: RouteCachePolicy = {
  keyPrefix: "ww:ra:dashboard:v1",
  ttlSeconds: 60 * 60 * 24,
  renewal: "fixed-expiry-on-write",
};

export const WEATHER_RANGE_CACHE_POLICY: RouteCachePolicy = {
  keyPrefix: "ww:ra:weather:range:v1",
  ttlSeconds: 60 * 60 * 24,
  renewal: "fixed-expiry-on-write",
};

export const ANALYTICS_SNAPSHOT_CACHE_POLICY: RouteCachePolicy = {
  keyPrefix: "ww:ra:analytics:snapshot:v1",
  ttlSeconds: 60 * 60 * 24,
  renewal: "fixed-expiry-on-write",
};

let redisClient: Redis | null | undefined;

function getRedisConfig():
  | {
      url: string;
      token: string;
    }
  | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const config = getRedisConfig();
  redisClient = config ? new Redis(config) : null;
  return redisClient;
}

export function buildCacheKey(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join(":");
}

export async function readCacheValue<T>(key: string): Promise<CacheReadResult<T>> {
  const redis = getRedisClient();
  if (!redis) {
    return {
      state: "disabled",
      value: null,
    };
  }

  try {
    const value = await redis.get<T>(key);
    if (value === null) {
      return {
        state: "miss",
        value: null,
      };
    }

    return {
      state: "hit",
      value,
    };
  } catch {
    return {
      state: "disabled",
      value: null,
    };
  }
}

export async function writeCacheValue(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<CacheWriteResult> {
  const redis = getRedisClient();
  if (!redis) {
    return "disabled";
  }

  try {
    await redis.set(key, value, { ex: ttlSeconds });
    return "refresh";
  } catch {
    return "disabled";
  }
}

export function jsonWithCacheState<T>(
  body: T,
  init: ResponseInit & {
    cachePolicy?: RouteCachePolicy;
    cacheState?: RouteCacheState;
  } = {}
): NextResponse<T> {
  const headers = new Headers(init.headers);
  if (init.cacheState) {
    headers.set("x-ww-cache", init.cacheState);
  }
  if (init.cachePolicy) {
    headers.set("x-ww-cache-renewal", init.cachePolicy.renewal);
    headers.set("x-ww-cache-ttl", String(init.cachePolicy.ttlSeconds));
  }

  return NextResponse.json(body, {
    status: init.status,
    headers,
  });
}
