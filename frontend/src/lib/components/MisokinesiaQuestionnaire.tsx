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

interface MisokinesiaQuestionnaireProps {
  misokinesiaParticipantId: string;
  stimulusId: string;
  displayOrder: number;
  clipNumber: number;
  totalClips: number;
  trialMode?: boolean;
  isFinalClip?: boolean;
  onComplete: (result: MisokinesiaTrialResponseResult) => void;
}

const QUESTIONS = [
  { key: "q1" as const, text: "I find this video unpleasant" },
  { key: "q2" as const, text: "I felt physical discomfort during the video" },
  { key: "q3" as const, text: "I felt upset during the video" },
  { key: "q4" as const, text: "I wanted to stop the video early / or close my eyes" },
];

const SCALE = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
];

export default function MisokinesiaQuestionnaire({
  misokinesiaParticipantId,
  stimulusId,
  displayOrder,
  clipNumber,
  totalClips,
  trialMode = false,
  isFinalClip = false,
  onComplete,
}: MisokinesiaQuestionnaireProps) {
  const [responses, setResponses] = useState<Partial<Record<"q1" | "q2" | "q3" | "q4", number>>>({});
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

  const handleSelect = (key: "q1" | "q2" | "q3" | "q4", value: number) => {
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
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-8 py-14">
      {/* Progress strip */}
      <div className="mb-7 flex items-center gap-4">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          Clip {clipNumber} of {totalClips}
        </span>
        <div className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {progressPct}%
        </span>
      </div>

      {/* Kicker + heading + body */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Post-clip · 4 questions
      </p>
      <h2 className="mt-2.5 text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
        How did you feel about that clip?
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree). There are no right answers.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Question fieldsets */}
        <div className="mt-8 flex flex-col gap-3.5">
          {QUESTIONS.map((q, idx) => {
            const selected = responses[q.key];
            return (
              <fieldset
                key={q.key}
                className="rounded-[14px] border border-border px-4 py-3.5"
                style={{ background: "var(--fieldset-bg)" }}
              >
                <legend className="sr-only">
                  Q{idx + 1}: {q.text}
                </legend>
                {/* Question label row */}
                <div className="mb-3 flex items-baseline gap-3">
                  <span className="min-w-[24px] shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    Q{idx + 1}
                  </span>
                  <span className="text-[14px] font-medium leading-[1.45] text-foreground">
                    {q.text}
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
                          {opt.label}
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
            {answeredCount}/{QUESTIONS.length} answered
          </span>
          <Button
            type="submit"
            disabled={!allAnswered || submitting}
            className="h-11 min-w-[160px] rounded-xl px-[22px] text-sm text-primary-foreground"
          >
            {submitting ? "Submitting…" : "Continue →"}
          </Button>
        </div>
      </form>
    </div>
  );
}
