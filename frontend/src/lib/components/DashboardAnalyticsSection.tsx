"use client";

import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, RefreshCw, Sparkles } from "lucide-react";
import {
  type AnalyticsEffectCardResponse,
  type AnalyticsModelSummaryResponse,
  type DashboardAnalyticsResponse,
} from "@/lib/api";
import {
  loadInitialDashboardAnalytics,
  refreshDashboardAnalytics,
} from "@/lib/analytics/dashboard-analytics-loader";
import {
  buildAnalyticsWarningDisplayItems,
  compareEffectsByStrength,
  formatOutcomeLabel,
  formatPValue,
  formatTemperatureDateRange,
  formatSigned,
  formatTermLabel,
  formatTermPart,
  getStatusPanel,
  timeAgo,
} from "@/lib/analytics/ui-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AnalyticsEffectPlotCard from "@/lib/components/AnalyticsEffectPlotCard";
import CloudLoading from "@/lib/components/CloudLoading";

type LoadingMode = "snapshot" | "live" | null;
type AnalyticsRangePreset = "study_start" | "last_7" | "last_30" | "last_90" | "custom";

const STUDY_START = "2025-03-03";

interface FlattenedEffectOption {
  key: string;
  outcome: AnalyticsModelSummaryResponse["outcome"];
  outcomeLabel: string;
  termLabel: string;
  selectionLabel: string;
  effect: AnalyticsEffectCardResponse;
  model: AnalyticsModelSummaryResponse;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function getDirectionCopy(direction: AnalyticsEffectCardResponse["direction"]): {
  icon: typeof ArrowUpRight;
  label: string;
  className: string;
} {
  if (direction === "positive") {
    return {
      icon: ArrowUpRight,
      label: "Positive",
      className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (direction === "negative") {
    return {
      icon: ArrowDownRight,
      label: "Negative",
      className: "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300",
    };
  }
  return {
    icon: Minus,
    label: "Neutral",
    className: "border-border/70 bg-muted/60 text-muted-foreground",
  };
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getAnalyticsPresetRange(
  preset: AnalyticsRangePreset,
  anchorDate: string
): { dateFrom: string; dateTo: string } {
  if (preset === "study_start") {
    return { dateFrom: STUDY_START, dateTo: anchorDate };
  }
  if (preset === "last_7") {
    return { dateFrom: shiftDate(anchorDate, -6), dateTo: anchorDate };
  }
  if (preset === "last_30") {
    return { dateFrom: shiftDate(anchorDate, -29), dateTo: anchorDate };
  }
  if (preset === "last_90") {
    return { dateFrom: shiftDate(anchorDate, -89), dateTo: anchorDate };
  }
  return { dateFrom: STUDY_START, dateTo: anchorDate };
}

function normalizeDateRange(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  return dateFrom <= dateTo ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom };
}

function DetailsPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-2xl border border-border/70 bg-background/55 px-4 py-4">
      <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden">
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}


function EffectCard({
  option,
}: {
  option: FlattenedEffectOption;
}) {
  const { effect, model } = option;
  const direction = getDirectionCopy(effect.direction);
  const DirectionIcon = direction.icon;

  return (
    <article
      className="rounded-2xl border border-border/80 p-4 shadow-[0_20px_45px_-40px_rgb(0_19_40/0.9)]"
      style={{ background: "color-mix(in srgb, var(--card) 86%, transparent)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-border/70 bg-background/70 text-foreground">
          {option.outcomeLabel}
        </Badge>
        <Badge variant="outline" className={direction.className}>
          <DirectionIcon className="mr-1 h-3.5 w-3.5" />
          {direction.label}
        </Badge>
        <Badge
          variant="outline"
          className={
            effect.significant
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-border/70 bg-background/70 text-muted-foreground"
          }
        >
          {effect.significant ? "Significant" : "Not significant"}
        </Badge>
        <Badge
          variant="outline"
          className={
            model.converged
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }
        >
          {model.converged ? "Converged" : "Check convergence"}
        </Badge>
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {effect.is_interaction ? "Interaction term" : "Effect term"}
        </p>
        <h3 className="max-w-full text-lg font-semibold leading-tight text-foreground break-words">
          {option.termLabel}
        </h3>
        <p className="max-w-full text-sm leading-relaxed text-muted-foreground break-words">
          Predictor: {formatTermLabel(effect.predictor)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground break-words">
            Coefficient
          </p>
          <p className="mt-1 break-words text-base font-semibold text-foreground">
            {formatSigned(effect.coefficient)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground break-words">
            95% CI
          </p>
          <p className="mt-1 break-words text-sm font-semibold leading-tight text-foreground sm:text-base">
            [{formatSigned(effect.ci_95_low)}, {formatSigned(effect.ci_95_high)}]
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground break-words">
            P-value
          </p>
          <p className="mt-1 break-words text-base font-semibold text-foreground">
            {formatPValue(effect.p_value)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground break-words">
            Statistic
          </p>
          <p className="mt-1 break-words text-base font-semibold text-foreground">
            {formatSigned(effect.statistic)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>n = {model.sample_size}</span>
        <span>days = {model.day_count}</span>
        <span>model {model.model_version}</span>
      </div>
    </article>
  );
}

interface DashboardAnalyticsSectionProps {
  anchorDate: string;
  refreshSignal?: number;
}

export default function DashboardAnalyticsSection({
  anchorDate,
  refreshSignal,
}: DashboardAnalyticsSectionProps) {
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>("snapshot");
  const [loadingMessage, setLoadingMessage] = useState("Loading analytics snapshot…");
  const [error, setError] = useState<string | null>(null);
  const [snapshotMissing, setSnapshotMissing] = useState(false);
  const [selectedEffectKey, setSelectedEffectKey] = useState<string | null>(null);
  const [preset, setPreset] = useState<AnalyticsRangePreset>("study_start");
  const [dateFrom, setDateFrom] = useState(STUDY_START);
  const [dateTo, setDateTo] = useState(anchorDate);
  const requestSeqRef = useRef(0);
  const presetRef = useRef<AnalyticsRangePreset>("study_start");
  const refreshSignalRef = useRef(refreshSignal);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    if (presetRef.current === "custom") {
      setDateFrom((current) => (current > anchorDate ? anchorDate : current));
      setDateTo((current) => (current > anchorDate ? anchorDate : current));
      return;
    }

    const nextRange = getAnalyticsPresetRange(presetRef.current, anchorDate);
    setDateFrom(nextRange.dateFrom);
    setDateTo(nextRange.dateTo);
  }, [anchorDate]);

  const loadAnalytics = async (mode: LoadingMode): Promise<void> => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    setLoadingMode(mode);
    setLoadingMessage(
      mode === "live"
        ? "Refreshing analytics…"
        : "Loading analytics snapshot…"
    );
    setError(null);
    setSnapshotMissing(false);

    const result =
      mode === "live"
        ? await refreshDashboardAnalytics(dateFrom, dateTo)
        : await loadInitialDashboardAnalytics(dateFrom, dateTo);

    if (requestSeqRef.current !== seq) {
      return;
    }

    if (result.kind === "loaded") {
      startTransition(() => {
        setAnalytics(result.response.data?.analytics ?? null);
        setSnapshotMissing(false);
      });
    } else if (result.kind === "missing-snapshot") {
      startTransition(() => {
        setAnalytics(null);
        setSnapshotMissing(true);
      });
    } else {
      startTransition(() => {
        setError(result.message);
      });
    }

    setLoadingMode(null);
  };

  useEffect(() => {
    void loadAnalytics("snapshot");
    return () => {
      requestSeqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (refreshSignalRef.current === refreshSignal) {
      return;
    }
    refreshSignalRef.current = refreshSignal;
    if (refreshSignal === undefined) {
      return;
    }
    void loadAnalytics("snapshot");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  useEffect(() => {
    if (analytics?.status !== "recomputing") {
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      const result = await loadInitialDashboardAnalytics(dateFrom, dateTo);
      if (cancelled || result.kind !== "loaded") {
        return;
      }

      startTransition(() => {
        setAnalytics(result.response.data?.analytics ?? null);
        setSnapshotMissing(false);
        setError(null);
      });
    }, 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [analytics?.status, dateFrom, dateTo]);

  async function handleRefresh(): Promise<void> {
    await loadAnalytics("live");
  }

  const statusPanel = analytics ? getStatusPanel(analytics) : null;
  const isLoadingInitial = analytics === null && loadingMode !== null;
  const effectOptions = useMemo<FlattenedEffectOption[]>(() => {
    return (analytics?.models ?? []).flatMap((model) =>
      model.effects.map((effect) => {
        const outcomeLabel = formatOutcomeLabel(model.outcome);
        const termLabel = formatTermLabel(effect.term);
        return {
          key: `${model.outcome}:${effect.term}`,
          outcome: model.outcome,
          outcomeLabel,
          termLabel,
          selectionLabel: `${outcomeLabel} - ${termLabel}`,
          effect,
          model,
        };
      })
    );
  }, [analytics?.models]);

  const significantEffects = useMemo(() => {
    return effectOptions
      .filter((option) => option.effect.significant)
      .sort((left, right) => compareEffectsByStrength(left.effect, right.effect));
  }, [effectOptions]);

  const defaultSelectedEffect = significantEffects[0] ?? effectOptions[0] ?? null;
  const selectedEffect = (
    selectedEffectKey
      ? effectOptions.find((option) => option.key === selectedEffectKey) ?? null
      : null
  ) ?? defaultSelectedEffect;
  const significantHighlights = Array.from({ length: 3 }, (_, index) => significantEffects[index] ?? null);
  const hasEffectCards = effectOptions.length > 0;
  const selectedModelWarnings = useMemo(() => {
    return selectedEffect ? buildAnalyticsWarningDisplayItems(selectedEffect.model.warnings) : [];
  }, [selectedEffect]);
  const activeRangeLabel = formatTemperatureDateRange(dateFrom, dateTo);

  // Find the effect plot for the currently selected effect term
  const selectedEffectPlot =
    analytics?.visualizations?.effect_plots && selectedEffect
      ? analytics.visualizations.effect_plots.find(
          (plot) => plot.outcome === selectedEffect.outcome && plot.term === selectedEffect.effect.term
        ) ?? null
      : null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/90 px-6 py-6 shadow-[0_28px_60px_-46px_rgb(0_19_40/0.95)]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, var(--accent) 4%) 0%, var(--card) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 top-0 h-36 w-36 rounded-full opacity-20 blur-3xl"
        style={{ background: "color-mix(in srgb, var(--ring) 68%, transparent)" }}
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Model results
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
              {activeRangeLabel}
            </Badge>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              This section stays separate from weather. Use the study window below to review model results and request a refresh.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loadingMode !== null && analytics !== null && (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CloudLoading size="sm" />
              <span>{loadingMessage}</span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border/80 bg-background/70"
            onClick={() => void handleRefresh()}
            disabled={loadingMode === "live"}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loadingMode === "live" && "animate-spin")} />
            Refresh Analytics
          </Button>
        </div>
      </div>

      {isLoadingInitial && (
        <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/65 px-4 py-4 text-sm text-muted-foreground">
          <CloudLoading size="sm" />
          <span>{loadingMessage}</span>
        </div>
      )}

      {error && (
        <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {snapshotMissing && !error && !analytics && (
        <div className="relative mt-5 rounded-2xl border border-border/70 bg-background/65 px-4 py-4 text-sm text-muted-foreground">
          No saved analytics snapshot exists for this study window yet. Use{" "}
          <span className="font-semibold text-foreground">Refresh Analytics</span> to request one.
        </div>
      )}

      {analytics && (
        <div className="relative mt-5 space-y-5">
          <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Study window
                </p>
                <h3 className="text-lg font-semibold text-foreground">{activeRangeLabel}</h3>
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  These controls only affect the analytics cards below.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ["study_start", "Study Start"],
                  ["last_7", "Last 7"],
                  ["last_30", "Last 30"],
                  ["last_90", "Last 90"],
                  ["custom", "Custom"],
                ] as const).map(([value, label]) => {
                  const isActive = preset === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        const nextRange = getAnalyticsPresetRange(value, anchorDate);
                        presetRef.current = value;
                        setPreset(value);
                        setDateFrom(nextRange.dateFrom);
                        setDateTo(nextRange.dateTo);
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
                        isActive
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border/70 bg-background/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
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
                    const next = normalizeDateRange(event.target.value, dateTo);
                    presetRef.current = "custom";
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
                    const next = normalizeDateRange(dateFrom, event.target.value);
                    presetRef.current = "custom";
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

          <div className={cn("rounded-2xl border px-4 py-4", statusPanel?.className)}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em]">{statusPanel?.title}</p>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed">{statusPanel?.body}</p>
              </div>
              <div className="space-y-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <p>Updated {timeAgo(analytics.snapshot.generated_at)}</p>
                <p>
                  {analytics.dataset.included_sessions} sessions, {analytics.dataset.included_days} days
                </p>
              </div>
            </div>
          </div>

          <DetailsPanel title="Snapshot details">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Sessions
                </p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {analytics.dataset.included_sessions}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Study days
                </p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {analytics.dataset.included_days}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Generated
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatDateTime(analytics.snapshot.generated_at)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Excluded rows
                </p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {analytics.dataset.excluded_rows}
                </p>
              </div>
            </div>

            {significantHighlights.map((option, index) => (
              <div
                key={option?.key ?? `empty-signal-${index}`}
                className="rounded-2xl border border-border/70 bg-background/65 p-4"
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Key result {index + 1}</span>
                </div>
                {option ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-semibold leading-tight text-foreground break-words">
                      {option.termLabel}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {option.outcomeLabel}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-foreground">
                      <span>{getDirectionCopy(option.effect.direction).label}</span>
                      <span>{formatSigned(option.effect.coefficient)}</span>
                      <span>p {formatPValue(option.effect.p_value)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm font-semibold text-foreground">
                      No additional significant finding
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      This snapshot does not contain enough significant terms to populate all three highlight slots.
                    </p>
                  </div>
                )}
              </div>
            ))}
            {analytics.dataset.exclusion_reasons.length > 0 && (
              <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Excluded rows
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analytics.dataset.exclusion_reasons.map((item) => (
                    <Badge
                      key={`${item.reason}-${item.count}`}
                      variant="outline"
                      className="border-border/70 bg-background/70 text-foreground"
                    >
                      {formatTermPart(item.reason)}: {item.count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </DetailsPanel>

          {hasEffectCards ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Modeled term
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">
                    {effectOptions.length} modeled terms
                  </h3>
                </div>
                <div className="w-full max-w-2xl space-y-2">
                  <label
                    htmlFor="dashboard-analytics-term"
                    className="block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    Choose result
                  </label>
                  <select
                    id="dashboard-analytics-term"
                    value={selectedEffect?.key ?? ""}
                    onChange={(event) => setSelectedEffectKey(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-border/80 bg-background/75 px-4 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    {effectOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.selectionLabel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedEffect && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        {selectedEffect.outcomeLabel}
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-foreground break-words">
                        {selectedEffect.termLabel}
                      </h3>
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Grouped by {selectedEffect.model.grouping_field === "date_bin" ? "study day" : selectedEffect.model.grouping_field}
                    </p>
                  </div>

                  <EffectCard option={selectedEffect} />
                  <AnalyticsEffectPlotCard effectPlot={selectedEffectPlot} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-8 text-center text-sm text-muted-foreground">
              {analytics.status === "ready"
                ? "No model results were returned for this snapshot."
                : "Model results will appear here once a valid snapshot is available."}
            </div>
          )}

          {selectedModelWarnings.length > 0 && (
            <details className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-4 text-sm text-amber-950/90 dark:text-amber-100">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Model notes ({selectedModelWarnings.length})
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-amber-800/80 dark:text-amber-200/80">
                  Show
                </span>
              </summary>

              <div className="mt-4 space-y-4 border-t border-amber-500/20 pt-4">
                {selectedModelWarnings.map((warning, index) => (
                  <div
                    key={`${warning.title}-${index}`}
                    className="rounded-xl border border-amber-500/15 bg-background/55 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-foreground">{warning.title}</p>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{warning.plainEnglish}</p>
                    <div className="mt-3 rounded-lg border border-border/60 bg-background/70 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Raw note
                      </p>
                      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
                        {warning.rawWarnings.map((rawWarning) => (
                          <li key={rawWarning}>{rawWarning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
