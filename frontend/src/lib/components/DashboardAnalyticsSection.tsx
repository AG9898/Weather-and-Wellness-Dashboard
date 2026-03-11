"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, RefreshCw, Sparkles } from "lucide-react";
import {
  ApiError,
  getDashboardAnalyticsBundle,
  type AnalyticsEffectCardResponse,
  type AnalyticsModelSummaryResponse,
  type DashboardAnalyticsResponse,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CloudLoading from "@/lib/components/CloudLoading";

const STUDY_START = "2025-03-03";
const STUDY_TIMEZONE = "America/Vancouver";

type LoadingMode = "snapshot" | "live" | null;

interface FlattenedEffectOption {
  key: string;
  outcome: AnalyticsModelSummaryResponse["outcome"];
  outcomeLabel: string;
  termLabel: string;
  selectionLabel: string;
  effect: AnalyticsEffectCardResponse;
  model: AnalyticsModelSummaryResponse;
}

function getStudyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIMEZONE }).format(new Date());
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatPValue(value: number): string {
  return value < 0.001 ? "<0.001" : value.toFixed(3);
}

function formatTermPart(value: string): string {
  const normalized = value.replace(/_z$/u, "");
  const parts = normalized.split("_");
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTermLabel(term: string): string {
  return term
    .split(":")
    .map((part) => formatTermPart(part))
    .join(" x ");
}

function formatOutcomeLabel(outcome: string): string {
  if (outcome === "digit_span") return "Backwards Digit Span";
  if (outcome === "self_report") return "Self-Reported Cognition";
  return formatTermPart(outcome);
}

function compareEffectsByStrength(
  left: Pick<AnalyticsEffectCardResponse, "p_value" | "statistic">,
  right: Pick<AnalyticsEffectCardResponse, "p_value" | "statistic">
): number {
  if (left.p_value !== right.p_value) {
    return left.p_value - right.p_value;
  }
  return Math.abs(right.statistic) - Math.abs(left.statistic);
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

function getAnalyticsErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your lab session expired. Sign in again to load analytics.";
    if (err.status === 404) return "No analytics snapshot exists yet for the current study window.";
    if (err.status >= 500) return "Analytics is temporarily unavailable from the backend.";
    return `Analytics request failed (${err.status}): ${err.message}`;
  }
  return "Unable to load dashboard analytics right now.";
}

function getStatusPanel(
  analytics: DashboardAnalyticsResponse
): { title: string; body: string; className: string } {
  switch (analytics.status) {
    case "recomputing":
      return {
        title: "Recompute in progress",
        body: "Showing the last successful analytics snapshot while a live recompute is running.",
        className: "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200",
      };
    case "stale":
      return {
        title: "Snapshot is stale",
        body: "The latest recompute did not finish cleanly, so the dashboard is keeping the prior successful snapshot visible.",
        className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      };
    case "insufficient_data":
      return {
        title: "Insufficient data",
        body: "There are not enough complete rows in the current study window to fit the planned mixed models yet.",
        className: "border-border/80 bg-muted/60 text-foreground",
      };
    case "failed":
      return {
        title: "Analytics recompute failed",
        body: "The backend could not generate analytics for this window. Operational KPIs and weather remain available.",
        className: "border-destructive/35 bg-destructive/10 text-destructive",
      };
    default:
      return {
        title: "Snapshot ready",
        body: "Model cards below reflect the latest analytics snapshot for the current study window.",
        className: "border-border/80 bg-muted/50 text-foreground",
      };
  }
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

      {model.warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {model.warnings.join(" ")}
        </div>
      )}
    </article>
  );
}

