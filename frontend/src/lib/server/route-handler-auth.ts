import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";

import {
  jsonWithCacheState,
  type RouteCacheState,
} from "@/lib/server/route-handler-cache";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> | null {
  if (jwks) {
    return jwks;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl) {
    return null;
  }

  jwks = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
  );
  return jwks;
}

export function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function verifySupabaseJWT(token: string): Promise<boolean> {
  const jwksSet = getJWKS();
  if (jwksSet) {
    try {
      await jwtVerify(token, jwksSet);
      return true;
    } catch {
      // Fall through to HS256 fallback.
    }
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      await jwtVerify(token, secret);
      return true;
    } catch {
      // Invalid token.
    }
  }

  return false;
}

export type AuthorizedTokenResult =
  | { ok: true; token: string }
  | { ok: false; response: NextResponse<{ detail: string }> };

export async function requireRaBearerToken(
  req: NextRequest,
  options: { failureCacheState?: RouteCacheState } = {}
): Promise<AuthorizedTokenResult> {
  const token = extractBearerToken(req);
  const failureCacheState = options.failureCacheState;

  if (!token) {
    return {
      ok: false,
      response: jsonWithCacheState(
        { detail: "Missing Authorization header" },
        { status: 401, cacheState: failureCacheState }
      ),
    };
  }

  const valid = await verifySupabaseJWT(token);
  if (!valid) {
    return {
      ok: false,
      response: jsonWithCacheState(
        { detail: "Invalid or expired token" },
        { status: 401, cacheState: failureCacheState }
      ),
    };
  }

  return { ok: true, token };
}

