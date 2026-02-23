"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost, type CESD10Response } from "@/lib/api";
import SurveyForm, { type SurveyItem, type ScaleOption } from "@/lib/components/SurveyForm";

const SCALE: ScaleOption[] = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
];

const ITEMS: SurveyItem[] = [
  { number: 1, text: "I am being bothered by things that don't usually bother me." },
  { number: 2, text: "I am having trouble keeping my mind on what I am doing." },
  { number: 3, text: "I am feeling depressed." },
  { number: 4, text: "I am feeling everything I do is an effort." },
  { number: 5, text: "I am feeling hopeful about the future." },
  { number: 6, text: "I am feeling fearful." },
  { number: 7, text: "My sleep was restless." },
  { number: 8, text: "I am feeling happy." },
  { number: 9, text: "I am feeling lonely." },
  { number: 10, text: 'I cannot "get going."' },
];

export default function CESD10Page() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (responses: Record<string, number>) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost<CESD10Response>("/surveys/cesd10", {
        session_id: sessionId,
        ...responses,
      });
      router.push(`/session/${sessionId}/gad7`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SurveyForm
      title="CES-D 10 — Depression Scale"
      instructions="Please indicate how often each statement describes you right now."
      items={ITEMS}
      scale={SCALE}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
