"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost, apiPatch, type CogFunc8aResponse, type SessionResponse } from "@/lib/api";
import SurveyForm, { type SurveyItem, type ScaleOption } from "@/lib/components/SurveyForm";

const SCALE: ScaleOption[] = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
  { value: 5, label: "Very Often" },
];

const ITEMS: SurveyItem[] = [
  { number: 1, text: "My thinking is slow." },
  { number: 2, text: "It seems like my brain is not working as well as usual." },
  { number: 3, text: "I am having to work harder than usual to focus on what I am doing." },
  { number: 4, text: "I am having trouble shifting back and forth between different activities that require thinking." },
  { number: 5, text: "I am having trouble concentrating." },
  { number: 6, text: "I am having to work hard to pay attention, or I will make a mistake." },
  { number: 7, text: "I am having trouble forming thoughts." },
  { number: 8, text: "I am having trouble adding or subtracting numbers in my head." },
];

export default function CogFuncPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (responses: Record<string, number>) => {
    setSubmitting(true);
    setError(null);
    try {
      // Submit survey
      await apiPost<CogFunc8aResponse>("/surveys/cogfunc8a", {
        session_id: sessionId,
        ...responses,
      });

      // Mark session complete
      await apiPatch<SessionResponse>(
        `/sessions/${sessionId}/status`,
        { status: "complete" }
      );

      router.push(`/session/${sessionId}/complete`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SurveyForm
      title="Cognitive Function 8a"
      stepLabel="Survey 4 of 4"
      instructions="Please respond to each question or statement by marking one box per row. Right now..."
      items={ITEMS}
      scale={SCALE}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
