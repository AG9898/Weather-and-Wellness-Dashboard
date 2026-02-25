"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost, type ULS8Response } from "@/lib/api";
import SurveyForm, { type SurveyItem, type ScaleOption } from "@/lib/components/SurveyForm";

const SCALE: ScaleOption[] = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
];

const ITEMS: SurveyItem[] = [
  { number: 1, text: "I am lacking companionship." },
  { number: 2, text: "I am feeling that there is no one I can turn to." },
  { number: 3, text: "I am feeling outgoing." },
  { number: 4, text: "I am feeling left out." },
  { number: 5, text: "I am feeling isolated from others." },
  { number: 6, text: "I can find companionship if I want it." },
  { number: 7, text: "I am unhappy being so withdrawn." },
  { number: 8, text: "I am feeling that people are around me but not with me." },
];

export default function ULS8Page() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (responses: Record<string, number>) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost<ULS8Response>("/surveys/uls8", {
        session_id: sessionId,
        ...responses,
      });
      router.push(`/session/${sessionId}/cesd10`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SurveyForm
      title="ULS-8 — Loneliness Scale"
      stepLabel="Survey 1 of 4"
      instructions="Please indicate how often each statement describes you right now."
      items={ITEMS}
      scale={SCALE}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