export default function DashboardAnalyticsSection() {
  const [dateTo] = useState(getStudyToday);
  const [analytics, setAnalytics] = useState<DashboardAnalyticsResponse | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<LoadingMode>("snapshot");
  const [loadingMessage, setLoadingMessage] = useState("Checking latest analytics snapshot…");
  const [error, setError] = useState<string | null>(null);
  const [selectedEffectKey, setSelectedEffectKey] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function requestAnalytics(
      mode: "snapshot" | "live",
      pendingMessage: string
    ): Promise<boolean> {
      setLoadingMode(mode);
      setLoadingMessage(pendingMessage);
      setError(null);

      try {
        const response = await getDashboardAnalyticsBundle(mode, STUDY_START, dateTo);
        if (cancelled || !response.data) {
          return false;
        }

        startTransition(() => {
          setAnalytics(response.data?.analytics ?? null);
          setCachedAt(response.data?.cached_at ?? null);
        });
        return true;
      } catch (err) {
        if (cancelled) {
          return false;
        }

        if (mode === "snapshot" && err instanceof ApiError && err.status === 404) {
          return false;
        }

        setError(getAnalyticsErrorMessage(err));
        return false;
      } finally {
        if (!cancelled) {
          setLoadingMode(null);
        }
      }
    }

    async function loadInitialAnalytics(): Promise<void> {
      const snapshotLoaded = await requestAnalytics(
        "snapshot",
        "Checking latest analytics snapshot…"
      );
      if (!snapshotLoaded && !cancelled) {
        await requestAnalytics(
          "live",
          "No saved snapshot yet. Running analytics from the current dataset…"
        );
      }
    }

    void loadInitialAnalytics();

    return () => {
      cancelled = true;
    };
  }, [dateTo]);

  async function handleRefresh(): Promise<void> {
    setLoadingMode("live");
    setLoadingMessage("Refreshing analytics from the backend…");
    setError(null);

    try {
      const response = await getDashboardAnalyticsBundle("live", STUDY_START, dateTo);
      if (!response.data) {
        setError("Analytics refresh returned no data.");
        return;
      }
      const data = response.data;

      startTransition(() => {
        setAnalytics(data.analytics);
        setCachedAt(data.cached_at);
      });
    } catch (err) {
      setError(getAnalyticsErrorMessage(err));
    } finally {
      setLoadingMode(null);
    }
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

  useEffect(() => {
    if (effectOptions.length === 0) {
      setSelectedEffectKey("");
      return;
    }

    const currentStillExists = effectOptions.some((option) => option.key === selectedEffectKey);
    if (currentStillExists) {
      return;
    }

    const defaultSelection = significantEffects[0] ?? effectOptions[0];
    setSelectedEffectKey(defaultSelection.key);
  }, [effectOptions, selectedEffectKey, significantEffects]);

  const selectedEffect =
    effectOptions.find((option) => option.key === selectedEffectKey) ?? significantEffects[0] ?? effectOptions[0] ?? null;
  const significantHighlights = Array.from({ length: 3 }, (_, index) => significantEffects[index] ?? null);
  const hasEffectCards = effectOptions.length > 0;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/90 px-6 py-6 shadow-[0_28px_60px_-46px_rgb(0_19_40/0.95)]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--card) 94%, var(--ubc-blue-100) 6%) 0%, var(--card) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 top-0 h-36 w-36 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--ubc-blue-500)" }}
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Statistical Models
            </Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
              {STUDY_START} to {dateTo}
            </Badge>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Analytics Snapshot</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Mixed-model cards stay separate from weather. The section reads the latest snapshot by default and can request a live recompute without blocking the rest of the dashboard.
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

      {analytics && (
        <div className="relative mt-5 space-y-5">
          <div className={cn("rounded-2xl border px-4 py-4", statusPanel?.className)}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em]">{statusPanel?.title}</p>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed">{statusPanel?.body}</p>
              </div>
              <div className="space-y-1 text-xs font-medium uppercase tracking-[0.18em]">
                <p>{analytics.snapshot.mode === "live" ? "Live response" : "Snapshot response"}</p>
                <p>Generated {formatDateTime(analytics.snapshot.generated_at)}</p>
                {cachedAt && <p>Route cache checked {timeAgo(cachedAt)}</p>}
                {analytics.snapshot.recompute_started_at && (
                  <p>Started {formatDateTime(analytics.snapshot.recompute_started_at)}</p>
                )}
                {analytics.snapshot.recompute_finished_at && (
                  <p>Finished {formatDateTime(analytics.snapshot.recompute_finished_at)}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Included Sessions
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {analytics.dataset.included_sessions}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Included Days
              </p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {analytics.dataset.included_days}
              </p>
            </div>
            {significantHighlights.map((option, index) => (
              <div
                key={option?.key ?? `empty-signal-${index}`}
                className="rounded-2xl border border-border/70 bg-background/65 p-4"
              >
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Signal {index + 1}</span>
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
          </div>

          {analytics.dataset.exclusion_reasons.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Exclusion Reasons
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
                    Select modeled term
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
                      Random effect: {selectedEffect.model.grouping_field}
                    </p>
                  </div>

                  <EffectCard option={selectedEffect} />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-background/65 px-4 py-8 text-center text-sm text-muted-foreground">
              {analytics.status === "ready"
                ? "No term-level effects were returned for this snapshot."
                : "Model cards will appear here once a valid analytics snapshot is available."}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
