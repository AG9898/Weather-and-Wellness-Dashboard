/**
 * POST /api/ra/chat
 *
 * Server-only Vercel Route Handler that proxies the RA data chatbot request to
 * the FastAPI backend.
 * - Verifies the Supabase JWT from Authorization: Bearer <token> before proxying.
 * - Forwards the JSON body unchanged so backend Pydantic validation is the single
 *   source of truth for the request contract.
 * - Default: proxies to backend POST /chat and returns the JSON response verbatim.
 * - Streaming: when the request asks for SSE (Accept: text/event-stream), it
 *   proxies to backend POST /chat/stream and passes the SSE body through
 *   unbuffered so the panel can render tokens and tool affordances live.
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

function wantsStream(req: NextRequest): boolean {
  return (req.headers.get("Accept") ?? "").includes("text/event-stream");
}

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const auth = await requireRaBearerToken(req);
  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.text();
  const stream = wantsStream(req);

  const response = await fetchBackend(stream ? "/chat/stream" : "/chat", {
    token: auth.token,
    method: "POST",
    body,
    cache: "no-store",
    ...(stream ? { headers: { Accept: "text/event-stream" } } : {}),
  });

  if (!stream) {
    const payload = (await response.json().catch(() => ({}))) as
      | RAChatResponse
      | { detail: string };
    return NextResponse.json(payload, { status: response.status });
  }

  // A non-2xx backend (e.g. auth/validation failure) never starts a stream, so
  // surface it as a JSON error the client wrapper can map without leaking detail.
  if (!response.ok || response.body === null) {
    const payload = (await response.json().catch(() => ({
      detail: `Backend returned ${response.status}`,
    }))) as { detail?: string };
    return NextResponse.json(
      { detail: payload.detail ?? `Backend returned ${response.status}` },
      { status: response.status || 502 }
    );
  }

  // Pass the SSE body through unbuffered. The browser still never reaches
  // OpenRouter; only this server-side proxy talks to the backend.
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
