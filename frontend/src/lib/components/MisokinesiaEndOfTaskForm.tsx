"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  submitMisokinesiaEndOfTask,
  type MisokinesiaEndOfTaskPayload,
} from "@/lib/api";

interface MisokinesiaEndOfTaskFormProps {
  misokinesiaParticipantId: string;
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
      await submitMisokinesiaEndOfTask(misokinesiaParticipantId, payload);
      onComplete();
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
            Final questions
          </p>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            A few last questions
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            All fields are optional — answer as many as you like.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Q1 — Fidgeting stimuli */}
          <div className="space-y-2 rounded-2xl border border-border/80 bg-background/55 p-4">
            <label
              htmlFor="fidgeting-text"
              className="text-sm font-medium leading-snug text-foreground"
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
              className="w-full resize-none rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          {/* Q2 — Emotional responses */}
          <div className="space-y-2 rounded-2xl border border-border/80 bg-background/55 p-4">
            <label
              htmlFor="emotions-text"
              className="text-sm font-medium leading-snug text-foreground"
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
              className="w-full resize-none rounded-xl border border-border bg-card/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>

          {/* Q3 — Stronger responses binary */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
            <p className="text-sm font-medium leading-snug text-foreground">
              Did viewing the videos create stronger responses over time?
            </p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "No", value: false },
                { label: "Yes", value: true },
              ].map((opt) => {
                const isSelected = strongerResponses === opt.value;
                return (
                  <label
                    key={opt.label}
                    className={cn(
                      "cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/60",
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
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  When did the responses feel stronger?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TIMING_OPTIONS.map((opt) => {
                    const isSelected = strongerResponsesTiming === opt;
                    return (
                      <label
                        key={opt}
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

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="min-w-36 rounded-xl px-6 text-primary-foreground"
              style={{
                background: "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
              }}
            >
              {submitting ? "Submitting…" : "Finish"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
