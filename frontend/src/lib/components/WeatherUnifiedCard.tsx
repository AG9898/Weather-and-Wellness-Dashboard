"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  ApiError,
  getWeatherRangeBundle,
  triggerWeatherIngest,
  type WeatherDailyItem,
  type WeatherDailyResponse,
  type WeatherLatestRun,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CloudLoading from "@/lib/components/CloudLoading";

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDY_START = "2025-03-03";
const STUDY_TIMEZONE = "America/Vancouver";

type FilterPreset = "study_start" | "last_7" | "last_30" | "last_90" | "custom";
type ParseStatus = "success" | "partial" | "fail";

interface ChartColors {
  chart1: string;
  chart2: string;
  chart3: string;
  border: string;
  mutedFg: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStudyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIMEZONE }).format(new Date());
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dateToTs(dateLocal: string): number {
  const [y, m, d] = dateLocal.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTemp(c: number | null): string | null {
  if (c === null) return null;
  return `${Math.round(c)}°C`;
}

function formatPrecip(mm: number | null): string | null {
  if (mm === null) return null;
  return `${mm.toFixed(1)} mm`;
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
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

function getRangeErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 422) return "Invalid date range.";
    if (err.status >= 500) return "Range data temporarily unavailable.";
    return `Failed to load range (${err.status}).`;
  }
  return "Unable to load chart data. Check your connection.";
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableRangeError(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500;
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    return (
      message.includes("timed out") ||
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("fetch")
    );
  }
  return false;
}

/** Convert a 6-digit CSS hex color (#rrggbb) to rgba() with the given alpha (0–1). */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function readChartColors(): ChartColors {
  return {
    chart1: getCssVar("--chart-1") || "#0052f5",
    chart2: getCssVar("--chart-2") || "#00a2fa",
    chart3: getCssVar("--chart-3") || "#33e0fc",
    border: getCssVar("--border") || "rgba(0,19,40,0.12)",
    mutedFg: getCssVar("--muted-foreground") || "#6e7c95",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const STATUS_BADGE_CLASS: Record<ParseStatus, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  partial: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  fail: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

interface SeriesToggleButtonProps {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}

function SeriesToggleButton({ active, color, label, onClick }: SeriesToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition-all",
        active
          ? "text-foreground"
          : "border-border/60 text-muted-foreground opacity-60 hover:opacity-80"
      )}
      style={
        active
          ? { background: `${color}22`, borderColor: `${color}66` }
          : undefined
      }
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full transition-opacity"
        style={{ background: color, opacity: active ? 1 : 0.4 }}
      />
      {label}
    </button>
  );
}

