"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { MisokinesiaDemographicsRequest } from "@/lib/api";
import {
  MISO_DEMOGRAPHICS_BLOCKS,
  MISO_DEMOGRAPHICS_CONSENT_GATE,
  getMisoDemographicsOptionLabel,
  getMisoDemographicsOptions,
  getMisoDemographicsSliderMax,
  getMisokinesiaDemographicsBlockPanes,
  isMisoDemographicsQuestionVisible,
  misoDemographicsConditionMatches,
  type MisoDemographicsBlock,
  type MisoDemographicsBooleanQuestion,
  type MisoDemographicsField,
  type MisoDemographicsMultiSelectQuestion,
  type MisoDemographicsPane,
  type MisoDemographicsQuestion,
  type MisoDemographicsSingleChoiceQuestion,
  type MisoDemographicsSliderQuestion,
  type MisoDemographicsTextQuestion,
  type MisoDemographicsValue,
  type MisoDemographicsValues,
} from "@/lib/misokinesia-demographics";
import {
  DEFAULT_MISO_LOCALE,
  misoMessage,
  type MisoLocale,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DemographicsFormValue = MisoDemographicsValue;
export type DemographicsFormValues = MisoDemographicsValues;

export type DemographicsValues = MisokinesiaDemographicsRequest;

interface MisokinesiaDemographicsFormProps {
  submitting: boolean;
  error: string | null;
  /** Session locale. Fixed for the session; selects labels only. */
  locale?: MisoLocale;
  onSubmit: (values: DemographicsValues) => void;
  onDeclineConsent?: () => void;
  initialConsentAccepted?: boolean;
  initialPaneIndex?: number;
  initialValues?: DemographicsFormValues;
  initialValidationAttempted?: boolean;
}

interface PaneWithMeta {
  block: MisoDemographicsBlock;
  pane: MisoDemographicsPane;
  blockIndex: number;
  paneIndex: number;
  panesInBlock: number;
  globalIndex: number;
}

function buildPanes(values: DemographicsFormValues): PaneWithMeta[] {
  return MISO_DEMOGRAPHICS_BLOCKS.flatMap((block, blockIndex) =>
    getMisokinesiaDemographicsBlockPanes(block, values).map(
      (pane, paneIndex, blockPanes) => ({
        block,
        pane,
        blockIndex,
        paneIndex,
        panesInBlock: blockPanes.length,
        globalIndex: 0,
      })
    )
  ).map((pane, globalIndex) => ({ ...pane, globalIndex }));
}

function questionVisible(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues
): boolean {
  return isMisoDemographicsQuestionVisible(question, values);
}

function otherTextVisible(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues
): boolean {
  return "otherText" in question && question.otherText
    ? misoDemographicsConditionMatches(question.otherText.requiredWhen, values)
    : false;
}

function sanitizeValues(values: DemographicsFormValues): DemographicsFormValues {
  const next = { ...values };
  for (const block of MISO_DEMOGRAPHICS_BLOCKS) {
    for (const pane of block.panes) {
      for (const question of pane.questions) {
        if (!questionVisible(question, next)) {
          delete next[question.field];
          if ("otherText" in question && question.otherText) {
            delete next[question.otherText.field];
          }
          continue;
        }
        if ("otherText" in question && question.otherText && !otherTextVisible(question, next)) {
          delete next[question.otherText.field];
        }
      }
    }
  }
  return next;
}

function questionAnswered(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues,
  locale: MisoLocale
): boolean {
  if (!questionVisible(question, values)) return true;

  const value = values[question.field];
  let answered = false;
  if (question.input === "slider") {
    answered =
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= question.min &&
      value <= getMisoDemographicsSliderMax(question, locale);
  } else if (question.input === "text") {
    answered = typeof value === "string" && value.trim().length > 0;
  } else if (question.input === "multi_select") {
    answered = Array.isArray(value) && value.length > 0;
  } else if (question.input === "boolean") {
    answered = typeof value === "boolean";
  } else {
    answered = typeof value === "string" && value.length > 0;
  }

  if (!answered) return false;

  if (otherTextVisible(question, values) && "otherText" in question && question.otherText) {
    const other = values[question.otherText.field];
    return typeof other === "string" && other.trim().length > 0;
  }

  return true;
}

function coercePayloadValue(value: DemographicsFormValue): DemographicsFormValue {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value;
  return value;
}

function buildPayload(values: DemographicsFormValues): MisokinesiaDemographicsRequest {
  const payload: MisokinesiaDemographicsRequest = {};
  for (const block of MISO_DEMOGRAPHICS_BLOCKS) {
    for (const pane of block.panes) {
      for (const question of pane.questions) {
        if (!questionVisible(question, values)) continue;
        const value = coercePayloadValue(values[question.field]);
        if (value !== undefined) {
          (payload as Record<string, DemographicsFormValue>)[question.field] = value;
        }
        if ("otherText" in question && question.otherText && otherTextVisible(question, values)) {
          const other = coercePayloadValue(values[question.otherText.field]);
          if (other !== undefined) {
            (payload as Record<string, DemographicsFormValue>)[question.otherText.field] = other;
          }
        }
      }
    }
  }
  return payload;
}

export default function MisokinesiaDemographicsForm({
  submitting,
  error,
  locale = DEFAULT_MISO_LOCALE,
  onSubmit,
  onDeclineConsent = () => {},
  initialConsentAccepted = false,
  initialPaneIndex = 0,
  initialValues = {},
  initialValidationAttempted = false,
}: MisokinesiaDemographicsFormProps) {
  const [consentAccepted, setConsentAccepted] = useState(initialConsentAccepted);
  const [currentPaneIndex, setCurrentPaneIndex] = useState(() =>
    Math.max(initialPaneIndex, 0)
  );
  const [values, setValues] = useState<DemographicsFormValues>(() =>
    sanitizeValues(initialValues)
  );
  const [validationAttempted, setValidationAttempted] = useState(
    initialValidationAttempted
  );
  const panes = useMemo(() => buildPanes(values), [values]);

  useEffect(() => {
    setCurrentPaneIndex((index) => Math.min(index, panes.length - 1));
  }, [panes.length]);

  const safePaneIndex = Math.min(currentPaneIndex, panes.length - 1);
  const currentPane = panes[safePaneIndex];
  const paneComplete = currentPane.pane.questions.every((question) =>
    questionAnswered(question, values, locale)
  );
  const isFinalPane = safePaneIndex === panes.length - 1;

  function setField(field: MisoDemographicsField, value: DemographicsFormValue) {
    setValues((prev) => sanitizeValues({ ...prev, [field]: value }));
  }

  function handleNext() {
    if (!paneComplete) {
      setValidationAttempted(true);
      return;
    }
    setValidationAttempted(false);
    setCurrentPaneIndex(Math.min(safePaneIndex + 1, panes.length - 1));
  }

  function handleBack() {
    setValidationAttempted(false);
    setCurrentPaneIndex(Math.max(safePaneIndex - 1, 0));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!paneComplete) {
      setValidationAttempted(true);
      return;
    }
    onSubmit(buildPayload(values));
  }

  if (!consentAccepted) {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-10 sm:px-8 sm:py-16">
        <StepStrip
          left={misoMessage("chrome.step.consent", locale)}
          right={misoMessage("chrome.step.trail", locale)}
        />
        <div
          className="rounded-2xl border border-border px-6 py-8 sm:px-10 sm:py-10"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {misoMessage(MISO_DEMOGRAPHICS_CONSENT_GATE.kickerKey, locale)}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">
            {misoMessage(MISO_DEMOGRAPHICS_CONSENT_GATE.titleKey, locale)}
          </h1>
          <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
            {misoMessage(MISO_DEMOGRAPHICS_CONSENT_GATE.bodyKey, locale)}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => setConsentAccepted(true)}
              className="h-11 min-w-[180px] rounded-xl px-[22px] text-sm text-primary-foreground"
            >
              {misoMessage(MISO_DEMOGRAPHICS_CONSENT_GATE.yesKey, locale)}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDeclineConsent}
              className="h-11 min-w-[180px] rounded-xl px-[22px] text-sm"
            >
              {misoMessage(MISO_DEMOGRAPHICS_CONSENT_GATE.noKey, locale)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-8 sm:py-16">
      <StepStrip
        left={`${String(currentPane.globalIndex + 1).padStart(2, "0")} / ${String(
          panes.length
        ).padStart(2, "0")}`}
        right={misoMessage("chrome.step.trail", locale)}
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {misoMessage("chrome.demographics.block_kicker", locale, {
          n: currentPane.block.sourceBlock,
          total: MISO_DEMOGRAPHICS_BLOCKS.length,
        })}
        {currentPane.panesInBlock > 1
          ? ` ${misoMessage("chrome.demographics.pane_suffix", locale, {
              n: currentPane.paneIndex + 1,
              m: currentPane.panesInBlock,
            })}`
          : ""}
      </p>
      <h1 className="mt-2.5 text-3xl font-bold text-foreground">
        {misoMessage(currentPane.block.titleKey, locale)}
      </h1>
      <p className="mt-2.5 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
        {misoMessage("chrome.demographics.pane_help", locale)}
      </p>

      <form onSubmit={handleSubmit}>
        <div
          className="mt-9 rounded-2xl border border-border px-5 py-1 sm:px-7"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          {currentPane.pane.questions
            .filter((question) => questionVisible(question, values))
            .map((question, index, visibleQuestions) => (
              <QuestionRow
                key={question.field}
                question={question}
                values={values}
                locale={locale}
                showValidation={validationAttempted}
                isLast={index === visibleQuestions.length - 1}
                onChange={setField}
              />
            ))}
        </div>

        {(validationAttempted || error) && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error ?? misoMessage("chrome.demographics.validation_banner", locale)}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={safePaneIndex === 0 || submitting}
            className="h-11 min-w-[140px] rounded-xl px-[22px] text-sm"
          >
            {misoMessage("chrome.button.back", locale)}
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isFinalPane ? (
              <Button
                type="submit"
                disabled={!paneComplete || submitting}
                className="h-11 min-w-[180px] rounded-xl px-[22px] text-sm text-primary-foreground"
              >
                {submitting
                  ? misoMessage("chrome.state.saving", locale)
                  : misoMessage("chrome.button.continue", locale)}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!paneComplete || submitting}
                onClick={handleNext}
                className="h-11 min-w-[160px] rounded-xl px-[22px] text-sm text-primary-foreground"
              >
                {misoMessage("chrome.button.next", locale)}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function StepStrip({ left, right }: { left: string; right: string }) {
  return (
    <div className="mb-9 flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
        {left}
      </span>
      <div className="h-px flex-1 bg-border" />
      <span className="min-w-0 shrink text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {right}
      </span>
    </div>
  );
}

function QuestionRow({
  question,
  values,
  locale,
  showValidation,
  isLast,
  onChange,
}: {
  question: MisoDemographicsQuestion;
  values: DemographicsFormValues;
  locale: MisoLocale;
  showValidation: boolean;
  isLast: boolean;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  const missing = showValidation && !questionAnswered(question, values, locale);
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-start gap-5 py-[22px] sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8",
        !isLast && "border-b border-border"
      )}
    >
      <div>
        <div className="text-[13px] font-semibold leading-relaxed text-foreground">
          {misoMessage(question.labelKey, locale)}
        </div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {question.sourceId}
        </div>
      </div>
      <div className="space-y-3">
        {renderQuestionControl(question, values, locale, onChange)}
        {otherTextVisible(question, values) && "otherText" in question && question.otherText && (
          <input
            type="text"
            value={(values[question.otherText.field] as string | undefined) ?? ""}
            onChange={(e) => onChange(question.otherText!.field, e.target.value)}
            placeholder={misoMessage(
              "chrome.demographics.other_placeholder",
              locale
            )}
            className="h-10 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          />
        )}
        {missing && (
          <p className="text-xs font-medium text-destructive">
            {misoMessage("chrome.demographics.field_required", locale)}
          </p>
        )}
      </div>
    </div>
  );
}

