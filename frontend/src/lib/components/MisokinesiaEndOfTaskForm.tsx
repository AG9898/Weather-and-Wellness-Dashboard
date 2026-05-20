"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  submitMisokinesiaEndOfTask,
  type MisokinesiaEndOfTaskPayload,
} from "@/lib/api";
import {
  getMisokinesiaSubmitMode,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";

interface MisokinesiaEndOfTaskFormProps {
  misokinesiaParticipantId: string;
  trialMode?: boolean;
  onComplete: () => void;
}

const TIMING_OPTIONS = [
  "Immediately",
  "After 5 seconds",
  "After 10 seconds",
  "At the end of the video",
];

export default function MisokinesiaEndOfTaskForm({
  misokinesiaParticipantId,
  trialMode = false,
  onComplete,
}: MisokinesiaEndOfTaskFormProps) {
  const [fidgetingText, setFidgetingText] = useState("");
  const [emotionsText, setEmotionsText] = useState("");
  const [strongerResponses, setStrongerResponses] = useState<boolean | undefined>(undefined);
  const [strongerResponsesTiming, setStrongerResponsesTiming] = useState<string | undefined>(
    undefined
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const payload: MisokinesiaEndOfTaskPayload = {};
    if (fidgetingText.trim()) payload.end_fidgeting_text = fidgetingText.trim();
    if (emotionsText.trim()) payload.end_emotions_text = emotionsText.trim();
    if (strongerResponses !== undefined) {
      payload.stronger_responses = strongerResponses;
      if (strongerResponses && strongerResponsesTiming) {
        payload.stronger_responses_timing = strongerResponsesTiming;
      }
    }

    try {
      await runTrialAwareSubmit(getMisokinesiaSubmitMode(trialMode), {
        trial: () => {
          onComplete();
        },
        production: async () => {
          await submitMisokinesiaEndOfTask(misokinesiaParticipantId, payload);
          onComplete();
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[760px] px-4 py-8">
      {/* Step indicator */}
      <div className="mb-9 flex items-center gap-3">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          04 / 04
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Demographics → Intro → Task → Surveys
        </span>
      </div>

      <div
        className="rounded-2xl border border-border px-8 py-8 sm:px-11 sm:py-10"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          End of task
        </p>
        <h2 className="mt-3 text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
          A few last questions
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          All fields are optional — answer as many as you like.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-3">
          {/* Q1 — Fidgeting stimuli */}
          <div
            className="space-y-3 rounded-[14px] border border-border p-4"
            style={{ background: "var(--fieldset-bg)" }}
          >
            <label
              htmlFor="fidgeting-text"
              className="block text-[14px] font-medium leading-snug text-foreground"
            >
              Please list any fidgeting stimuli that you are bothered by that did not show up in
              the task.
            </label>
            <textarea
              id="fidgeting-text"
              value={fidgetingText}
              onChange={(e) => setFidgetingText(e.target.value)}
              rows={3}
              placeholder="Optional — leave blank if none"
              className="w-full resize-none rounded-[10px] border border-border bg-background px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          {/* Q2 — Emotional responses */}
          <div
            className="space-y-3 rounded-[14px] border border-border p-4"
            style={{ background: "var(--fieldset-bg)" }}
          >
            <label
              htmlFor="emotions-text"
              className="block text-[14px] font-medium leading-snug text-foreground"
            >
              Please list any emotional responses that you felt during the videos that were not
              asked in the questionnaire.
            </label>
            <textarea
              id="emotions-text"
              value={emotionsText}
              onChange={(e) => setEmotionsText(e.target.value)}
              rows={3}
              placeholder="Optional — leave blank if none"
              className="w-full resize-none rounded-[10px] border border-border bg-background px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          {/* Q3 — Stronger responses binary */}
          <div
            className="space-y-3 rounded-[14px] border border-border p-4"
            style={{ background: "var(--fieldset-bg)" }}
          >
            <p className="text-[14px] font-medium leading-snug text-foreground">
              Did viewing the videos create stronger responses over time?
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "No", value: false },
                { label: "Yes", value: true },
              ].map((opt) => {
                const isSelected = strongerResponses === opt.value;
                return (
                  <label
                    key={opt.label}
                    className={cn(
                      "cursor-pointer rounded-[10px] border px-4 py-2 text-[12px] font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/60",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-ring/60 hover:text-foreground"
                    )}
                  >
                    <input
                      type="radio"
                      name="stronger-responses"
                      value={String(opt.value)}
                      checked={isSelected}
                      onChange={() => {
                        setStrongerResponses(opt.value);
                        if (!opt.value) setStrongerResponsesTiming(undefined);
                      }}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>

            {/* Conditional timing options — only shown when stronger_responses is Yes */}
            {strongerResponses === true && (
              <div className="mt-2 space-y-2 border-t border-border pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  When did the responses feel stronger?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIMING_OPTIONS.map((opt) => {
                    const isSelected = strongerResponsesTiming === opt;
                    return (
                      <label
                        key={opt}
                        className={cn(
                          "cursor-pointer rounded-[10px] border px-3.5 py-2 text-[12px] font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/60",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-ring/60 hover:text-foreground"
                        )}
                      >
                        <input
                          type="radio"
                          name="stronger-responses-timing"
                          value={opt}
                          checked={isSelected}
                          onChange={() => setStrongerResponsesTiming(opt)}
                          className="sr-only"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-3">
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 min-w-[160px] rounded-xl px-[22px] text-sm text-primary-foreground"
            >
              {submitting ? "Submitting…" : "Finish →"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
