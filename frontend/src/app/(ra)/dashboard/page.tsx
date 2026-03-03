"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getDashboardBundle,
  getDashboardRangeBundle,
  type DashboardSummaryRangeResponse,
  type DashboardSummaryResponse,
  type WeatherDailyResponse,
} from "@/lib/api";
import PageContainer from "@/lib/components/PageContainer";
import WeatherCard from "@/lib/components/WeatherCard";
import { Button } from "@/components/ui/button";

// Helpers

const STUDY_TIMEZONE = "America/Vancouver";

type DateRange = {
  dateFrom: string;
  dateTo: string;
};

type FilterPreset =
  | "default"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "custom";

function getStudyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDY_TIMEZONE,
  }).format(new Date());
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function startOfMonth(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, 1));
  return dt.toISOString().slice(0, 10);
}

function getPresetRange(preset: Exclude<FilterPreset, "default" | "custom">): DateRange {
  const today = getStudyToday();
  if (preset === "today") {
    return { dateFrom: today, dateTo: today };
  }
  if (preset === "last_7_days") {
    return { dateFrom: shiftIsoDate(today, -6), dateTo: today };
  }
  if (preset === "this_month") {
    return { dateFrom: startOfMonth(today), dateTo: today };
  }
  return { dateFrom: shiftIsoDate(today, -29), dateTo: today };
}

function formatRangeLabel(range: DateRange): string {
  if (range.dateFrom === range.dateTo) {
    return range.dateFrom;
  }
  return `${range.dateFrom} to ${range.dateTo}`;
}

function getFilterErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 422) return "Invalid date range. Confirm date_from is not after date_to.";
    if (err.status >= 500) return "Range data is temporarily unavailable. Keeping current dashboard values.";
    return `Range update failed (${err.status}): ${err.message}`;
  }
  return "Unable to refresh the selected range right now. Keeping current dashboard values.";
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
}

