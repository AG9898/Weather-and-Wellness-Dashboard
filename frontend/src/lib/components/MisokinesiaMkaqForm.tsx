"use client";

import { useState } from "react";
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

export interface MkAqItem {
  key: string;
  /** Catalogue key for the item statement; the text itself resolves per locale. */
  textKey: MisoMessageKey;
}

interface MisokinesiaMkaqFormProps {
  items: MkAqItem[];
  /** Session locale. Fixed for the session; selects labels only. */
  locale?: MisoLocale;
  onComplete: (answers: Record<string, number>) => void;
}

// Item order and the submitted `key` are language-independent; only the
// statement text resolves per locale (LOCALIZATION.md section 5.2).
export const MKAQ_ITEMS: MkAqItem[] = [
  { key: "q1",  textKey: "mkaq.item.q1" },
  { key: "q2",  textKey: "mkaq.item.q2" },
  { key: "q3",  textKey: "mkaq.item.q3" },
  { key: "q4",  textKey: "mkaq.item.q4" },
  { key: "q5",  textKey: "mkaq.item.q5" },
  { key: "q6",  textKey: "mkaq.item.q6" },
  { key: "q7",  textKey: "mkaq.item.q7" },
  { key: "q8",  textKey: "mkaq.item.q8" },
  { key: "q9",  textKey: "mkaq.item.q9" },
  { key: "q10", textKey: "mkaq.item.q10" },
  { key: "q11", textKey: "mkaq.item.q11" },
  { key: "q12", textKey: "mkaq.item.q12" },
  { key: "q13", textKey: "mkaq.item.q13" },
  { key: "q14", textKey: "mkaq.item.q14" },
  { key: "q15", textKey: "mkaq.item.q15" },
  { key: "q16", textKey: "mkaq.item.q16" },
  { key: "q17", textKey: "mkaq.item.q17" },
  { key: "q18", textKey: "mkaq.item.q18" },
  { key: "q19", textKey: "mkaq.item.q19" },
  { key: "q20", textKey: "mkaq.item.q20" },
  { key: "q21", textKey: "mkaq.item.q21" },
];

// The submitted value is the numeric point, identical across locales; only the
// chip tooltip anchor is localized.
const MKAQ_SCALE: { value: number; labelKey: MisoMessageKey }[] = [
  { value: 0, labelKey: "mkaq.scale.0" },
  { value: 1, labelKey: "mkaq.scale.1" },
  { value: 2, labelKey: "mkaq.scale.2" },
  { value: 3, labelKey: "mkaq.scale.3" },
];

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
  locale = DEFAULT_MISO_LOCALE,
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
          {misoMessage("chrome.mkaq.instrument_label", locale)}
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

      {/* Item rows */}
      <form onSubmit={handleSubmit}>
        <div className="mt-7 flex flex-col gap-3">
          {currentPane.map((item) => {
            const globalIdx = items.indexOf(item);
            const selected = answers[item.key];
            const text = misoMessage(item.textKey, locale);
            return (
              <fieldset
                key={item.key}
                className="rounded-[14px] border border-border px-[18px] py-[14px]"
                style={{ background: "var(--fieldset-bg)" }}
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
                    {MKAQ_SCALE.map((opt) => {
                      const isSelected = selected === opt.value;
                      return (
                        <label
                          key={opt.value}
                          title={misoMessage(opt.labelKey, locale)}
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
                className="min-w-[120px] rounded-xl"
              >
                {misoMessage("chrome.button.previous", locale)}
              </Button>
            )}
            {!isLastPane ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!currentPaneComplete}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                {misoMessage("chrome.button.next_arrow", locale)}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!allAnswered}
                className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
              >
                {misoMessage("chrome.button.submit", locale)}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
