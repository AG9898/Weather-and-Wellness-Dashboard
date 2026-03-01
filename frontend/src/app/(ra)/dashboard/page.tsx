"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiGet,
  getDashboardBundle,
  type DashboardSummaryResponse,
  type WeatherDailyResponse,
  type SessionListResponse,
  type SessionListItemResponse,
} from "@/lib/api";
import PageContainer from "@/lib/components/PageContainer";
import WeatherCard from "@/lib/components/WeatherCard";
import { Button } from "@/components/ui/button";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_BADGE: Record<string, string> = {
  created: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  complete: "border-white/10 bg-white/5 text-muted-foreground",
};

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

function SessionRow({ session }: { session: SessionListItemResponse }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold tabular-nums"
          style={{ background: "var(--ubc-blue-700)", color: "#fff" }}
        >
          #{session.participant_number}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {session.session_id.slice(0, 8)}…
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[session.status] ?? STATUS_BADGE.complete}`}
        >
          {session.status}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
          {timeAgo(session.created_at)}
        </span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  // Summary + weather
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherDailyResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Sessions list
  const [sessions, setSessions] = useState<SessionListItemResponse[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const hasCachedSummaryRef = useRef(false);

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
        const [liveRes, sessionsData] = await Promise.all([
          getDashboardBundle("live"),
          apiGet<SessionListResponse>("/sessions?page_size=8", { auth: true }),
        ]);
        if (!cancelled) {
          if (liveRes.data) {
            setSummary(liveRes.data.summary);
            setWeatherData(liveRes.data.weather);
          }
          setSessions(sessionsData.items);
        }
      } catch {
        if (!cancelled && !hasCachedSummaryRef.current) {
          setError("Unable to load dashboard data. You can still start a new entry.");
        }
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
          setSessionsLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const totalSessions = summary
    ? summary.sessions_created + summary.sessions_active + summary.sessions_complete
    : 0;

  return (
    <PageContainer>

      {/* ── Hero action zone ─────────────────────────────── */}
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
              className="rounded-xl px-6 font-semibold text-white"
              style={{ background: "var(--ubc-blue-700)" }}
              onClick={() => router.push("/new-session")}
            >
              Start New Entry
            </Button>
          </div>
        </div>
      </div>

      {/* ── Error state (only when no data available at all) ─ */}
      {error && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Weather card ─────────────────────────────────── */}
      <div className="mb-8">
        <WeatherCard weather={weatherData} />
      </div>

      {/* ── KPI cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        <KpiCard
          label="Participants"
          value={summaryLoading ? "—" : (summary?.total_participants ?? 0)}
          accent="bg-primary/15"
          icon={
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <KpiCard
          label="Active Sessions"
          value={summaryLoading ? "—" : (summary?.sessions_active ?? 0)}
          accent="bg-emerald-500/15"
          icon={
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          }
        />
        <KpiCard
          label="Total Sessions"
          value={summaryLoading ? "—" : totalSessions}
          accent="bg-accent/15"
          icon={
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <KpiCard
          label="Created (7d)"
          value={summaryLoading ? "—" : (summary?.sessions_created_last_7_days ?? 0)}
          accent="bg-ring/15"
          icon={
            <svg className="w-4 h-4 text-ring" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        />
        <KpiCard
          label="Completed (7d)"
          value={summaryLoading ? "—" : (summary?.sessions_completed_last_7_days ?? 0)}
          accent="bg-primary/15"
          icon={
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Recent sessions ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent Sessions
          </p>
        </div>

        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{ background: "var(--card)" }}
        >
          {sessionsLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No sessions yet. Use the button above to start the first entry.
              </p>
            </div>
          ) : (
            sessions.map((s) => <SessionRow key={s.session_id} session={s} />)
          )}
        </div>
      </div>

    </PageContainer>
  );
}
