import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/route-handler-auth", () => ({
  requireRaBearerToken: vi.fn(),
}));

vi.mock("@/lib/server/route-handler-backend", () => ({
  fetchBackend: vi.fn(),
}));

import { fetchBackend } from "@/lib/server/route-handler-backend";
import { requireRaBearerToken } from "@/lib/server/route-handler-auth";
import { POST } from "./route";

function chatRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/ra/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function sseBackendResponse(payload: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("POST /api/ra/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without proxying when auth fails", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { detail: "Missing Authorization header" },
        { status: 401 }
      ),
    });

    const response = await POST(chatRequest({ message: "hi" }));

    expect(response.status).toBe(401);
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it("proxies the request body to the backend /chat path with the bearer token", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: true,
      token: "token",
    });
    const backendBody = {
      conversation_id: "11111111-1111-1111-1111-111111111111",
      message: "Here is a summary.",
      model: "test-model",
      tool_results: [],
      blocked_reason: null,
    };
    vi.mocked(fetchBackend).mockResolvedValue(Response.json(backendBody));

    const response = await POST(chatRequest({ message: "summarize" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(backendBody);
    expect(fetchBackend).toHaveBeenCalledOnce();
    expect(fetchBackend).toHaveBeenCalledWith("/chat", {
      token: "token",
      method: "POST",
      body: JSON.stringify({ message: "summarize" }),
      cache: "no-store",
    });
  });

  it("forwards the backend error status and detail", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: true,
      token: "token",
    });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ detail: "Chat is unavailable" }, { status: 503 })
    );

    const response = await POST(chatRequest({ message: "hi" }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ detail: "Chat is unavailable" });
  });

  it("proxies to /chat/stream and passes the SSE body through when streaming", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: true,
      token: "token",
    });
    const frame = 'data: {"type":"token","text":"hi"}\n\n';
    vi.mocked(fetchBackend).mockResolvedValue(sseBackendResponse(frame));

    const response = await POST(
      chatRequest({ message: "stream please" }, { Accept: "text/event-stream" })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    expect(await response.text()).toBe(frame);
    expect(fetchBackend).toHaveBeenCalledWith("/chat/stream", {
      token: "token",
      method: "POST",
      body: JSON.stringify({ message: "stream please" }),
      cache: "no-store",
      headers: { Accept: "text/event-stream" },
    });
  });

  it("surfaces a non-ok backend as JSON when a stream was requested", async () => {
    vi.mocked(requireRaBearerToken).mockResolvedValue({
      ok: true,
      token: "token",
    });
    vi.mocked(fetchBackend).mockResolvedValue(
      Response.json({ detail: "Chat is unavailable" }, { status: 503 })
    );

    const response = await POST(
      chatRequest({ message: "hi" }, { Accept: "text/event-stream" })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ detail: "Chat is unavailable" });
  });
});
