/**
 * POST /api/ra/chat
 *
 * Server-only Vercel Route Handler that proxies the RA data chatbot request to
 * the FastAPI backend (canonical path: backend POST /chat).
 * - Verifies the Supabase JWT from Authorization: Bearer <token> before proxying.
 * - Forwards the JSON body unchanged so backend Pydantic validation is the single
 *   source of truth for the request contract.
 * - Returns the backend response body and status verbatim.
 *
 * This same-origin proxy is the only browser-reachable path to the chatbot. The
 * browser never holds OpenRouter credentials and never calls OpenRouter directly;
 * all model and data-tool access is mediated server-side by FastAPI.
 */

import { NextRequest, NextResponse } from "next/server";

import type { RAChatResponse } from "@/lib/api";
import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireRaBearerToken(req);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.text();

  const response = await fetchBackend("/chat", {
    token: auth.token,
    method: "POST",
    body,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as
    | RAChatResponse
    | { detail: string };
  return NextResponse.json(payload, { status: response.status });
}
