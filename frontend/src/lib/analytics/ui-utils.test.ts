/**
 * Unit tests for analytics dashboard UI utility functions.
 *
 * Covers all analytics status states (loading → ready, stale, recomputing,
 * insufficient_data, failed), error message resolution, and formatting helpers.
 */

import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  buildAnalyticsWarningDisplayItems,
  compareEffectsByStrength,
  formatOutcomeLabel,
  formatPValue,
  formatSigned,
  formatTermLabel,
  formatTermPart,
  getAnalyticsErrorMessage,
  getStatusPanel,
} from "./ui-utils";
import type { DashboardAnalyticsResponse } from "@/lib/api";

// ---------------------------------------------------------------------------
// Minimal response fixture factory
// ---------------------------------------------------------------------------

function makeAnalytics(status: DashboardAnalyticsResponse["status"]): DashboardAnalyticsResponse {
  return {
    status,
    response_version: "dashboard-analytics-v1",
    snapshot: {
      mode: "snapshot",
      response_version: "dashboard-analytics-v1",
      model_version: "weather-mlm-v1",
      generated_at: "2026-03-10T18:00:00Z",
      is_stale: status === "stale" || status === "recomputing",
      recompute_started_at: null,
      recompute_finished_at: null,
    },
    dataset: {
      date_from: "2026-03-01",
      date_to: "2026-03-10",
      included_sessions: 24,
      included_days: 8,
      native_rows: 20,
      imported_rows: 4,
      excluded_rows: 2,
      exclusion_reasons: [],
      generated_at: "2026-03-10T18:00:00Z",
    },
    models: [],
    visualizations: null,
  };
}

// ---------------------------------------------------------------------------
// getStatusPanel — all analytics UI states
// ---------------------------------------------------------------------------

