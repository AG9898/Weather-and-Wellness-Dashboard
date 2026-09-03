"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  submitMisokinesiaTrialResponse,
  type MisokinesiaTrialResponseResult,
} from "@/lib/api";
import {
  getMisokinesiaSubmitMode,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";
import {
  DEFAULT_MISO_LOCALE,
  misoMessage,
  type MisoLocale,
  type MisoMessageKey,
} from "@/lib/i18n";

interface MisokinesiaQuestionnaireProps {
  misokinesiaParticipantId: string;
  stimulusId: string;
  displayOrder: number;
  clipNumber: number;
  totalClips: number;
  trialMode?: boolean;
  isFinalClip?: boolean;
  /** Session locale. Fixed for the session; selects labels only. */
  locale?: MisoLocale;
  onComplete: (result: MisokinesiaTrialResponseResult) => void;
}

type VmaItemKey = "q1" | "q2" | "q3" | "q4";

// Item order and submitted field names are language-independent; only the
// display text resolves per locale (LOCALIZATION.md section 5.1).
const QUESTIONS: { key: VmaItemKey; textKey: MisoMessageKey }[] = [
  { key: "q1", textKey: "vma.item.q1" },
  { key: "q2", textKey: "vma.item.q2" },
  { key: "q3", textKey: "vma.item.q3" },
  { key: "q4", textKey: "vma.item.q4" },
];

// The submitted value is the numeric point, identical across locales.
const SCALE: { value: number; labelKey: MisoMessageKey }[] = [
  { value: 1, labelKey: "vma.scale.1" },
  { value: 2, labelKey: "vma.scale.2" },
  { value: 3, labelKey: "vma.scale.3" },
  { value: 4, labelKey: "vma.scale.4" },
  { value: 5, labelKey: "vma.scale.5" },
];

export default function MisokinesiaQuestionnaire({
  misokinesiaParticipantId,
  stimulusId,
  displayOrder,
  clipNumber,
  totalClips,
  trialMode = false,
  isFinalClip = false,
  locale = DEFAULT_MISO_LOCALE,
  onComplete,
}: MisokinesiaQuestionnaireProps) {
  const [responses, setResponses] = useState<Partial<Record<VmaItemKey, number>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered =
    responses.q1 !== undefined &&
    responses.q2 !== undefined &&
    responses.q3 !== undefined &&
    responses.q4 !== undefined;

  const answeredCount = Object.keys(responses).length;

  // Progress strip values
  const progressPct = totalClips > 0 ? Math.round((clipNumber / totalClips) * 100) : 0;

  const handleSelect = (key: VmaItemKey, value: number) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await runTrialAwareSubmit(getMisokinesiaSubmitMode(trialMode), {
        trial: () => {
          onComplete({
            response_id: `trial-local-misokinesia-response-${displayOrder}`,
            is_complete: isFinalClip,
            session_id: `trial-local-misokinesia-session`,
          });
        },
        production: async () => {
          const result = await submitMisokinesiaTrialResponse(misokinesiaParticipantId, {
            stimulus_id: stimulusId,
            display_order: displayOrder,
            q1: responses.q1!,
            q2: responses.q2!,
            q3: responses.q3!,
            q4: responses.q4!,
          });
          onComplete(result);
        },
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : misoMessage("chrome.error.submit_failed", locale)
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-8 py-14">
      {/* Progress strip */}
      <div className="mb-7 flex items-center gap-4">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          {misoMessage("chrome.clip.progress", locale, {
            n: clipNumber,
            m: totalClips,
          })}
        </span>
        <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {misoMessage("chrome.clip.progress_percent", locale, { pct: progressPct })}
        </span>
      </div>

      {/* Kicker + heading + body */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {misoMessage("chrome.clip.kicker", locale)}
      </p>
      <h2 className="mt-2.5 text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
        {misoMessage("chrome.clip.heading", locale)}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {misoMessage("chrome.clip.help", locale)}
      </p>

      <form onSubmit={handleSubmit}>
        {/* Question fieldsets */}
        <div className="mt-8 flex flex-col gap-3.5">
          {QUESTIONS.map((q, idx) => {
            const selected = responses[q.key];
            const text = misoMessage(q.textKey, locale);
            return (
              <fieldset
                key={q.key}
                className="rounded-[14px] border border-border px-4 py-3.5"
                style={{ background: "var(--fieldset-bg)" }}
              >
                <legend className="sr-only">
                  {misoMessage("chrome.clip.legend", locale, { n: idx + 1, text })}
                </legend>
                {/* Question label row */}
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="min-w-[24px] shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {misoMessage("chrome.clip.item_number", locale, { n: idx + 1 })}
                  </span>
                  <span className="text-[14px] font-medium leading-[1.45] text-foreground">
                    {text}
                  </span>
                </div>
                {/* Scale chips row */}
                <div className="flex flex-wrap gap-2 pl-9">
                  {SCALE.map((opt) => {
                    const isSelected = selected === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex cursor-pointer flex-col items-center gap-0.5 rounded-[10px] border px-3 py-2 transition-colors duration-150",
                          "min-w-[64px] focus-within:ring-2 focus-within:ring-ring/50",
                          isSelected
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground"
                        )}
                      >
                        <input
                          type="radio"
                          name={`misoq-${q.key}`}
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => handleSelect(q.key, opt.value)}
                          className="sr-only"
                        />
                        <span className="text-[13px] font-semibold leading-none">{opt.value}</span>
                        <span
                          className="text-[10px] leading-none"
                          style={{ opacity: 0.8, letterSpacing: 0, textTransform: "none" }}
                        >
                          {misoMessage(opt.labelKey, locale)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {misoMessage("chrome.form.answered_count", locale, {
              n: answeredCount,
              m: QUESTIONS.length,
            })}
          </span>
          <Button
            type="submit"
            disabled={!allAnswered || submitting}
            className="h-11 min-w-[160px] rounded-xl px-[22px] text-sm text-primary-foreground"
          >
            {submitting
              ? misoMessage("chrome.state.submitting", locale)
              : misoMessage("chrome.button.continue_arrow", locale)}
          </Button>
        </div>
      </form>
    </div>
  );
}
