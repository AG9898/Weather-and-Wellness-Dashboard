"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { MisokinesiaDemographicsRequest } from "@/lib/api";
import {
  MISO_DEMOGRAPHICS_BLOCKS,
  MISO_DEMOGRAPHICS_CONSENT_GATE,
  type MisoDemographicsBlock,
  type MisoDemographicsBooleanQuestion,
  type MisoDemographicsCondition,
  type MisoDemographicsField,
  type MisoDemographicsMultiSelectQuestion,
  type MisoDemographicsPane,
  type MisoDemographicsQuestion,
  type MisoDemographicsSingleChoiceQuestion,
  type MisoDemographicsSliderQuestion,
  type MisoDemographicsTextQuestion,
} from "@/lib/misokinesia-demographics";
import { cn } from "@/lib/utils";

type DemographicsFormValue = string | number | boolean | string[] | null | undefined;
export type DemographicsFormValues = Partial<
  Record<MisoDemographicsField, DemographicsFormValue>
>;

export type DemographicsValues = MisokinesiaDemographicsRequest;

interface MisokinesiaDemographicsFormProps {
  submitting: boolean;
  error: string | null;
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

function buildPanes(): PaneWithMeta[] {
  return MISO_DEMOGRAPHICS_BLOCKS.flatMap((block, blockIndex) =>
    block.panes.map((pane, paneIndex) => ({
      block,
      pane,
      blockIndex,
      paneIndex,
      panesInBlock: block.panes.length,
      globalIndex: 0,
    }))
  ).map((pane, globalIndex) => ({ ...pane, globalIndex }));
}

function conditionMatches(
  condition: MisoDemographicsCondition,
  values: DemographicsFormValues
): boolean {
  const value = values[condition.field];
  if (condition.operator === "equals") {
    return value === condition.value;
  }
  return Array.isArray(value) && value.includes(condition.value);
}

function questionVisible(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues
): boolean {
  return !question.visibleWhen || conditionMatches(question.visibleWhen, values);
}

function otherTextVisible(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues
): boolean {
  return "otherText" in question && question.otherText
    ? conditionMatches(question.otherText.requiredWhen, values)
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
  values: DemographicsFormValues
): boolean {
  if (!questionVisible(question, values)) return true;

  const value = values[question.field];
  let answered = false;
  if (question.input === "slider") {
    answered =
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= question.min &&
      value <= question.max;
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
  onSubmit,
  onDeclineConsent = () => {},
  initialConsentAccepted = false,
  initialPaneIndex = 0,
  initialValues = {},
  initialValidationAttempted = false,
}: MisokinesiaDemographicsFormProps) {
  const panes = useMemo(buildPanes, []);
  const [consentAccepted, setConsentAccepted] = useState(initialConsentAccepted);
  const [currentPaneIndex, setCurrentPaneIndex] = useState(() =>
    Math.min(Math.max(initialPaneIndex, 0), panes.length - 1)
  );
  const [values, setValues] = useState<DemographicsFormValues>(() =>
    sanitizeValues(initialValues)
  );
  const [validationAttempted, setValidationAttempted] = useState(
    initialValidationAttempted
  );

  const currentPane = panes[currentPaneIndex];
  const paneComplete = currentPane.pane.questions.every((question) =>
    questionAnswered(question, values)
  );
  const isFinalPane = currentPaneIndex === panes.length - 1;

  function setField(field: MisoDemographicsField, value: DemographicsFormValue) {
    setValues((prev) => sanitizeValues({ ...prev, [field]: value }));
  }

  function handleNext() {
    if (!paneComplete) {
      setValidationAttempted(true);
      return;
    }
    setValidationAttempted(false);
    setCurrentPaneIndex((index) => Math.min(index + 1, panes.length - 1));
  }

  function handleBack() {
    setValidationAttempted(false);
    setCurrentPaneIndex((index) => Math.max(index - 1, 0));
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
        <StepStrip left="Consent" right="Demographics -> Intro -> Task -> Surveys" />
        <div
          className="rounded-2xl border border-border px-6 py-8 sm:px-10 sm:py-10"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Before we begin
          </p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">
            {MISO_DEMOGRAPHICS_CONSENT_GATE.label}
          </h1>
          <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
            Do you consent to participate in this task and continue to the
            demographics questions?
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => setConsentAccepted(true)}
              className="h-11 min-w-[180px] rounded-xl px-[22px] text-sm text-primary-foreground"
            >
              {MISO_DEMOGRAPHICS_CONSENT_GATE.yesLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDeclineConsent}
              className="h-11 min-w-[180px] rounded-xl px-[22px] text-sm"
            >
              {MISO_DEMOGRAPHICS_CONSENT_GATE.noLabel}
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
        right="Demographics -> Intro -> Task -> Surveys"
      />

      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Block {currentPane.block.sourceBlock} of {MISO_DEMOGRAPHICS_BLOCKS.length}
        {currentPane.panesInBlock > 1
          ? ` - Pane ${currentPane.paneIndex + 1} of ${currentPane.panesInBlock}`
          : ""}
      </p>
      <h1 className="mt-2.5 text-3xl font-bold text-foreground">
        {currentPane.block.title}
      </h1>
      <p className="mt-2.5 max-w-[560px] text-sm leading-relaxed text-muted-foreground">
        Answer each visible question on this pane before continuing.
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
                showValidation={validationAttempted}
                isLast={index === visibleQuestions.length - 1}
                onChange={setField}
              />
            ))}
        </div>

        {(validationAttempted || error) && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error ?? "Please complete every visible question before continuing."}
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentPaneIndex === 0 || submitting}
            className="h-11 min-w-[140px] rounded-xl px-[22px] text-sm"
          >
            Back
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
              Roughly 18 minutes to complete
            </span>
            {isFinalPane ? (
              <Button
                type="submit"
                disabled={!paneComplete || submitting}
                className="h-11 min-w-[180px] rounded-xl px-[22px] text-sm text-primary-foreground"
              >
                {submitting ? "Saving..." : "Continue"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!paneComplete || submitting}
                onClick={handleNext}
                className="h-11 min-w-[160px] rounded-xl px-[22px] text-sm text-primary-foreground"
              >
                Next
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
  showValidation,
  isLast,
  onChange,
}: {
  question: MisoDemographicsQuestion;
  values: DemographicsFormValues;
  showValidation: boolean;
  isLast: boolean;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  const missing = showValidation && !questionAnswered(question, values);
  return (
    <div
      className={cn(
        "grid grid-cols-1 items-start gap-5 py-[22px] sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8",
        !isLast && "border-b border-border"
      )}
    >
      <div>
        <div className="text-[13px] font-semibold leading-relaxed text-foreground">
          {question.label}
        </div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {question.sourceId}
        </div>
      </div>
      <div className="space-y-3">
        {renderQuestionControl(question, values, onChange)}
        {otherTextVisible(question, values) && "otherText" in question && question.otherText && (
          <input
            type="text"
            value={(values[question.otherText.field] as string | undefined) ?? ""}
            onChange={(e) => onChange(question.otherText!.field, e.target.value)}
            placeholder="Please specify"
            className="h-10 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          />
        )}
        {missing && (
          <p className="text-xs font-medium text-destructive">
            This visible question is required.
          </p>
        )}
      </div>
    </div>
  );
}

function renderQuestionControl(
  question: MisoDemographicsQuestion,
  values: DemographicsFormValues,
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void
) {
  if (question.input === "slider") {
    return (
      <SliderQuestion question={question} value={values[question.field]} onChange={onChange} />
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
        onChange={onChange}
      />
    );
  }
  if (question.input === "boolean") {
    return <BooleanQuestion question={question} value={values[question.field]} onChange={onChange} />;
  }
  return (
    <SingleChoiceQuestion question={question} value={values[question.field]} onChange={onChange} />
  );
}

function SliderQuestion({
  question,
  value,
  onChange,
}: {
  question: MisoDemographicsSliderQuestion;
  value: DemographicsFormValue;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  const numericValue = typeof value === "number" ? value : question.min;
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_96px] sm:items-center">
      <input
        type="range"
        min={question.min}
        max={question.max}
        step={question.step}
        value={numericValue}
        onChange={(e) => onChange(question.field, Number(e.target.value))}
        className="w-full accent-primary"
      />
      <input
        type="number"
        min={question.min}
        max={question.max}
        step={question.step}
        value={typeof value === "number" ? value : ""}
        onChange={(e) => {
          const next = e.target.value === "" ? undefined : Number(e.target.value);
          onChange(question.field, next);
        }}
        className="h-10 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
      />
    </div>
  );
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
  onChange,
}: {
  question: MisoDemographicsSingleChoiceQuestion;
  value: DemographicsFormValue;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {question.options.map((option) => (
        <ChipButton
          key={option.value}
          selected={value === option.value}
          onClick={() => onChange(question.field, option.value)}
        >
          {option.label}
        </ChipButton>
      ))}
    </div>
  );
}

