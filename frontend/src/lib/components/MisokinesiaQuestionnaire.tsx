"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  submitMisokinesiaTrialResponse,
  type MisokinesiaTrialResponseResult,
} from "@/lib/api";

interface MisokinesiaQuestionnaireProps {
  misokinesiaParticipantId: string;
  stimulusId: string;
  displayOrder: number;
  onComplete: (result: MisokinesiaTrialResponseResult) => void;
}

const QUESTIONS = [
  { key: "q1" as const, text: "I find this video unpleasant" },
  { key: "q2" as const, text: "I felt physical discomfort during the video" },
  { key: "q3" as const, text: "I felt upset during the video" },
  { key: "q4" as const, text: "I wanted to stop the video early / or close my eyes" },
];

const SCALE = [
  { value: 1, label: "1 — Strongly Disagree" },
  { value: 2, label: "2 — Disagree" },
  { value: 3, label: "3 — Neutral" },
  { value: 4, label: "4 — Agree" },
  { value: 5, label: "5 — Strongly Agree" },
];

export default function MisokinesiaQuestionnaire({
  misokinesiaParticipantId,
  stimulusId,
  displayOrder,
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

  const handleSelect = (key: "q1" | "q2" | "q3" | "q4", value: number) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitMisokinesiaTrialResponse(misokinesiaParticipantId, {
        stimulus_id: stimulusId,
        display_order: displayOrder,
        q1: responses.q1!,
        q2: responses.q2!,
        q3: responses.q3!,
        q4: responses.q4!,
      });
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute left-0 top-6 h-44 w-44 rounded-full opacity-35 blur-3xl"
        style={{ background: "var(--ubc-blue-300)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--ubc-blue-500)" }}
      />

      <div
        className="relative space-y-6 rounded-[1.6rem] border border-border/90 p-5 shadow-[0_30px_60px_-52px_rgb(0_19_40/0.7)] sm:p-8"
        style={{ background: "var(--card)" }}
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Per-clip questions
          </p>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            How did you feel about that clip?
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {QUESTIONS.map((q, idx) => {
            const selected = responses[q.key];
            return (
              <fieldset
                key={q.key}
                className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4"
              >
                <legend className="sr-only">
                  {idx + 1}. {q.text}
                </legend>
                <p className="text-sm font-medium leading-snug text-foreground">
                  {idx + 1}. {q.text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SCALE.map((opt) => {
                    const isSelected = selected === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/60",
                          isSelected
                            ? "border-transparent text-primary-foreground shadow-sm"
                            : "border-border bg-card/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
                        )}
                        style={
                          isSelected
                            ? {
                                background:
                                  "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
                              }
                            : undefined
                        }
                      >
                        <input
                          type="radio"
                          name={`misoq-${q.key}`}
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => handleSelect(q.key, opt.value)}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {answeredCount}/{QUESTIONS.length} answered
            </p>
            <Button
              type="submit"
              disabled={!allAnswered || submitting}
              className="min-w-36 rounded-xl px-6 text-primary-foreground"
              style={{
                background: "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
              }}
            >
              {submitting ? "Submitting…" : "Continue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
