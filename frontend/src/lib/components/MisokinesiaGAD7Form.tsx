"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EditorialKicker,
} from "@/lib/components/EditorialPrimitives";
import {
  DEFAULT_MISO_LOCALE,
  MISO_MESSAGES,
  misoMessage,
  type MisoLocale,
  type MisoMessageKey,
} from "@/lib/i18n";

export type MisokinesiaGAD7Answers = Record<string, number | string | null>;

interface MisokinesiaGAD7FormProps {
  onSubmit: (answers: MisokinesiaGAD7Answers) => void;
  submitting: boolean;
  error: string | null;
  /** Session locale. Fixed for the session; selects labels only. */
  locale?: MisoLocale;
}

// Item order and the submitted `key` are language-independent; only the item
// text resolves per locale. The KO strings are the lab's validated Korean
// GAD-7 (LOCALIZATION.md section 5.3) — never reworded.
const GAD7_ITEMS: { key: string; textKey: MisoMessageKey }[] = [
  { key: "r1", textKey: "gad7.item.r1" },
  { key: "r2", textKey: "gad7.item.r2" },
  { key: "r3", textKey: "gad7.item.r3" },
  { key: "r4", textKey: "gad7.item.r4" },
  { key: "r5", textKey: "gad7.item.r5" },
  { key: "r6", textKey: "gad7.item.r6" },
  { key: "r7", textKey: "gad7.item.r7" },
];

// The submitted value is the numeric point, identical across locales; only the
// chip tooltip anchor is localized.
const GAD7_SCALE: { value: number; labelKey: MisoMessageKey }[] = [
  { value: 0, labelKey: "gad7.scale.0" },
  { value: 1, labelKey: "gad7.scale.1" },
  { value: 2, labelKey: "gad7.scale.2" },
  { value: 3, labelKey: "gad7.scale.3" },
];

// `difficulty_impact` is deliberately **not** key-migrated: the column is
// validated against the four exact English labels
// (`_VALID_GAD7_DIFFICULTY_IMPACTS` in `backend/app/schemas/misokinesia.py`,
// mirrored by a DB CHECK). So a KO session displays the Korean label but still
// submits the English one, taken from the EN catalogue so the two can never
// drift apart. See LOCALIZATION.md section 5.3.
const GAD7_DIFFICULTY_KEYS: MisoMessageKey[] = [
  "gad7.difficulty.not_at_all",
  "gad7.difficulty.somewhat",
  "gad7.difficulty.very",
  "gad7.difficulty.extremely",
];

/** The stored English label for a difficulty option, whatever the locale. */
function gad7DifficultyValue(key: MisoMessageKey): string {
  return MISO_MESSAGES.en[key];
}

export default function MisokinesiaGAD7Form({
  onSubmit,
  submitting,
  error,
  locale = DEFAULT_MISO_LOCALE,
}: MisokinesiaGAD7FormProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [difficultyImpact, setDifficultyImpact] = useState<string | null>(null);

  const answeredCount = Object.keys(answers).length;
  const allItemsAnswered = GAD7_ITEMS.every((item) => answers[item.key] !== undefined);
  const hasEndorsedProblem = Object.values(answers).some((value) => value > 0);
  const allAnswered =
    allItemsAnswered && (!hasEndorsedProblem || difficultyImpact !== null);

  const handleSelect = (key: string, value: number) => {
    const nextAnswers = { ...answers, [key]: value };
    setAnswers(nextAnswers);
    if (!Object.values(nextAnswers).some((answer) => answer > 0)) {
      setDifficultyImpact(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    onSubmit({
      ...answers,
      difficulty_impact: hasEndorsedProblem ? difficultyImpact : null,
    });
  };

  return (
    <div className="mx-auto max-w-[760px] px-8 py-14">
      {/* Header: instrument label — hairline */}
      <div className="mb-7 flex items-center gap-3">
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {misoMessage("chrome.gad7.instrument_label", locale)}
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {/* Kicker + heading + scale legend */}
      <EditorialKicker className="mb-2.5">
        {misoMessage("chrome.form.item_range", locale, {
          a: 1,
          b: GAD7_ITEMS.length,
          n: GAD7_ITEMS.length,
        })}
      </EditorialKicker>
      <h2 className="text-[22px] font-bold leading-snug tracking-[-0.01em] text-foreground">
        {misoMessage("gad7.stem", locale)}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {misoMessage("chrome.gad7.scale_legend", locale)}
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
            const text = misoMessage(item.textKey, locale);
            return (
              <fieldset
                key={item.key}
                className="rounded-[14px] border border-border px-[18px] py-[14px]"
                style={{ background: "var(--fieldset-bg)" }}
                disabled={submitting}
              >
                <legend className="sr-only">
                  {misoMessage("chrome.form.item_legend", locale, {
                    n: idx + 1,
                    text,
                  })}
                </legend>
                <div className="grid items-center gap-4" style={{ gridTemplateColumns: "32px 1fr auto" }}>
                  {/* Item number */}
                  <span
                    className="font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    aria-hidden
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  {/* Statement */}
                  <p className="text-[14px] font-medium leading-[1.45] text-foreground">
                    {text}
                  </p>
                  {/* Scale chips */}
                  <div className="flex gap-1.5" role="radiogroup" aria-label={text}>
                    {GAD7_SCALE.map((opt) => {
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

        {hasEndorsedProblem && (
          <fieldset
            className="mt-5 rounded-[14px] border border-border px-[18px] py-[16px]"
            style={{ background: "var(--fieldset-bg)" }}
            disabled={submitting}
          >
            <legend className="sr-only">
              {misoMessage("gad7.difficulty.stem", locale)}
            </legend>
            <p className="text-[14px] font-medium leading-[1.45] text-foreground">
              {misoMessage("gad7.difficulty.stem", locale)}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {GAD7_DIFFICULTY_KEYS.map((optionKey) => {
                const option = gad7DifficultyValue(optionKey);
                const isSelected = difficultyImpact === option;
                return (
                  <label
                    key={optionKey}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-[10px] border px-3 py-2 text-center text-xs font-semibold transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring/60",
                      isSelected
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-ring/40 hover:text-foreground",
                      submitting && "pointer-events-none opacity-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="gad7-difficulty-impact"
                      value={option}
                      checked={isSelected}
                      onChange={() => setDifficultyImpact(option)}
                      className="sr-only"
                    />
                    {misoMessage(optionKey, locale)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Footer */}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <span className="font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {misoMessage("chrome.form.answered_count", locale, {
              n: answeredCount,
              m: GAD7_ITEMS.length,
            })}
          </span>
          <Button
            type="submit"
            disabled={!allAnswered || submitting}
            className="min-w-[120px] rounded-xl px-6 text-primary-foreground"
          >
            {submitting
              ? misoMessage("chrome.state.submitting", locale)
              : misoMessage("chrome.button.submit", locale)}
          </Button>
        </div>
      </form>
    </div>
  );
}
