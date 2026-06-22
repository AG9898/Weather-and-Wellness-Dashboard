import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { shouldShowRAFloatingChrome } from "@/lib/components/RAFloatingChrome";
import { LAB_REGISTRY, buildDockItems } from "@/lib/labs";

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
  it("exposes Chat as a Weather-Wellness dock item pointing at /chat", () => {
    const chat = LAB_REGISTRY.ww.items.find((item) => item.href === "/chat");
    expect(chat).toBeDefined();
    expect(chat?.label).toBe("Chat");
    // Chat is a shared RA surface, reachable without admin role.
    expect(buildDockItems("ww", "ra").some((item) => item.href === "/chat")).toBe(true);
  });

  it("guards /chat behind RA middleware", () => {
    const middleware = readFrontendFile("src/middleware.ts");
    expect(middleware).toContain('"/chat/:path*"');
  });
});