function renderQuestionControl(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues,
  locale: MisoLocale,
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void
) {
  if (question.input === "slider") {
    return (
      <SliderQuestion
        question={question}
        value={values[question.field]}
        locale={locale}
        onChange={onChange}
      />
    );
  }
  if (question.input === "text") {
    return <TextQuestion question={question} value={values[question.field]} onChange={onChange} />;
  }
  if (question.input === "multi_select") {
    return (
      <MultiSelectQuestion
        question={question}
        value={values[question.field]}
        locale={locale}
        onChange={onChange}
      />
    );
  }
  if (question.input === "boolean") {
    return (
      <BooleanQuestion
        question={question}
        value={values[question.field]}
        locale={locale}
        onChange={onChange}
      />
    );
  }
  return (
    <SingleChoiceQuestion
      question={question}
      value={values[question.field]}
      locale={locale}
      onChange={onChange}
    />
  );
}

function SliderQuestion({
  question,
  value,
  locale,
  onChange,
}: {
  question: MisoDemographicsSliderQuestion;
  value: DemographicsFormValue;
  locale: MisoLocale;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  const max = getMisoDemographicsSliderMax(question, locale);
  const numericValue = typeof value === "number" ? value : question.min;
  const thresholds = getSliderThresholds(question, max);
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px] sm:items-end">
      <div className="min-w-0 space-y-2">
        <div
          className="grid text-center text-[10px] font-semibold text-muted-foreground tabular-nums"
          style={{ gridTemplateColumns: `repeat(${thresholds.length}, minmax(0, 1fr))` }}
        >
          {thresholds.map((threshold) => (
            <span key={threshold}>{formatSliderThreshold(threshold)}</span>
          ))}
        </div>
        <input
          type="range"
          min={question.min}
          max={max}
          step={question.step}
          value={numericValue}
          onChange={(e) =>
            onChange(
              question.field,
              snapSliderValue(question, max, Number(e.target.value))
            )
          }
          className="w-full accent-primary"
        />
      </div>
      <input
        type="number"
        min={question.min}
        max={max}
        step={question.step}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => {
          // Clamped, not just `max`-attributed: the attribute alone still lets a
          // ko participant type 4.8 into a 4.5-capped GPA field.
          const next =
            e.target.value === ""
              ? undefined
              : clampSliderValue(question, max, Number(e.target.value));
          onChange(question.field, next);
        }}
        className="h-10 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
      />
    </div>
  );
}

