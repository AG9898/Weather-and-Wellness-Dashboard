"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EditorialKicker,
  EditorialPaneDots,
} from "@/lib/components/EditorialPrimitives";
import {
  DEFAULT_MISO_LOCALE,
  misoMessage,
  type MisoLocale,
  type MisoMessageKey,
} from "@/lib/i18n";

export interface MAQItem {
  id: string;
  /** Catalogue key for the item statement; the text itself resolves per locale. */
  textKey: MisoMessageKey;
}

interface MisokinesiaMAQFormProps {
  onSubmit: (answers: Record<string, number>) => void;
  submitting: boolean;
  error: string | null;
  itemCount?: number;
  /** Session locale. Fixed for the session; selects labels only. */
  locale?: MisoLocale;
}

// Item order and the submitted `id` are language-independent; only the
// statement text resolves per locale (LOCALIZATION.md section 5.4).
export const MAQ_ITEMS: MAQItem[] = [
  { id: "q1", textKey: "maq.item.q1" },
  { id: "q2", textKey: "maq.item.q2" },
  { id: "q3", textKey: "maq.item.q3" },
  { id: "q4", textKey: "maq.item.q4" },
  { id: "q5", textKey: "maq.item.q5" },
  { id: "q6", textKey: "maq.item.q6" },
  { id: "q7", textKey: "maq.item.q7" },
  { id: "q8", textKey: "maq.item.q8" },
  { id: "q9", textKey: "maq.item.q9" },
  { id: "q10", textKey: "maq.item.q10" },
  { id: "q11", textKey: "maq.item.q11" },
  { id: "q12", textKey: "maq.item.q12" },
  { id: "q13", textKey: "maq.item.q13" },
  { id: "q14", textKey: "maq.item.q14" },
  { id: "q15", textKey: "maq.item.q15" },
  { id: "q16", textKey: "maq.item.q16" },
  { id: "q17", textKey: "maq.item.q17" },
  { id: "q18", textKey: "maq.item.q18" },
  { id: "q19", textKey: "maq.item.q19" },
  { id: "q20", textKey: "maq.item.q20" },
  { id: "q21", textKey: "maq.item.q21" },
];

// The submitted value is the numeric point, identical across locales; only the
// chip tooltip anchor is localized.
const MAQ_SCALE: { value: number; labelKey: MisoMessageKey }[] = [
  { value: 0, labelKey: "maq.scale.0" },
  { value: 1, labelKey: "maq.scale.1" },
  { value: 2, labelKey: "maq.scale.2" },
  { value: 3, labelKey: "maq.scale.3" },
];

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
  locale = DEFAULT_MISO_LOCALE,
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
          {misoMessage("chrome.maq.instrument_label", locale)}
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden />
        <EditorialPaneDots
          total={panes.length}
          activeIndex={paneIndex}
        />
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {misoMessage("chrome.form.part_counter", locale, {
            n: paneIndex + 1,
            m: panes.length,
          })}
        </span>
      </div>

      {/* Kicker + heading + scale legend */}
      <EditorialKicker className="mb-2.5">
        {misoMessage("chrome.form.item_range", locale, {
          a: firstItemGlobalIdx,
          b: lastItemGlobalIdx,
          n: items.length,
        })}
      </EditorialKicker>
      <h2 className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
        {misoMessage("chrome.form.rate_heading", locale)}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {misoMessage("chrome.form.scale_legend_0_3", locale)}
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
            const text = misoMessage(item.textKey, locale);
            return (
              <fieldset
                key={item.id}
                className="rounded-[14px] border border-border px-[18px] py-[14px]"
                style={{ background: "var(--fieldset-bg)" }}
                disabled={submitting}
              >
                <legend className="sr-only">
                  {misoMessage("chrome.form.item_legend", locale, {
                    n: globalIdx + 1,
                    text,
                  })}
                </legend>
                <div className="grid items-center gap-4" style={{ gridTemplateColumns: "32px 1fr auto" }}>
                  {/* Item number */}
                  <span
                    className="font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    aria-hidden
                  >
                    {String(globalIdx + 1).padStart(2, "0")}
                  </span>
                  {/* Statement */}
                  <p className="text-[14px] font-medium leading-[1.45] text-foreground">
                    {text}
                  </p>
                  {/* Compact numeric chips */}
                  <div className="flex gap-1.5" role="radiogroup" aria-label={text}>
                    {MAQ_SCALE.map((opt) => {
                      const isSelected = selected === opt.value;
                      return (
                        <label
                          key={opt.value}
                          title={misoMessage(opt.labelKey, locale)}
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
            {misoMessage("chrome.form.pane_progress", locale, {
              a: currentPaneAnswered,
              b: currentPane.length,
              c: answeredCount,
              d: items.length,
            })}
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
                {misoMessage("chrome.button.previous", locale)}
              </Button>
            )}
            {!isLastPane ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!currentPaneComplete || submitting}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                {misoMessage("chrome.button.next_arrow", locale)}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!allAnswered || submitting}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                {submitting
                  ? misoMessage("chrome.state.submitting", locale)
                  : misoMessage("chrome.button.submit", locale)}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
