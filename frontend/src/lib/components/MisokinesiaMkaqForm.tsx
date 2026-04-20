"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MkAqItem {
  key: string;
  text: string;
}

interface MisokinesiaMkaqFormProps {
  items: MkAqItem[];
  onComplete: (answers: Record<string, number>) => void;
}

export const MKAQ_ITEMS: MkAqItem[] = [
  { key: "q1",  text: "My visual issues currently make me unhappy." },
  { key: "q2",  text: "My visual issues currently create problems for me." },
  { key: "q3",  text: "My visual issues have recently made me feel angry." },
  { key: "q4",  text: "I feel that no one understands my problems with certain visuals." },
  { key: "q5",  text: "My visual issues do not seem to have a known cause." },
  { key: "q6",  text: "My visual issues currently make me feel helpless." },
  { key: "q7",  text: "My visual issues currently interfere with my social life." },
  { key: "q8",  text: "My visual issues currently make me feel isolated." },
  { key: "q9",  text: "My visual issues have recently created problems for me in groups." },
  { key: "q10", text: "My visual issues negatively affect my work/school life (currently or recently)." },
  { key: "q11", text: "My visual issues currently make me feel frustrated." },
  { key: "q12", text: "My visual issues currently impact my entire life negatively." },
  { key: "q13", text: "My visual issues have recently made me feel guilty." },
  { key: "q14", text: "My visual issues are classified as \u2018crazy\u2019." },
  { key: "q15", text: "I feel that no one can help me with my visual issues." },
  { key: "q16", text: "My visual issues currently make me feel hopeless." },
  { key: "q17", text: "I feel that my visual issues will only get worse with time." },
  { key: "q18", text: "My visual issues currently impact my family relationships." },
  { key: "q19", text: "My visual issues have recently affected my ability to be with other people." },
  { key: "q20", text: "My visual issues have not been recognized as legitimate." },
  { key: "q21", text: "I am worried that my whole life will be affected by visual issues." },
];

const MKAQ_SCALE = [
  { value: 0, label: "0 \u2014 Not at all" },
  { value: 1, label: "1 \u2014 A little of the time" },
  { value: 2, label: "2 \u2014 A good deal of the time" },
  { value: 3, label: "3 \u2014 Almost all the time" },
] as const;

/**
 * Splits items into panes of baseSize, extending the last pane to absorb a
 * short remainder rather than creating a near-empty final pane.
 * 21 items → 5/5/5/6; 10 items → 5/5; 5 items → 5.
 */
export function buildMkaqPanes<T>(items: T[], baseSize = 5): T[][] {
  const panes: T[][] = [];
  let start = 0;
  while (start < items.length) {
    const remaining = items.length - start;
    const isLast = remaining <= baseSize + 1;
    const paneSize = isLast ? remaining : baseSize;
    panes.push(items.slice(start, start + paneSize));
    start += paneSize;
    if (isLast) break;
  }
  return panes;
}

export default function MisokinesiaMkaqForm({
  items,
  onComplete,
}: MisokinesiaMkaqFormProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [paneIndex, setPaneIndex] = useState(0);

  const panes = buildMkaqPanes(items);
  const currentPane = panes[paneIndex] ?? [];
  const isFirstPane = paneIndex === 0;
  const isLastPane = paneIndex === panes.length - 1;

  const currentPaneComplete = currentPane.every(
    (item) => answers[item.key] !== undefined
  );
  const allAnswered = items.every((item) => answers[item.key] !== undefined);
  const answeredCount = items.filter((item) => answers[item.key] !== undefined).length;

  const handleSelect = (key: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleNext = () => {
    if (!currentPaneComplete) return;
    setPaneIndex((i) => i + 1);
  };

  const handlePrevious = () => {
    setPaneIndex((i) => Math.max(0, i - 1));
  };

  const handleSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!allAnswered) return;
    onComplete({ ...answers });
  };

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
      {/* Ambient glows */}
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
            Assessment questionnaire &mdash; Part {paneIndex + 1} of {panes.length}
          </p>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            Please rate each statement
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            0 = Not at all &nbsp;&bull;&nbsp; 1 = A little of the time &nbsp;&bull;&nbsp;
            2 = A good deal of the time &nbsp;&bull;&nbsp; 3 = Almost all the time
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentPane.map((item, idx) => {
            const selected = answers[item.key];
            const globalIdx = paneIndex * 5 + idx;
            return (
              <fieldset
                key={item.key}
                className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4"
              >
                <legend className="sr-only">
                  {globalIdx + 1}. {item.text}
                </legend>
                <p className="text-sm font-medium leading-snug text-foreground">
                  {globalIdx + 1}. {item.text}
                </p>
                <div className="flex flex-wrap gap-2">
                  {MKAQ_SCALE.map((opt) => {
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
                          name={`mkaq-${item.key}`}
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => handleSelect(item.key, opt.value)}
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
                  className="rounded-xl"
                >
                  Previous
                </Button>
              )}
              {!isLastPane ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!currentPaneComplete}
                  className="min-w-28 rounded-xl px-6 text-primary-foreground"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!allAnswered}
                  className="min-w-28 rounded-xl px-6 text-primary-foreground"
                >
                  Submit
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
