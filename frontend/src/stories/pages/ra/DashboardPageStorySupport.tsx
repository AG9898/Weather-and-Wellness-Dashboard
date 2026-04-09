import type { Decorator } from "@storybook/nextjs-vite";
import DashboardPage from "@/app/(ra)/dashboard/page";
import type {
  DashboardAnalyticsResponse,
  DashboardAnalyticsRouteResponse,
  DashboardStudyWindowResponse,
  DashboardWeatherRouteResponse,
  DeleteLastNativeSessionResponse,
  LastNativeSessionResponse,
  WeatherDailyItem,
  WeatherDailyResponse,
  WeatherIngestResponse,
  WeatherRangeRouteResponse,
} from "@/lib/api";
import RAFloatingChrome from "@/lib/components/RAFloatingChrome";
import { RAUserContext } from "@/lib/contexts/RAUserContext";

interface MockResponseConfig {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

interface MockFetchRoute {
  method?: string;
  path: string | RegExp;
  response:
    | MockResponseConfig
    | ((url: string, init?: RequestInit) => MockResponseConfig | Promise<MockResponseConfig>);
}

export type DashboardStoryState = "replica" | "loading" | "empty" | "error";

const STUDY_WINDOW_RESPONSE: DashboardStudyWindowResponse = {
  latest_study_day: "2026-03-27",
};

const LAST_NATIVE_SESSION: LastNativeSessionResponse = {
  session_id: "session_20260327_001",
  participant_uuid: "participant-301",
  participant_number: 301,
  status: "complete",
  created_at: "2026-03-27T16:08:00Z",
};

const DELETE_LAST_NATIVE_SESSION_RESPONSE: DeleteLastNativeSessionResponse = {
  deleted_session_id: "session_20260327_001",
  deleted_participant_uuid: "participant-301",
  deleted_participant_number: 301,
  session_status_at_delete: "complete",
  participant_deleted: false,
};

const WEATHER_INGEST_RESPONSE: WeatherIngestResponse = {
  run_id: "run_20260327_1700",
  station_id: 3510,
  ingested_at: "2026-03-27T17:00:00Z",
  parse_status: "success",
  parse_errors: [],
  upserted_days: 25,
};

const latestRun = {
  run_id: "run_20260327_1530",
  ingested_at: "2026-03-27T15:30:00Z",
  parse_status: "success",
} as const;

const WEATHER_TABLE: Array<[string, number, number, number, number, string, number]> = [
  ["2026-03-03", 4.8, 1.3, 7.2, 1.1, "Light rain", 2.7],
  ["2026-03-04", 5.1, 0.6, 8.1, 2.0, "High cloud", 3.5],
  ["2026-03-05", 6.3, 0.2, 9.4, 2.4, "Partly cloudy", 4.4],
  ["2026-03-06", 7.2, 0.0, 10.1, 3.1, "Bright intervals", 5.8],
  ["2026-03-07", 8.9, 0.0, 12.4, 4.7, "Sunny", 7.6],
  ["2026-03-08", 9.8, 0.0, 13.5, 5.3, "Clear skies", 8.3],
  ["2026-03-09", 8.4, 0.5, 10.7, 4.0, "Passing showers", 4.1],
  ["2026-03-10", 7.0, 1.8, 8.8, 3.2, "Rain bands", 2.3],
  ["2026-03-11", 6.5, 2.5, 7.9, 2.8, "Steady rain", 1.4],
  ["2026-03-12", 7.8, 0.9, 9.5, 3.6, "Cloud breaks", 3.6],
  ["2026-03-13", 9.1, 0.1, 11.2, 4.9, "Sunny breaks", 6.8],
  ["2026-03-14", 10.4, 0.0, 13.0, 5.2, "Sunny", 8.8],
  ["2026-03-15", 11.0, 0.0, 14.2, 5.9, "Clear skies", 9.2],
  ["2026-03-16", 9.7, 0.4, 11.9, 4.8, "Mixed cloud", 5.2],
  ["2026-03-17", 8.6, 1.1, 10.3, 4.1, "Showers", 3.7],
  ["2026-03-18", 7.9, 2.2, 9.1, 3.5, "Rain tapering", 2.9],
  ["2026-03-19", 8.3, 0.8, 10.0, 4.0, "Cloudy", 3.1],
  ["2026-03-20", 9.4, 0.3, 11.8, 4.6, "Light cloud", 5.6],
  ["2026-03-21", 10.1, 0.0, 12.9, 5.2, "Sunny breaks", 7.2],
  ["2026-03-22", 11.3, 0.0, 13.8, 6.1, "Sunny", 8.7],
  ["2026-03-23", 12.0, 0.0, 14.6, 6.8, "Clear skies", 9.4],
  ["2026-03-24", 10.8, 0.4, 12.7, 5.9, "High cloud", 6.1],
  ["2026-03-25", 9.6, 1.6, 10.9, 4.7, "Showers", 3.8],
  ["2026-03-26", 8.8, 2.1, 9.8, 4.1, "Rain easing", 2.6],
  ["2026-03-27", 10.2, 0.2, 12.6, 5.4, "Sunny breaks", 7.5],
];

function buildWeatherItem(
  [date_local, current_temp_c, current_precip_today_mm, forecast_high_c, forecast_low_c, forecast_condition_text, sunshine_duration_hours]: ArrayElement<typeof WEATHER_TABLE>,
  index: number
): WeatherDailyItem {
  return {
    station_id: 3510,
    study_day_id: `study-day-${date_local}`,
    date_local,
    source_run_id: latestRun.run_id,
    updated_at: `2026-03-${String(index + 3).padStart(2, "0")}T15:30:00Z`,
    current_temp_c,
    current_precip_today_mm,
    forecast_high_c,
    forecast_low_c,
    forecast_condition_text,
    forecast_periods: [],
    sunshine_duration_hours,
  };
}

type ArrayElement<T extends readonly unknown[]> = T extends readonly (infer U)[] ? U : never;

const weatherRangeItems = WEATHER_TABLE.map(buildWeatherItem);
const currentWeatherItems = weatherRangeItems.slice(-1);

const dashboardWeather: WeatherDailyResponse = {
  items: currentWeatherItems,
  latest_run: latestRun,
};

const weatherRange: WeatherDailyResponse = {
  items: weatherRangeItems,
  latest_run: latestRun,
};

const DASHBOARD_WEATHER_RESPONSE: DashboardWeatherRouteResponse = {
  cached: true,
  data: {
    weather: dashboardWeather,
    cached_at: "2026-03-27T16:14:00Z",
  },
};

const WEATHER_RANGE_RESPONSE: WeatherRangeRouteResponse = {
  cached: true,
  data: {
    weather: weatherRange,
    cached_at: "2026-03-27T16:15:00Z",
  },
};

const DASHBOARD_ANALYTICS_RESPONSE: DashboardAnalyticsResponse = {
  status: "ready",
  response_version: "dashboard-analytics-v2",
  snapshot: {
    mode: "snapshot",
    response_version: "dashboard-analytics-v2",
    model_version: "weather-mlm-v2",
    generated_at: "2026-03-27T16:20:00Z",
    is_stale: false,
    recompute_started_at: null,
    recompute_finished_at: "2026-03-27T16:20:00Z",
  },
  dataset: {
    date_from: "2025-03-03",
    date_to: "2026-03-27",
    included_sessions: 187,
    included_days: 390,
    native_rows: 187,
    imported_rows: 0,
    excluded_rows: 14,
    exclusion_reasons: [
      { reason: "missing_weather_day", count: 9 },
      { reason: "incomplete_session", count: 5 },
    ],
    generated_at: "2026-03-27T16:20:00Z",
  },
  models: [
    {
      outcome: "digit_span",
      formula: "digit_span ~ mean_temperature_c + sunshine_duration_hours + (1|participant_uuid)",
      grouping_field: "date_bin",
      sample_size: 187,
      day_count: 390,
      converged: true,
      warnings: [],
      model_version: "weather-mlm-v2",
      generated_at: "2026-03-27T16:20:00Z",
      effects: [
        {
          term: "mean_temperature_c",
          predictor: "mean_temperature_c",
          is_interaction: false,
          coefficient: 0.41,
          standard_error: 0.11,
          statistic: 3.72,
          p_value: 0.0008,
          ci_95_low: 0.19,
          ci_95_high: 0.63,
          direction: "positive",
          significant: true,
        },
        {
          term: "sunshine_duration_hours",
          predictor: "sunshine_duration_hours",
          is_interaction: false,
          coefficient: 0.17,
          standard_error: 0.08,
          statistic: 2.21,
          p_value: 0.027,
          ci_95_low: 0.02,
          ci_95_high: 0.32,
          direction: "positive",
          significant: true,
        },
      ],
    },
    {
      outcome: "self_report",
      formula: "self_report ~ mean_temperature_c + precipitation_mm + (1|participant_uuid)",
      grouping_field: "date_bin",
      sample_size: 187,
      day_count: 390,
      converged: true,
      warnings: ["scaled gradient below tolerance after restart"],
      model_version: "weather-mlm-v2",
      generated_at: "2026-03-27T16:20:00Z",
      effects: [
        {
          term: "precipitation_mm",
          predictor: "precipitation_mm",
          is_interaction: false,
          coefficient: -0.28,
          standard_error: 0.09,
          statistic: -3.05,
          p_value: 0.0023,
          ci_95_low: -0.46,
          ci_95_high: -0.10,
          direction: "negative",
          significant: true,
        },
        {
          term: "mean_temperature_c",
          predictor: "mean_temperature_c",
          is_interaction: false,
          coefficient: -0.07,
          standard_error: 0.06,
          statistic: -1.18,
          p_value: 0.24,
          ci_95_low: -0.19,
          ci_95_high: 0.05,
          direction: "negative",
          significant: false,
        },
      ],
    },
  ],
  temperature_summary: {
    windows: [
      {
        window_key: "overall",
        date_from: "2025-03-03",
        date_to: "2026-03-27",
        day_count: 137,
        participant_count: 279,
        mean_temperature_c: 10.3,
        sd_temperature_c: 4.5,
        cold_threshold_temperature_c: 5.2,
        hot_threshold_temperature_c: 14.7,
        threshold_method: "window_day_zscore_v1",
        threshold_z_cutoff: 1.15,
        frequency_bins: [
          { bin_start_c: 1, bin_end_c: 2, day_count: 1 },
          { bin_start_c: 2, bin_end_c: 3, day_count: 2 },
          { bin_start_c: 3, bin_end_c: 4, day_count: 4 },
          { bin_start_c: 4, bin_end_c: 5, day_count: 8 },
          { bin_start_c: 5, bin_end_c: 6, day_count: 13 },
          { bin_start_c: 6, bin_end_c: 7, day_count: 17 },
          { bin_start_c: 7, bin_end_c: 8, day_count: 18 },
          { bin_start_c: 8, bin_end_c: 9, day_count: 14 },
          { bin_start_c: 9, bin_end_c: 10, day_count: 12 },
          { bin_start_c: 10, bin_end_c: 11, day_count: 11 },
          { bin_start_c: 11, bin_end_c: 12, day_count: 10 },
          { bin_start_c: 12, bin_end_c: 13, day_count: 9 },
          { bin_start_c: 13, bin_end_c: 14, day_count: 8 },
          { bin_start_c: 14, bin_end_c: 15, day_count: 5 },
          { bin_start_c: 15, bin_end_c: 16, day_count: 3 },
          { bin_start_c: 16, bin_end_c: 17, day_count: 2 },
        ],
        cold_group: {
          day_count: 12,
          participant_count: 31,
          participant_ids: ["P-002", "P-009", "P-014", "P-028"],
          dates: ["2025-12-02", "2025-12-08", "2026-01-14", "2026-02-06"],
          days: [
            {
              date_local: "2025-12-02",
              temperature_c: 4.3,
              temperature_z: -1.34,
              participant_ids: ["P-002", "P-009"],
              participant_count: 2,
            },
            {
              date_local: "2026-01-14",
              temperature_c: 3.8,
              temperature_z: -1.46,
              participant_ids: ["P-014", "P-028"],
              participant_count: 2,
            },
          ],
        },
        hot_group: {
          day_count: 11,
          participant_count: 27,
          participant_ids: ["P-031", "P-048", "P-052", "P-075"],
          dates: ["2025-07-21", "2025-08-02", "2025-08-17", "2025-09-04"],
          days: [
            {
              date_local: "2025-08-02",
              temperature_c: 15.6,
              temperature_z: 1.18,
              participant_ids: ["P-031", "P-048"],
              participant_count: 2,
            },
            {
              date_local: "2025-08-17",
              temperature_c: 16.1,
              temperature_z: 1.29,
              participant_ids: ["P-052", "P-075"],
              participant_count: 2,
            },
          ],
        },
      },
      {
        window_key: "fall_winter",
        date_from: "2025-09-22",
        date_to: "2026-03-21",
        day_count: 82,
        participant_count: 161,
        mean_temperature_c: 7.1,
        sd_temperature_c: 2.8,
        cold_threshold_temperature_c: 4.6,
        hot_threshold_temperature_c: 10.4,
        threshold_method: "window_day_zscore_v1",
        threshold_z_cutoff: 1.0,
        frequency_bins: [
          { bin_start_c: 2, bin_end_c: 3, day_count: 2 },
          { bin_start_c: 3, bin_end_c: 4, day_count: 5 },
          { bin_start_c: 4, bin_end_c: 5, day_count: 9 },
          { bin_start_c: 5, bin_end_c: 6, day_count: 12 },
          { bin_start_c: 6, bin_end_c: 7, day_count: 15 },
          { bin_start_c: 7, bin_end_c: 8, day_count: 14 },
          { bin_start_c: 8, bin_end_c: 9, day_count: 11 },
          { bin_start_c: 9, bin_end_c: 10, day_count: 9 },
          { bin_start_c: 10, bin_end_c: 11, day_count: 5 },
        ],
        cold_group: {
          day_count: 9,
          participant_count: 22,
          participant_ids: ["P-002", "P-009"],
          dates: ["2025-12-02", "2026-01-14"],
          days: [
            {
              date_local: "2025-12-02",
              temperature_c: 4.3,
              temperature_z: -1.11,
              participant_ids: ["P-002", "P-009"],
              participant_count: 2,
            },
          ],
        },
        hot_group: {
          day_count: 8,
          participant_count: 16,
          participant_ids: ["P-031", "P-048"],
          dates: ["2025-10-04", "2026-03-19"],
          days: [
            {
              date_local: "2026-03-19",
              temperature_c: 10.9,
              temperature_z: 1.36,
              participant_ids: ["P-031", "P-048"],
              participant_count: 2,
            },
          ],
        },
      },
      {
        window_key: "spring_summer",
        date_from: "2025-03-22",
        date_to: "2025-09-21",
        day_count: 55,
        participant_count: 118,
        mean_temperature_c: 13.8,
        sd_temperature_c: 2.1,
        cold_threshold_temperature_c: 11.2,
        hot_threshold_temperature_c: 15.9,
        threshold_method: "window_day_zscore_v1",
        threshold_z_cutoff: 1.0,
        frequency_bins: [
          { bin_start_c: 10, bin_end_c: 11, day_count: 2 },
          { bin_start_c: 11, bin_end_c: 12, day_count: 5 },
          { bin_start_c: 12, bin_end_c: 13, day_count: 8 },
          { bin_start_c: 13, bin_end_c: 14, day_count: 11 },
          { bin_start_c: 14, bin_end_c: 15, day_count: 12 },
          { bin_start_c: 15, bin_end_c: 16, day_count: 10 },
          { bin_start_c: 16, bin_end_c: 17, day_count: 5 },
          { bin_start_c: 17, bin_end_c: 18, day_count: 2 },
        ],
        cold_group: {
          day_count: 5,
          participant_count: 9,
          participant_ids: ["P-011", "P-026"],
          dates: ["2025-04-04"],
          days: [
            {
              date_local: "2025-04-04",
              temperature_c: 10.8,
              temperature_z: -1.43,
              participant_ids: ["P-011", "P-026"],
              participant_count: 2,
            },
          ],
        },
        hot_group: {
          day_count: 6,
          participant_count: 11,
          participant_ids: ["P-067", "P-083"],
          dates: ["2025-08-17"],
          days: [
            {
              date_local: "2025-08-17",
              temperature_c: 16.1,
              temperature_z: 1.10,
              participant_ids: ["P-067", "P-083"],
              participant_count: 2,
            },
          ],
        },
      },
    ],
  },
  visualizations: {
    default_selected_term: "mean_temperature_c",
    weather_annotations: null,
    effect_plots: [
      {
        outcome: "digit_span",
        term: "mean_temperature_c",
        x_label: "Mean Temperature (°C)",
        y_label: "Digit Span",
        points: [
          { x: 4.6, y: 6.2, date_local: "2026-03-03" },
          { x: 5.2, y: 6.5, date_local: "2026-03-06" },
          { x: 6.8, y: 6.9, date_local: "2026-03-10" },
          { x: 8.9, y: 7.3, date_local: "2026-03-14" },
          { x: 10.4, y: 7.9, date_local: "2026-03-18" },
          { x: 12.2, y: 8.3, date_local: "2026-03-22" },
          { x: 13.7, y: 8.7, date_local: "2026-03-27" },
        ],
        fitted_line: [
          { x: 4, y: 6.1 },
          { x: 6, y: 6.6 },
          { x: 8, y: 7.1 },
          { x: 10, y: 7.7 },
          { x: 12, y: 8.1 },
          { x: 14, y: 8.7 },
        ],
      },
      {
        outcome: "digit_span",
        term: "sunshine_duration_hours",
        x_label: "Sunlight Hours",
        y_label: "Digit Span",
        points: [
          { x: 2.7, y: 6.1, date_local: "2026-03-03" },
          { x: 3.5, y: 6.4, date_local: "2026-03-04" },
          { x: 4.4, y: 6.8, date_local: "2026-03-05" },
          { x: 5.8, y: 7.1, date_local: "2026-03-06" },
          { x: 7.6, y: 7.7, date_local: "2026-03-07" },
          { x: 8.8, y: 8.0, date_local: "2026-03-14" },
          { x: 9.4, y: 8.4, date_local: "2026-03-23" },
        ],
        fitted_line: [
          { x: 2.5, y: 6.1 },
          { x: 4, y: 6.6 },
          { x: 5.5, y: 7.0 },
          { x: 7, y: 7.5 },
          { x: 8.5, y: 7.9 },
          { x: 10, y: 8.4 },
        ],
      },
      {
        outcome: "self_report",
        term: "precipitation_mm",
        x_label: "Precipitation (mm)",
        y_label: "Self-report score",
        points: [
          { x: 0.0, y: 4.8, date_local: "2026-03-08" },
          { x: 0.4, y: 4.5, date_local: "2026-03-24" },
          { x: 0.9, y: 4.3, date_local: "2026-03-12" },
          { x: 1.6, y: 4.1, date_local: "2026-03-25" },
          { x: 2.1, y: 3.9, date_local: "2026-03-26" },
          { x: 2.5, y: 3.7, date_local: "2026-03-11" },
        ],
        fitted_line: [
          { x: 0, y: 4.8 },
          { x: 0.5, y: 4.5 },
          { x: 1, y: 4.3 },
          { x: 1.5, y: 4.1 },
          { x: 2, y: 3.9 },
          { x: 2.5, y: 3.7 },
        ],
      },
    ],
  },
};

const ANALYTICS_ROUTE_RESPONSE: DashboardAnalyticsRouteResponse = {
  cached: true,
  data: {
    analytics: DASHBOARD_ANALYTICS_RESPONSE,
    cached_at: "2026-03-27T16:21:00Z",
  },
  refresh: {
    requested: false,
    state: "ready",
    detail: "Snapshot is current for the selected window.",
  },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function neverResolve(): Promise<MockResponseConfig> {
  return new Promise(() => undefined);
}

export function buildDashboardMockFetch(state: DashboardStoryState): MockFetchRoute[] {
  const studyWindowRoute: MockFetchRoute = {
    method: "GET",
    path: /\/api\/ra\/dashboard\/study-window$/,
    response:
      state === "loading"
        ? async () => {
            await delay(900);
            return { json: STUDY_WINDOW_RESPONSE };
          }
        : { json: STUDY_WINDOW_RESPONSE },
  };

  const dashboardRoute: MockFetchRoute = {
    method: "GET",
    path: /\/api\/ra\/dashboard\?mode=(cached|live)/,
    response:
      state === "error"
        ? { status: 500, json: { detail: "Unable to load dashboard data right now." } }
        : state === "loading"
          ? () => neverResolve()
          : { json: DASHBOARD_WEATHER_RESPONSE },
  };

  const weatherRangeRoute: MockFetchRoute = {
    method: "GET",
    path: /\/api\/ra\/weather\/range\?/,
    response:
      state === "error"
        ? { status: 500, json: { detail: "Range data temporarily unavailable." } }
        : state === "loading"
          ? () => neverResolve()
          : { json: WEATHER_RANGE_RESPONSE },
  };

  const analyticsRoute: MockFetchRoute = {
    method: "GET",
    path: /\/api\/ra\/dashboard\/analytics\?/,
    response:
      state === "error"
        ? { status: 500, json: { detail: "Unable to load dashboard analytics right now." } }
        : state === "empty"
          ? { status: 404, json: { detail: "No analytics snapshot exists for this window." } }
          : state === "loading"
            ? () => neverResolve()
            : { json: ANALYTICS_ROUTE_RESPONSE },
  };

  return [
    studyWindowRoute,
    analyticsRoute,
    dashboardRoute,
    weatherRangeRoute,
    {
      method: "GET",
      path: "http://localhost:8000/sessions/last-native",
      response: { json: LAST_NATIVE_SESSION },
    },
    {
      method: "DELETE",
      path: "http://localhost:8000/sessions/last-native",
      response: { json: DELETE_LAST_NATIVE_SESSION_RESPONSE },
    },
    {
      method: "POST",
      path: "http://localhost:8000/weather/ingest/ubc-eos",
      response: { json: WEATHER_INGEST_RESPONSE },
    },
  ];
}

export function DashboardStoryShell() {
  return (
    <RAUserContext.Provider value={{ role: "admin", lab_name: "Weather & Wellness" }}>
      <div className="min-h-screen bg-background">
        <main className="pb-32 sm:pb-36">
          <DashboardPage />
        </main>
        <RAFloatingChrome />
      </div>
    </RAUserContext.Provider>
  );
}

export function buildDashboardStoryParameters(state: DashboardStoryState = "replica") {
  return {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/dashboard",
      },
    },
    mockFetch: buildDashboardMockFetch(state),
  };
}

export const dashboardMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);
