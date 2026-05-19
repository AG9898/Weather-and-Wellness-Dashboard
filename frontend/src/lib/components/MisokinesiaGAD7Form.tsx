"use client";

import SurveyForm, { type ScaleOption, type SurveyItem } from "@/lib/components/SurveyForm";

interface MisokinesiaGAD7FormProps {
  onSubmit: (answers: Record<string, number>) => void;
  submitting: boolean;
  error: string | null;
}

const GAD7_ITEMS: SurveyItem[] = [
  { number: 1, text: "I am feeling nervous, anxious, or on edge." },
  { number: 2, text: "I am not able to stop or control worrying." },
  { number: 3, text: "I am worrying too much about different things." },
  { number: 4, text: "I am having trouble relaxing." },
  { number: 5, text: "I am feeling so restless that it is hard to sit still." },
  { number: 6, text: "I am feeling easily annoyed or irritable." },
  { number: 7, text: "I am feeling afraid, as if something awful might happen." },
];

const GAD7_SCALE: ScaleOption[] = [
  { value: 1, label: "1 - Never" },
  { value: 2, label: "2 - Rarely" },
  { value: 3, label: "3 - Sometimes" },
  { value: 4, label: "4 - Often" },
];

export default function MisokinesiaGAD7Form({
  onSubmit,
  submitting,
  error,
}: MisokinesiaGAD7FormProps) {
  return (
    <SurveyForm
      title="Anxiety questionnaire"
      instructions="Please choose the response that best describes how you have been feeling."
      items={GAD7_ITEMS}
      scale={GAD7_SCALE}
      submitting={submitting}
      error={error}
      onSubmit={onSubmit}
    />
  );
}