function getSliderThresholds(
  question: MisoDemographicsSliderQuestion,
  max: number
): number[] {
  if (question.field === "cumulative_gpa") {
    // Whole points up to the locale cap, then the cap itself when it is not a
    // whole number (ko tops out at 4.5).
    const whole = Array.from({ length: Math.floor(max) + 1 }, (_, index) => index);
    return Number.isInteger(max) ? whole : [...whole, max];
  }
  if (question.min === 0 && max === 100) {
    return Array.from({ length: 11 }, (_, index) => index * 10);
  }
  return [question.min, max];
}

function clampSliderValue(
  question: MisoDemographicsSliderQuestion,
  max: number,
  value: number
): number {
  if (!Number.isFinite(value)) return question.min;
  return Math.min(Math.max(value, question.min), max);
}

function snapSliderValue(
  question: MisoDemographicsSliderQuestion,
  max: number,
  value: number
): number {
  const thresholds = getSliderThresholds(question, max);
  const snapTolerance = Math.max(question.step * 1.25, (max - question.min) / 100);
  const nearest = thresholds.reduce((closest, threshold) =>
    Math.abs(threshold - value) < Math.abs(closest - value) ? threshold : closest
  );
  return Math.abs(nearest - value) <= snapTolerance ? nearest : value;
}

