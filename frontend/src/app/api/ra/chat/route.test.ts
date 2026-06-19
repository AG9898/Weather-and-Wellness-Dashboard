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

function chatRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ra/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
});