interface PresetButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function PresetButton({ active, label, onClick }: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide transition-all",
        active
          ? "border-transparent text-primary-foreground"
          : "border-border/60 text-muted-foreground hover:border-ring/40 hover:text-foreground"
      )}
      style={active ? { background: "var(--ubc-blue-700)" } : undefined}
    >
      {label}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WeatherUnifiedCardProps {
  /**
   * Base weather data from the dashboard bundle (for current-day summary).
   * null = bundle not yet loaded.
   */
  weather: WeatherDailyResponse | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeatherUnifiedCard({ weather }: WeatherUnifiedCardProps) {
  // ── Mount guard (Highcharts needs window) ────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── Ingest state ─────────────────────────────────────────────────────────
  const [ingestOverride, setIngestOverride] = useState<WeatherLatestRun | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  // ── Derived current-day display (from base prop) ─────────────────────────
  const latestRun = ingestOverride ?? weather?.latest_run ?? null;
  const displayItem =
    weather && weather.items.length > 0
      ? weather.items[weather.items.length - 1]
      : null;
  const isLoading = weather === null;

  const currentTemp = formatTemp(displayItem?.current_temp_c ?? null);
  const forecastHigh = formatTemp(displayItem?.forecast_high_c ?? null);
  const forecastLow = formatTemp(displayItem?.forecast_low_c ?? null);
  const precipToday = formatPrecip(displayItem?.current_precip_today_mm ?? null);
  const conditionText = displayItem?.forecast_condition_text ?? null;

  // ── Filter state ─────────────────────────────────────────────────────────
  const todayRef = useRef(getStudyToday());
  const [preset, setPreset] = useState<FilterPreset>("study_start");
  const [customFrom, setCustomFrom] = useState(STUDY_START);
  const [customTo, setCustomTo] = useState(todayRef.current);

  // ── Range fetch state ────────────────────────────────────────────────────
  const [rangeItems, setRangeItems] = useState<WeatherDailyItem[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeLoadingMessage, setRangeLoadingMessage] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const rangeSeqRef = useRef(0);

  // ── Series visibility ────────────────────────────────────────────────────
  const [showTemp, setShowTemp] = useState(true);
  const [showPrecip, setShowPrecip] = useState(true);
  const [showSunlight, setShowSunlight] = useState(true);

  // ── Chart theme state ────────────────────────────────────────────────────
  const [chartColors, setChartColors] = useState<ChartColors>({
    chart1: "#0052f5",
    chart2: "#00a2fa",
    chart3: "#33e0fc",
    border: "rgba(0,19,40,0.12)",
    mutedFg: "#6e7c95",
  });

  // Read CSS vars at mount and re-read on theme class changes
  useEffect(() => {
    setChartColors(readChartColors());
    const observer = new MutationObserver(() => {
      setChartColors(readChartColors());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // ── Fetch range data ──────────────────────────────────────────────────────
  const fetchRange = useCallback(async (
    dateFrom: string,
    dateTo: string,
    options?: { forceLive?: boolean }
  ) => {
    setRangeError(null);
    setRangeLoadingMessage(null);
    const seq = rangeSeqRef.current + 1;
    rangeSeqRef.current = seq;
    let loadingTimer: ReturnType<typeof setTimeout> | null = null;
    const setLoadingIfStillCurrent = (message: string) => {
      if (rangeSeqRef.current !== seq) return;
      setRangeLoading(true);
      setRangeLoadingMessage(message);
    };

    const fetchLiveWithRetry = async () => {
      try {
        return await getWeatherRangeBundle("live", dateFrom, dateTo);
      } catch (err) {
        if (!isRetryableRangeError(err) || rangeSeqRef.current !== seq) {
          throw err;
        }
        setLoadingIfStillCurrent("Retrying live chart data from backend…");
        await sleep(1200);
        if (rangeSeqRef.current !== seq) throw err;
        return getWeatherRangeBundle("live", dateFrom, dateTo);
      }
    };

    try {
      if (options?.forceLive) {
        setLoadingIfStillCurrent("Fetching live chart data from backend…");
        const live = await fetchLiveWithRetry();
        if (rangeSeqRef.current !== seq) return;
        if (!live.data) throw new Error("No weather data returned");
        setRangeItems(live.data.weather.items);
        return;
      }

      loadingTimer = setTimeout(() => {
        setLoadingIfStillCurrent("Checking cached chart data…");
      }, 150);

      const cached = await getWeatherRangeBundle("cached", dateFrom, dateTo);
      if (rangeSeqRef.current !== seq) return;
      if (cached.cached && cached.data) {
        setRangeItems(cached.data.weather.items);
        return;
      }

      setLoadingIfStillCurrent("Fetching live chart data from backend…");
      const live = await fetchLiveWithRetry();
      if (rangeSeqRef.current !== seq) return;
      if (!live.data) throw new Error("No weather data returned");
      setRangeItems(live.data.weather.items);
    } catch (err) {
      if (rangeSeqRef.current !== seq) return;
      setRangeError(getRangeErrorMessage(err));
    } finally {
      if (loadingTimer) clearTimeout(loadingTimer);
      if (rangeSeqRef.current === seq) {
        setRangeLoading(false);
        setRangeLoadingMessage(null);
      }
    }
  }, []);

  // Initial fetch with default preset (study start → today)
  useEffect(() => {
    void fetchRange(STUDY_START, todayRef.current);
  }, [fetchRange]);

  // ── Preset handlers ───────────────────────────────────────────────────────
  function applyPreset(next: FilterPreset): void {
    if (next === "custom") {
      setPreset("custom");
      return;
    }
    const today = getStudyToday();
    let from: string;
    const to = today;
    if (next === "study_start") {
      from = STUDY_START;
    } else if (next === "last_7") {
      from = shiftDate(today, -6);
    } else if (next === "last_30") {
      from = shiftDate(today, -29);
    } else {
      // last_90
      from = shiftDate(today, -89);
    }
    setPreset(next);
    setCustomFrom(from);
    setCustomTo(to);
    void fetchRange(from, to);
  }

  function handleApplyCustom(): void {
    if (!customFrom || !customTo) return;
    if (customFrom > customTo) {
      setRangeError("Start date must be on or before end date.");
      return;
    }
    void fetchRange(customFrom, customTo);
  }

  // ── Ingest handler ────────────────────────────────────────────────────────
  async function handleUpdate(): Promise<void> {
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
          ? "Update complete with partial data."
          : "Update ran but no data could be parsed.";
      setUpdateResult({ kind: "success", message: label });
      const studyToday = getStudyToday();
      if (customFrom !== STUDY_START || customTo !== studyToday) {
        void getWeatherRangeBundle("live", STUDY_START, studyToday).catch(() => undefined);
      }
      void fetchRange(customFrom, customTo, { forceLive: true });
    } catch (err) {
      setUpdateResult({ kind: "error", message: getIngestErrorMessage(err) });
    } finally {
      setUpdating(false);
    }
  }

  // Ref to the chart area div — used for the CSS clip-path draw-in animation
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // ── Chart options (declarative — data and visibility included) ────────────
  const chartOptions = useMemo<Highcharts.Options>(() => {
    const { chart1, chart2, chart3, border, mutedFg } = chartColors;

    const tempData: [number, number | null][] = rangeItems.map((item) => [
      dateToTs(item.date_local),
      item.current_temp_c,
    ]);
    const precipData: [number, number | null][] = rangeItems.map((item) => [
      dateToTs(item.date_local),
      item.current_precip_today_mm,
    ]);
    const sunData: [number, number | null][] = rangeItems.map((item) => [
      dateToTs(item.date_local),
      item.sunshine_duration_hours,
    ]);

    return {
      chart: {
        backgroundColor: "transparent",
        height: 300,
        animation: false,
        style: { fontFamily: "inherit" },
        marginTop: 12,
        marginRight: 48,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: "var(--card)",
        borderColor: border,
        borderRadius: 10,
        padding: 10,
        shadow: false,
        style: { color: mutedFg, fontSize: "12px", lineHeight: "1.6" },
        formatter: function (): string {
          const ctx = this as unknown as { points?: Highcharts.Point[]; x?: number };
          const points = ctx.points ?? [];
          if (points.length === 0) return "";
          const xVal = (ctx.x ?? points[0].x) as number;
          const dateLabel = formatDisplayDate(new Date(xVal).toISOString().slice(0, 10));
          const lines: string[] = [
            `<span style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${dateLabel}</span>`,
          ];
          for (const p of points) {
            const yVal = p.y;
            if (yVal === null || yVal === undefined) continue;
            let unit = "";
            if (p.series.name === "Temperature") unit = "°C";
            else if (p.series.name === "Precipitation") unit = " mm";
            else if (p.series.name === "Sunlight") unit = " h";
            lines.push(
              `<span style="color:${p.color as string}">\u25CF</span> ` +
                `${p.series.name}: <b>${(yVal as number).toFixed(1)}${unit}</b>`
            );
          }
          return lines.join("<br/>");
        },
      },
      xAxis: {
        type: "datetime",
        lineColor: border,
        tickColor: "transparent",
        gridLineWidth: 0,
        labels: {
          style: { color: mutedFg, fontSize: "11px" },
          y: 18,
        },
      },
      yAxis: [
        {
          // Temperature — left axis (°C)
          title: { text: undefined },
          gridLineColor: border,
          gridLineDashStyle: "Dash" as const,
          labels: {
            style: { color: mutedFg, fontSize: "11px" },
            formatter: function (): string {
              return `${this.value}°`;
            },
          },
        },
        {
          // Precipitation (mm) — right axis, no labels (different unit from sunlight)
          title: { text: undefined },
          opposite: true,
          gridLineWidth: 0,
          min: 0,
          labels: { enabled: false },
        },
        {
          // Sunlight hours — second right axis, no labels
          title: { text: undefined },
          opposite: true,
          gridLineWidth: 0,
          min: 0,
          max: 14,
          labels: { enabled: false },
        },
      ],
      plotOptions: {
        series: {
          connectNulls: false,
          animation: false,
          states: { hover: { lineWidthPlus: 0 } },
        },
        areaspline: {
          lineWidth: 2.5,
          marker: {
            enabled: false,
            symbol: "circle",
            states: { hover: { enabled: true, radius: 4, lineWidth: 0 } },
          },
        },
        spline: {
          lineWidth: 2,
          marker: {
            enabled: false,
            symbol: "circle",
            states: { hover: { enabled: true, radius: 4, lineWidth: 0 } },
          },
        },
      },
      series: [
        {
          // Temperature — areaspline with gradient fill for visual depth
          type: "areaspline" as const,
          name: "Temperature",
          color: chart1,
          lineWidth: 2.5,
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, hexToRgba(chart1, 0.18)] as [number, string],
              [1, hexToRgba(chart1, 0)] as [number, string],
            ],
          },
          yAxis: 0,
          visible: showTemp,
          data: tempData,
          zIndex: 3,
        },
        {
          // Precipitation — spline, semi-transparent
          type: "spline" as const,
          name: "Precipitation",
          color: chart2,
          lineWidth: 2,
          opacity: 0.65,
          dashStyle: "ShortDash",
          yAxis: 1,
          visible: showPrecip,
          data: precipData,
          zIndex: 2,
        },
        {
          // Sunlight hours — spline, semi-transparent, separate scale
          type: "spline" as const,
          name: "Sunlight",
          color: chart3,
          lineWidth: 2,
          opacity: 0.65,
          dashStyle: "ShortDot",
          yAxis: 2,
          visible: showSunlight,
          data: sunData,
          zIndex: 1,
        },
      ],
    };
  }, [chartColors, rangeItems, showTemp, showPrecip, showSunlight]);

  // CSS clip-path draw-in animation: fires whenever data or visibility changes.
  // HighchartsReact re-renders declaratively from chartOptions; the clip effect
  // runs synchronously before the next paint so it covers the chart update.
  useEffect(() => {
    if (!mounted || rangeItems.length === 0) return;
    const el = chartAreaRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.clipPath = "inset(0 100% 0 0)";
    void el.offsetWidth; // force reflow so the clip is committed before animating
    el.style.transition = "clip-path 800ms ease-out";
    el.style.clipPath = "inset(0 0% 0 0)";
  }, [rangeItems, showTemp, showPrecip, showSunlight, mounted]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border/90 shadow-[0_24px_48px_-46px_rgb(0_19_40/0.75)]"
      style={{ background: "var(--card)" }}
    >
      {/* Background glow accent */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--ubc-blue-500)" }}
      />

      <div className="relative p-5 sm:p-6">
        {/* ── Header row ─────────────────────────────────────────────────── */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0"
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
              Weather
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full px-4"
            onClick={() => { void handleUpdate(); }}
            disabled={updating || isLoading}
          >
            {updating ? (
              <>
                <CloudLoading size="sm" className="mr-1.5" />
                Updating…
              </>
            ) : (
              "Update Weather"
            )}
          </Button>
        </div>

        {/* ── Current-day weather summary ───────────────────────────────── */}
        {isLoading ? (
          <div className="mb-5 flex items-center gap-2 text-muted-foreground">
            <CloudLoading size="md" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            {/* Temperature + forecast + condition + precip */}
            <div className="flex flex-col gap-2">
              {currentTemp || conditionText ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-3">
                    {currentTemp && (
                      <span className="text-4xl font-bold tabular-nums text-foreground">
                        {currentTemp}
                      </span>
                    )}
                    {(forecastHigh || forecastLow) && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {forecastHigh && <span>↑ {forecastHigh}</span>}
                        {forecastHigh && forecastLow && (
                          <span className="mx-1 opacity-40">·</span>
                        )}
                        {forecastLow && <span>↓ {forecastLow}</span>}
                      </span>
                    )}
                  </div>
                  {conditionText && (
                    <p className="text-sm text-muted-foreground">{conditionText}</p>
                  )}
                  {precipToday && (
                    <span className="inline-flex w-fit rounded-full border border-border/80 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                      Precip: {precipToday}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No weather data for today yet.
                </p>
              )}
            </div>

            {/* Ingest run status badge */}
            {latestRun ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={`border font-semibold ${STATUS_BADGE_CLASS[latestRun.parse_status]}`}
                  variant="outline"
                >
                  {latestRun.parse_status}
                </Badge>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {timeAgo(latestRun.ingested_at)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No ingestion runs yet.</p>
            )}
          </div>
        )}

        {/* Ingest feedback */}
        {updateResult && (
          <p
            className={cn(
              "mb-4 text-sm",
              updateResult.kind === "success"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-destructive"
            )}
          >
            {updateResult.message}
          </p>
        )}

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="mb-4 border-t border-border/60" />

        {/* ── Graph controls row ────────────────────────────────────────── */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {/* Date range preset buttons */}
          <div className="flex flex-wrap gap-1.5">
            <PresetButton
              active={preset === "study_start"}
              label="Study Start"
              onClick={() => applyPreset("study_start")}
            />
            <PresetButton
              active={preset === "last_7"}
              label="Last 7d"
              onClick={() => applyPreset("last_7")}
            />
            <PresetButton
              active={preset === "last_30"}
              label="Last 30d"
              onClick={() => applyPreset("last_30")}
            />
            <PresetButton
              active={preset === "last_90"}
              label="Last 90d"
              onClick={() => applyPreset("last_90")}
            />
            <PresetButton
              active={preset === "custom"}
              label="Custom"
              onClick={() => applyPreset("custom")}
            />
          </div>

          {/* Series visibility toggles */}
          <div className="flex flex-wrap gap-1.5">
            <SeriesToggleButton
              active={showTemp}
              color={chartColors.chart1}
              label="Temp"
              onClick={() => setShowTemp((v) => !v)}
            />
            <SeriesToggleButton
              active={showPrecip}
              color={chartColors.chart2}
              label="Precip"
              onClick={() => setShowPrecip((v) => !v)}
            />
            <SeriesToggleButton
              active={showSunlight}
              color={chartColors.chart3}
              label="Sunlight"
              onClick={() => setShowSunlight((v) => !v)}
            />
          </div>
        </div>

        {/* Custom date pickers (visible only when Custom preset is active) */}
        {preset === "custom" && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </span>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-36 rounded-xl border border-border bg-background px-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                To
              </span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={getStudyToday()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-36 rounded-xl border border-border bg-background px-2 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 self-end rounded-xl"
              disabled={rangeLoading}
              onClick={handleApplyCustom}
            >
              Apply
            </Button>
          </div>
        )}

        {/* Inline range loading / error feedback */}
        {(rangeLoading || rangeError) && (
          <div className="mb-3 text-xs">
            {rangeLoading && (
              <span className="text-muted-foreground">
                {rangeLoadingMessage ?? "Loading chart data…"}
              </span>
            )}
            {!rangeLoading && rangeError && (
              <span className="text-destructive">{rangeError}</span>
            )}
          </div>
        )}

        {/* ── Highcharts line chart ─────────────────────────────────────── */}
        <div className="h-72 w-full" ref={chartAreaRef}>
          {mounted && (
            <HighchartsReact
              highcharts={Highcharts}
              options={chartOptions}
              containerProps={{ style: { width: "100%", height: "100%" } }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
