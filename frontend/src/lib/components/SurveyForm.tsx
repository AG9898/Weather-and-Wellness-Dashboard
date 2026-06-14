"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EditorialFieldset,
  EditorialTaskHeader,
  EditorialTaskPanel,
  EditorialTaskShell,
} from "@/lib/components/EditorialPrimitives";
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
  const stepTag = progress
    ? `${String(progress.current).padStart(2, "0")} / ${String(progress.total).padStart(2, "0")}`
    : undefined;

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
    <EditorialTaskShell>
      <EditorialTaskPanel className="space-y-7">
        <EditorialTaskHeader
          stepTag={stepTag}
          breadcrumb="Weather Wellness"
          kicker={stepLabel ?? "Survey"}
          title={title}
          description={instructions}
          progress={{
            current: answeredCount,
            total: items.length,
            label: `${answeredCount} of ${items.length} answered`,
            hidePercent: true,
          }}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          {items.map((item) => (
            <EditorialFieldset
              key={item.number}
              legend={`${item.number}. ${item.text}`}
              disabled={submitting}
              className="space-y-3"
            >
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
                        "cursor-pointer rounded-[10px] border px-3 py-2 text-sm font-medium leading-tight transition-colors focus-within:ring-2 focus-within:ring-ring/60",
                        selected
                          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-card/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
                      )}
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
            </EditorialFieldset>
          ))}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {answeredCount}/{items.length} answered
            </p>
            <Button
              type="submit"
              disabled={!allAnswered || submitting}
              className="min-w-36 rounded-xl px-6 text-primary-foreground"
            >
              {submitting ? "Submitting…" : "Continue"}
            </Button>
          </div>
        </form>
      </EditorialTaskPanel>
    </EditorialTaskShell>
  );
}
