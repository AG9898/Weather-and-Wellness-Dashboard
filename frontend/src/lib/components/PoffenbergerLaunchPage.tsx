"use client";

import { useState } from "react";
import { FlaskConical, Play, RotateCcw } from "lucide-react";
import PageContainer from "@/lib/components/PageContainer";
import CloudLoading from "@/lib/components/CloudLoading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PoffenbergerDashboardResponse } from "@/lib/api/ihtt-poffenberger";

// ── Demographic option sets ─────────────────────────────────────────────────

export const POFFENBERGER_AGE_BAND_OPTIONS = [
  "Under 18",
  "18-24",
  "25-31",
  "32-38",
  ">38",
];
export const POFFENBERGER_GENDER_OPTIONS = [
  "Woman",
  "Man",
  "Non-binary",
  "Prefer not to say",
];
export const POFFENBERGER_HANDEDNESS_OPTIONS = [
  "Left-handed",
  "Right-handed",
  "Ambidextrous",
  "Prefer not to say",
];

// ── Form model ──────────────────────────────────────────────────────────────

export interface PoffenbergerDemoForm {
  age_band: string;
  gender: string;
  handedness: string;
}

export const EMPTY_POFFENBERGER_FORM: PoffenbergerDemoForm = {
  age_band: "",
  gender: "",
  handedness: "",
};

