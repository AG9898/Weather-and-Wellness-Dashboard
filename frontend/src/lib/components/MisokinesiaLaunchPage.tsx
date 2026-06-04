import { FlaskConical, Play, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
import type {
  MisoDashboardResponse,
  MisoDashboardSessionItem,
  MisoVideoScoreItem,
  MisoVideoScoresResponse,
} from "@/lib/api/misokinesia";

export type SessionKind = "production" | "short_trial" | "full_trial";
export type SessionStatus = "complete" | "incomplete" | "rehearsal";
export type MisokinesiaLaunchStatsState = "replica" | "empty" | "error";

interface MisokinesiaLaunchPageProps {
  loading?: boolean;
  shortTrialLoading?: boolean;
  fullTrialLoading?: boolean;
  error?: string | null;
  dashboard?: MisoDashboardResponse | null;
  videoScores?: MisoVideoScoresResponse | null;
  dashboardLoading?: boolean;
  dashboardError?: string | null;
  statsState?: MisokinesiaLaunchStatsState;
  onStart?: () => void;
  onStartShortTrial?: () => void;
  onStartFullTrial?: () => void;
  /** Called when RA clicks "Undo last session". Stub until wired to backend. */
  onUndoLastSession?: () => void;
}

const KIND_LABEL: Record<SessionKind, string> = {
  production: "Production",
  short_trial: "Short trial",
  full_trial: "Full trial",
};

function StatusBadge({ kind, status }: { kind: SessionKind; status: SessionStatus }) {
  const isComplete = status === "complete";
  const isRehearsal = status === "rehearsal";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5",
        "text-[10px] font-semibold uppercase tracking-widest",
        isComplete
          ? "border-primary/30 bg-primary/10 text-primary"
          : isRehearsal
            ? "border-border bg-muted text-muted-foreground"
            : "border-border bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

function formatParticipantNumber(value: number): string {
  return `MKP-${String(value).padStart(4, "0")}`;
}

function formatRelativeTime(value: string): string {
  const started = new Date(value);
  if (Number.isNaN(started.getTime())) {
    return "—";
  }

  const now = new Date();
  const elapsedMs = now.getTime() - started.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) {
    return "Just now";
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24 && now.toDateString() === started.toDateString()) {
    return `${elapsedHours}h ${elapsedMinutes % 60}m ago`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = started.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (started.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${time}`;
  }

  return `${started.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} · ${time}`;
}

function formatNullable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return typeof value === "number" ? value.toFixed(1) : value;
}

function formatDemographicValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
}

function formatDemographics(row: MisoDashboardSessionItem): string {
  const values = [row.age, row.sex, row.residence_status].map(formatDemographicValue);
  return values.join(" · ");
}

function ScoreRows({ items }: { items: MisoVideoScoreItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.video_label}-${item.avg_score}`}
          className="flex items-center justify-between gap-4 border-b border-border pb-2 text-[12px] last:border-0 last:pb-0"
        >
          <span className="min-w-0 truncate font-medium text-foreground">
            {item.video_label}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-foreground">
            {item.avg_score.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MisokinesiaLaunchPage({
  loading = false,
  shortTrialLoading = false,
  fullTrialLoading = false,
  error = null,
  dashboard = null,
  videoScores = null,
  dashboardLoading = false,
  dashboardError = null,
  onStart,
  onStartShortTrial,
  onStartFullTrial,
  onUndoLastSession,
}: MisokinesiaLaunchPageProps) {
  const anyLoading = loading || shortTrialLoading || fullTrialLoading;
  const recentSessions = dashboard?.recent_sessions.slice(0, 10) ?? [];
  const activeStimuliCount = dashboard?.active_stimuli_count;
  const topScores = videoScores?.top_5 ?? [];
  const bottomScores = videoScores?.bottom_5 ?? [];
  const hasVideoScores = topScores.length > 0 || bottomScores.length > 0;

  return (
    <PageContainer>
      <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[540px] space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Misokinesia Study · Lab Operations
          </p>
          <h1
            className="text-[30px] font-bold leading-[1.15] text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            Misokinesia Task
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Launch a participant session, run a rehearsal trial, or review recent activity for this lab module.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 lg:items-end">
          <Button
            size="lg"
            disabled={anyLoading}
            onClick={onStart}
            className="h-11 rounded-xl px-[22px] font-semibold text-primary-foreground"
          >
            <Play className="mr-2 size-4" />
            {loading ? "Starting…" : "Start Misokinesia Session"}
          </Button>

          <div className="flex gap-2">
            <Button
              size="default"
              variant="outline"
              disabled={anyLoading}
              onClick={onStartShortTrial}
              className="h-9 rounded-xl px-4 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              {shortTrialLoading ? "Starting…" : "Short Trial"}
            </Button>
            <Button
              size="default"
              variant="outline"
              disabled={anyLoading}
              onClick={onStartFullTrial}
              className="h-9 rounded-xl px-4 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              {fullTrialLoading ? "Starting…" : "Full Trial"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Trials use fake ids · no data is written
          </p>

          {error && (
            <p className="max-w-xs text-sm text-destructive lg:text-right">{error}</p>
          )}
        </div>
      </div>

      {dashboardError && (
        <div className="mb-6 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dashboardError}
        </div>
      )}

      <div
        className="mb-6 rounded-2xl border border-border px-6 py-5 shadow-[var(--shadow-card)]"
        style={{ background: "var(--card)" }}
      >
        <div
          className="border-l-2 pl-5"
          style={{ borderColor: "var(--primary)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Active stimuli
          </p>
          <p
            className="mt-1.5 font-bold tabular-nums text-foreground"
            style={{ fontSize: 30, letterSpacing: "-0.02em" }}
          >
            {dashboardLoading ? "Loading" : activeStimuliCount ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground" style={{ color: "var(--ink-45)" }}>
            clips available in the active test set
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        <div
          className="rounded-2xl border border-border px-6 py-5 shadow-[var(--shadow-card)]"
          style={{ background: "var(--card)" }}
        >
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Recent sessions
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[11px] text-muted-foreground"
              onClick={onUndoLastSession}
            >
              <Undo2 className="mr-1.5 size-3.5" />
              Undo last session
            </Button>
          </div>

          <div className="border-t border-border">
            {dashboardLoading ? (
              <p className="py-6 text-[12px] text-muted-foreground">
                Loading recent sessions…
              </p>
            ) : recentSessions.length === 0 ? (
              <p className="py-6 text-[12px] text-muted-foreground">
                No sessions yet.
              </p>
            ) : (
              recentSessions.map((row) => (
                <div
                  key={`${row.misokinesia_participant_number}-${row.started_at}`}
                  className="grid grid-cols-[minmax(92px,0.9fr)_minmax(95px,1fr)] items-center gap-x-4 gap-y-1 border-b border-border py-3 text-[12px] sm:grid-cols-[110px_minmax(120px,1fr)_minmax(150px,1.45fr)_90px]"
                >
                  <span
                    className="font-semibold tabular-nums text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatParticipantNumber(row.misokinesia_participant_number)}
                  </span>
                  <span className="text-muted-foreground">{formatRelativeTime(row.started_at)}</span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {formatDemographics(row)}
                  </span>
                  <span
                    className="tabular-nums text-muted-foreground sm:text-right"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatNullable(row.avg_clip_score)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          className="rounded-2xl border border-border px-6 py-5 shadow-[var(--shadow-card)]"
          style={{ background: "var(--card)" }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Video Score Leaderboard
          </p>

          {dashboardLoading ? (
            <p className="border-t border-border py-6 text-[12px] text-muted-foreground">
              Loading video scores…
            </p>
          ) : !hasVideoScores ? (
            <p className="border-t border-border py-6 text-[12px] text-muted-foreground">
              No video score data yet.
            </p>
          ) : (
            <div className="space-y-5 border-t border-border pt-4">
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Highest reactivity
                </p>
                <ScoreRows items={topScores} />
              </section>
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Lowest reactivity
                </p>
                <ScoreRows items={bottomScores} />
              </section>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
