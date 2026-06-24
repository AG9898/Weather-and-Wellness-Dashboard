import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import * as api from "@/lib/api";

function collectRouteFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = prefix ? join(prefix, entry.name) : entry.name;
      const absolutePath = join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectRouteFiles(absolutePath, relativePath);
      }

      return entry.isFile() && entry.name === "route.ts" ? [relativePath] : [];
    })
    .sort();
}

describe("RA route topology", () => {
  it("keeps only the shipped dashboard-related route handlers under /api/ra", () => {
    const raApiRoot = resolve(process.cwd(), "src/app/api/ra");
    const routeFiles = collectRouteFiles(raApiRoot).filter(
      (file) => file.startsWith("dashboard/") || file.startsWith("weather/")
    );

    expect(routeFiles).toEqual([
      "dashboard/analytics/route.ts",
      "dashboard/route.ts",
      "dashboard/study-window/route.ts",
      "weather/range/route.ts",
    ]);
  });

  it("ships the RA chatbot proxy route handler under /api/ra/chat", () => {
    const raApiRoot = resolve(process.cwd(), "src/app/api/ra");
    const routeFiles = collectRouteFiles(raApiRoot).filter((file) =>
      file.startsWith("chat/")
    );

    expect(routeFiles).toEqual(["chat/route.ts"]);
  });

  it("ships the participant demographics route handler under /api/ra/participants", () => {
    const raApiRoot = resolve(process.cwd(), "src/app/api/ra");
    const routeFiles = collectRouteFiles(raApiRoot).filter((file) =>
      file.startsWith("participants/")
    );

    expect(routeFiles).toEqual([
      "participants/[participantUuid]/route.ts",
    ]);
  });

  it("exports only the active dashboard route wrappers", () => {
    expect(api).toHaveProperty("getDashboardWeatherBundle");
    expect(api).toHaveProperty("getWeatherRangeBundle");
    expect(api).toHaveProperty("getDashboardStudyWindow");
    expect(api).toHaveProperty("getDashboardAnalyticsBundle");
    expect(api).not.toHaveProperty("getDashboardRangeBundle");
  });

  it("exports the participant demographics helper", () => {
    expect(api).toHaveProperty("getParticipantDemographics");
  });

  it("exports the RA chatbot wrapper", () => {
    expect(api).toHaveProperty("postRaChat");
  });

  it("/account/password page exists under (ra) layout and middleware protects /account/*", () => {
    const passwordPage = resolve(
      process.cwd(),
      "src/app/(ra)/account/password/page.tsx"
    );
    expect(existsSync(passwordPage)).toBe(true);

    const middlewareSrc = readFileSync(
      resolve(process.cwd(), "src/middleware.ts"),
      "utf8"
    );
    expect(middlewareSrc).toContain('"/account/:path*"');
  });

  it("protects IHTT RA pages in middleware", () => {
    const middlewareSrc = readFileSync(
      resolve(process.cwd(), "src/middleware.ts"),
      "utf8"
    );
    expect(middlewareSrc).toContain('"/ihtt/:path*"');
  });
});
