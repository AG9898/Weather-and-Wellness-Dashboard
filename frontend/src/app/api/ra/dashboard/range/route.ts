/**
 * GET /api/ra/dashboard/range?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 *
 * Server-only Vercel Route Handler for range-filtered RA dashboard data.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - Fetches live range-filtered backend data (no Redis path)
 * - Returns a single typed bundle for KPIs + weather + participants/day graph
 */

import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type {
  DashboardParticipantsPerDayResponse,
  DashboardSummaryRangeResponse,
  WeatherDailyResponse,
} from "@/lib/api";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardRangeBundle {
  summary: DashboardSummaryRangeResponse;
  weather: WeatherDailyResponse;
  participants_per_day: DashboardParticipantsPerDayResponse;
  cached_at: string; // ISO 8601
}

export interface DashboardRangeRouteResponse {
  cached: false;
  data: DashboardRangeBundle;
}

// ── JWT verification ──────────────────────────────────────────────────────────

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> | null {
  if (jwks) return jwks;
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl) return null;
  jwks = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
  );
  return jwks;
}

async function verifySupabaseJWT(token: string): Promise<boolean> {
  const jwksSet = getJWKS();
  if (jwksSet) {
    try {
      await jwtVerify(token, jwksSet);
      return true;
    } catch {
      // Fall through to HS256 fallback
    }
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      await jwtVerify(token, secret);
      return true;
    } catch {
      // Invalid token
    }
  }

  return false;
}

// ── Live bundle fetch ─────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class BackendRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

function isIsoDate(value: string): boolean {
  return DATE_RE.test(value);
}

async function throwIfNotOk(res: Response, endpoint: string): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => ({} as { detail?: unknown }));
  const detail =
    typeof body.detail === "string"
      ? body.detail
      : `${endpoint} returned ${res.status}`;
  throw new BackendRequestError(detail, res.status);
}

async function fetchRangeBundle(
  token: string,
  dateFrom: string,
  dateTo: string
): Promise<DashboardRangeBundle> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const [summaryRes, weatherRes, participantsRes] = await Promise.all([
    fetch(
      `${BACKEND_URL}/dashboard/summary/range?date_from=${dateFrom}&date_to=${dateTo}`,
      { headers, cache: "no-store" }
    ),
    fetch(`${BACKEND_URL}/weather/daily?start=${dateFrom}&end=${dateTo}`, {
      headers,
      cache: "no-store",
    }),
    fetch(
      `${BACKEND_URL}/dashboard/participants-per-day?start=${dateFrom}&end=${dateTo}`,
      { headers, cache: "no-store" }
    ),
  ]);

  await Promise.all([
    throwIfNotOk(summaryRes, "Backend /dashboard/summary/range"),
    throwIfNotOk(weatherRes, "Backend /weather/daily"),
    throwIfNotOk(participantsRes, "Backend /dashboard/participants-per-day"),
  ]);

  const [summary, weather, participantsPerDay] = (await Promise.all([
    summaryRes.json(),
    weatherRes.json(),
    participantsRes.json(),
  ])) as [
    DashboardSummaryRangeResponse,
    WeatherDailyResponse,
    DashboardParticipantsPerDayResponse,
  ];

  return {
    summary,
    weather,
    participants_per_day: participantsPerDay,
    cached_at: new Date().toISOString(),
  };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return NextResponse.json(
      { detail: "Missing Authorization header" },
      { status: 401 }
    );
  }

  const valid = await verifySupabaseJWT(token);
  if (!valid) {
    return NextResponse.json(
      { detail: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const dateFrom = req.nextUrl.searchParams.get("date_from") ?? "";
  const dateTo = req.nextUrl.searchParams.get("date_to") ?? "";
  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { detail: "date_from and date_to are required" },
      { status: 422 }
    );
  }
  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return NextResponse.json(
      { detail: "date_from and date_to must be YYYY-MM-DD" },
      { status: 422 }
    );
  }

  try {
    const bundle = await fetchRangeBundle(token, dateFrom, dateTo);
    return NextResponse.json<DashboardRangeRouteResponse>({
      cached: false,
      data: bundle,
    });
  } catch (err) {
    if (err instanceof BackendRequestError) {
      return NextResponse.json({ detail: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to fetch range data";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
