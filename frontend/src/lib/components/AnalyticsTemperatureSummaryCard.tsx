"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import {
  AlertTriangle,
  CalendarDays,
  Flame,
  RefreshCw,
  Snowflake,
  Thermometer,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  AnalyticsTemperatureSummaryGroupResponse,
  AnalyticsTemperatureSummaryResponse,
  AnalyticsTemperatureSummaryWindowKey,
  AnalyticsTemperatureSummaryWindowResponse,
} from "@/lib/api";
import {
  loadTemperatureSummary,
  refreshTemperatureSummary,
  type TemperatureSummaryLoadResult,
} from "@/lib/analytics/dashboard-analytics-loader";
import {
  buildTemperatureHistogramPoints,
  formatSigned,
  formatTemperatureDateRange,
  formatTemperatureValue,
  formatTemperatureWindowLabel,
  getTemperatureSummaryThresholdOverlay,
  getTemperatureSummaryWindow,
  getTemperatureSummaryPresetRange,
  isTemperatureSummaryReady,
  normalizeTemperatureSummaryRange,
  type TemperatureSummaryRangePreset,
} from "@/lib/analytics/ui-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CloudLoading from "@/lib/components/CloudLoading";

const STUDY_START = "2025-03-03";

const WINDOW_KEYS: AnalyticsTemperatureSummaryWindowKey[] = [
  "overall",
  "fall_winter",
  "spring_summer",
];

type LoadingMode = "snapshot" | "live" | null;
type SummaryRangePreset = TemperatureSummaryRangePreset;

interface ChartColors {
  bars: string;
  mean: string;
  cold: string;
  hot: string;
  border: string;
  mutedFg: string;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readChartColors(): ChartColors {
  return {
    bars: getCssVar("--chart-1") || "#28455d",
    mean: getCssVar("--chart-4") || "#b8c2cb",
    cold: getCssVar("--chart-3") || "#8a9bab",
    hot: getCssVar("--chart-5") || "#878343",
    border: getCssVar("--border") || "rgba(0,19,40,0.12)",
    mutedFg: getCssVar("--muted-foreground") || "#6e7c95",
  };
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function TemperatureSummaryStatCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold leading-none text-foreground">{value}</p>
      {helper && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{helper}</p>}
    </div>
  );
}

function SummaryPresetButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
        active
          ? "border-primary/35 bg-primary/10 text-primary"
          : "border-border/70 bg-background/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function TemperatureHistogramChart({
  summaryWindow,
}: {
  summaryWindow: AnalyticsTemperatureSummaryWindowResponse;
}) {
  const [mounted, setMounted] = useState(false);
  const [chartColors, setChartColors] = useState<ChartColors>({
    bars: "#28455d",
    mean: "#b8c2cb",
    cold: "#8a9bab",
    hot: "#878343",
    border: "rgba(0,19,40,0.12)",
    mutedFg: "#6e7c95",
  });

  useEffect(() => {
    setMounted(true);
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

  const histogramPoints = useMemo(
    () => buildTemperatureHistogramPoints(summaryWindow),
    [summaryWindow]
  );
  const thresholdOverlay = useMemo(
    () => getTemperatureSummaryThresholdOverlay(summaryWindow),
    [summaryWindow]
  );

  const chartOptions = useMemo<Highcharts.Options>(() => {
    const { bars, mean, cold, hot, border, mutedFg } = chartColors;

    const minX = histogramPoints.length
      ? Math.min(...histogramPoints.map((point) => point.x)) - 0.5
      : undefined;
    const maxX = histogramPoints.length
      ? Math.max(...histogramPoints.map((point) => point.x)) + 0.5
      : undefined;
    const dataMax = Math.max(...histogramPoints.map((point) => point.y), 0);
    const plotLines: Highcharts.XAxisPlotLinesOptions[] = [];

    if (summaryWindow.mean_temperature_c !== null) {
      plotLines.push({
        value: summaryWindow.mean_temperature_c,
        color: mean,
        width: 2,
        dashStyle: "Solid",
        zIndex: 5,
        label: {
          text: `Mean ${formatTemperatureValue(summaryWindow.mean_temperature_c)}`,
          rotation: 0,
          align: "left",
          x: 4,
          y: -8,
          style: { color: mean, fontSize: "11px", fontWeight: "600" },
        },
      });
    }

    if (thresholdOverlay.available && thresholdOverlay.coldThresholdTemperatureC !== null) {
      plotLines.push({
        value: thresholdOverlay.coldThresholdTemperatureC,
        color: cold,
        width: 1.5,
        dashStyle: "Dash",
        zIndex: 5,
        label: {
          text: `Cold cutoff ${formatTemperatureValue(
            thresholdOverlay.coldThresholdTemperatureC
          )}`,
          rotation: 0,
          align: "left",
          x: 4,
          y: -8,
          style: { color: cold, fontSize: "11px", fontWeight: "600" },
        },
      });
    }

    if (thresholdOverlay.available && thresholdOverlay.hotThresholdTemperatureC !== null) {
      plotLines.push({
        value: thresholdOverlay.hotThresholdTemperatureC,
        color: hot,
        width: 1.5,
        dashStyle: "Dash",
        zIndex: 5,
        label: {
          text: `Hot cutoff ${formatTemperatureValue(
            thresholdOverlay.hotThresholdTemperatureC
          )}`,
          rotation: 0,
          align: "left",
          x: 4,
          y: -8,
          style: { color: hot, fontSize: "11px", fontWeight: "600" },
        },
      });
    }

    return {
      chart: {
        backgroundColor: "transparent",
        height: 300,
        animation: false,
        style: { fontFamily: "inherit" },
        marginTop: 12,
        marginRight: 20,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        shared: false,
        useHTML: true,
        backgroundColor: "var(--card)",
        borderColor: border,
        borderRadius: 10,
        padding: 10,
        shadow: false,
        style: { color: mutedFg, fontSize: "12px", lineHeight: "1.6" },
        formatter: function (): string {
          const ctx = this as unknown as {
            point?: { custom?: { binLabel?: string } };
            y?: number;
          };

          return `
            <span style="font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">${ctx.point?.custom?.binLabel ?? "Temperature bin"}</span><br/>
            ${ctx.y ?? 0} day${ctx.y === 1 ? "" : "s"}
          `;
        },
      },
      xAxis: {
        title: {
          text: "Temperature (°C)",
          style: { color: mutedFg, fontSize: "11px" },
          margin: 8,
        },
        lineColor: border,
        tickColor: "transparent",
        gridLineWidth: 1,
        gridLineColor: border,
        gridLineDashStyle: "Dash" as const,
        labels: {
          style: { color: mutedFg, fontSize: "11px" },
          formatter: function () {
            const value = typeof this.value === "number" ? this.value : Number(this.value);
            return Number.isFinite(value) ? `${value.toFixed(0)}°` : "";
          },
        },
        min: minX,
        max: maxX,
        tickInterval: 1,
        plotLines,
      },
      yAxis: {
        title: {
          text: "Days",
          style: { color: mutedFg, fontSize: "11px" },
          margin: 8,
        },
        gridLineColor: border,
        gridLineDashStyle: "Dash" as const,
        labels: { style: { color: mutedFg, fontSize: "11px" } },
        allowDecimals: false,
        min: 0,
        max: dataMax > 0 ? undefined : 1,
      },
      plotOptions: {
        series: {
          animation: false,
          borderWidth: 0,
        },
        column: {
          color: bars,
          borderRadius: 4,
          groupPadding: 0.06,
          pointPadding: 0.02,
          pointRange: 1,
        },
      },
      series: [
        {
          type: "column" as const,
          name: "Days",
          data: histogramPoints.map((point) => ({
            x: point.x,
            y: point.y,
            custom: { binLabel: point.binLabel },
          })),
          color: bars,
        },
      ],
    };
  }, [
    chartColors,
    histogramPoints,
    summaryWindow.mean_temperature_c,
    thresholdOverlay.available,
    thresholdOverlay.coldThresholdTemperatureC,
    thresholdOverlay.hotThresholdTemperatureC,
  ]);

  return (
    <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Temperature histogram
          </p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">
            1°C frequency bins for the active window
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
            1°C bins
          </Badge>
          <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
            {thresholdOverlay.methodLabel} · {thresholdOverlay.cutoffLabel}
          </Badge>
        </div>
      </div>

      <div className="mt-4 h-[300px] w-full">
        {histogramPoints.length > 0 ? (
          mounted ? (
            <HighchartsReact
              highcharts={Highcharts}
              options={chartOptions}
              containerProps={{ style: { width: "100%", height: "100%" } }}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
              Rendering the histogram…
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-sm text-muted-foreground">
            No bins were returned for this window.
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {thresholdOverlay.note}
      </p>
    </div>
  );
}

function TemperatureGroupPanel({
  title,
  icon: Icon,
  toneClassName,
  thresholdLabel,
  group,
}: {
  title: string;
  icon: LucideIcon;
  toneClassName: string;
  thresholdLabel: string;
  group: AnalyticsTemperatureSummaryGroupResponse;
}) {
  return (
    <div className={cn("rounded-2xl border px-4 py-4", toneClassName)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{thresholdLabel}</p>
        </div>
        <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
          {group.day_count} day{group.day_count === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Icon className="h-3.5 w-3.5" />
          <span>
            {group.participant_count} participant{group.participant_count === 1 ? "" : "s"}
          </span>
        </span>
      </div>

      {group.days.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {group.days.map((day) => (
              <div key={day.date_local} className="rounded-xl border border-border/70 bg-background/60 px-3 py-3">
                <p className="text-sm font-semibold text-foreground">{formatDisplayDate(day.date_local)}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {day.participant_count} participant{day.participant_count === 1 ? "" : "s"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatTemperatureValue(day.temperature_c)} · z {formatSigned(day.temperature_z)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {group.days.map((day) => (
              <Badge
                key={`${title}-${day.date_local}`}
                variant="outline"
                className="border-border/70 bg-background/70 text-foreground"
              >
                {formatDisplayDate(day.date_local)} · {day.participant_count} participant
                {day.participant_count === 1 ? "" : "s"}
              </Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-background/60 px-4 py-5 text-sm text-muted-foreground">
          No qualifying days crossed this threshold in the selected window.
        </div>
      )}
    </div>
  );
}

interface TemperatureSummaryContentProps {
  temperatureSummary: AnalyticsTemperatureSummaryResponse | null;
}

function TemperatureSummaryContent({ temperatureSummary }: TemperatureSummaryContentProps) {
  const [selectedWindowKey, setSelectedWindowKey] =
    useState<AnalyticsTemperatureSummaryWindowKey>("overall");

  const availableWindowKeys = useMemo(
    () => WINDOW_KEYS.filter((windowKey) => getTemperatureSummaryWindow(temperatureSummary, windowKey)),
    [temperatureSummary]
  );

  useEffect(() => {
    if (availableWindowKeys.length === 0) {
      return;
    }
    if (!getTemperatureSummaryWindow(temperatureSummary, selectedWindowKey)) {
      setSelectedWindowKey(availableWindowKeys[0]);
    }
  }, [availableWindowKeys, selectedWindowKey, temperatureSummary]);

  const selectedWindow =
    getTemperatureSummaryWindow(temperatureSummary, selectedWindowKey) ??
    getTemperatureSummaryWindow(temperatureSummary, availableWindowKeys[0] ?? "overall");

  const summaryStats = useMemo(() => {
    if (!selectedWindow) {
      return null;
    }

    return [
      {
        icon: CalendarDays,
        label: "Days",
        value: selectedWindow.day_count.toString(),
        helper: formatTemperatureDateRange(selectedWindow.date_from, selectedWindow.date_to),
      },
      {
        icon: Users,
        label: "Participants",
        value: selectedWindow.participant_count.toString(),
        helper: "Unique participant-day total in the selected window.",
      },
      {
        icon: Thermometer,
        label: "Mean temperature",
        value: formatTemperatureValue(selectedWindow.mean_temperature_c),
        helper: "Arithmetic mean across unique study days.",
      },
      {
        icon: Thermometer,
        label: "Std. deviation",
        value: formatTemperatureValue(selectedWindow.sd_temperature_c),
        helper: "Day-level spread across the window.",
      },
      {
        icon: Snowflake,
        label: "Cold participants",
        value: selectedWindow.cold_group.participant_count.toString(),
        helper: "Days with temperature z < -2.",
      },
      {
        icon: Flame,
        label: "Hot participants",
        value: selectedWindow.hot_group.participant_count.toString(),
        helper: "Days with temperature z > 2.",
      },
    ];
  }, [selectedWindow]);

  if (!temperatureSummary) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border border-border/80 p-4 shadow-[0_20px_45px_-40px_rgb(0_19_40/0.9)]"
      style={{ background: "color-mix(in srgb, var(--card) 86%, transparent)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Temperature Summary
            </Badge>
            {selectedWindow ? (
              <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
                {formatTemperatureDateRange(selectedWindow.date_from, selectedWindow.date_to)}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
                No window available
              </Badge>
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">Day-level temperature summary</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              This summary stays separate from the model cards. Use the fixed tabs to review overall, fall/winter, and spring/summer windows.
            </p>
          </div>
        </div>

        <div role="tablist" aria-label="Temperature summary windows" className="flex flex-wrap gap-2">
          {WINDOW_KEYS.map((windowKey) => {
            const isAvailable = Boolean(getTemperatureSummaryWindow(temperatureSummary, windowKey));
            const isActive = selectedWindowKey === windowKey && isAvailable;
            return (
              <button
                key={windowKey}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={!isAvailable}
                disabled={!isAvailable}
                onClick={() => setSelectedWindowKey(windowKey)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                  isActive
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border/70 bg-background/70 text-muted-foreground hover:border-ring/40 hover:text-foreground",
                  !isAvailable && "cursor-not-allowed opacity-45"
                )}
              >
                {formatTemperatureWindowLabel(windowKey)}
              </button>
            );
          })}
        </div>
      </div>

      {selectedWindow && summaryStats ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {summaryStats.map((stat) => (
              <TemperatureSummaryStatCard
                key={stat.label}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                helper={stat.helper}
              />
            ))}
          </div>

          <TemperatureHistogramChart summaryWindow={selectedWindow} />

          <div className="grid gap-4 lg:grid-cols-2">
            <TemperatureGroupPanel
              title="Cold group"
              icon={Snowflake}
              toneClassName="border-sky-500/20 bg-sky-500/8"
              thresholdLabel="temperature_z < -2"
              group={selectedWindow.cold_group}
            />
            <TemperatureGroupPanel
              title="Hot group"
              icon={Flame}
              toneClassName="border-amber-500/20 bg-amber-500/8"
              thresholdLabel="temperature_z > 2"
              group={selectedWindow.hot_group}
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-border/70 bg-background/65 px-4 py-6 text-sm text-muted-foreground">
          No temperature summary windows were returned for this snapshot.
        </div>
      )}
    </section>
  );
}

interface Props {
  anchorDate: string;
}

function formatTemperatureSummaryStateLabel(mode: LoadingMode): string {
  if (mode === "live") {
    return "Refreshing temperature summary…";
  }
  if (mode === "snapshot") {
    return "Loading temperature summary…";
  }
  return "Temperature summary ready.";
}

function getSummaryResultMessage(result: TemperatureSummaryLoadResult): string {
  if (result.kind === "empty") {
    return result.message;
  }
  if (result.kind === "error") {
    return result.message;
  }
  return "";
}

export default function AnalyticsTemperatureSummaryCard({ anchorDate }: Props) {
  const [temperatureSummary, setTemperatureSummary] =
    useState<AnalyticsTemperatureSummaryResponse | null>(null);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>("snapshot");
  const [error, setError] = useState<string | null>(null);
  const [snapshotMissing, setSnapshotMissing] = useState(false);
  const [loadMessage, setLoadMessage] = useState(formatTemperatureSummaryStateLabel("snapshot"));
  const [preset, setPreset] = useState<SummaryRangePreset>("study_start");
  const [dateFrom, setDateFrom] = useState(STUDY_START);
  const [dateTo, setDateTo] = useState(anchorDate);
  const requestSeqRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);

  function clearPollTimer(): void {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function scheduleSnapshotPoll(seq: number, activeDateFrom: string, activeDateTo: string): void {
    clearPollTimer();
    pollTimerRef.current = window.setTimeout(async () => {
      if (requestSeqRef.current !== seq) {
        return;
      }

      const result = await loadTemperatureSummary(activeDateFrom, activeDateTo);
      if (requestSeqRef.current !== seq) {
        return;
      }

      if (result.kind !== "loaded") {
        startTransition(() => {
          if (result.kind === "missing-snapshot") {
            setSnapshotMissing(true);
            if (!isTemperatureSummaryReady(temperatureSummary)) {
              setTemperatureSummary(null);
            }
            setError(null);
          } else {
            setError(getSummaryResultMessage(result));
          }
        });
        setLoadingMode(null);
        setLoadMessage(formatTemperatureSummaryStateLabel(null));
        return;
      }

      if (result.response.refresh.state === "recomputing") {
        scheduleSnapshotPoll(seq, activeDateFrom, activeDateTo);
        return;
      }

      startTransition(() => {
        setTemperatureSummary(result.temperatureSummary);
        setSnapshotMissing(false);
        setError(null);
      });
      setLoadingMode(null);
      setLoadMessage(formatTemperatureSummaryStateLabel(null));
    }, 4000);
  }

  useEffect(() => {
    let cancelled = false;
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    clearPollTimer();

    const load = async () => {
      setLoadingMode("snapshot");
      setLoadMessage(formatTemperatureSummaryStateLabel("snapshot"));
      setError(null);
      setSnapshotMissing(false);

      const result = await loadTemperatureSummary(dateFrom, dateTo);
      if (cancelled || requestSeqRef.current !== seq) {
        return;
      }

      if (result.kind === "loaded") {
        setTemperatureSummary(result.temperatureSummary);
        setSnapshotMissing(false);
        setError(null);
      } else if (result.kind === "missing-snapshot") {
        setTemperatureSummary(null);
        setSnapshotMissing(true);
      } else {
        setTemperatureSummary(null);
        setError(getSummaryResultMessage(result));
      }

      setLoadingMode(null);
    };

    void load();

    return () => {
      cancelled = true;
      clearPollTimer();
      requestSeqRef.current += 1;
    };
  }, [dateFrom, dateTo]);

  async function handleCompute(): Promise<void> {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    clearPollTimer();
    setLoadingMode("live");
    setLoadMessage(formatTemperatureSummaryStateLabel("live"));
    setError(null);
    setSnapshotMissing(false);

    const activeDateFrom = dateFrom;
    const activeDateTo = dateTo;
    const result = await refreshTemperatureSummary(activeDateFrom, activeDateTo);
    if (requestSeqRef.current !== seq) {
      return;
    }

    if (result.kind === "loaded") {
      setTemperatureSummary(result.temperatureSummary);
      setError(null);
      if (result.response.refresh.state === "recomputing") {
        scheduleSnapshotPoll(seq, activeDateFrom, activeDateTo);
        return;
      }
      setLoadingMode(null);
      setLoadMessage(formatTemperatureSummaryStateLabel(null));
    } else if (result.kind === "empty") {
      setTemperatureSummary(null);
      setError(null);
      setSnapshotMissing(false);
      setLoadMessage(result.message);
      setLoadingMode(null);
    } else if (result.kind === "missing-snapshot") {
      setTemperatureSummary(null);
      setSnapshotMissing(true);
      setError(null);
      setLoadingMode(null);
      setLoadMessage(formatTemperatureSummaryStateLabel(null));
    } else {
      setTemperatureSummary(null);
      setError(result.message);
      setLoadingMode(null);
      setLoadMessage(formatTemperatureSummaryStateLabel(null));
    }
  }

  useEffect(() => {
    if (preset === "custom") {
      setDateTo((current) => (current > anchorDate ? anchorDate : current));
      setDateFrom((current) => (current > anchorDate ? anchorDate : current));
      return;
    }

    const nextRange = getTemperatureSummaryPresetRange(preset, anchorDate);
    setDateFrom(nextRange.dateFrom);
    setDateTo(nextRange.dateTo);
  }, [anchorDate, preset]);

  const hasSummary = isTemperatureSummaryReady(temperatureSummary);
  const hasSummaryPayload = Boolean(temperatureSummary);
  const activeRangeLabel = formatTemperatureDateRange(dateFrom, dateTo);
  const actionLabel = loadingMode === "live"
    ? "Refreshing..."
    : hasSummary
      ? "Refresh Summary"
      : "Compute Summary";
  const summaryBadgeLabel = loadingMode === "live"
    ? "Refreshing"
    : loadingMode === "snapshot"
      ? "Loading"
      : hasSummary
        ? "Ready"
        : snapshotMissing
          ? "No saved summary yet"
          : error
            ? "Needs refresh"
            : hasSummaryPayload
              ? "Empty summary"
              : "Independent summary";

  return (
    <section
      className="rounded-2xl border border-border/80 p-4 shadow-[0_20px_45px_-40px_rgb(0_19_40/0.9)]"
      style={{ background: "color-mix(in srgb, var(--card) 86%, transparent)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Temperature Summary
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
              {summaryBadgeLabel}
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
              {activeRangeLabel}
            </Badge>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">Day-level temperature summary</h3>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              This summary loads independently from the analytics section and can be refreshed on its own.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 lg:items-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border/80 bg-background/70"
            onClick={() => void handleCompute()}
            disabled={loadingMode === "live"}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loadingMode === "live" && "animate-spin")} />
            {actionLabel}
          </Button>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {loadingMode === null ? `Range: ${activeRangeLabel}` : loadMessage}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border/70 bg-background/65 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Summary window
            </p>
            <h4 className="text-lg font-semibold text-foreground">{activeRangeLabel}</h4>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              These controls only affect the standalone temperature summary card.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              ["study_start", "Study Start"],
              ["last_7", "Last 7"],
              ["last_30", "Last 30"],
              ["last_90", "Last 90"],
              ["custom", "Custom"],
            ] as const).map(([value, label]) => (
              <SummaryPresetButton
                key={value}
                active={preset === value}
                label={label}
                onClick={() => {
                  setPreset(value);
                  if (value !== "custom") {
                    const nextRange = getTemperatureSummaryPresetRange(value, anchorDate);
                    setDateFrom(nextRange.dateFrom);
                    setDateTo(nextRange.dateTo);
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              From
            </span>
            <input
              type="date"
              min={STUDY_START}
              max={anchorDate}
              value={dateFrom}
              onChange={(event) => {
                const next = normalizeTemperatureSummaryRange(event.target.value, dateTo);
                setPreset("custom");
                setDateFrom(next.dateFrom);
                setDateTo(next.dateTo);
              }}
              className="h-11 w-full rounded-2xl border border-border/80 bg-background/75 px-4 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              To
            </span>
            <input
              type="date"
              min={STUDY_START}
              max={anchorDate}
              value={dateTo}
              onChange={(event) => {
                const next = normalizeTemperatureSummaryRange(dateFrom, event.target.value);
                setPreset("custom");
                setDateFrom(next.dateFrom);
                setDateTo(next.dateTo);
              }}
              className="h-11 w-full rounded-2xl border border-border/80 bg-background/75 px-4 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Active range
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{activeRangeLabel}</p>
          </div>
        </div>
      </div>

      {loadingMode !== null && !hasSummary && !error && (
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/65 px-4 py-4 text-sm text-muted-foreground">
          <CloudLoading size="sm" />
          <span>{loadMessage}</span>
        </div>
      )}

      {loadingMode !== null && hasSummary && !error && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/65 px-4 py-3 text-sm text-muted-foreground">
          <CloudLoading size="sm" />
          <span>{loadMessage}</span>
        </div>
      )}

      {error && (
        <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && !hasSummary && (
        <div className="mt-5 rounded-2xl border border-dashed border-border/70 bg-background/65 px-4 py-6 text-sm text-muted-foreground">
          {snapshotMissing
            ? "No saved temperature summary exists for this window yet. Use Compute Summary to request one."
            : hasSummaryPayload
              ? "The backend returned an empty temperature summary payload for this window."
              : "Temperature summary data has not loaded yet. Use Compute Summary to request it."}
        </div>
      )}

      {temperatureSummary && <TemperatureSummaryContent temperatureSummary={temperatureSummary} />}
    </section>
  );
}
