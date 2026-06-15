"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  apiPatch,
  getCognitiveBattery,
  getParticipantErrorMessage,
  type CognitiveTaskKey,
  type SessionResponse,
} from "@/lib/api";
import {
  EditorialTaskHeader,
  EditorialTaskPanel,
  EditorialTaskShell,
} from "@/lib/components/EditorialPrimitives";
import {
  buildTrialRunPath,
  getOrCreateTrialCognitiveTaskOrder,
  getWeatherWellnessSubmitMode,
  isLastCognitiveTask,
  nextCognitiveTaskPath,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";

const TASK: CognitiveTaskKey = "stroop";

/**
 * Placeholder Stroop route. The full task UI is implemented in a later task;
 * this page only wires battery routing so the assigned task order can advance
 * to the next cognitive task or to completion without breaking the flow.
 */
export default function StroopPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskOrder, setTaskOrder] = useState<CognitiveTaskKey[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (getWeatherWellnessSubmitMode(sessionId) === "trial") {
      setTaskOrder(getOrCreateTrialCognitiveTaskOrder());
      return;
    }
    getCognitiveBattery(sessionId)
      .then((battery) => {
        if (!cancelled) setTaskOrder(battery.task_order);
      })
      .catch(() => {
        if (!cancelled) setTaskOrder([TASK]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const order = taskOrder ?? [TASK];
    const lastTask = isLastCognitiveTask(order, TASK);
    const nextPath = nextCognitiveTaskPath(sessionId, order, TASK);
    try {
      await runTrialAwareSubmit(getWeatherWellnessSubmitMode(sessionId), {
        trial: () => {
          router.push(buildTrialRunPath(nextPath));
        },
        production: async () => {
          if (lastTask) {
            await apiPatch<SessionResponse>(`/sessions/${sessionId}/status`, { status: "complete" });
          }
          router.push(nextPath);
        },
      });
    } catch (err) {
      setError(getParticipantErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EditorialTaskShell>
      <EditorialTaskPanel className="space-y-7">
        <EditorialTaskHeader
          stepTag="05 / 05"
          breadcrumb="Weather Wellness"
          kicker="Cognitive task"
          title="Stroop"
          description="This task is not yet available. Continue to advance the battery."
        />
        <div className="flex flex-col items-center text-center">
          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button
            onClick={handleContinue}
            disabled={submitting}
            className="mt-8 rounded-xl px-8 text-primary-foreground"
          >
            {submitting ? "Submitting…" : "Continue"}
          </Button>
        </div>
      </EditorialTaskPanel>
    </EditorialTaskShell>
  );
}
