"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EditorialKicker,
} from "@/lib/components/EditorialPrimitives";

interface MisokinesiaGAD7FormProps {
  onSubmit: (answers: Record<string, number>) => void;
  submitting: boolean;
  error: string | null;
}

const GAD7_ITEMS = [
  { key: "r1", text: "Feeling nervous, anxious, or on edge" },
  { key: "r2", text: "Not being able to stop or control worrying" },
  { key: "r3", text: "Worrying too much about different things" },
  { key: "r4", text: "Trouble relaxing" },
  { key: "r5", text: "Being so restless that it is hard to sit still" },
  { key: "r6", text: "Becoming easily annoyed or irritable" },
  { key: "r7", text: "Feeling afraid, as if something awful might happen" },
] as const;

const GAD7_SCALE = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
] as const;

export default function MisokinesiaGAD7Form({
  onSubmit,
  submitting,
  error,
}: MisokinesiaGAD7FormProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const answeredCount = Object.keys(answers).length;
  const allAnswered = GAD7_ITEMS.every((item) => answers[item.key] !== undefined);

  const handleSelect = (key: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    onSubmit({ ...answers });
  };

  return (
    <div className="mx-auto max-w-[760px] px-8 py-14">
      {/* Header: instrument label — hairline */}
      <div className="mb-7 flex items-center gap-3">
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          GAD-7 · Anxiety Assessment
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {/* Kicker + heading + scale legend */}
      <EditorialKicker className="mb-2.5">
        Items 1–7 of 7
      </EditorialKicker>
      <h2 className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
        How often have you been bothered by these problems?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        1&nbsp;&bull;&nbsp;Never&nbsp;&nbsp;&bull;&nbsp;&nbsp;2&nbsp;&bull;&nbsp;Rarely&nbsp;&nbsp;&bull;&nbsp;&nbsp;3&nbsp;&bull;&nbsp;Sometimes&nbsp;&nbsp;&bull;&nbsp;&nbsp;4&nbsp;&bull;&nbsp;Often
      </p>

      {/* Error banner */}
      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Item rows */}
      <form onSubmit={handleSubmit}>
        <div className="mt-7 flex flex-col gap-3">
          {GAD7_ITEMS.map((item, idx) => {
            const selected = answers[item.key];
            return (
              <fieldset
                key={item.key}
                className="rounded-[14px] border border-border px-[18px] py-[14px]"
                style={{ background: "var(--fieldset-bg)" }}
                disabled={submitting}
              >
                <legend className="sr-only">
                  {idx + 1}. {item.text}
                </legend>
                <div className="grid items-center gap-4" style={{ gridTemplateColumns: "32px 1fr auto" }}>
                  {/* Item number */}
                  <span
                    className="self-start mt-1 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    aria-hidden
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  {/* Statement */}
                  <p className="text-[14px] font-medium leading-[1.45] text-foreground">
                    {item.text}
                  </p>
                  {/* Scale chips */}
                  <div className="flex gap-1.5" role="radiogroup" aria-label={item.text}>
                    {GAD7_SCALE.map((opt) => {
                      const isSelected = selected === opt.value;
                      return (
                        <label
                          key={opt.value}
                          title={opt.label}
                          className={cn(
                            "flex min-w-[40px] cursor-pointer items-center justify-center rounded-[10px] border px-2.5 py-2 text-xs font-semibold transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring/60",
                            isSelected
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-ring/40 hover:text-foreground",
                            submitting && "pointer-events-none opacity-50"
                          )}
                        >
                          <input
                            type="radio"
                            name={`gad7-${item.key}`}
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => handleSelect(item.key, opt.value)}
                            className="sr-only"
                          />
                          {opt.value}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <span className="font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {answeredCount}/{GAD7_ITEMS.length} answered
          </span>
          <Button
            type="submit"
            disabled={!allAnswered || submitting}
            className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
