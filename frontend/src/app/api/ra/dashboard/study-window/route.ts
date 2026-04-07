/**
 * GET /api/ra/dashboard/study-window
 *
 * Server-only Vercel Route Handler for the dashboard anchor-date metadata read.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - Proxies the backend's latest study day payload for browser-owned reads
 */

import { NextRequest, NextResponse } from "next/server";

import type { DashboardStudyWindowResponse } from "@/lib/api";
import { fetchBackend, throwIfBackendNotOk } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireRaBearerToken(req, { failureCacheState: "skip" });
  if (!auth.ok) {
    return auth.response;
  }

  const response = await fetchBackend("/dashboard/study-window", {
    token: auth.token,
    cache: "no-store",
  });
  await throwIfBackendNotOk(response, "Backend /dashboard/study-window");

  const body = (await response.json()) as DashboardStudyWindowResponse;
  return NextResponse.json(body, { status: response.status });
}
