/**
 * Pure utility functions for the analytics dashboard UI.
 *
 * Extracted from DashboardAnalyticsSection to allow isolated unit testing
 * of analytics state logic without requiring React DOM or component rendering.
 */

import type { AnalyticsEffectCardResponse, DashboardAnalyticsResponse } from "@/lib/api";
import { ApiError } from "@/lib/api";

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
