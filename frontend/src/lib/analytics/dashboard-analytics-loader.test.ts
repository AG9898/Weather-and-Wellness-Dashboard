import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import {
  loadInitialDashboardAnalytics,
  refreshDashboardAnalytics,
} from "@/lib/analytics/dashboard-analytics-loader";

describe("dashboard analytics loader", () => {
  it("does not trigger a live recompute when the initial snapshot read returns 404", async () => {
    const fetchBundle = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(404, "No analytics snapshot exists"));

    const result = await loadInitialDashboardAnalytics(
      "2026-03-01",
      "2026-03-12",
      fetchBundle
    );

    expect(result).toEqual({ kind: "missing-snapshot" });
    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(fetchBundle).toHaveBeenCalledWith("snapshot", "2026-03-01", "2026-03-12");
  });

  it("returns the snapshot bundle on a successful initial read", async () => {
    const fetchBundle = vi.fn().mockResolvedValue({
      cached: true,
      data: {
        analytics: {
          status: "ready",
          response_version: "dashboard-analytics-v1",
          snapshot: {
            mode: "snapshot",
            response_version: "dashboard-analytics-v1",
            model_version: "weather-mlm-v1",
            generated_at: "2026-03-12T00:00:00Z",
            is_stale: false,
            recompute_started_at: null,
            recompute_finished_at: null,
          },
          dataset: {
            date_from: "2026-03-01",
            date_to: "2026-03-12",
            included_sessions: 1,
            included_days: 1,
            native_rows: 1,
            imported_rows: 0,
            excluded_rows: 0,
            exclusion_reasons: [],
            generated_at: "2026-03-12T00:00:00Z",
          },
          models: [],
          visualizations: null,
        },
        cached_at: "2026-03-12T00:00:00Z",
      },
      refresh: {
        requested: false,
        state: "idle",
        detail: "Serving the latest stored analytics snapshot for this study window.",
      },
    });

    const result = await loadInitialDashboardAnalytics(
      "2026-03-01",
      "2026-03-12",
      fetchBundle
    );

    expect(result.kind).toBe("loaded");
    expect(fetchBundle).toHaveBeenCalledWith("snapshot", "2026-03-01", "2026-03-12");
  });

  it("uses live mode for explicit refresh requests", async () => {
    const fetchBundle = vi.fn().mockResolvedValue({
      cached: false,
      data: {
        analytics: {
          status: "ready",
          response_version: "dashboard-analytics-v1",
          snapshot: {
            mode: "live",
            response_version: "dashboard-analytics-v1",
            model_version: "weather-mlm-v1",
            generated_at: "2026-03-12T00:00:00Z",
            is_stale: false,
            recompute_started_at: null,
            recompute_finished_at: "2026-03-12T00:01:00Z",
          },
          dataset: {
            date_from: "2026-03-01",
            date_to: "2026-03-12",
            included_sessions: 1,
            included_days: 1,
            native_rows: 1,
            imported_rows: 0,
            excluded_rows: 0,
            exclusion_reasons: [],
            generated_at: "2026-03-12T00:00:00Z",
          },
          models: [],
          visualizations: null,
        },
        cached_at: "2026-03-12T00:00:00Z",
      },
      refresh: {
        requested: true,
        state: "recomputing",
        detail:
          "Background recompute requested. Showing the last successful snapshot until the backend finishes.",
      },
    });

    const result = await refreshDashboardAnalytics(
      "2026-03-01",
      "2026-03-12",
      fetchBundle
    );

    expect(result.kind).toBe("loaded");
    expect(fetchBundle).toHaveBeenCalledTimes(1);
    expect(fetchBundle).toHaveBeenCalledWith("live", "2026-03-01", "2026-03-12");
  });
});
