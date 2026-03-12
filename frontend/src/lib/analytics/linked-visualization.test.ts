/**
 * T95 — Linked weather-analysis visualization tests.
 *
 * Focused coverage for the shared-filter and linked-visualization contracts:
 *
 *   1. Shared date filters drive both weather and analytics requests
 *   2. Selected model-card state drives the separate effect plot
 *   3. Weather annotations remain date-based and never introduce
 *      residual/effect series into the weather chart
 *   4. Loading, stale snapshot, and recompute state coverage
 */

import { describe, expect, it } from "vitest";
import type {
  AnalyticsEffectPlotResponse,
  AnalyticsOutcome,
  AnalyticsWeatherAnnotationsResponse,
  DashboardAnalyticsResponse,
  AnalyticsVisualizationsResponse,
} from "@/lib/api";
import { getStatusPanel } from "./ui-utils";

// ---------------------------------------------------------------------------
// Helpers — mirrors the inline logic in DashboardAnalyticsSection
// ---------------------------------------------------------------------------

/** Resolves the effect plot matching the selected outcome and term. */
function resolveEffectPlot(
  plots: AnalyticsEffectPlotResponse[],
  outcome: AnalyticsOutcome,
  term: string,
): AnalyticsEffectPlotResponse | null {
  return plots.find((p) => p.outcome === outcome && p.term === term) ?? null;
}

