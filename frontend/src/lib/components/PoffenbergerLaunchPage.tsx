"use client";

import { FlaskConical, Play, RotateCcw } from "lucide-react";
import PageContainer from "@/lib/components/PageContainer";
import CloudLoading from "@/lib/components/CloudLoading";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// ── Demographic option sets (platform start-session presets) ────────────────

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
export const POFFENBERGER_ORIGIN_OPTIONS = [
  "Home",
  "Work",
  "Class",
  "Library",
  "Gym/Recreation Center",
  "Other",
];
export const POFFENBERGER_COMMUTE_OPTIONS = [
  "Walk",
  "Transit",
  "Car",
  "Bike/Scooter",
  "Other",
];
export const POFFENBERGER_TIME_OUTSIDE_OPTIONS = [
  "Never (0-30 minutes)",
  "Rarely (31 minutes- 60 minutes)",
  "Sometimes (61 minutes - 90 minutes)",
  "Often (over 90 minutes)",
];

// ── Form model ──────────────────────────────────────────────────────────────

export interface PoffenbergerDemoForm {
  age_band: string;
  gender: string;
  origin: string;
  origin_other_text: string;
  commute_method: string;
  commute_method_other_text: string;
  time_outside: string;
}

export const EMPTY_POFFENBERGER_FORM: PoffenbergerDemoForm = {
  age_band: "",
  gender: "",
  origin: "",
  origin_other_text: "",
  commute_method: "",
  commute_method_other_text: "",
  time_outside: "",
};

/** True when every required demographic value is selected and any required other-text is filled. */
export function isPoffenbergerFormComplete(f: PoffenbergerDemoForm): boolean {
  if (!f.age_band || !f.gender || !f.origin || !f.commute_method || !f.time_outside) {
    return false;
  }
  if (f.origin === "Other" && !f.origin_other_text.trim()) return false;
  if (f.commute_method === "Other" && !f.commute_method_other_text.trim()) return false;
  return true;
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
}

/**
 * RA-facing IHTT Poffenberger launch surface. Quiet and operational: it collects
 * the platform-required anonymous start-session demographics, then exposes the
 * recorded Start action plus Short/Full no-write trial actions. No recent-session
 * ledger, metric cards, or analytics placeholders are rendered here.
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
}: PoffenbergerLaunchPageProps) {
  const busy = starting || shortTrialStarting || fullTrialStarting;
  const formComplete = isPoffenbergerFormComplete(form);
  const update = (patch: Partial<PoffenbergerDemoForm>) =>
    onFormChange({ ...form, ...patch });

  return (
    <PageContainer narrow>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            IHTT Study · Lab Operations
          </p>
          <h1 className="text-2xl font-bold text-foreground">Poffenberger Task</h1>
          <p className="text-sm text-muted-foreground">
            Select the required participant demographics, then start a recorded
            session or run a no-write trial. All fields are required before
            starting.
          </p>
        </div>

        <div
          className="rounded-2xl border border-border p-6"
          style={{ background: "var(--card)" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!formComplete || busy) return;
              onStart?.();
            }}
            className="flex flex-col gap-5"
          >
            {/* Age band */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="age_band" className="text-sm text-foreground">
                Age band
              </Label>
              <Select
                value={form.age_band}
                onValueChange={(v) => update({ age_band: v })}
                disabled={busy}
              >
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
              <Select
                value={form.gender}
                onValueChange={(v) => update({ gender: v })}
                disabled={busy}
              >
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

            {/* Origin */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="origin" className="text-sm text-foreground">
                Coming from
              </Label>
              <Select
                value={form.origin}
                onValueChange={(v) => update({ origin: v, origin_other_text: "" })}
                disabled={busy}
              >
                <SelectTrigger id="origin" className="border-border bg-input/30 focus:ring-ring">
                  <SelectValue placeholder="Select origin" />
                </SelectTrigger>
                <SelectContent>
                  {POFFENBERGER_ORIGIN_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.origin === "Other" && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <Input
                    id="origin_other_text"
                    value={form.origin_other_text}
                    onChange={(e) => update({ origin_other_text: e.target.value })}
                    placeholder="Describe origin (no names or personal details)"
                    disabled={busy}
                    className="border-border bg-input/30 focus-visible:ring-ring"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Do not enter names, initials, or any information that could
                    identify the participant.
                  </p>
                </div>
              )}
            </div>

            {/* Commute method */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commute_method" className="text-sm text-foreground">
                Commute method
              </Label>
              <Select
                value={form.commute_method}
                onValueChange={(v) =>
                  update({ commute_method: v, commute_method_other_text: "" })
                }
                disabled={busy}
              >
                <SelectTrigger
                  id="commute_method"
                  className="border-border bg-input/30 focus:ring-ring"
                >
                  <SelectValue placeholder="Select commute method" />
                </SelectTrigger>
                <SelectContent>
                  {POFFENBERGER_COMMUTE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.commute_method === "Other" && (
                <div className="mt-1 flex flex-col gap-1.5">
                  <Input
                    id="commute_method_other_text"
                    value={form.commute_method_other_text}
                    onChange={(e) =>
                      update({ commute_method_other_text: e.target.value })
                    }
                    placeholder="Describe commute method (no names or personal details)"
                    disabled={busy}
                    className="border-border bg-input/30 focus-visible:ring-ring"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Do not enter names, initials, or any information that could
                    identify the participant.
                  </p>
                </div>
              )}
            </div>

            {/* Time outside */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time_outside" className="text-sm text-foreground">
                Time spent outside today
              </Label>
              <Select
                value={form.time_outside}
                onValueChange={(v) => update({ time_outside: v })}
                disabled={busy}
              >
                <SelectTrigger
                  id="time_outside"
                  className="border-border bg-input/30 focus:ring-ring"
                >
                  <SelectValue placeholder="Select time outside" />
                </SelectTrigger>
                <SelectContent>
                  {POFFENBERGER_TIME_OUTSIDE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error banner */}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-1">
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
                    Start Poffenberger Session
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl px-6 font-semibold"
                disabled={!formComplete || busy}
                onClick={onStartShortTrial}
              >
                <FlaskConical className="mr-2 size-4" />
                {shortTrialStarting ? "Starting…" : "Run Short Trial"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl px-6 font-semibold"
                disabled={!formComplete || busy}
                onClick={onStartFullTrial}
              >
                <FlaskConical className="mr-2 size-4" />
                {fullTrialStarting ? "Starting…" : "Run Full Trial"}
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
              Trials use fake local-only run ids and do not create participant,
              session, Poffenberger run, trial, or completion records. Short Trial
              uses a shortened balanced manifest; Full Trial mirrors production
              length.
            </p>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
