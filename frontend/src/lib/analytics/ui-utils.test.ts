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
  buildTemperatureFrequencyBars,
  compareEffectsByStrength,
  formatOutcomeLabel,
  formatPValue,
  formatSigned,
  formatTemperatureBinLabel,
  formatTemperatureDateRange,
  formatTemperatureValue,
  formatTemperatureWindowLabel,
  formatTermLabel,
  formatTermPart,
  getAnalyticsErrorMessage,
  getTemperatureSummaryWindow,
  getStatusPanel,
} from "./ui-utils";
import type { DashboardAnalyticsResponse } from "@/lib/api";

// ---------------------------------------------------------------------------
// Minimal response fixture factory
// ---------------------------------------------------------------------------

function makeAnalytics(status: DashboardAnalyticsResponse["status"]): DashboardAnalyticsResponse {
  return {
    status,
    response_version: "dashboard-analytics-v2",
    snapshot: {
      mode: "snapshot",
      response_version: "dashboard-analytics-v2",
      model_version: "weather-mlm-v2",
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
    temperature_summary: { windows: [] },
    visualizations: null,
  };
}

// ---------------------------------------------------------------------------
// getStatusPanel — all analytics UI states
// ---------------------------------------------------------------------------

describe("getStatusPanel", () => {
  it("returns ready panel for status=ready", () => {
    const panel = getStatusPanel(makeAnalytics("ready"));
    expect(panel.title).toBe("Latest snapshot ready");
    expect(panel.body).toContain("selected study window");
  });

  it("returns stale panel for status=stale", () => {
    const panel = getStatusPanel(makeAnalytics("stale"));
    expect(panel.title).toBe("Previous snapshot still shown");
    expect(panel.body).toContain("last saved snapshot stays visible");
    expect(panel.className).toContain("amber");
  });

  it("returns recomputing panel for status=recomputing", () => {
    const panel = getStatusPanel(makeAnalytics("recomputing"));
    expect(panel.title).toBe("Background refresh running");
    expect(panel.body).toContain("analytics recompute");
    expect(panel.className).toContain("sky");
  });

  it("returns insufficient_data panel for status=insufficient_data", () => {
    const panel = getStatusPanel(makeAnalytics("insufficient_data"));
    expect(panel.title).toBe("Not enough data yet");
    expect(panel.body).toContain("not enough complete rows");
  });

  it("returns failed panel for status=failed", () => {
    const panel = getStatusPanel(makeAnalytics("failed"));
    expect(panel.title).toBe("Analytics refresh failed");
    expect(panel.body).toContain("weather and dashboard actions still work");
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

// ---------------------------------------------------------------------------
// temperature summary helpers
// ---------------------------------------------------------------------------

describe("temperature summary helpers", () => {
  const summary: DashboardAnalyticsResponse["temperature_summary"] = {
    windows: [
      {
        window_key: "overall",
        date_from: "2026-03-01",
        date_to: "2026-03-10",
        day_count: 3,
        participant_count: 6,
        mean_temperature_c: 8.75,
        sd_temperature_c: 1.5,
        frequency_bins: [
          { bin_start_c: 7, bin_end_c: 8, day_count: 1 },
          { bin_start_c: 8, bin_end_c: 9, day_count: 3 },
        ],
        cold_group: {
          day_count: 1,
          participant_count: 2,
          participant_ids: ["p1", "p2"],
          dates: ["2026-03-01"],
          days: [
            {
              date_local: "2026-03-01",
              temperature_c: 7.2,
              temperature_z: -2.4,
              participant_ids: ["p1", "p2"],
              participant_count: 2,
            },
          ],
        },
        hot_group: {
          day_count: 0,
          participant_count: 0,
          participant_ids: [],
          dates: [],
          days: [],
        },
      },
    ],
  };

  it("formats temperature window labels", () => {
    expect(formatTemperatureWindowLabel("overall")).toBe("Overall");
    expect(formatTemperatureWindowLabel("fall_winter")).toBe("Fall / Winter");
    expect(formatTemperatureWindowLabel("spring_summer")).toBe("Spring / Summer");
  });

  it("formats temperature values and bin labels", () => {
    expect(formatTemperatureValue(12.34)).toBe("12.3°C");
    expect(formatTemperatureValue(null)).toBe("—");
    expect(formatTemperatureBinLabel(7, 8)).toBe("7 to 8°C");
  });

  it("formats date ranges for display", () => {
    expect(formatTemperatureDateRange("2026-03-01", "2026-03-10")).toBe("Mar 1, 2026 to Mar 10, 2026");
    expect(formatTemperatureDateRange("2026-03-01", "2026-03-01")).toBe("Mar 1, 2026");
    expect(formatTemperatureDateRange(null, "2026-03-10")).toBe("No study dates");
  });

  it("resolves summary windows by key", () => {
    expect(getTemperatureSummaryWindow(summary, "overall")?.day_count).toBe(3);
    expect(getTemperatureSummaryWindow(summary, "fall_winter")).toBeNull();
  });

  it("builds normalized frequency bars from day-level bins", () => {
    const bars = buildTemperatureFrequencyBars(summary.windows[0]);
    expect(bars).toEqual([
      { label: "7 to 8°C", dayCount: 1, share: 1 / 3 },
      { label: "8 to 9°C", dayCount: 3, share: 1 },
    ]);
  });
});
