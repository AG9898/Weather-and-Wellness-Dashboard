import { FlaskConical, Play, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";

// ── Stub data types ──────────────────────────────────────────────────────────
// These are clearly isolated as stubs until backend endpoint support lands.
// When a dashboard endpoint is available, replace STUB_RECENT_SESSIONS and
// STUB_SPLIT_DATA with live API calls and wire real data through props.

export type SessionKind = "production" | "short_trial" | "full_trial";
export type SessionStatus = "complete" | "incomplete" | "rehearsal";

export interface RecentSession {
  /** RA-facing participant ID label, e.g. "MKP-0149" or "MKP-—" for trials */
  id: string;
  /** Human-readable elapsed or clock timestamp */
  stamp: string;
  /** Clips completed expressed as "N/M" */
  clips: string;
  kind: SessionKind;
  status: SessionStatus;
}

export interface SplitData {
  productionCount: number;
  trialCount: number;
  /** Period label, e.g. "30 days" */
  window: string;
}

// Stub data — replace with real API props when backend support lands.
const STUB_RECENT_SESSIONS: RecentSession[] = [
  { id: "MKP-0149", stamp: "2 min ago",           clips: "25/25", kind: "production",   status: "complete"   },
  { id: "MKP-0148", stamp: "1h 12m ago",           clips: "25/25", kind: "production",   status: "complete"   },
  { id: "MKP-—",    stamp: "2h 04m ago",           clips: "5/5",   kind: "short_trial",  status: "rehearsal"  },
  { id: "MKP-0147", stamp: "3h 51m ago",           clips: "12/25", kind: "production",   status: "incomplete" },
  { id: "MKP-0146", stamp: "Yesterday · 16:22",    clips: "25/25", kind: "production",   status: "complete"   },
];

const STUB_SPLIT_DATA: SplitData = {
  productionCount: 42,
  trialCount: 16,
  window: "30 days",
};

// Active stimuli count is stubbed; replace with real value when available.
const STUB_ACTIVE_STIMULI = 25;

// ── Kind labels ──────────────────────────────────────────────────────────────
const KIND_LABEL: Record<SessionKind, string> = {
  production:  "Production",
  short_trial: "Short trial",
  full_trial:  "Full trial",
};

// ── Component props ──────────────────────────────────────────────────────────
export type MisokinesiaLaunchStatsState = "replica" | "empty" | "error";

interface MisokinesiaLaunchPageProps {
  loading?: boolean;
  shortTrialLoading?: boolean;
  fullTrialLoading?: boolean;
  error?: string | null;
  /** Unused in this version but kept for Storybook/story compatibility. */
  statsState?: MisokinesiaLaunchStatsState;
  onStart?: () => void;
  onStartShortTrial?: () => void;
  onStartFullTrial?: () => void;
  /** Called when RA clicks "Undo last session". Stub until wired to backend. */
  onUndoLastSession?: () => void;
}

// ── StatusBadge ──────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
export default function MisokinesiaLaunchPage({
  loading = false,
  shortTrialLoading = false,
  fullTrialLoading = false,
  error = null,
  onStart,
  onStartShortTrial,
  onStartFullTrial,
  onUndoLastSession,
}: MisokinesiaLaunchPageProps) {
  const anyLoading = loading || shortTrialLoading || fullTrialLoading;

  const total = STUB_SPLIT_DATA.productionCount + STUB_SPLIT_DATA.trialCount;
  const productionPct = total > 0 ? (STUB_SPLIT_DATA.productionCount / total) * 100 : 0;
  const trialPct = 100 - productionPct;

  return (
    <PageContainer>
      {/* ── Masthead ─────────────────────────────────────────────────── */}
      <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        {/* Left: kicker + heading + subtitle */}
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

        {/* Right: action cluster */}
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

      {/* ── Active stimuli card ───────────────────────────────────────── */}
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
            {STUB_ACTIVE_STIMULI}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground" style={{ color: "var(--ink-45)" }}>
            clips available in the active test set
          </p>
        </div>
      </div>

      {/* ── Two-column: sessions ledger + trial/production split ──────── */}
      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">

        {/* Recent sessions ledger */}
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

          {/* Sessions rows */}
          <div className="border-t border-border">
            {STUB_RECENT_SESSIONS.map((row, i) => (
              <div
                key={i}
                className="grid items-center gap-4 border-b border-border py-3 text-[12px]"
                style={{ gridTemplateColumns: "110px 1fr 90px 110px" }}
              >
                {/* ID */}
                <span
                  className="font-semibold tabular-nums text-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.id}
                </span>
                {/* Timestamp */}
                <span className="text-muted-foreground">{row.stamp}</span>
                {/* Clips */}
                <span
                  className="tabular-nums text-muted-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.clips}
                </span>
                {/* Status badge */}
                <div>
                  <StatusBadge kind={row.kind} status={row.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Stub notice */}
          <p className="mt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-60">
            Stub data · wiring pending
          </p>
        </div>

        {/* Trial vs Production split */}
        <div
          className="rounded-2xl border border-border px-6 py-5 shadow-[var(--shadow-card)]"
          style={{ background: "var(--card)" }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trial vs production · {STUB_SPLIT_DATA.window}
          </p>

          {/* Stacked bar */}
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-primary"
              style={{ width: `${productionPct.toFixed(1)}%` }}
            />
            <div
              style={{
                width: `${trialPct.toFixed(1)}%`,
                background: "var(--ubc-blue-300)",
              }}
            />
          </div>

          {/* Legend */}
          <div className="mt-4 flex justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: "var(--primary)" }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Production
                </span>
              </div>
              <p
                className="mt-1 font-bold tabular-nums text-foreground"
                style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}
              >
                {STUB_SPLIT_DATA.productionCount}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: "var(--ubc-blue-300)" }}
                />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Trial runs
                </span>
              </div>
              <p
                className="mt-1 font-bold tabular-nums text-foreground"
                style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }}
              >
                {STUB_SPLIT_DATA.trialCount}
              </p>
            </div>
          </div>

          {/* Stub notice */}
          <p className="mt-4 border-t border-border pt-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground opacity-60">
            Stub data · wiring pending
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
