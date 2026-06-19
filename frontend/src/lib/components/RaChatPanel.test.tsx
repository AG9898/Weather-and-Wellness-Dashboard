import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  chatErrorMessage,
  extractSourceLinks,
  isPrivacyUnavailable,
} from "@/lib/components/RaChatPanel";
import { ApiError } from "@/lib/api";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
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

describe("RaChatPanel UI contract", () => {
  const source = readFrontendFile("src/lib/components/RaChatPanel.tsx");

  it("routes all model access through the typed postRaChat wrapper, never bare fetch", () => {
    expect(source).toContain("postRaChat");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/openrouter/i);
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