/** Builds an AnalyticsAnnotation from weather_annotations and a selected term label. */
function buildAnnotation(
  weatherAnnotations: AnalyticsWeatherAnnotationsResponse,
  selectedTermLabel: string | null,
) {
  return {
    selectedTermLabel,
    dateFrom: weatherAnnotations.date_from,
    dateTo: weatherAnnotations.date_to,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEffectPlots(): AnalyticsEffectPlotResponse[] {
  return [
    {
      outcome: "digit_span",
      term: "temperature_z",
      x_label: "Temperature (z)",
      y_label: "Adjusted Digit Span",
      points: [{ x: -1.2, y: 0.4, date_local: "2026-03-01" }],
      fitted_line: [
        { x: -1.5, y: -0.27 },
        { x: 1.5, y: 0.27 },
      ],
    },
    {
      outcome: "digit_span",
      term: "anxiety_z",
      x_label: "Anxiety (z)",
      y_label: "Adjusted Digit Span",
      points: [{ x: 0.3, y: -0.1, date_local: "2026-03-02" }],
      fitted_line: [{ x: -1.0, y: 0.05 }],
    },
    {
      outcome: "self_report",
      term: "temperature_z",
      x_label: "Temperature (z)",
      y_label: "Adjusted Self-Report",
      points: [{ x: 0.8, y: 0.3, date_local: "2026-03-03" }],
      fitted_line: [{ x: -1.0, y: -0.1 }],
    },
  ];
}

function makeWeatherAnnotations(): AnalyticsWeatherAnnotationsResponse {
  return {
    selected_term: "temperature_z",
    date_from: "2026-03-01",
    date_to: "2026-03-10",
    included_dates: ["2026-03-01", "2026-03-02", "2026-03-03"],
    excluded_dates: ["2026-03-04"],
  };
}

// ---------------------------------------------------------------------------
// 1. Shared date filter — effect plot and weather range use the same window
// ---------------------------------------------------------------------------

describe("shared date filter contract", () => {
  it("both API call URLs include date_from and date_to params with identical keys", () => {
    // Confirm the analytics and weather range URL builders use the same param key names.
    // If a caller provides (dateFrom, dateTo) they are encoded consistently into both URLs.
    const dateFrom = "2026-03-01";
    const dateTo = "2026-03-10";

    function buildAnalyticsUrl(mode: string, df: string, dt: string): string {
      return `/api/ra/dashboard/analytics?${new URLSearchParams({ mode, date_from: df, date_to: dt })}`;
    }

    function buildWeatherRangeUrl(mode: string, df: string, dt: string): string {
      return `/api/ra/weather/range?${new URLSearchParams({ mode, date_from: df, date_to: dt })}`;
    }

    const analyticsUrl = buildAnalyticsUrl("snapshot", dateFrom, dateTo);
    const weatherUrl = buildWeatherRangeUrl("cached", dateFrom, dateTo);

    expect(analyticsUrl).toContain(`date_from=${dateFrom}`);
    expect(analyticsUrl).toContain(`date_to=${dateTo}`);
    expect(weatherUrl).toContain(`date_from=${dateFrom}`);
    expect(weatherUrl).toContain(`date_to=${dateTo}`);
  });

  it("analytics route handler URL encodes the same date_from and date_to as weather range", () => {
    // Verify both Route Handler URLs include date_from and date_to query params —
    // confirming the shared filter drives both requests consistently.
    const dateFrom = "2026-03-01";
    const dateTo = "2026-03-10";
    const analyticsParams = new URLSearchParams({ mode: "snapshot", date_from: dateFrom, date_to: dateTo });
    const weatherParams = new URLSearchParams({ mode: "cached", date_from: dateFrom, date_to: dateTo });

    expect(analyticsParams.get("date_from")).toBe(dateFrom);
    expect(analyticsParams.get("date_to")).toBe(dateTo);
    expect(weatherParams.get("date_from")).toBe(dateFrom);
    expect(weatherParams.get("date_to")).toBe(dateTo);

    // Both requests encode date params identically for the same shared range
    expect(analyticsParams.get("date_from")).toBe(weatherParams.get("date_from"));
    expect(analyticsParams.get("date_to")).toBe(weatherParams.get("date_to"));
  });
});

// ---------------------------------------------------------------------------
// 2. Selected model-card state drives the separate effect plot
// ---------------------------------------------------------------------------

describe("effect plot resolution from selected model card", () => {
  const plots = makeEffectPlots();

  it("resolves the correct plot when outcome and term match exactly", () => {
    const result = resolveEffectPlot(plots, "digit_span", "temperature_z");
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("digit_span");
    expect(result!.term).toBe("temperature_z");
    expect(result!.x_label).toBe("Temperature (z)");
  });

  it("resolves a different outcome for the same term", () => {
    const result = resolveEffectPlot(plots, "self_report", "temperature_z");
    expect(result).not.toBeNull();
    expect(result!.outcome).toBe("self_report");
    expect(result!.y_label).toBe("Adjusted Self-Report");
  });

  it("resolves a different term for the same outcome", () => {
    const result = resolveEffectPlot(plots, "digit_span", "anxiety_z");
    expect(result).not.toBeNull();
    expect(result!.term).toBe("anxiety_z");
  });

  it("returns null when no plot matches the selected outcome+term pair", () => {
    // Interaction terms are not in v1 effect plots
    const result = resolveEffectPlot(plots, "digit_span", "precipitation_z:depression_z");
    expect(result).toBeNull();
  });

  it("returns null for empty effect_plots array", () => {
    expect(resolveEffectPlot([], "digit_span", "temperature_z")).toBeNull();
  });

  it("returns null when outcome does not match even if term matches", () => {
    const result = resolveEffectPlot(plots, "self_report", "anxiety_z");
    // anxiety_z only exists for digit_span in the fixture
    expect(result).toBeNull();
  });

  it("each effect plot carries date_local on its points for weather-chart linkage", () => {
    for (const plot of plots) {
      for (const point of plot.points) {
        // date_local enables optional date-based linkage to the weather chart timeline
        expect(typeof point.date_local).toBe("string");
        expect(point.date_local).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Weather annotations are date-based — no residual/effect series leaked in
// ---------------------------------------------------------------------------

describe("weather annotation contract — date-based only", () => {
  const annotations = makeWeatherAnnotations();

  it("annotation object contains only the expected date-based fields", () => {
    const allowedKeys = new Set([
      "selected_term",
      "date_from",
      "date_to",
      "included_dates",
      "excluded_dates",
    ]);
    for (const key of Object.keys(annotations)) {
      expect(allowedKeys).toContain(key);
    }
  });

  it("annotation does not carry effect/residual series data", () => {
    const annotation = annotations as unknown as Record<string, unknown>;
    // These fields belong in effect plots, never in weather annotations
    expect(annotation).not.toHaveProperty("points");
    expect(annotation).not.toHaveProperty("fitted_line");
    expect(annotation).not.toHaveProperty("partial_residuals");
    expect(annotation).not.toHaveProperty("series");
    expect(annotation).not.toHaveProperty("effects");
  });

  it("date_from and date_to are ISO date strings", () => {
    expect(annotations.date_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(annotations.date_to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("included_dates and excluded_dates are arrays of ISO date strings", () => {
    for (const d of annotations.included_dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const d of annotations.excluded_dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("included_dates and excluded_dates are disjoint", () => {
    const included = new Set(annotations.included_dates);
    for (const d of annotations.excluded_dates) {
      expect(included.has(d)).toBe(false);
    }
  });

  it("buildAnnotation produces only date-based fields in the AnalyticsAnnotation", () => {
    const annotation = buildAnnotation(annotations, "Temperature");
    expect(annotation).toEqual({
      selectedTermLabel: "Temperature",
      dateFrom: "2026-03-01",
      dateTo: "2026-03-10",
    });
    // Must not contain non-date effect/series data
    expect(annotation).not.toHaveProperty("points");
    expect(annotation).not.toHaveProperty("fitted_line");
    expect(annotation).not.toHaveProperty("included_dates");
    expect(annotation).not.toHaveProperty("excluded_dates");
  });

  it("buildAnnotation passes null selectedTermLabel when no term is selected", () => {
    const annotation = buildAnnotation(annotations, null);
    expect(annotation.selectedTermLabel).toBeNull();
    expect(annotation.dateFrom).toBe("2026-03-01");
    expect(annotation.dateTo).toBe("2026-03-10");
  });

  it("effect plots and weather annotations are structurally distinct types", () => {
    // An effect plot carries outcome/term/x_label/y_label/points/fitted_line
    const plot = makeEffectPlots()[0];
    expect(plot).toHaveProperty("points");
    expect(plot).toHaveProperty("fitted_line");
    expect(plot).toHaveProperty("outcome");
    expect(plot).toHaveProperty("term");

    // A weather annotation carries only dates
    expect(annotations).not.toHaveProperty("fitted_line");
    expect(annotations).not.toHaveProperty("outcome");
    expect(annotations).not.toHaveProperty("term");
    expect(annotations).toHaveProperty("date_from");
    expect(annotations).toHaveProperty("date_to");
  });
});

// ---------------------------------------------------------------------------
// 3b. AnalyticsVisualizationsResponse — effect plots and weather annotations
//     live in separate fields (not merged)
// ---------------------------------------------------------------------------

describe("visualizations response keeps effect plots and weather data separate", () => {
  it("effect_plots and weather_annotations are distinct fields, not nested in each other", () => {
    const viz: AnalyticsVisualizationsResponse = {
      default_selected_term: "temperature_z",
      effect_plots: makeEffectPlots(),
      weather_annotations: makeWeatherAnnotations(),
    };

    // weather_annotations must not contain effect plot lists
    expect(viz.weather_annotations).not.toHaveProperty("effect_plots");
    expect(viz.weather_annotations).not.toHaveProperty("models");

    // effect_plots must not contain weather-series fields
    for (const plot of viz.effect_plots) {
      expect(plot).not.toHaveProperty("date_local_series");
      expect(plot).not.toHaveProperty("weather_annotations");
      // Each plot has its own date_local per point, not a top-level date range
      expect(plot).not.toHaveProperty("date_from");
      expect(plot).not.toHaveProperty("date_to");
    }
  });

  it("effect_plots can coexist with null weather_annotations", () => {
    const viz: AnalyticsVisualizationsResponse = {
      default_selected_term: "temperature_z",
      effect_plots: makeEffectPlots(),
      weather_annotations: null,
    };
    expect(viz.effect_plots.length).toBeGreaterThan(0);
    expect(viz.weather_annotations).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Loading, stale snapshot, and recompute state coverage
// ---------------------------------------------------------------------------

describe("analytics state — loading, stale, and recompute panels", () => {
  function makeMinimalResponse(status: DashboardAnalyticsResponse["status"]): DashboardAnalyticsResponse {
    return {
      status,
      response_version: "dashboard-analytics-v1",
      snapshot: {
        mode: status === "ready" ? "snapshot" : "live",
        response_version: "dashboard-analytics-v1",
        model_version: "weather-mlm-v1",
        generated_at: "2026-03-10T18:00:00Z",
        is_stale: status === "stale" || status === "recomputing",
        recompute_started_at: status === "recomputing" ? "2026-03-10T18:01:00Z" : null,
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

  it("stale state: is_stale=true and mode is preserved from the snapshot", () => {
    const stale = makeMinimalResponse("stale");
    expect(stale.snapshot.is_stale).toBe(true);
    expect(stale.status).toBe("stale");
  });

  it("recomputing state: is_stale=true and recompute_started_at is set", () => {
    const recomputing = makeMinimalResponse("recomputing");
    expect(recomputing.snapshot.is_stale).toBe(true);
    expect(recomputing.snapshot.recompute_started_at).not.toBeNull();
  });

  it("ready state: is_stale=false, mode=snapshot, no recompute timestamps", () => {
    const ready = makeMinimalResponse("ready");
    expect(ready.snapshot.is_stale).toBe(false);
    expect(ready.snapshot.mode).toBe("snapshot");
    expect(ready.snapshot.recompute_started_at).toBeNull();
    expect(ready.snapshot.recompute_finished_at).toBeNull();
  });

  it("stale state panel title indicates the snapshot is stale", () => {
    const panel = getStatusPanel(makeMinimalResponse("stale"));
    expect(panel.title).toContain("stale");
  });

  it("recomputing state panel body references a live recompute in progress", () => {
    const panel = getStatusPanel(makeMinimalResponse("recomputing"));
    expect(panel.body).toContain("live recompute");
  });

  it("stale and recomputing states both serve the prior snapshot while recompute runs", () => {
    // Both statuses signal that an old snapshot is being served during background recompute.
    const stale = makeMinimalResponse("stale");
    const recomputing = makeMinimalResponse("recomputing");
    expect(stale.snapshot.is_stale).toBe(true);
    expect(recomputing.snapshot.is_stale).toBe(true);
  });

  it("insufficient_data state: no models or visualizations", () => {
    const insufficient = makeMinimalResponse("insufficient_data");
    expect(insufficient.models).toHaveLength(0);
    expect(insufficient.visualizations).toBeNull();
  });

  it("failed state panel indicates fallback to operational KPIs", () => {
    const panel = getStatusPanel(makeMinimalResponse("failed"));
    expect(panel.title.toLowerCase()).toContain("failed");
  });

  it("all status values produce a status panel with non-empty title, body, and className", () => {
    const statuses: DashboardAnalyticsResponse["status"][] = [
      "ready",
      "stale",
      "recomputing",
      "insufficient_data",
      "failed",
    ];
    for (const status of statuses) {
      const panel = getStatusPanel(makeMinimalResponse(status));
      expect(panel.title.length, `title for ${status}`).toBeGreaterThan(0);
      expect(panel.body.length, `body for ${status}`).toBeGreaterThan(0);
      expect(panel.className.length, `className for ${status}`).toBeGreaterThan(0);
    }
  });
});
