import { readdirSync } from "node:fs";
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
      "weather/range/route.ts",
    ]);
  });

  it("exports only the active dashboard route wrappers", () => {
    expect(api).toHaveProperty("getDashboardWeatherBundle");
    expect(api).toHaveProperty("getWeatherRangeBundle");
    expect(api).toHaveProperty("getDashboardAnalyticsBundle");
    expect(api).not.toHaveProperty("getDashboardRangeBundle");
  });
});
