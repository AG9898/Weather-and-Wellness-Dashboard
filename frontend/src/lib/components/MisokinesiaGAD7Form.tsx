"use client";

import SurveyForm, { type ScaleOption, type SurveyItem } from "@/lib/components/SurveyForm";

interface MisokinesiaGAD7FormProps {
  onSubmit: (answers: Record<string, number>) => void;
  submitting: boolean;
  error: string | null;
}

const GAD7_ITEMS: SurveyItem[] = [
  { number: 1, text: "Feeling nervous, anxious, or on edge" },
  { number: 2, text: "Not being able to stop or control worrying" },
  { number: 3, text: "Worrying too much about different things" },
  { number: 4, text: "Trouble relaxing" },
  { number: 5, text: "Being so restless that it is hard to sit still" },
  { number: 6, text: "Becoming easily annoyed or irritable" },
  { number: 7, text: "Feeling afraid, as if something awful might happen" },
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
      instructions="Over the last two weeks, how often have you been bothered by the following problems?"
      items={GAD7_ITEMS}
      scale={GAD7_SCALE}
      submitting={submitting}
      error={error}
      onSubmit={onSubmit}
    />
  );
}
