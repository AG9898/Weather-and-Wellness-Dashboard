import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyToolActivity,
  chatErrorMessage,
  extractSourceLinks,
  isPrivacyUnavailable,
} from "@/lib/components/RaChatPanel";
import { ApiError, streamRaChat, type RAChatStreamEvent } from "@/lib/api";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Build a mock Response whose body streams the given SSE frames. */
function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function sseFrame(event: RAChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe("extractSourceLinks", () => {
  it("pulls deduped http(s) URLs and trims trailing punctuation", () => {
    const text =
      "See https://openrouter.ai/docs and also https://example.com/study. " +
      "Repeat https://example.com/study again.";
    expect(extractSourceLinks(text)).toEqual([
      "https://openrouter.ai/docs",
      "https://example.com/study",
    ]);
  });

  it("returns an empty list when no links are present", () => {
    expect(extractSourceLinks("No sources cited in this answer.")).toEqual([]);
  });
});

describe("isPrivacyUnavailable", () => {
  it("flags privacy / ZDR / unavailable refusals", () => {
    expect(isPrivacyUnavailable("Assistant unavailable")).toBe(true);
    expect(isPrivacyUnavailable("Privacy safeguards not satisfied")).toBe(true);
    expect(isPrivacyUnavailable("ZDR routing required")).toBe(true);
  });

  it("treats ordinary scope refusals and empty reasons as not privacy-unavailable", () => {
    expect(isPrivacyUnavailable("permission_denied for this lab scope")).toBe(false);
    expect(isPrivacyUnavailable(null)).toBe(false);
    expect(isPrivacyUnavailable(undefined)).toBe(false);
  });
});

describe("chatErrorMessage", () => {
  it("maps auth failures to a re-auth prompt", () => {
    expect(chatErrorMessage(new ApiError(401, "nope"))).toMatch(/sign in again/i);
    expect(chatErrorMessage(new ApiError(403, "nope"))).toMatch(/sign in again/i);
  });

  it("maps 503 to a privacy-aware unavailable message", () => {
    expect(chatErrorMessage(new ApiError(503, "down"))).toMatch(/unavailable/i);
  });

  it("never leaks raw error detail for unknown failures", () => {
    const message = chatErrorMessage(new Error("DATABASE_URL=postgres://secret"));
    expect(message).not.toContain("secret");
    expect(message).toMatch(/try again/i);
  });
});

describe("applyToolActivity", () => {
  it("appends a running tool affordance", () => {
    expect(applyToolActivity([], "get_data_coverage", "running")).toEqual([
      { toolName: "get_data_coverage", status: "running" },
    ]);
  });

  it("resolves the matching running tool in place", () => {
    const running = applyToolActivity([], "survey_scores", "running");
    expect(applyToolActivity(running, "survey_scores", "resolved")).toEqual([
      { toolName: "survey_scores", status: "resolved" },
    ]);
  });

  it("appends a resolved entry when no running tool matches", () => {
    expect(applyToolActivity([], "orphan", "resolved")).toEqual([
      { toolName: "orphan", status: "resolved" },
    ]);
  });
});

describe("RaChatPanel UI contract", () => {
  const source = readFrontendFile("src/lib/components/RaChatPanel.tsx");

  it("routes all model access through the typed streaming wrapper, never bare fetch", () => {
    expect(source).toContain("streamRaChat");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/openrouter/i);
  });

  it("renders incremental tokens and running tool affordances", () => {
    expect(source).toContain("onToken");
    expect(source).toContain("ToolActivityList");
    expect(source).toMatch(/Running/);
  });

  it("offers no file-download / export action", () => {
    expect(source).not.toMatch(/download=/i);
    expect(source).not.toMatch(/createObjectURL/i);
    expect(source).not.toMatch(/\.csv|\.xlsx|\.zip/i);
  });

  it("renders loading, error, empty, and privacy-unavailable states", () => {
    expect(source).toContain('status === "loading"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("showEmptyState");
    expect(source).toContain("isPrivacyUnavailable");
  });

  it("surfaces tool results and source citations", () => {
    expect(source).toContain("ToolSummaries");
    expect(source).toContain("SourceLinks");
  });
});

describe("streamRaChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits typed token/tool events and resolves with the final response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        sseFrame({ type: "tool_running", tool_name: "get_data_coverage" }),
        sseFrame({
          type: "tool_resolved",
          tool_name: "get_data_coverage",
          summary: "ready: 12 participants",
          status: "ready",
        }),
        sseFrame({ type: "token", text: "Your lab " }),
        sseFrame({ type: "token", text: "has 12 participants." }),
        sseFrame({
          type: "done",
          response: {
            conversation_id: "c1",
            message: "Your lab has 12 participants.",
            model: "primary/model",
            tool_results: [
              { tool_name: "get_data_coverage", summary: "ready: 12 participants" },
            ],
            blocked_reason: null,
          },
        }),
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    const tokens: string[] = [];
    const running: string[] = [];
    let resolvedStatus = "";
    const res = await streamRaChat(
      { message: "how many participants?" },
      {
        onToken: (t) => tokens.push(t),
        onToolRunning: (name) => running.push(name),
        onToolResolved: (e) => {
          resolvedStatus = e.status;
        },
      }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ra/chat",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe("text/event-stream");
    expect(tokens.join("")).toBe("Your lab has 12 participants.");
    expect(running).toEqual(["get_data_coverage"]);
    expect(resolvedStatus).toBe("ready");
    expect(res.message).toBe("Your lab has 12 participants.");
    expect(res.conversation_id).toBe("c1");
  });

  it("throws ApiError on a terminal error event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        sseFrame({
          type: "error",
          message: "The assistant is temporarily unavailable.",
          blocked_reason: "model_unavailable",
        }),
      ])
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(streamRaChat({ message: "hi" })).rejects.toBeInstanceOf(ApiError);
  });

  it("maps a non-ok proxy response to ApiError without reading a stream", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(streamRaChat({ message: "hi" })).rejects.toMatchObject({
      status: 401,
    });
  });
});
