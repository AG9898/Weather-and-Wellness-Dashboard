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
  instructions: string;
  items: SurveyItem[];
  scale: ScaleOption[];
  submitting: boolean;
  error: string | null;
  onSubmit: (responses: Record<string, number>) => void;
}

export default function SurveyForm({
  title,
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
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-zinc-600">{instructions}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {items.map((item) => (
          <fieldset key={item.number} className="space-y-2">
            <legend className="text-sm font-medium">
              {item.number}. {item.text}
            </legend>
            <div className="flex flex-wrap gap-3">
              {scale.map((opt) => {
                const selected = responses[item.number] === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-md border px-4 py-2 text-sm transition-colors ${
                      selected
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 hover:border-zinc-400"
                    }`}
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!allAnswered || submitting}
          className="rounded-md bg-zinc-900 px-6 py-2 text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
