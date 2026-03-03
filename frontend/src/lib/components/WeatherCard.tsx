"use client";

import { useState } from "react";
import {
  ApiError,
  triggerWeatherIngest,
  type WeatherDailyResponse,
  type WeatherLatestRun,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTemp(c: number | null): string | null {
  if (c === null) return null;
  return `${Math.round(c)}°C`;
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(dt);
}

function getIngestErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "Another ingestion is already in progress. Try again shortly.";
    if (err.status === 429) return "Weather data was recently updated. Try again in a few minutes.";
    if (err.status >= 500) return "Server error during ingestion. Try again later.";
    return `Update failed (${err.status}): ${err.message}`;
  }
  return "Could not reach the server. Check your connection and try again.";
}

type ParseStatus = "success" | "partial" | "fail";

const STATUS_BADGE_CLASS: Record<ParseStatus, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  fail: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface WeatherCardProps {
  /**
   * Weather data sourced from the dashboard bundle (cached/live).
   * null = bundle not yet loaded — shows loading skeleton.
   */
  weather: WeatherDailyResponse | null;
  /**
   * Optional day context for display. When present, the card attempts to show
   * weather for this local date (`YYYY-MM-DD`) and falls back to the nearest
   * available day in the bundle if missing.
   */
  focusDate?: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeatherCard({ weather, focusDate = null }: WeatherCardProps) {
  // Override latest_run after a manual ingest without waiting for a full bundle refresh
  const [ingestOverride, setIngestOverride] = useState<WeatherLatestRun | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  // Derive display values — ingestOverride wins for latestRun after a manual update
  const latestRun = ingestOverride ?? weather?.latest_run ?? null;
  const lastItem = weather && weather.items.length > 0 ? weather.items[weather.items.length - 1] : null;
  const contextDate = focusDate ?? lastItem?.date_local ?? null;
  const displayItem = weather
    ? (
      (contextDate
        ? weather.items.find((item) => item.date_local === contextDate)
        : null
      ) ?? lastItem
    )
    : null;
  const missingContextDate = Boolean(
    contextDate &&
    displayItem &&
    displayItem.date_local !== contextDate
  );
  const isLoading = weather === null;

  const currentTemp = formatTemp(displayItem?.current_temp_c ?? null);
  const forecastHigh = formatTemp(displayItem?.forecast_high_c ?? null);
  const forecastLow  = formatTemp(displayItem?.forecast_low_c ?? null);
  const conditionText = displayItem?.forecast_condition_text ?? null;

  async function handleUpdate() {
    setUpdating(true);
    setUpdateResult(null);
    try {
      const result = await triggerWeatherIngest();
      setIngestOverride({
        run_id: result.run_id,
        ingested_at: result.ingested_at,
        parse_status: result.parse_status,
      });
      const label =
        result.parse_status === "success"
          ? "Weather updated successfully."
          : result.parse_status === "partial"
          ? "Update complete with partial data — some fields may be missing."
          : "Update ran but no data could be parsed. Check the ingest logs.";
      setUpdateResult({ kind: "success", message: label });
    } catch (err) {
      setUpdateResult({ kind: "error", message: getIngestErrorMessage(err) });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-border p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      style={{ background: "var(--card)" }}
    >
      {/* Left — label + weather data + status */}
      <div className="flex flex-col gap-3">

        {/* Section label */}
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--ubc-blue-500)" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            />
          </svg>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Weather Data
          </p>
        </div>
        {!isLoading && contextDate && (
          <p className="text-xs text-muted-foreground">
            Context day: {formatDisplayDate(contextDate)}
          </p>
        )}

        {/* Weather summary for context day */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (currentTemp || conditionText) ? (
          <div className="flex flex-col gap-1">
            {/* Temperature row */}
            <div className="flex flex-wrap items-baseline gap-3">
              {currentTemp && (
                <span className="text-2xl font-bold tabular-nums text-foreground">
                  {currentTemp}
                </span>
              )}
              {(forecastHigh || forecastLow) && (
                <span className="text-sm tabular-nums text-muted-foreground">
                  {forecastHigh && <span>↑ {forecastHigh}</span>}
                  {forecastHigh && forecastLow && <span className="mx-1 opacity-40">·</span>}
                  {forecastLow && <span>↓ {forecastLow}</span>}
                </span>
              )}
            </div>
            {/* Condition text */}
            {conditionText && (
              <p className="text-sm text-muted-foreground">{conditionText}</p>
            )}
            {missingContextDate && contextDate && displayItem && (
              <p className="text-xs text-muted-foreground">
                No weather row for {formatDisplayDate(contextDate)}. Showing nearest available day ({formatDisplayDate(displayItem.date_local)}).
              </p>
            )}
          </div>
        ) : (
          // Have weather response but no item data for selected context day.
          <p className="text-sm text-muted-foreground">
            No weather data for {contextDate ? formatDisplayDate(contextDate) : "the selected day"} yet.
          </p>
        )}

        {/* Ingest run status */}
        {!isLoading && (
          latestRun ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={`border font-semibold ${STATUS_BADGE_CLASS[latestRun.parse_status]}`}
                variant="outline"
              >
                {latestRun.parse_status}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                Last updated {timeAgo(latestRun.ingested_at)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No ingestion runs yet.</p>
          )
        )}

        {/* Inline feedback after manual update */}
        {updateResult && (
          <p
            className={`text-sm ${
              updateResult.kind === "success"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-destructive"
            }`}
          >
            {updateResult.message}
          </p>
        )}
      </div>

      {/* Right — action button */}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 self-start"
        onClick={handleUpdate}
        disabled={updating || isLoading}
      >
        {updating ? (
          <>
            <svg
              className="mr-1.5 h-3.5 w-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Updating…
          </>
        ) : (
          "Update Weather"
        )}
      </Button>
    </div>
  );
}
