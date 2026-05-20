"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EditorialKicker,
  EditorialPaneDots,
} from "@/lib/components/EditorialPrimitives";

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
  { value: 0, label: "Not at all" },
  { value: 1, label: "A little of the time" },
  { value: 2, label: "A good deal of the time" },
  { value: 3, label: "Almost all the time" },
] as const;

/**
 * Builds panes for MAQ.
 * - itemCount <= 10 (trial): 5-item panes → 5/5
 * - itemCount = 21 (production): 7-item panes → 7/7/7
 */
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

  // For the "Items N–M of total" kicker label
  const firstItemGlobalIdx = items.indexOf(currentPane[0]) + 1;
  const lastItemGlobalIdx = items.indexOf(currentPane[currentPane.length - 1]) + 1;

  const currentPaneAnswered = currentPane.filter(
    (item) => answers[item.id] !== undefined
  ).length;

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
    <div className="mx-auto max-w-[760px] px-8 py-14">
      {/* A4 carousel header: instrument label — hairline — pane dots — "Part X / Y" */}
      <div className="mb-7 flex items-center gap-3">
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          MAQ · Misophonia Assessment
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

      {/* Error banner */}
      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Item rows */}
      <form onSubmit={handleSubmit}>
        <div className="mt-7 flex flex-col gap-3">
          {currentPane.map((item) => {
            const globalIdx = items.findIndex((candidate) => candidate.id === item.id);
            const selected = answers[item.id];
            return (
              <fieldset
                key={item.id}
                className="rounded-[14px] border border-border px-[18px] py-[14px]"
                style={{ background: "var(--fieldset-bg)" }}
                disabled={submitting}
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
                    {MAQ_SCALE.map((opt) => {
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
                            name={`maq-${item.id}`}
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => handleSelect(item.id, opt.value)}
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
                disabled={submitting}
                className="min-w-[120px] rounded-xl"
              >
                &larr; Previous
              </Button>
            )}
            {!isLastPane ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!currentPaneComplete || submitting}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                Next &rarr;
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!allAnswered || submitting}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