/** True when every required IHTT demographic value is selected. */
export function isPoffenbergerFormComplete(f: PoffenbergerDemoForm): boolean {
  return Boolean(f.age_band && f.gender && f.handedness);
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatParticipantNumber(value: number): string {
  return `P-${String(value).padStart(4, "0")}`;
}

function formatRelativeTime(value: string): string {
  const started = new Date(value);
  if (Number.isNaN(started.getTime())) {
    return "—";
  }

  const now = new Date();
  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 60000));

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24 && now.toDateString() === started.toDateString()) {
    return `${elapsedHours}h ${elapsedMinutes % 60}m ago`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (started.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${time}`;
  }

  return `${started.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} · ${time}`;
}

function formatDemographics(
  ...values: Array<string | null | undefined>
): string {
  const cleaned = values.map((v) => (v == null || v === "" ? "—" : v));
  return cleaned.join(" · ");
}

function formatMs(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(numeric)) return "—";
  return `${numeric.toFixed(1)} ms`;
}

// ── Demographics form (rendered inside the start dialog) ─────────────────────

interface DemographicsFieldsProps {
  form: PoffenbergerDemoForm;
  onFormChange: (next: PoffenbergerDemoForm) => void;
  busy: boolean;
}

function DemographicsFields({ form, onFormChange, busy }: DemographicsFieldsProps) {
  const update = (patch: Partial<PoffenbergerDemoForm>) =>
    onFormChange({ ...form, ...patch });

  return (
    <>
      {/* Age band */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="age_band" className="text-sm text-foreground">
          Age band
        </Label>
        <Select value={form.age_band} onValueChange={(v) => update({ age_band: v })} disabled={busy}>
          <SelectTrigger id="age_band" className="border-border bg-input/30 focus:ring-ring">
            <SelectValue placeholder="Select age band" />
          </SelectTrigger>
          <SelectContent>
            {POFFENBERGER_AGE_BAND_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Gender */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gender" className="text-sm text-foreground">
          Gender
        </Label>
        <Select value={form.gender} onValueChange={(v) => update({ gender: v })} disabled={busy}>
          <SelectTrigger id="gender" className="border-border bg-input/30 focus:ring-ring">
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            {POFFENBERGER_GENDER_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Handedness */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="handedness" className="text-sm text-foreground">
          Handedness
        </Label>
        <Select
          value={form.handedness}
          onValueChange={(v) => update({ handedness: v })}
          disabled={busy}
        >
          <SelectTrigger id="handedness" className="border-border bg-input/30 focus:ring-ring">
            <SelectValue placeholder="Select handedness" />
          </SelectTrigger>
          <SelectContent>
            {POFFENBERGER_HANDEDNESS_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

interface PoffenbergerLaunchPageProps {
  form: PoffenbergerDemoForm;
  onFormChange: (next: PoffenbergerDemoForm) => void;
  starting?: boolean;
  shortTrialStarting?: boolean;
  fullTrialStarting?: boolean;
  error?: string | null;
  onStart?: () => void;
  onStartShortTrial?: () => void;
  onStartFullTrial?: () => void;
  dashboard?: PoffenbergerDashboardResponse | null;
  dashboardLoading?: boolean;
  dashboardError?: string | null;
}

/**
 * RA-facing IHTT Poffenberger operations dashboard. The front surface mirrors the
 * misokinesia board: a header with launch actions, a headline metric, and a recent
 * recorded-run ledger. IHTT demographics are collected in a
 * dialog opened by "Start Poffenberger Session"; the no-write Short/Full trials
 * launch directly (they create no records, so no demographics are required).
 */
export default function PoffenbergerLaunchPage({
  form,
  onFormChange,
  starting = false,
  shortTrialStarting = false,
  fullTrialStarting = false,
  error = null,
  onStart,
  onStartShortTrial,
  onStartFullTrial,
  dashboard = null,
  dashboardLoading = false,
  dashboardError = null,
}: PoffenbergerLaunchPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const busy = starting || shortTrialStarting || fullTrialStarting;
  const formComplete = isPoffenbergerFormComplete(form);

  const recentRuns = dashboard?.recent_runs ?? [];
  const totalRuns = dashboard?.total_runs ?? 0;
  const completedRuns = dashboard?.completed_runs ?? 0;
  const inProgressRuns = Math.max(0, totalRuns - completedRuns);

  return (
    <PageContainer>
      <div className="mb-9 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[540px] space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            IHTT Study · Lab Operations
          </p>
          <h1
            className="text-[30px] font-bold leading-[1.15] text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            Poffenberger Task
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Launch a recorded participant session, run a no-write rehearsal trial, or
            review recent activity for this lab module.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 lg:items-end">
          <Button
            size="lg"
            disabled={busy}
            onClick={() => setDialogOpen(true)}
            className="h-11 rounded-xl px-[22px] font-semibold text-primary-foreground"
          >
            <Play className="mr-2 size-4" />
            {starting ? "Starting…" : "Start Poffenberger Session"}
          </Button>

          <div className="flex gap-2">
            <Button
              size="default"
              variant="outline"
              disabled={busy}
              onClick={onStartShortTrial}
              className="h-9 rounded-xl px-4 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              {shortTrialStarting ? "Starting…" : "Short Trial"}
            </Button>
            <Button
              size="default"
              variant="outline"
              disabled={busy}
              onClick={onStartFullTrial}
              className="h-9 rounded-xl px-4 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              {fullTrialStarting ? "Starting…" : "Full Trial"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Trials use fake ids · no data is written
          </p>

          {error && !dialogOpen && (
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
        <div className="border-l-2 pl-5" style={{ borderColor: "var(--primary)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Completed runs
          </p>
          <p
            className="mt-1.5 font-bold tabular-nums text-foreground"
            style={{ fontSize: 30, letterSpacing: "-0.02em" }}
          >
            {dashboardLoading ? "Loading" : completedRuns}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground" style={{ color: "var(--ink-45)" }}>
            of {dashboardLoading ? "—" : totalRuns} recorded runs
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        <div
          className="rounded-2xl border border-border px-6 py-5 shadow-[var(--shadow-card)]"
          style={{ background: "var(--card)" }}
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recent runs
          </p>

          <div className="border-t border-border">
            {dashboardLoading ? (
              <p className="py-6 text-[12px] text-muted-foreground">Loading recent runs…</p>
            ) : recentRuns.length === 0 ? (
              <p className="py-6 text-[12px] text-muted-foreground">No runs yet.</p>
            ) : (
              recentRuns.map((row) => (
                <div
                  key={`${row.participant_number}-${row.started_at}`}
                  className="grid grid-cols-[minmax(72px,0.9fr)_minmax(95px,1fr)] items-center gap-x-4 gap-y-1 border-b border-border py-3 text-[12px] sm:grid-cols-[80px_minmax(110px,1fr)_minmax(150px,1.45fr)_90px]"
                >
                  <span
                    className="font-semibold tabular-nums text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatParticipantNumber(row.participant_number)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatRelativeTime(row.started_at)}
                  </span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {formatDemographics(row.age_band, row.gender, row.handedness)}
                  </span>
                  <span
                    className="tabular-nums text-muted-foreground sm:text-right"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {row.is_complete ? formatMs(row.ihtt_difference_ms) : "In progress"}
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
            Run summary
          </p>

          <div className="space-y-3 border-t border-border pt-4 text-[12px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-semibold tabular-nums text-foreground">
                {dashboardLoading ? "—" : completedRuns}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">In progress</span>
              <span className="font-semibold tabular-nums text-foreground">
                {dashboardLoading ? "—" : inProgressRuns}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Avg IHTT difference</span>
              <span className="font-semibold tabular-nums text-foreground">
                {dashboardLoading ? "—" : formatMs(dashboard?.avg_ihtt_difference_ms)}
              </span>
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            IHTT difference is the crossed minus uncrossed mean reaction time, averaged
            across completed runs.
          </p>
        </div>
      </div>

      {/* Start-session demographics dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !busy && setDialogOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Start Poffenberger session</DialogTitle>
            <DialogDescription>
              Select the IHTT participant demographics, then start the recorded
              session. All fields are required.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formComplete || busy) return;
              onStart?.();
            }}
            className="flex flex-col gap-5"
          >
            <DemographicsFields form={form} onFormChange={onFormChange} busy={busy} />

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                type="submit"
                size="lg"
                className="rounded-xl px-6 font-semibold text-primary-foreground"
                disabled={!formComplete || busy}
              >
                {starting ? (
                  <>
                    <CloudLoading size="sm" className="mr-1.5" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Play className="mr-2 size-4" />
                    Start Session
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-xl px-6 font-semibold"
                disabled={busy}
                onClick={() => onFormChange(EMPTY_POFFENBERGER_FORM)}
              >
                <RotateCcw className="mr-2 size-4" />
                Reset
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Demographics are stored on the participant record only. Do not enter
              names, initials, or any information that could identify the participant.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
