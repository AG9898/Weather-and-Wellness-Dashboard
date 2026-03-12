"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDashboardBundle,
  type WeatherDailyResponse,
} from "@/lib/api";
import DashboardAnalyticsSection, { type AnalyticsAnnotation } from "@/lib/components/DashboardAnalyticsSection";
import PageContainer from "@/lib/components/PageContainer";
import WeatherUnifiedCard from "@/lib/components/WeatherUnifiedCard";
import { Button } from "@/components/ui/button";

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDY_START = "2025-03-03";
const STUDY_TIMEZONE = "America/Vancouver";

function getStudyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIMEZONE }).format(new Date());
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [weatherData, setWeatherData] = useState<WeatherDailyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasCachedRef = useRef(false);

  // Shared filter state: drives both WeatherUnifiedCard range requests and analytics fetches.
  // Initialized to the same defaults as WeatherUnifiedCard so both start in sync.
  const [sharedDateFrom, setSharedDateFrom] = useState(STUDY_START);
  const [sharedDateTo, setSharedDateTo] = useState(getStudyToday);

  // Analytics annotation passed to the weather card for visual linking
  const [analyticsAnnotation, setAnalyticsAnnotation] = useState<AnalyticsAnnotation | null>(null);

  function handleDateRangeChange(from: string, to: string): void {
    setSharedDateFrom(from);
    setSharedDateTo(to);
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Fast path: try cache first
      let cachedAt: string | null = null;
      try {
        const cached = await getDashboardBundle("cached");
        if (!cancelled && cached.cached && cached.data) {
          setWeatherData(cached.data.weather);
          hasCachedRef.current = true;
          cachedAt = cached.data.cached_at;
        }
      } catch {
        // proceed to live
      }

      const REFRESH_AFTER_MS = 10 * 60 * 1000; // only refresh live when cached data is older than ~10 minutes
      const shouldRefreshLive =
        !cachedAt ||
        Date.now() - new Date(cachedAt).getTime() > REFRESH_AFTER_MS;

      // If we have cached data, refresh in the background (do not block first render).
      if (hasCachedRef.current && !shouldRefreshLive) return;
      if (hasCachedRef.current && shouldRefreshLive) {
        void (async () => {
          try {
            const live = await getDashboardBundle("live");
            if (!cancelled && live.data) {
              setWeatherData(live.data.weather);
            }
          } catch {
            // Ignore live refresh failures when we already have cached data rendered.
          }
        })();
        return;
      }

      // Cache miss: block on live data (best-effort) before removing the loading state.
      try {
        const live = await getDashboardBundle("live");
        if (!cancelled && live.data) {
          setWeatherData(live.data.weather);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load dashboard data. You can still start a new entry.");
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

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

      <div className="mb-8">
        <WeatherUnifiedCard
          weather={weatherData}
          onDateRangeChange={handleDateRangeChange}
          analyticsAnnotation={analyticsAnnotation}
        />
      </div>

      <div className="mb-6">
        <DashboardAnalyticsSection
          dateFrom={sharedDateFrom}
          dateTo={sharedDateTo}
          onAnnotationsChange={setAnalyticsAnnotation}
        />
      </div>
    </PageContainer>
  );
}
