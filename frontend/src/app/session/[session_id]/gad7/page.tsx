"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost, type GAD7Response } from "@/lib/api";
import SurveyForm, { type SurveyItem, type ScaleOption } from "@/lib/components/SurveyForm";

const SCALE: ScaleOption[] = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
];

const ITEMS: SurveyItem[] = [
  { number: 1, text: "I am feeling nervous, anxious, or on edge." },
  { number: 2, text: "I am not able to stop or control worrying." },
  { number: 3, text: "I am worrying too much about different things." },
  { number: 4, text: "I am having trouble relaxing." },
  { number: 5, text: "I am feeling so restless that it is hard to sit still." },
  { number: 6, text: "I am feeling easily annoyed or irritable." },
  { number: 7, text: "I am feeling afraid, as if something awful might happen." },
];

export default function GAD7Page() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (responses: Record<string, number>) => {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost<GAD7Response>("/surveys/gad7", {
        session_id: sessionId,
        ...responses,
      });
      router.push(`/session/${sessionId}/cogfunc`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SurveyForm
      title="GAD-7 — Generalized Anxiety Scale"
      instructions="Please indicate how often each statement describes you right now."
      items={ITEMS}
      scale={SCALE}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
