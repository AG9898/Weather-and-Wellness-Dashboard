import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { shouldShowRAFloatingChrome } from "@/lib/components/RAFloatingChrome";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("shouldShowRAFloatingChrome", () => {
  it("shows the dock on the /chat page", () => {
    expect(shouldShowRAFloatingChrome("/chat")).toBe(true);
  });

  it("keeps showing the dock on existing RA surfaces", () => {
    expect(shouldShowRAFloatingChrome("/dashboard")).toBe(true);
    expect(shouldShowRAFloatingChrome("/misokinesia")).toBe(true);
  });

  it("hides the dock on unknown or participant routes", () => {
    expect(shouldShowRAFloatingChrome("/")).toBe(false);
    expect(shouldShowRAFloatingChrome("/new-session")).toBe(false);
    expect(shouldShowRAFloatingChrome(null)).toBe(false);
  });
});

describe("RA dock Chat entry", () => {
  const source = readFrontendFile("src/lib/components/RAFloatingChrome.tsx");

  it("includes a non-admin Chat dock item pointing at /chat", () => {
    expect(source).toContain('href: "/chat"');
    expect(source).toContain('label: "Chat"');
    // The Chat entry must be reachable by all RA/admin users (not adminOnly).
    const chatEntry = source.match(/\{[^}]*href:\s*"\/chat"[^}]*\}/);
    expect(chatEntry).not.toBeNull();
    expect(chatEntry?.[0]).toContain("adminOnly: false");
  });

  it("guards /chat behind RA middleware", () => {
    const middleware = readFrontendFile("src/middleware.ts");
    expect(middleware).toContain('"/chat/:path*"');
  });
});
