"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDashboardBundle,
  type DashboardSummaryResponse,
  type WeatherDailyResponse,
} from "@/lib/api";
import PageContainer from "@/lib/components/PageContainer";
import WeatherUnifiedCard from "@/lib/components/WeatherUnifiedCard";
import { Button } from "@/components/ui/button";

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
      className="relative overflow-hidden rounded-2xl border border-border/90 p-5 shadow-[0_20px_40px_-42px_rgb(0_19_40/0.95)]"
      style={{ background: "var(--card)" }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-25 blur-2xl"
        style={{ background: "var(--ubc-blue-500)" }}
      />
      <div className="relative">
        <div className={`inline-flex w-fit items-center justify-center rounded-xl p-2.5 ${accent}`}>
          {icon}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherDailyResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCachedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Fast path: try cache first
      try {
        const cached = await getDashboardBundle("cached");
        if (!cancelled && cached.cached && cached.data) {
          setSummary(cached.data.summary);
          setWeatherData(cached.data.weather);
          setSummaryLoading(false);
          hasCachedRef.current = true;
        }
      } catch {
        // proceed to live
      }

      // Live refresh
      try {
        const live = await getDashboardBundle("live");
        if (!cancelled && live.data) {
          setSummary(live.data.summary);
          setWeatherData(live.data.weather);
        }
      } catch {
        if (!cancelled && !hasCachedRef.current) {
          setError("Unable to load dashboard data. You can still start a new entry.");
        }
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  const totalSessions = summary
    ? summary.sessions_created + summary.sessions_active + summary.sessions_complete
    : 0;

  return (
    <PageContainer>
      {/* Hero action zone */}
      <div
        className="relative mb-8 overflow-hidden rounded-2xl border border-border px-8 py-10"
        style={{ background: "var(--card)" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--ubc-blue-600)" }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              W&amp;W Research
            </p>
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Start a New Entry
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Present the consent form, collect participant details, and open a supervised session.
            </p>
          </div>
          <div className="shrink-0">
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

      {/* Fatal error */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="Participants"
          value={summaryLoading ? "—" : (summary?.total_participants ?? "—")}
          accent="bg-primary/15"
          icon={
            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <KpiCard
          label="Active Sessions"
          value={summaryLoading ? "—" : (summary?.sessions_active ?? "—")}
          accent="bg-emerald-500/15"
          icon={
            <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          }
        />
        <KpiCard
          label="Total Sessions"
          value={summaryLoading ? "—" : totalSessions}
          accent="bg-accent/15"
          icon={
            <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <KpiCard
          label="Created (7d)"
          value={summaryLoading ? "—" : (summary?.sessions_created_last_7_days ?? "—")}
          accent="bg-ring/15"
          icon={
            <svg className="h-4 w-4 text-ring" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        />
        <KpiCard
          label="Completed (7d)"
          value={summaryLoading ? "—" : (summary?.sessions_completed_last_7_days ?? "—")}
          accent="bg-primary/15"
          icon={
            <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Unified weather card with Highcharts chart */}
      <div className="mb-6">
        <WeatherUnifiedCard weather={weatherData} />
      </div>
    </PageContainer>
  );
}
