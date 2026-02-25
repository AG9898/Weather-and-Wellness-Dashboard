"use client";

import { useState } from "react";

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

  const allAnswered = items.every((item) => responses[item.number] !== undefined);

  const handleSelect = (itemNumber: number, value: number) => {
    setResponses((prev) => ({ ...prev, [itemNumber]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered) return;
    const payload: Record<string, number> = {};
    items.forEach((item) => {
      payload[`r${item.number}`] = responses[item.number];
    });
    onSubmit(payload);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">

      {/* Step context */}
      {stepLabel && (
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {stepLabel}
        </p>
      )}

      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{instructions}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {items.map((item) => (
          <fieldset key={item.number} className="space-y-3">
            <legend className="text-sm font-medium text-foreground leading-snug">
              {item.number}. {item.text}
            </legend>
            <div className="flex flex-wrap gap-2">
              {scale.map((opt) => {
                const selected = responses[item.number] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground hover:border-ring hover:text-foreground"
                    }`}
                    style={selected ? { background: "var(--ubc-blue-700)" } : undefined}
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
          </fieldset>
        ))}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!allAnswered || submitting}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: "var(--ubc-blue-700)" }}
        >
          {submitting ? "Submitting…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