function MultiSelectQuestion({
  question,
  value,
  onChange,
}: {
  question: MisoDemographicsMultiSelectQuestion;
  value: DemographicsFormValue;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  const selected = Array.isArray(value) ? value : [];
  function toggle(optionValue: string) {
    const option = question.options.find((item) => item.value === optionValue);
    if (option?.exclusive) {
      onChange(question.field, selected.includes(optionValue) ? [] : [optionValue]);
      return;
    }
    const exclusiveValues = question.options
      .filter((item) => item.exclusive)
      .map((item) => item.value);
    const withoutExclusive = selected.filter((item) => !exclusiveValues.includes(item));
    const next = withoutExclusive.includes(optionValue)
      ? withoutExclusive.filter((item) => item !== optionValue)
      : [...withoutExclusive, optionValue];
    onChange(question.field, next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {question.options.map((option) => (
        <ChipButton
          key={option.value}
          selected={selected.includes(option.value)}
          onClick={() => toggle(option.value)}
        >
          {option.label}
        </ChipButton>
      ))}
    </div>
  );
}

function BooleanQuestion({
  question,
  value,
  onChange,
}: {
  question: MisoDemographicsBooleanQuestion;
  value: DemographicsFormValue;
  onChange: (field: MisoDemographicsField, value: DemographicsFormValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ChipButton selected={value === true} onClick={() => onChange(question.field, true)}>
        {question.trueLabel}
      </ChipButton>
      <ChipButton selected={value === false} onClick={() => onChange(question.field, false)}>
        {question.falseLabel}
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
