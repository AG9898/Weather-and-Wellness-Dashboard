"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MAQItem {
  id: string;
  text: string;
}

interface MisokinesiaMAQFormProps {
  onSubmit: (answers: Record<string, number>) => void;
  submitting: boolean;
  error: string | null;
  itemCount?: number;
}

export const MAQ_ITEMS: MAQItem[] = [
  { id: "q1", text: "My sound issues currently make me unhappy." },
  { id: "q2", text: "My sound issues currently create problems for me." },
  { id: "q3", text: "My sound issues have recently made me feel angry." },
  { id: "q4", text: "I feel that no one understands my problems with certain sounds." },
  { id: "q5", text: "My sound issues do not seem to have a known cause." },
  { id: "q6", text: "My sound issues currently make me feel helpless." },
  { id: "q7", text: "My sound issues currently interfere with my social life." },
  { id: "q8", text: "My sound issues currently make me feel isolated." },
  { id: "q9", text: "My sound issues have recently created problems for me in groups." },
  {
    id: "q10",
    text: "My sound issues negatively affect my work/school life (currently or recently).",
  },
  { id: "q11", text: "My sound issues currently make me feel frustrated." },
  { id: "q12", text: "My sound issues currently impact my entire life negatively." },
  { id: "q13", text: "My sound issues have recently made me feel guilty." },
  { id: "q14", text: "My sound issues are classified as 'crazy'." },
  { id: "q15", text: "I feel that no one can help me with my sound issues." },
  { id: "q16", text: "My sound issues currently make me feel hopeless." },
  { id: "q17", text: "I feel that my sound issues will only get worse with time." },
  { id: "q18", text: "My sound issues currently impact my family relationships." },
  {
    id: "q19",
    text: "My sound issues have recently affected my ability to be with other people.",
  },
  { id: "q20", text: "My sound issues have not been recognized as legitimate." },
  { id: "q21", text: "I am worried that my whole life will be affected by sound issues." },
];

const MAQ_SCALE = [
  { value: 0, label: "0 - Not at all" },
  { value: 1, label: "1 - A little of the time" },
  { value: 2, label: "2 - A good deal of the time" },
  { value: 3, label: "3 - Almost all the time" },
] as const;

export function buildMaqPanes<T>(items: T[], itemCount = items.length): T[][] {
  const visibleItems = items.slice(0, itemCount);
  const paneSize = itemCount <= 10 ? 5 : 7;
  const panes: T[][] = [];

  for (let start = 0; start < visibleItems.length; start += paneSize) {
    panes.push(visibleItems.slice(start, start + paneSize));
  }

  return panes;
}

export default function MisokinesiaMAQForm({
  onSubmit,
  submitting,
  error,
  itemCount = 21,
}: MisokinesiaMAQFormProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [paneIndex, setPaneIndex] = useState(0);

  const items = useMemo(() => MAQ_ITEMS.slice(0, itemCount), [itemCount]);
  const panes = useMemo(() => buildMaqPanes(MAQ_ITEMS, itemCount), [itemCount]);
  const currentPane = panes[paneIndex] ?? [];
  const isFirstPane = paneIndex === 0;
  const isLastPane = paneIndex === panes.length - 1;

  const currentPaneComplete = currentPane.every(
    (item) => answers[item.id] !== undefined
  );
  const allAnswered = items.every((item) => answers[item.id] !== undefined);
  const answeredCount = items.filter((item) => answers[item.id] !== undefined).length;

  const handleSelect = (id: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleNext = () => {
    if (!currentPaneComplete) return;
    setPaneIndex((i) => Math.min(i + 1, panes.length - 1));
  };

  const handlePrevious = () => {
    setPaneIndex((i) => Math.max(0, i - 1));
  };

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!allAnswered || submitting) return;
    onSubmit({ ...answers });
  };

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div
        className="pointer-events-none absolute left-0 top-6 h-44 w-44 rounded-full opacity-35 blur-3xl"
        style={{ background: "color-mix(in srgb, var(--ring) 72%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full opacity-20 blur-3xl"
        style={{ background: "color-mix(in srgb, var(--primary) 68%, transparent)" }}
      />

      <div
        className="relative space-y-6 rounded-[1.6rem] border border-border/90 p-5 shadow-[0_30px_60px_-52px_rgb(0_19_40/0.7)] sm:p-8"
        style={{ background: "var(--card)" }}
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Assessment questionnaire - Part {paneIndex + 1} of {panes.length}
          </p>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            Please rate each statement
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            0 = Not at all &nbsp;&bull;&nbsp; 1 = A little of the time &nbsp;&bull;&nbsp;
            2 = A good deal of the time &nbsp;&bull;&nbsp; 3 = Almost all the time
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentPane.map((item) => {
            const selected = answers[item.id];
            const globalIdx = items.findIndex((candidate) => candidate.id === item.id);
            return (
              <fieldset
                key={item.id}
                className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4"
                disabled={submitting}
              >
                <legend className="sr-only">
                  {globalIdx + 1}. {item.text}
                </legend>
                <p className="text-sm font-medium leading-snug text-foreground">
                  {globalIdx + 1}. {item.text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {MAQ_SCALE.map((opt) => {
                    const isSelected = selected === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/60",
                          isSelected
                            ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
                        )}
                      >
                        <input
                          type="radio"
                          name={`maq-${item.id}`}
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => handleSelect(item.id, opt.value)}
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {answeredCount}/{items.length} answered
            </p>
            <div className="flex gap-3">
              {!isFirstPane && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={submitting}
                  className="rounded-xl"
                >
                  Previous
                </Button>
              )}
              {!isLastPane ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!currentPaneComplete || submitting}
                  className="min-w-28 rounded-xl px-6 text-primary-foreground"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!allAnswered || submitting}
                  className="min-w-28 rounded-xl px-6 text-primary-foreground"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
