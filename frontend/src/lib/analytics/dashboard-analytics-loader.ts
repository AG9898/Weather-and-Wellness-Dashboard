import {
  ApiError,
  getDashboardAnalyticsBundle,
  type AnalyticsReadMode,
  type AnalyticsTemperatureSummaryResponse,
  type DashboardAnalyticsRouteResponse,
} from "@/lib/api";
import { getAnalyticsErrorMessage } from "@/lib/analytics/ui-utils";

type AnalyticsBundleFetcher = (
  mode: AnalyticsReadMode,
  dateFrom: string,
  dateTo: string
) => Promise<DashboardAnalyticsRouteResponse>;

export type DashboardAnalyticsLoadResult =
  | {
      kind: "loaded";
      response: DashboardAnalyticsRouteResponse;
    }
  | {
      kind: "missing-snapshot";
    }
  | {
      kind: "empty";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    };

export type TemperatureSummaryLoadResult =
  | {
      kind: "loaded";
      response: DashboardAnalyticsRouteResponse;
      temperatureSummary: AnalyticsTemperatureSummaryResponse | null;
    }
  | {
      kind: "missing-snapshot";
    }
  | {
      kind: "empty";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    };

export async function loadInitialDashboardAnalytics(
  dateFrom: string,
  dateTo: string,
  fetchBundle: AnalyticsBundleFetcher = getDashboardAnalyticsBundle
): Promise<DashboardAnalyticsLoadResult> {
  try {
    const response = await fetchBundle("snapshot", dateFrom, dateTo);
    if (!response.data) {
      return { kind: "missing-snapshot" };
    }
    return {
      kind: "loaded",
      response,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { kind: "missing-snapshot" };
    }
    return {
      kind: "error",
      message: getAnalyticsErrorMessage(err),
    };
  }
}

export async function refreshDashboardAnalytics(
  dateFrom: string,
  dateTo: string,
  fetchBundle: AnalyticsBundleFetcher = getDashboardAnalyticsBundle
): Promise<DashboardAnalyticsLoadResult> {
  try {
    const response = await fetchBundle("live", dateFrom, dateTo);
    if (!response.data) {
      return {
        kind: "empty",
        message: "Analytics refresh returned no data.",
      };
    }
    return {
      kind: "loaded",
      response,
    };
  } catch (err) {
    return {
      kind: "error",
      message: getAnalyticsErrorMessage(err),
    };
  }
}

export async function loadTemperatureSummary(
  dateFrom: string,
  dateTo: string,
  fetchBundle: AnalyticsBundleFetcher = getDashboardAnalyticsBundle
): Promise<TemperatureSummaryLoadResult> {
  try {
    const response = await fetchBundle("snapshot", dateFrom, dateTo);
    if (!response.data) {
      return { kind: "missing-snapshot" };
    }
    return {
      kind: "loaded",
      response,
      temperatureSummary: response.data.analytics.temperature_summary ?? null,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { kind: "missing-snapshot" };
    }
    return {
      kind: "error",
      message: getAnalyticsErrorMessage(err),
    };
  }
}

export async function refreshTemperatureSummary(
  dateFrom: string,
  dateTo: string,
  fetchBundle: AnalyticsBundleFetcher = getDashboardAnalyticsBundle
): Promise<TemperatureSummaryLoadResult> {
  try {
    const response = await fetchBundle("live", dateFrom, dateTo);
    if (!response.data) {
      return {
        kind: "empty",
        message: "Temperature summary recompute returned no data.",
      };
    }
    return {
      kind: "loaded",
      response,
      temperatureSummary: response.data.analytics.temperature_summary ?? null,
    };
  } catch (err) {
    return {
      kind: "error",
      message: getAnalyticsErrorMessage(err),
    };
  }
}
