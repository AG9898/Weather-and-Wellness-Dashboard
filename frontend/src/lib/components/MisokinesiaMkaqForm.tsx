"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EditorialKicker,
  EditorialPaneDots,
} from "@/lib/components/EditorialPrimitives";

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
  { key: "q14", text: "My visual issues are classified as ‘crazy’." },
  { key: "q15", text: "I feel that no one can help me with my visual issues." },
  { key: "q16", text: "My visual issues currently make me feel hopeless." },
  { key: "q17", text: "I feel that my visual issues will only get worse with time." },
  { key: "q18", text: "My visual issues currently impact my family relationships." },
  { key: "q19", text: "My visual issues have recently affected my ability to be with other people." },
  { key: "q20", text: "My visual issues have not been recognized as legitimate." },
  { key: "q21", text: "I am worried that my whole life will be affected by visual issues." },
];

const MKAQ_SCALE = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "A little of the time" },
  { value: 2, label: "A good deal of the time" },
  { value: 3, label: "Almost all the time" },
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

  // For the "Items N–M of total" kicker label
  const firstItemGlobalIdx = items.indexOf(currentPane[0]) + 1;
  const lastItemGlobalIdx = items.indexOf(currentPane[currentPane.length - 1]) + 1;

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

  const currentPaneAnswered = currentPane.filter(
    (item) => answers[item.key] !== undefined
  ).length;

  return (
    <div className="mx-auto max-w-[760px] px-8 py-14">
      {/* A4 carousel header: instrument label — hairline — pane dots — "Part X / Y" */}
      <div className="mb-7 flex items-center gap-3">
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          MkAQ · Misokinesia Assessment
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden />
        <EditorialPaneDots
          total={panes.length}
          activeIndex={paneIndex}
        />
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Part {paneIndex + 1} / {panes.length}
        </span>
      </div>

      {/* Kicker + heading + scale legend */}
      <EditorialKicker className="mb-2.5">
        Items {firstItemGlobalIdx}–{lastItemGlobalIdx} of {items.length}
      </EditorialKicker>
      <h2 className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
        Please rate each statement
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        0&nbsp;&bull;&nbsp;Not at all&nbsp;&nbsp;&bull;&nbsp;&nbsp;1&nbsp;&bull;&nbsp;A little&nbsp;&nbsp;&bull;&nbsp;&nbsp;2&nbsp;&bull;&nbsp;A good deal&nbsp;&nbsp;&bull;&nbsp;&nbsp;3&nbsp;&bull;&nbsp;Almost all the time
      </p>

      {/* Item rows */}
      <form onSubmit={handleSubmit}>
        <div className="mt-7 flex flex-col gap-3">
          {currentPane.map((item) => {
            const globalIdx = items.indexOf(item);
            const selected = answers[item.key];
            return (
              <fieldset
                key={item.key}
                className="rounded-[14px] border border-border px-[18px] py-[14px]"
                style={{ background: "var(--fieldset-bg)" }}
              >
                <legend className="sr-only">
                  {globalIdx + 1}. {item.text}
                </legend>
                <div className="grid items-center gap-4" style={{ gridTemplateColumns: "32px 1fr auto" }}>
                  {/* Item number */}
                  <span
                    className="self-start mt-1 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    aria-hidden
                  >
                    {String(globalIdx + 1).padStart(2, "0")}
                  </span>
                  {/* Statement */}
                  <p className="text-[14px] font-medium leading-[1.45] text-foreground">
                    {item.text}
                  </p>
                  {/* Compact numeric chips */}
                  <div className="flex gap-1.5" role="radiogroup" aria-label={item.text}>
                    {MKAQ_SCALE.map((opt) => {
                      const isSelected = selected === opt.value;
                      return (
                        <label
                          key={opt.value}
                          title={opt.label}
                          className={cn(
                            "flex min-w-[40px] cursor-pointer items-center justify-center rounded-[10px] border px-2.5 py-2 text-xs font-semibold transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring/60",
                            isSelected
                              ? "border-transparent bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:border-ring/40 hover:text-foreground"
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
            {currentPaneAnswered}/{currentPane.length} on this part&nbsp;&nbsp;&bull;&nbsp;&nbsp;{answeredCount}/{items.length} overall
          </span>
          <div className="flex gap-2">
            {!isFirstPane && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                className="min-w-[120px] rounded-xl"
              >
                &larr; Previous
              </Button>
            )}
            {!isLastPane ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!currentPaneComplete}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                Next &rarr;
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!allAnswered}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                Submit
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
