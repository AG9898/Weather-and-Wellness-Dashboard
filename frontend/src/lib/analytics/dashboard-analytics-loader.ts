import {
  ApiError,
  getDashboardAnalyticsBundle,
  type AnalyticsReadMode,
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
