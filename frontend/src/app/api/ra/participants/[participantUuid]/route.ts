/**
 * GET /api/ra/participants/[participantUuid]
 *
 * Server-only Vercel Route Handler that proxies the backend participant read.
 * - Verifies the Supabase JWT from Authorization: Bearer <token>
 * - Returns the participant with demographics, or 404 if not found.
 * - Does not add aggregation; demographics-only in this first pass.
 */

import { NextRequest, NextResponse } from "next/server";

import type { ParticipantResponse } from "@/lib/api";
import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ participantUuid: string }> }
): Promise<NextResponse> {
  const auth = await requireRaBearerToken(req, { failureCacheState: "skip" });
  if (!auth.ok) {
    return auth.response;
  }

  const { participantUuid } = await params;

  const response = await fetchBackend(`/participants/${participantUuid}`, {
    token: auth.token,
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as
    | ParticipantResponse
    | { detail: string };
  return NextResponse.json(body, { status: response.status });
}
