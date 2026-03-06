"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SurveyItem {
  number: number;
  text: string;
}

export interface ScaleOption {
  value: number;
  label: string;
}

interface SurveyFormProps {
  title: string;
  /** Optional step context shown above the title, e.g. "Survey 1 of 4" */
  stepLabel?: string;
  instructions: string;
  items: SurveyItem[];
  scale: ScaleOption[];
  submitting: boolean;
  error: string | null;
  onSubmit: (responses: Record<string, number>) => void;
}

export default function SurveyForm({
  title,
  stepLabel,
  instructions,
  items,
  scale,
  submitting,
  error,
  onSubmit,
}: SurveyFormProps) {
  const [responses, setResponses] = useState<Record<number, number>>({});

  const progress = useMemo(() => {
    if (!stepLabel) return null;
    const match = stepLabel.match(/(\d+)\s+of\s+(\d+)/i);
    if (!match) return null;
    const current = Number(match[1]);
    const total = Number(match[2]);
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null;
    return {
      current,
      total,
      percent: Math.max(0, Math.min(100, Math.round((current / total) * 100))),
    };
  }, [stepLabel]);

  const allAnswered = items.every((item) => responses[item.number] !== undefined);
  const answeredCount = Object.keys(responses).length;

  const handleSelect = (itemNumber: number, value: number) => {
    setResponses((prev) => ({ ...prev, [itemNumber]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    const payload: Record<string, number> = {};
    items.forEach((item) => {
      payload[`r${item.number}`] = responses[item.number];
    });
    onSubmit(payload);
  };

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
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
        <div className="space-y-3">
          {stepLabel && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {stepLabel}
            </p>
          )}
          {progress && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-border/70">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress.percent}%`,
                    background: "linear-gradient(90deg, var(--ubc-blue-700), var(--ubc-blue-500))",
                  }}
                />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Step {progress.current} of {progress.total}
              </p>
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{instructions}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {items.map((item) => (
            <fieldset
              key={item.number}
              className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4"
            >
              <legend className="sr-only">
                {item.number}. {item.text}
              </legend>
              <p className="text-sm font-medium leading-snug text-foreground">
                {item.number}. {item.text}
              </p>
              <div className="flex flex-wrap gap-2">
                {scale.map((opt) => {
                  const selected = responses[item.number] === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/60",
                        selected
                          ? "border-transparent text-primary-foreground shadow-sm"
                          : "border-border bg-card/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
                      )}
                      style={
                        selected
                          ? {
                              background:
                                "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
                            }
                          : undefined
                      }
                    >
                      <input
                        type="radio"
                        name={`item-${item.number}`}
                        value={opt.value}
                        checked={selected}
                        onChange={() => handleSelect(item.number, opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {answeredCount}/{items.length} answered
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