function formatSliderThreshold(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function TextQuestion({
  question,
  value,
  onChange,
}: {
  question: MisoDemographicsTextQuestion;
  value: DemographicsFormValue;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  if (question.multiline) {
    return (
      <textarea
        value={(value as string | undefined) ?? ""}
        onChange={(e) => onChange(question.field, e.target.value)}
        className="min-h-[96px] w-full rounded-[10px] border border-border bg-background px-3.5 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
      />
    );
  }
  return (
    <input
      type="text"
      value={(value as string | undefined) ?? ""}
      onChange={(e) => onChange(question.field, e.target.value)}
      className="h-10 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
    />
  );
}

function SingleChoiceQuestion({
  question,
  value,
  locale,
  onChange,
}: {
  question: MisoDemographicsSingleChoiceQuestion;
  value: DemographicsFormValue;
  locale: MisoLocale;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {getMisoDemographicsOptions(question, locale).map((option) => (
        <ChipButton
          key={option.key}
          selected={value === option.key}
          onClick={() => onChange(question.field, option.key)}
        >
          {getMisoDemographicsOptionLabel(question, option, locale)}
        </ChipButton>
      ))}
    </div>
  );
}

function MultiSelectQuestion({
  question,
  value,
  locale,
  onChange,
}: {
  question: MisoDemographicsMultiSelectQuestion;
  value: DemographicsFormValue;
  locale: MisoLocale;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  const options = getMisoDemographicsOptions(question, locale);
  const selected = Array.isArray(value) ? value : [];
  // Exclusivity is keyed off the option KEY (`fluent_lang_none`, `disorder_na`,
  // `substance_none`), never off a display label.
  function toggle(optionKey: string) {
    const option = options.find((item) => item.key === optionKey);
    if (option?.exclusive) {
      onChange(question.field, selected.includes(optionKey) ? [] : [optionKey]);
      return;
    }
    const exclusiveKeys = options
      .filter((item) => item.exclusive)
      .map((item) => item.key);
    const withoutExclusive = selected.filter((item) => !exclusiveKeys.includes(item));
    const next = withoutExclusive.includes(optionKey)
      ? withoutExclusive.filter((item) => item !== optionKey)
      : [...withoutExclusive, optionKey];
    onChange(question.field, next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <ChipButton
          key={option.key}
          selected={selected.includes(option.key)}
          onClick={() => toggle(option.key)}
        >
          {getMisoDemographicsOptionLabel(question, option, locale)}
        </ChipButton>
      ))}
    </div>
  );
}

function BooleanQuestion({
  question,
  value,
  locale,
  onChange,
}: {
  question: MisoDemographicsBooleanQuestion;
  value: DemographicsFormValue;
  locale: MisoLocale;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ChipButton selected={value === true} onClick={() => onChange(question.field, true)}>
        {misoMessage(question.trueLabelKey, locale)}
      </ChipButton>
      <ChipButton selected={value === false} onClick={() => onChange(question.field, false)}>
        {misoMessage(question.falseLabelKey, locale)}
      </ChipButton>
    </div>
  );
}

function ChipButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-[10px] border px-3.5 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-ring/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