describe("getStatusPanel", () => {
  it("returns ready panel for status=ready", () => {
    const panel = getStatusPanel(makeAnalytics("ready"));
    expect(panel.title).toBe("Snapshot ready");
    expect(panel.body).toContain("latest analytics snapshot");
  });

  it("returns stale panel for status=stale", () => {
    const panel = getStatusPanel(makeAnalytics("stale"));
    expect(panel.title).toBe("Snapshot is stale");
    expect(panel.body).toContain("prior successful snapshot");
    expect(panel.className).toContain("amber");
  });

  it("returns recomputing panel for status=recomputing", () => {
    const panel = getStatusPanel(makeAnalytics("recomputing"));
    expect(panel.title).toBe("Recompute in progress");
    expect(panel.body).toContain("live recompute is running");
    expect(panel.className).toContain("sky");
  });

  it("returns insufficient_data panel for status=insufficient_data", () => {
    const panel = getStatusPanel(makeAnalytics("insufficient_data"));
    expect(panel.title).toBe("Insufficient data");
    expect(panel.body).toContain("not enough complete rows");
  });

  it("returns failed panel for status=failed", () => {
    const panel = getStatusPanel(makeAnalytics("failed"));
    expect(panel.title).toBe("Analytics recompute failed");
    expect(panel.body).toContain("Operational KPIs");
    expect(panel.className).toContain("destructive");
  });

  it("each status produces a non-empty title, body, and className", () => {
    const statuses: DashboardAnalyticsResponse["status"][] = [
      "ready",
      "stale",
      "recomputing",
      "insufficient_data",
      "failed",
    ];
    for (const status of statuses) {
      const panel = getStatusPanel(makeAnalytics(status));
      expect(panel.title.length).toBeGreaterThan(0);
      expect(panel.body.length).toBeGreaterThan(0);
      expect(panel.className.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getAnalyticsErrorMessage — loading/error UI states
// ---------------------------------------------------------------------------

describe("getAnalyticsErrorMessage", () => {
  it("returns auth message for 401", () => {
    const msg = getAnalyticsErrorMessage(new ApiError(401, "Unauthorized"));
    expect(msg).toContain("lab session expired");
  });

  it("returns not-found message for 404", () => {
    const msg = getAnalyticsErrorMessage(new ApiError(404, "Not found"));
    expect(msg).toContain("No analytics snapshot exists");
  });

  it("returns unavailable message for 500", () => {
    const msg = getAnalyticsErrorMessage(new ApiError(500, "Internal Server Error"));
    expect(msg).toContain("temporarily unavailable");
  });

  it("returns unavailable message for 503", () => {
    const msg = getAnalyticsErrorMessage(new ApiError(503, "Service Unavailable"));
    expect(msg).toContain("temporarily unavailable");
  });

  it("returns generic API message for other status codes", () => {
    const msg = getAnalyticsErrorMessage(new ApiError(429, "Too many requests"));
    expect(msg).toContain("429");
    expect(msg).toContain("Too many requests");
  });

  it("returns fallback message for non-ApiError", () => {
    const msg = getAnalyticsErrorMessage(new Error("network failure"));
    expect(msg).toBe("Unable to load dashboard analytics right now.");
  });

  it("returns fallback message for unknown thrown value", () => {
    const msg = getAnalyticsErrorMessage("something went wrong");
    expect(msg).toBe("Unable to load dashboard analytics right now.");
  });
});

// ---------------------------------------------------------------------------
// formatTermLabel and formatTermPart — term/predictor formatting
// ---------------------------------------------------------------------------

describe("formatTermLabel", () => {
  it("formats a simple z-scored predictor correctly", () => {
    expect(formatTermLabel("temperature_z")).toBe("Temperature");
  });

  it("formats an interaction term with x separator", () => {
    expect(formatTermLabel("precipitation_z:depression_z")).toBe("Precipitation x Depression");
  });

  it("formats daylight_z:depression_z interaction", () => {
    expect(formatTermLabel("daylight_z:depression_z")).toBe("Daylight x Depression");
  });

  it("formats precipitation_z:loneliness_z interaction", () => {
    expect(formatTermLabel("precipitation_z:loneliness_z")).toBe("Precipitation x Loneliness");
  });

  it("formats anxiety_z as Anxiety", () => {
    expect(formatTermLabel("anxiety_z")).toBe("Anxiety");
  });

  it("strips _z suffix from multi-part predictor names", () => {
    expect(formatTermPart("daylight_hours_z")).toBe("Daylight Hours");
  });
});

describe("formatOutcomeLabel", () => {
  it("formats digit_span as display label", () => {
    expect(formatOutcomeLabel("digit_span")).toBe("Backwards Digit Span");
  });

  it("formats self_report as display label", () => {
    expect(formatOutcomeLabel("self_report")).toBe("Self-Reported Cognition");
  });

  it("formats unknown outcome gracefully", () => {
    // Falls through to formatTermPart: title-cases each part
    const label = formatOutcomeLabel("some_other_outcome");
    expect(label).toBeTruthy();
    expect(label.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// formatSigned and formatPValue — numeric display helpers
// ---------------------------------------------------------------------------

describe("formatSigned", () => {
  it("prepends + to positive values", () => {
    expect(formatSigned(0.25)).toBe("+0.25");
  });

  it("prepends - to negative values", () => {
    expect(formatSigned(-0.12)).toBe("-0.12");
  });

  it("formats zero as +0.00", () => {
    expect(formatSigned(0)).toBe("+0.00");
  });
});

describe("formatPValue", () => {
  it("returns <0.001 for very small p-values", () => {
    expect(formatPValue(0.0001)).toBe("<0.001");
  });

  it("returns formatted decimal for larger p-values", () => {
    expect(formatPValue(0.042)).toBe("0.042");
  });

  it("formats exactly 0.001 as 0.001 (not <0.001)", () => {
    expect(formatPValue(0.001)).toBe("0.001");
  });

  it("formats p=1 as 1.000", () => {
    expect(formatPValue(1)).toBe("1.000");
  });
});

// ---------------------------------------------------------------------------
// compareEffectsByStrength — effect card ordering
// ---------------------------------------------------------------------------

describe("compareEffectsByStrength", () => {
  it("lower p-value sorts first", () => {
    const result = compareEffectsByStrength(
      { p_value: 0.01, statistic: 1.5 },
      { p_value: 0.05, statistic: 2.0 },
    );
    expect(result).toBeLessThan(0);
  });

  it("higher absolute statistic breaks tie when p-values are equal", () => {
    const result = compareEffectsByStrength(
      { p_value: 0.05, statistic: 1.0 },
      { p_value: 0.05, statistic: 3.0 },
    );
    // right has higher |statistic| so left should sort after right → positive result
    expect(result).toBeGreaterThan(0);
  });

  it("returns 0 for identical p-value and statistic", () => {
    const result = compareEffectsByStrength(
      { p_value: 0.04, statistic: 2.1 },
      { p_value: 0.04, statistic: 2.1 },
    );
    expect(result).toBe(0);
  });

  it("handles negative statistic by absolute value for tie-breaking", () => {
    // |-3.0| > |1.0| so right sorts first when p equal
    const result = compareEffectsByStrength(
      { p_value: 0.03, statistic: 1.0 },
      { p_value: 0.03, statistic: -3.0 },
    );
    expect(result).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildAnalyticsWarningDisplayItems - model warning translation
// ---------------------------------------------------------------------------

describe("buildAnalyticsWarningDisplayItems", () => {
  it("consolidates optimizer fallback warnings into one plain-English item", () => {
    const warnings = [
      "self_report model optimizer lbfgs failed: Singular matrix",
      "The MLE may be on the boundary of the parameter space.",
      "self_report model converged after retrying with optimizer powell.",
    ];

    const items = buildAnalyticsWarningDisplayItems(warnings);

    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("fallback fitting method");
    expect(items[0].plainEnglish).toContain("backup fitting method");
    expect(items[0].plainEnglish).toContain("interpreted a bit more cautiously");
    expect(items[0].rawWarnings).toEqual(warnings);
  });

  it("returns a generic explanation for unknown warnings", () => {
    const items = buildAnalyticsWarningDisplayItems([
      "digit_span model did not converge.",
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Technical model warning");
    expect(items[0].plainEnglish).toContain("technical warning");
    expect(items[0].rawWarnings).toEqual(["digit_span model did not converge."]);
  });

  it("keeps unmatched warnings after consolidating optimizer fallback details", () => {
    const items = buildAnalyticsWarningDisplayItems([
      "self_report model optimizer lbfgs failed: Singular matrix",
      "The MLE may be on the boundary of the parameter space.",
      "self_report model converged after retrying with optimizer powell.",
      "The Hessian matrix at the estimated parameter values is not positive definite.",
    ]);

    expect(items).toHaveLength(2);
    expect(items[0].rawWarnings).toHaveLength(3);
    expect(items[1].title).toBe("Technical model warning");
    expect(items[1].rawWarnings).toEqual([
      "The Hessian matrix at the estimated parameter values is not positive definite.",
    ]);
  });
});
