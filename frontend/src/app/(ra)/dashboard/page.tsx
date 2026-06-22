"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDashboardStudyWindow,
  getDashboardWeatherBundle,
  type WeatherDailyResponse,
} from "@/lib/api";
import DashboardAnalyticsSection from "@/lib/components/DashboardAnalyticsSection";
import AnalyticsTemperatureSummaryCard from "@/lib/components/AnalyticsTemperatureSummaryCard";
import LabGuard from "@/lib/components/LabGuard";
import PageContainer from "@/lib/components/PageContainer";
import UndoLastSessionControl from "@/lib/components/UndoLastSessionControl";
import WeatherUnifiedCard from "@/lib/components/WeatherUnifiedCard";
import { Button } from "@/components/ui/button";

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDY_TIMEZONE = "America/Vancouver";

function getStudyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDY_TIMEZONE }).format(new Date());
}

// ── Page ──────────────────────────────────────────────────────────────────────

// The Weather-Wellness dashboard is this lab's landing page; guard it so only
// ww RAs (and admins) can reach it by direct URL.
export default function DashboardPage() {
  return (
    <LabGuard lab="ww">
      <DashboardPageContent />
    </LabGuard>
  );
}

function DashboardPageContent() {
  const router = useRouter();

  const [weatherData, setWeatherData] = useState<WeatherDailyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestStudyDay, setLatestStudyDay] = useState<string | null>(null);
  const hasCachedRef = useRef(false);
  const weatherAnchorDate = latestStudyDay ?? getStudyToday();

  // Increment to force analytics section to re-fetch after a destructive operation.
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadStudyWindow = async () => {
      try {
        const response = await getDashboardStudyWindow();
        if (!cancelled) {
          setLatestStudyDay(response.latest_study_day);
        }
      } catch {
        if (!cancelled) {
          setLatestStudyDay(null);
        }
      }
    };

    void loadStudyWindow();

    const load = async () => {
      // Fast path: try cache first
      let cachedAt: string | null = null;
      try {
        const cached = await getDashboardWeatherBundle("cached");
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
            const live = await getDashboardWeatherBundle("live");
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
        const live = await getDashboardWeatherBundle("live");
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
        className="relative mb-8 overflow-hidden rounded-2xl border border-border px-8 py-10 shadow-[var(--shadow-raised)]"
        style={{ background: "var(--card)" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-16 blur-3xl"
          style={{ background: "var(--ring)" }}
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
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              size="lg"
              className="rounded-xl px-6 font-semibold text-primary-foreground"
              onClick={() => router.push("/new-session")}
            >
              Start New Entry
            </Button>
            <UndoLastSessionControl
              onSuccess={() => {
                setAnalyticsRefreshKey((k) => k + 1);
                // Also refresh the live dashboard weather bundle in the background.
                void getDashboardWeatherBundle("live").then((live) => {
                  if (live.data) setWeatherData(live.data.weather);
                }).catch(() => undefined);
              }}
            />
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
          anchorDate={weatherAnchorDate}
        />
      </div>

      <div className="mb-6">
        <AnalyticsTemperatureSummaryCard anchorDate={weatherAnchorDate} />
      </div>

      <div className="mb-6">
        <DashboardAnalyticsSection
          anchorDate={weatherAnchorDate}
          refreshSignal={analyticsRefreshKey}
        />
      </div>
    </PageContainer>
  );
}
