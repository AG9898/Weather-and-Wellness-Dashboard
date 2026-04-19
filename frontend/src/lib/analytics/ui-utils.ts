/**
 * Pure utility functions for the analytics dashboard UI.
 *
 * Extracted from DashboardAnalyticsSection to allow isolated unit testing
 * of analytics state logic without requiring React DOM or component rendering.
 */

import type {
  AnalyticsEffectCardResponse,
  AnalyticsTemperatureSummaryParticipantSessionResponse,
  AnalyticsTemperatureSummaryResponse,
  AnalyticsTemperatureSummaryWindowKey,
  AnalyticsTemperatureSummaryWindowResponse,
  DashboardAnalyticsResponse,
} from "@/lib/api";
import { ApiError } from "@/lib/api";

export type TemperatureSummaryRangePreset = "study_start" | "last_7" | "last_30" | "last_90" | "custom";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatTermPart(value: string): string {
  const normalized = value.replace(/_z$/u, "");
  const parts = normalized.split("_");
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTermLabel(term: string): string {
  return term
    .split(":")
    .map((part) => formatTermPart(part))
    .join(" x ");
}

export function formatOutcomeLabel(outcome: string): string {
  if (outcome === "digit_span") return "Backwards Digit Span";
  if (outcome === "self_report") return "Self-Reported Cognition";
  return formatTermPart(outcome);
}

const TEMPERATURE_WINDOW_LABELS: Record<AnalyticsTemperatureSummaryWindowKey, string> = {
  overall: "Overall",
  fall_winter: "Fall / Winter",
  spring_summer: "Spring / Summer",
};

const STUDY_START = "2025-03-03";

function formatTemperatureNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

export function formatTemperatureWindowLabel(
  windowKey: AnalyticsTemperatureSummaryWindowKey
): string {
  return TEMPERATURE_WINDOW_LABELS[windowKey];
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getTemperatureSummaryPresetRange(
  preset: Exclude<TemperatureSummaryRangePreset, "custom">,
  anchorDate: string
): { dateFrom: string; dateTo: string } {
  if (preset === "study_start") {
    return { dateFrom: STUDY_START, dateTo: anchorDate };
  }
  if (preset === "last_7") {
    return { dateFrom: shiftIsoDate(anchorDate, -6), dateTo: anchorDate };
  }
  if (preset === "last_30") {
    return { dateFrom: shiftIsoDate(anchorDate, -29), dateTo: anchorDate };
  }
  return { dateFrom: shiftIsoDate(anchorDate, -89), dateTo: anchorDate };
}

export function normalizeTemperatureSummaryRange(
  dateFrom: string,
  dateTo: string
): { dateFrom: string; dateTo: string } {
  return dateFrom <= dateTo ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom };
}

export function formatTemperatureValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}°C` : "—";
}

export function formatTemperatureDateRange(
  dateFrom: string | null,
  dateTo: string | null
): string {
  if (!dateFrom || !dateTo) {
    return "No study dates";
  }
  if (dateFrom === dateTo) {
    return formatIsoDate(dateFrom);
  }
  return `${formatIsoDate(dateFrom)} to ${formatIsoDate(dateTo)}`;
}

export function formatTemperatureBinLabel(
  binStartC: number,
  binEndC: number
): string {
  return `${formatTemperatureNumber(binStartC)} to ${formatTemperatureNumber(binEndC)}°C`;
}

export function getTemperatureSummaryWindow(
  summary: AnalyticsTemperatureSummaryResponse | null | undefined,
  windowKey: AnalyticsTemperatureSummaryWindowKey
): AnalyticsTemperatureSummaryWindowResponse | null {
  return summary?.windows.find((window) => window.window_key === windowKey) ?? null;
}

export function isTemperatureSummaryReady(
  summary: AnalyticsTemperatureSummaryResponse | null | undefined
): summary is AnalyticsTemperatureSummaryResponse {
  return Boolean(summary && summary.windows.length > 0);
}

export interface TemperatureFrequencyBar {
  label: string;
  dayCount: number;
  share: number;
}

export function buildTemperatureFrequencyBars(
  window: AnalyticsTemperatureSummaryWindowResponse
): TemperatureFrequencyBar[] {
  const maxDayCount = Math.max(...window.frequency_bins.map((bin) => bin.day_count), 0);
  return window.frequency_bins.map((bin) => ({
    label: formatTemperatureBinLabel(bin.bin_start_c, bin.bin_end_c),
    dayCount: bin.day_count,
    share: maxDayCount > 0 ? bin.day_count / maxDayCount : 0,
  }));
}

export interface TemperatureHistogramPoint {
  x: number;
  y: number;
  binLabel: string;
  participantSessions: AnalyticsTemperatureSummaryParticipantSessionResponse[];
}

export function buildTemperatureHistogramPoints(
  window: AnalyticsTemperatureSummaryWindowResponse
): TemperatureHistogramPoint[] {
  return window.frequency_bins.map((bin) => ({
    x: bin.bin_start_c + 0.5,
    y: bin.day_count,
    binLabel: formatTemperatureBinLabel(bin.bin_start_c, bin.bin_end_c),
    participantSessions: bin.participant_sessions ?? [],
  }));
}

export interface TemperatureSummaryThresholdOverlay {
  available: boolean;
  methodLabel: string;
  cutoffLabel: string;
  note: string;
  coldThresholdTemperatureC: number | null;
  hotThresholdTemperatureC: number | null;
}

export function getTemperatureSummaryThresholdOverlay(
  window: AnalyticsTemperatureSummaryWindowResponse
): TemperatureSummaryThresholdOverlay {
  const thresholdZCutoff =
    typeof window.threshold_z_cutoff === "number" && Number.isFinite(window.threshold_z_cutoff)
      ? window.threshold_z_cutoff
      : 2;
  const thresholdMethod = window.threshold_method ?? "window_day_zscore_v1";
  const meanTemperatureC = window.mean_temperature_c;
  const sdTemperatureC = window.sd_temperature_c;
  const canDeriveThresholds =
    window.day_count >= 2 &&
    meanTemperatureC !== null &&
    sdTemperatureC !== null &&
    sdTemperatureC > 0;
  const coldThresholdTemperatureC =
    typeof window.cold_threshold_temperature_c === "number" &&
    Number.isFinite(window.cold_threshold_temperature_c)
      ? window.cold_threshold_temperature_c
      : canDeriveThresholds
        ? meanTemperatureC - thresholdZCutoff * sdTemperatureC
        : null;
  const hotThresholdTemperatureC =
    typeof window.hot_threshold_temperature_c === "number" &&
    Number.isFinite(window.hot_threshold_temperature_c)
      ? window.hot_threshold_temperature_c
      : canDeriveThresholds
        ? meanTemperatureC + thresholdZCutoff * sdTemperatureC
        : null;
  const available =
    canDeriveThresholds &&
    coldThresholdTemperatureC !== null &&
    hotThresholdTemperatureC !== null;

  return {
    available,
    methodLabel:
      thresholdMethod === "window_day_zscore_v1"
        ? "Window-day z-score v1"
        : "Threshold unavailable",
    cutoffLabel: `|z| > ${thresholdZCutoff}`,
    note: available
      ? `Extreme-day cutoffs are descriptive window-specific thresholds derived from mean ± ${thresholdZCutoff} SD across unique study days.`
      : "Extreme-day cutoffs are unavailable for this window because it has fewer than 2 unique study days or no day-level temperature variation.",
    coldThresholdTemperatureC,
    hotThresholdTemperatureC,
  };
}

export function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function formatPValue(value: number): string {
  return value < 0.001 ? "<0.001" : value.toFixed(3);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Analytics state → UI state mapping
// ---------------------------------------------------------------------------

export interface StatusPanel {
  title: string;
  body: string;
  className: string;
}

export function getStatusPanel(analytics: DashboardAnalyticsResponse): StatusPanel {
  switch (analytics.status) {
    case "recomputing":
      return {
        title: "Background refresh running",
        body: "The last saved snapshot stays visible while live recompute runs.",
        className: "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200",
      };
    case "stale":
      return {
        title: "Previous stale snapshot still shown",
        body: "A newer refresh did not finish, so the last saved snapshot stays visible.",
        className: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      };
    case "insufficient_data":
      return {
        title: "Not enough data yet",
        body: "There are not enough complete rows in this window to fit the models.",
        className: "border-border/80 bg-muted/60 text-foreground",
      };
    case "failed":
      return {
        title: "Analytics refresh failed",
        body: "The backend could not produce analytics for this window, but weather and dashboard actions still work.",
        className: "border-destructive/35 bg-destructive/10 text-destructive",
      };
    default:
      return {
        title: "Latest snapshot ready",
        body: "Model cards reflect the selected study window.",
        className: "border-border/80 bg-muted/50 text-foreground",
      };
  }
}

// ---------------------------------------------------------------------------
// Error message resolution
// ---------------------------------------------------------------------------

export function getAnalyticsErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your lab session expired. Sign in again to load analytics.";
    if (err.status === 404) return "No analytics snapshot exists yet for the current study window.";
    if (err.status >= 500) return "Analytics is temporarily unavailable from the backend.";
    return `Analytics request failed (${err.status}): ${err.message}`;
  }
  return "Unable to load dashboard analytics right now.";
}

// ---------------------------------------------------------------------------
// Effect card ordering
// ---------------------------------------------------------------------------

export function compareEffectsByStrength(
  left: Pick<AnalyticsEffectCardResponse, "p_value" | "statistic">,
  right: Pick<AnalyticsEffectCardResponse, "p_value" | "statistic">
): number {
  if (left.p_value !== right.p_value) {
    return left.p_value - right.p_value;
  }
  return Math.abs(right.statistic) - Math.abs(left.statistic);
}

// ---------------------------------------------------------------------------
// Model warning display helpers
// ---------------------------------------------------------------------------

export interface AnalyticsWarningDisplayItem {
  title: string;
  plainEnglish: string;
  rawWarnings: string[];
}

const OPTIMIZER_FAIL_RE = /model optimizer\s+(\w+)\s+failed:/iu;
const OPTIMIZER_RETRY_RE = /model converged after retrying with optimizer\s+(\w+)\.?/iu;
const BOUNDARY_RE = /boundary of the parameter space/iu;
const SINGULAR_RE = /singular/iu;

export function buildAnalyticsWarningDisplayItems(warnings: string[]): AnalyticsWarningDisplayItem[] {
  const remaining = [...warnings];
  const items: AnalyticsWarningDisplayItem[] = [];

  const optimizerFailure = remaining.find((warning) => OPTIMIZER_FAIL_RE.test(warning));
  const optimizerRetry = remaining.find((warning) => OPTIMIZER_RETRY_RE.test(warning));

  if (optimizerFailure && optimizerRetry) {
    const optimizerWarnings = remaining.filter(
      (warning) =>
        warning === optimizerFailure ||
        warning === optimizerRetry ||
        BOUNDARY_RE.test(warning) ||
        SINGULAR_RE.test(warning)
    );

    items.push({
      title: "Model needed a fallback fitting method",
      plainEnglish:
        "This model was harder than usual to fit for the selected date range. The default fitting method ran into a numerical problem, usually because one part of the model is very close to zero or the data leaves too little separation between parameters. A backup fitting method was able to finish, so the result is still available, but it should be interpreted a bit more cautiously than a clean first-pass fit.",
      rawWarnings: optimizerWarnings,
    });

    for (const warning of optimizerWarnings) {
      const index = remaining.indexOf(warning);
      if (index >= 0) {
        remaining.splice(index, 1);
      }
    }
  }

  return items.concat(
    remaining.map((warning) => ({
      title: "Technical model warning",
      plainEnglish:
        "The analytics model returned a technical warning while fitting this result. The estimate is still shown, but it may be less stable than usual.",
      rawWarnings: [warning],
    }))
  );
}
