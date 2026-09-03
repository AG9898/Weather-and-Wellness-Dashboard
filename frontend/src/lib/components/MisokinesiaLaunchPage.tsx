import { FlaskConical, Play, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
import {
  DEFAULT_MISO_LOCALE,
  MISO_LOCALES,
  misoLocaleTag,
  misoMessage,
  misoOptionLabel,
  type MisoLocale,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
  /**
   * Locale the RA has selected for the next session. It drives both the copy on
   * this page and the `language` sent to `POST /misokinesia/start`, so the RA
   * can see at a glance which version they are about to run. This page is the
   * only translated RA surface.
   */
  locale?: MisoLocale;
  onLocaleChange?: (locale: MisoLocale) => void;
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

function formatParticipantNumber(value: number): string {
  return `MKP-${String(value).padStart(4, "0")}`;
}

function formatRelativeTime(value: string, locale: MisoLocale): string {
  const started = new Date(value);
  if (Number.isNaN(started.getTime())) {
    return "—";
  }

  const tag = misoLocaleTag(locale);
  const now = new Date();
  const elapsedMs = now.getTime() - started.getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));

  if (elapsedMinutes < 1) {
    return misoMessage("ra.launch.time.just_now", locale);
  }
  if (elapsedMinutes < 60) {
    return misoMessage("ra.launch.time.minutes", locale, { n: elapsedMinutes });
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24 && now.toDateString() === started.toDateString()) {
    return misoMessage("ra.launch.time.hours", locale, {
      h: elapsedHours,
      m: elapsedMinutes % 60,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = started.toLocaleTimeString(tag, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (started.toDateString() === yesterday.toDateString()) {
    return misoMessage("ra.launch.time.yesterday", locale, { time });
  }

  return `${started.toLocaleDateString(tag, {
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

/**
 * `sex` and `residence_status` arrive from the dashboard as stored option keys
 * (`sex_female`, `residence_citizenship`), so they must be rendered through the
 * section 2 label maps rather than printed raw. `misoOptionLabel` returns the
 * key unchanged when it does not recognise it, which keeps rows written before
 * the option-key migration legible instead of blanking them.
 */
function formatDemographicOption(
  field: "sex" | "residence_status",
  value: string | null | undefined,
  locale: MisoLocale,
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return misoOptionLabel(field, value, locale);
}

function formatDemographics(row: MisoDashboardSessionItem, locale: MisoLocale): string {
  return [
    formatDemographicValue(row.age),
    formatDemographicOption("sex", row.sex, locale),
    formatDemographicOption("residence_status", row.residence_status, locale),
  ].join(" · ");
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
  locale = DEFAULT_MISO_LOCALE,
  onLocaleChange,
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
  const t = (key: Parameters<typeof misoMessage>[0]) => misoMessage(key, locale);

  return (
    <PageContainer>
      <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[540px] space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("ra.launch.kicker")}
          </p>
          <h1
            className="text-[30px] font-bold leading-[1.15] text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            {t("ra.launch.title")}
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {t("ra.launch.subtitle")}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 lg:items-end">
          <div
            className="inline-grid grid-flow-col auto-cols-fr gap-1 rounded-md border border-border bg-card/90 p-1 shadow-sm"
            role="group"
            aria-label={t("ra.launch.language.aria")}
          >
            {MISO_LOCALES.map((option) => {
              const isActive = option === locale;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={anyLoading}
                  aria-pressed={isActive}
                  onClick={() => onLocaleChange?.(option)}
                  className={cn(
                    "min-w-[3rem] rounded px-3 py-1.5 text-center text-[11px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
                    isActive &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  {misoMessage(
                    option === "ko" ? "ra.launch.language.ko" : "ra.launch.language.en",
                    locale
                  )}
                </button>
              );
            })}
          </div>

          <Button
            size="lg"
            disabled={anyLoading}
            onClick={onStart}
            className="h-11 rounded-xl px-[22px] font-semibold text-primary-foreground"
          >
            <Play className="mr-2 size-4" />
            {loading ? t("ra.launch.state.starting") : t("ra.launch.button.start")}
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
              {shortTrialLoading
                ? t("ra.launch.state.starting")
                : t("ra.launch.button.short_trial")}
            </Button>
            <Button
              size="default"
              variant="outline"
              disabled={anyLoading}
              onClick={onStartFullTrial}
              className="h-9 rounded-xl px-4 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              {fullTrialLoading
                ? t("ra.launch.state.starting")
                : t("ra.launch.button.full_trial")}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("ra.launch.trial_note")}
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
            {t("ra.launch.stats.active_stimuli")}
          </p>
          <p
            className="mt-1.5 font-bold tabular-nums text-foreground"
            style={{ fontSize: 30, letterSpacing: "-0.02em" }}
          >
            {dashboardLoading ? t("ra.launch.state.loading") : activeStimuliCount ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground" style={{ color: "var(--ink-45)" }}>
            {t("ra.launch.stats.active_stimuli_help")}
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
              {t("ra.launch.recent.title")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[11px] text-muted-foreground"
              onClick={onUndoLastSession}
            >
              <Undo2 className="mr-1.5 size-3.5" />
              {t("ra.launch.recent.undo")}
            </Button>
          </div>

          <div className="border-t border-border">
            {dashboardLoading ? (
              <p className="py-6 text-[12px] text-muted-foreground">
                {t("ra.launch.recent.loading")}
              </p>
            ) : recentSessions.length === 0 ? (
              <p className="py-6 text-[12px] text-muted-foreground">
                {t("ra.launch.recent.empty")}
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
                  <span className="text-muted-foreground">{formatRelativeTime(row.started_at, locale)}</span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {formatDemographics(row, locale)}
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
            {t("ra.launch.scores.title")}
          </p>

          {dashboardLoading ? (
            <p className="border-t border-border py-6 text-[12px] text-muted-foreground">
              {t("ra.launch.scores.loading")}
            </p>
          ) : !hasVideoScores ? (
            <p className="border-t border-border py-6 text-[12px] text-muted-foreground">
              {t("ra.launch.scores.empty")}
            </p>
          ) : (
            <div className="space-y-5 border-t border-border pt-4">
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("ra.launch.scores.highest")}
                </p>
                <ScoreRows items={topScores} />
              </section>
              <section>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("ra.launch.scores.lowest")}
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