function KpiCard({ label, value, icon, accent = "bg-primary/15" }: KpiCardProps) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-border p-5"
      style={{ background: "var(--card)" }}
    >
      <div className={`inline-flex w-fit items-center justify-center rounded-xl p-2.5 ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums text-foreground">{value}</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}

interface FilterPresetButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function FilterPresetButton({ active, label, onClick }: FilterPresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border bg-background/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const todayRef = useRef(getStudyToday());

  // Base summary + weather (cached -> live SWR)
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherDailyResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filtered range summary + weather (live-only)
  const [rangeSummary, setRangeSummary] = useState<DashboardSummaryRangeResponse | null>(null);
  const [rangeWeatherData, setRangeWeatherData] = useState<WeatherDailyResponse | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  // Filter controls
  const [preset, setPreset] = useState<FilterPreset>("default");
  const [customFrom, setCustomFrom] = useState(shiftIsoDate(todayRef.current, -6));
  const [customTo, setCustomTo] = useState(todayRef.current);
  const [requestedRange, setRequestedRange] = useState<DateRange | null>(null);
  const [appliedRange, setAppliedRange] = useState<DateRange | null>(null);

  const [error, setError] = useState<string | null>(null);
  const hasCachedSummaryRef = useRef(false);
  const rangeRequestSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const cached = await getDashboardBundle("cached");
        if (!cancelled && cached.cached && cached.data) {
          setSummary(cached.data.summary);
          setWeatherData(cached.data.weather);
          setSummaryLoading(false);
          hasCachedSummaryRef.current = true;
        }
      } catch {
        // proceed to live
      }

      try {
        const liveRes = await getDashboardBundle("live");
        if (!cancelled) {
          if (liveRes.data) {
            setSummary(liveRes.data.summary);
            setWeatherData(liveRes.data.weather);
          }
        }
      } catch {
        if (!cancelled && !hasCachedSummaryRef.current) {
          setError("Unable to load dashboard data. You can still start a new entry.");
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyRange(nextRange: DateRange, nextPreset: FilterPreset): Promise<void> {
    if (nextRange.dateFrom > nextRange.dateTo) {
      setRangeError("Start date must be on or before end date.");
      return;
    }

    setPreset(nextPreset);
    setRequestedRange(nextRange);
    setRangeLoading(true);
    setRangeError(null);

    const requestId = rangeRequestSeqRef.current + 1;
    rangeRequestSeqRef.current = requestId;

    try {
      const rangeRes = await getDashboardRangeBundle(nextRange.dateFrom, nextRange.dateTo);
      if (rangeRequestSeqRef.current !== requestId) return;
      setRangeSummary(rangeRes.data.summary);
      setRangeWeatherData(rangeRes.data.weather);
      setAppliedRange(nextRange);
    } catch (err) {
      if (rangeRequestSeqRef.current !== requestId) return;
      setRangeError(getFilterErrorMessage(err));
    } finally {
      if (rangeRequestSeqRef.current === requestId) {
        setRangeLoading(false);
      }
    }
  }

  function clearRangeFilter(): void {
    rangeRequestSeqRef.current += 1;
    setPreset("default");
    setRequestedRange(null);
    setAppliedRange(null);
    setRangeSummary(null);
    setRangeWeatherData(null);
    setRangeLoading(false);
    setRangeError(null);
  }

  function handlePresetClick(nextPreset: Exclude<FilterPreset, "custom">): void {
    if (nextPreset === "default") {
      clearRangeFilter();
      return;
    }

    const nextRange = getPresetRange(nextPreset);
    setCustomFrom(nextRange.dateFrom);
    setCustomTo(nextRange.dateTo);
    void applyRange(nextRange, nextPreset);
  }

  function handleApplyCustomRange(): void {
    if (!customFrom || !customTo) {
      setRangeError("Select both date_from and date_to before applying a custom range.");
      return;
    }
    void applyRange(
      {
        dateFrom: customFrom,
        dateTo: customTo,
      },
      "custom"
    );
  }

  const isFiltered = appliedRange !== null;
  const totalSessions = summary
    ? summary.sessions_created + summary.sessions_active + summary.sessions_complete
    : 0;

  const displayWeather = isFiltered ? (rangeWeatherData ?? weatherData) : weatherData;
  const weatherFocusDate = isFiltered ? appliedRange.dateTo : todayRef.current;

  const createdLabel = isFiltered ? "Created (range)" : "Created (7d)";
  const completedLabel = isFiltered ? "Completed (range)" : "Completed (7d)";
  const createdValue = isFiltered
    ? (rangeSummary?.sessions_created ?? "—")
    : (summaryLoading ? "—" : (summary?.sessions_created_last_7_days ?? 0));
  const completedValue = isFiltered
    ? (rangeSummary?.sessions_completed ?? "—")
    : (summaryLoading ? "—" : (summary?.sessions_completed_last_7_days ?? 0));
  const rangeStatusText = isFiltered && appliedRange
    ? `Showing ${formatRangeLabel(appliedRange)} (${STUDY_TIMEZONE})`
    : `Default overview (cached + live refresh, ${STUDY_TIMEZONE})`;

  return (
    <PageContainer>
      {/* Hero action zone */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border px-8 py-10 mb-8"
        style={{ background: "var(--card)" }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-20"
          style={{ background: "var(--ubc-blue-600)" }}
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 max-w-lg">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              W&amp;W Research
            </p>
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              Start a New Entry
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Present the consent form, collect participant details, and open a supervised session.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="lg"
              className="rounded-xl px-6 font-semibold text-primary-foreground"
              style={{ background: "var(--ubc-blue-700)" }}
              onClick={() => router.push("/new-session")}
            >
              Start New Entry
            </Button>
          </div>
        </div>
      </div>

      {/* Fatal error (only when no dashboard data is available) */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Date range controls */}
      <div
        className="mb-6 rounded-2xl border border-border p-5"
        style={{ background: "var(--card)" }}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Dashboard Range
            </p>
            <p className="text-sm text-foreground">
              {rangeStatusText}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterPresetButton
              active={preset === "default"}
              label="Default"
              onClick={() => handlePresetClick("default")}
            />
            <FilterPresetButton
              active={preset === "today"}
              label="Today"
              onClick={() => handlePresetClick("today")}
            />
            <FilterPresetButton
              active={preset === "last_7_days"}
              label="Last 7 days"
              onClick={() => handlePresetClick("last_7_days")}
            />
            <FilterPresetButton
              active={preset === "last_30_days"}
              label="Last 30 days"
              onClick={() => handlePresetClick("last_30_days")}
            />
            <FilterPresetButton
              active={preset === "this_month"}
              label="This month"
              onClick={() => handlePresetClick("this_month")}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date from
            </span>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Date to
            </span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              disabled={rangeLoading}
              onClick={handleApplyCustomRange}
            >
              Apply Custom
            </Button>
            {isFiltered && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl"
                disabled={rangeLoading}
                onClick={clearRangeFilter}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {(rangeLoading || rangeError) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {rangeLoading && (
              <span className="text-muted-foreground">
                Updating range {requestedRange ? formatRangeLabel(requestedRange) : ""}...
              </span>
            )}
            {rangeError && (
              <span className="text-destructive">{rangeError}</span>
            )}
          </div>
        )}
      </div>

      {/* Weather card */}
      <div className="mb-8">
        <WeatherCard weather={displayWeather} focusDate={weatherFocusDate} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        <KpiCard
          label="Participants"
          value={summaryLoading ? "—" : (summary ? summary.total_participants : "—")}
          accent="bg-primary/15"
          icon={
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <KpiCard
          label="Active Sessions"
          value={summaryLoading ? "—" : (summary ? summary.sessions_active : "—")}
          accent="bg-emerald-500/15"
          icon={
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          }
        />
        <KpiCard
          label="Total Sessions"
          value={summaryLoading ? "—" : (summary ? totalSessions : "—")}
          accent="bg-accent/15"
          icon={
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <KpiCard
          label={createdLabel}
          value={createdValue}
          accent="bg-ring/15"
          icon={
            <svg className="w-4 h-4 text-ring" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        />
        <KpiCard
          label={completedLabel}
          value={completedValue}
          accent="bg-primary/15"
          icon={
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>
    </PageContainer>
  );
}
