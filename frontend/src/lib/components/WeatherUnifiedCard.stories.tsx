import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { WeatherDailyItem, WeatherDailyResponse, WeatherIngestResponse } from "@/lib/api";
import WeatherUnifiedCard from "@/lib/components/WeatherUnifiedCard";

const latestRun = {
  run_id: "run_20260327_1530",
  ingested_at: "2026-03-27T15:30:00Z",
  parse_status: "success",
} as const;

const rangeItems: WeatherDailyItem[] = [
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-20",
    date_local: "2026-03-20",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-20T15:30:00Z",
    current_temp_c: 7.8,
    current_precip_today_mm: 0.4,
    forecast_high_c: 9.2,
    forecast_low_c: 3.1,
    forecast_condition_text: "Light cloud",
    forecast_periods: [],
    sunshine_duration_hours: 5.4,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-21",
    date_local: "2026-03-21",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-21T15:30:00Z",
    current_temp_c: 8.4,
    current_precip_today_mm: 0.1,
    forecast_high_c: 10.3,
    forecast_low_c: 3.8,
    forecast_condition_text: "Partly cloudy",
    forecast_periods: [],
    sunshine_duration_hours: 6.2,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-22",
    date_local: "2026-03-22",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-22T15:30:00Z",
    current_temp_c: 9.6,
    current_precip_today_mm: 0,
    forecast_high_c: 11.5,
    forecast_low_c: 4.3,
    forecast_condition_text: "Bright intervals",
    forecast_periods: [],
    sunshine_duration_hours: 7.8,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-23",
    date_local: "2026-03-23",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-23T15:30:00Z",
    current_temp_c: 10.8,
    current_precip_today_mm: 0,
    forecast_high_c: 12.4,
    forecast_low_c: 5.1,
    forecast_condition_text: "Sunny",
    forecast_periods: [],
    sunshine_duration_hours: 8.9,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-24",
    date_local: "2026-03-24",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-24T15:30:00Z",
    current_temp_c: 11.2,
    current_precip_today_mm: 0,
    forecast_high_c: 13.2,
    forecast_low_c: 5.7,
    forecast_condition_text: "Clear skies",
    forecast_periods: [],
    sunshine_duration_hours: 9.6,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-25",
    date_local: "2026-03-25",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-25T15:30:00Z",
    current_temp_c: 9.4,
    current_precip_today_mm: 1.7,
    forecast_high_c: 10.7,
    forecast_low_c: 4.9,
    forecast_condition_text: "Showers",
    forecast_periods: [],
    sunshine_duration_hours: 3.8,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-26",
    date_local: "2026-03-26",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-26T15:30:00Z",
    current_temp_c: 8.7,
    current_precip_today_mm: 2.3,
    forecast_high_c: 9.8,
    forecast_low_c: 4.2,
    forecast_condition_text: "Rain tapering off",
    forecast_periods: [],
    sunshine_duration_hours: 2.9,
  },
  {
    station_id: 3510,
    study_day_id: "study-day-2026-03-27",
    date_local: "2026-03-27",
    source_run_id: latestRun.run_id,
    updated_at: "2026-03-27T15:30:00Z",
    current_temp_c: 12.4,
    current_precip_today_mm: 0.2,
    forecast_high_c: 14.1,
    forecast_low_c: 6.3,
    forecast_condition_text: "Sunny breaks",
    forecast_periods: [],
    sunshine_duration_hours: 8.1,
  },
];

const weather: WeatherDailyResponse = {
  items: rangeItems,
  latest_run: latestRun,
};

const rangeRouteResponse = {
  cached: true,
  data: {
    weather,
    cached_at: "2026-03-27T15:35:00Z",
  },
};

const ingestResponse: WeatherIngestResponse = {
  run_id: "run_20260327_1600",
  station_id: 3510,
  ingested_at: "2026-03-27T16:00:00Z",
  parse_status: "success",
  parse_errors: [],
  upserted_days: rangeItems.length,
};

const weatherStoryMocks = [
  {
    method: "GET",
    path: "/api/ra/weather/range?",
    response: { json: rangeRouteResponse },
  },
  {
    method: "POST",
    path: "http://localhost:8000/weather/ingest/ubc-eos",
    response: { json: ingestResponse },
  },
];

const meta = {
  title: "Dashboard/WeatherUnifiedCard",
  component: WeatherUnifiedCard,
  tags: ["autodocs"],
  parameters: {
    mockFetch: weatherStoryMocks,
  },
  args: {
    weather,
  },
  render: (args) => (
    <div className="mx-auto max-w-6xl">
      <WeatherUnifiedCard {...args} />
    </div>
  ),
} satisfies Meta<typeof WeatherUnifiedCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LoadingState: Story = {
  args: {
    weather: null,
  },
};
