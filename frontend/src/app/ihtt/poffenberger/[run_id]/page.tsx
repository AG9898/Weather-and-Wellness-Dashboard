"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitPoffenbergerRun, getParticipantErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  TRIAL_RUN_STORAGE_KEY,
  readTrialRunState,
  type TrialRunPoffenbergerState,
} from "@/lib/trial-mode";
import {
  buildPoffenbergerSubmitPayload,
  createPoffenbergerSubmittedTrial,
  flattenPoffenbergerManifest,
  isExpectedPoffenbergerKey,
  POFFENBERGER_RESPONSE_CUTOFF_MS,
  readPoffenbergerRunState,
  type PoffenbergerRunState,
  type PoffenbergerTaskTrial,
  type PoffenbergerTrialTiming,
} from "@/lib/poffenberger-task";

type Phase =
  | "loading"
  | "error"
  | "consent"
  | "instructions"
  | "practice-intro"
  | "block-intro"
  | "waiting"
  | "stimulus"
  | "ready-submit"
  | "submitting"
  | "complete";

export default function PoffenbergerTaskPage() {
  const params = useParams();
  const runId = params.run_id as string;

  const [phase, setPhase] = useState<Phase>("loading");
  const [runState, setRunState] = useState<PoffenbergerRunState | null>(null);
  const [trialIndex, setTrialIndex] = useState(0);
  const [rows, setRows] = useState<ReturnType<typeof createPoffenbergerSubmittedTrial>[]>(
    []
  );
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answeredRef = useRef(false);
  const timingRef = useRef<PoffenbergerTrialTiming | null>(null);
  const finishTrialRef = useRef<(pressedKey: string | null) => void>(() => {});

  const trials = useMemo(
    () => (runState ? flattenPoffenbergerManifest(runState.manifest) : []),
    [runState]
  );
  const currentTrial = trials[trialIndex] ?? null;
  const isTrialMode = runState?.mode === "trial";
  const completedTrials = rows.length;

  useEffect(() => {
    const productionState = readPoffenbergerRunState(runId);
    if (productionState) {
      setRunState(productionState);
      setPhase("consent");
      return;
    }

    const trialState = readIhttTrialState(runId);
    if (trialState) {
      setRunState(trialState);
      setPhase("instructions");
      return;
    }

    setError("Task data was not found. Please ask the research assistant to restart the session.");
    setPhase("error");
  }, [runId]);

  useEffect(() => {
    return () => {
      clearActiveTimer(timeoutRef);
    };
  }, []);

  const finishTrial = useCallback(
    (pressedKey: string | null) => {
      if (!currentTrial || !timingRef.current || answeredRef.current) return;
      answeredRef.current = true;
      clearActiveTimer(timeoutRef);

      const now = performance.now();
      const timing: PoffenbergerTrialTiming = {
        ...timingRef.current,
        client_response_at_ms: pressedKey ? now : null,
        client_trial_ended_at_ms: now,
      };
      const row = createPoffenbergerSubmittedTrial(currentTrial, timing, pressedKey);

      setRows((existing) => [...existing, row]);

      const nextIndex = trialIndex + 1;
      const nextTrial = trials[nextIndex];
      if (!nextTrial) {
        setPhase("ready-submit");
        return;
      }

      setTrialIndex(nextIndex);
      if (shouldShowTransition(currentTrial, nextTrial)) {
        setPhase(nextTrial.is_practice ? "practice-intro" : "block-intro");
      } else {
        startTrial(nextTrial);
      }
    },
    [currentTrial, trialIndex, trials]
  );

  useEffect(() => {
    finishTrialRef.current = finishTrial;
  }, [finishTrial]);

  const startCurrentTrial = useCallback(() => {
    if (!currentTrial) return;
    startTrial(currentTrial);
  }, [currentTrial]);

  useEffect(() => {
    if (phase !== "stimulus" || !currentTrial) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!currentTrial) return;
      if (!isExpectedPoffenbergerKey(event.key, currentTrial.expected_key)) return;
      event.preventDefault();
      finishTrial(event.key);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, currentTrial, finishTrial]);

  async function submitRows() {
    if (!runState) return;
    setPhase("submitting");
    setSubmitError(null);

    if (isTrialMode) {
      setPhase("complete");
      return;
    }

    try {
      const payload = buildPoffenbergerSubmitPayload(runState, rows);
      await submitPoffenbergerRun(runState.run_id, payload);
      setPhase("complete");
    } catch (err) {
      setSubmitError(getParticipantErrorMessage(err));
      setPhase("ready-submit");
    }
  }

  function startTrial(trial: PoffenbergerTaskTrial) {
    clearActiveTimer(timeoutRef);
    answeredRef.current = false;
    const trialStartedAt = performance.now();
    timingRef.current = {
      client_trial_started_at_ms: trialStartedAt,
      client_stimulus_onset_ms: trialStartedAt,
      client_response_at_ms: null,
      client_trial_ended_at_ms: trialStartedAt,
    };
    setPhase("waiting");

    timeoutRef.current = setTimeout(() => {
      const onset = performance.now();
      timingRef.current = {
        client_trial_started_at_ms: trialStartedAt,
        client_stimulus_onset_ms: onset,
        client_response_at_ms: null,
        client_trial_ended_at_ms: onset,
      };
      setPhase("stimulus");
      timeoutRef.current = setTimeout(() => {
        finishTrialRef.current(null);
      }, POFFENBERGER_RESPONSE_CUTOFF_MS);
    }, trial.jitter_ms);
  }

  if (phase === "loading") {
    return <CenteredMessage title="Loading task" detail="Preparing the Poffenberger run." />;
  }

  if (phase === "error") {
    return <CenteredMessage title="Unable to start task" detail={error ?? "Task data missing."} />;
  }

  if (!runState || !currentTrial) {
    return <CenteredMessage title="Unable to start task" detail="Task manifest is incomplete." />;
  }

  if (phase === "complete") {
    return (
      <CenteredMessage
        icon={<CheckCircle2 className="h-8 w-8 text-primary-foreground" aria-hidden="true" />}
        title="Task Complete"
        detail="Please return this device to the research assistant."
      />
    );
  }

  if (phase === "waiting" || phase === "stimulus") {
    return <TimedStage phase={phase} trial={currentTrial} progress={completedTrials} total={trials.length} />;
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col justify-center">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-8">
          {phase === "consent" ? (
            <TaskIntro
              eyebrow="Consent"
              title="Poffenberger Reaction-Time Task"
              body="The research assistant has started this task for you. Continue only when you are ready to complete the full visual reaction-time task on this device."
              primaryLabel="I am ready"
              onPrimary={() => setPhase("instructions")}
            />
          ) : null}

          {phase === "instructions" ? (
            <TaskIntro
              eyebrow={isTrialMode ? "Trial run" : "Instructions"}
              title="Respond When The Dot Appears"
              body="Keep your eyes on the center cross. A dot will appear on the left or right side. Press only the key for the assigned hand as quickly as you can after the dot appears."
              primaryLabel="Continue"
              onPrimary={() => setPhase("practice-intro")}
            />
          ) : null}

          {phase === "practice-intro" ? (
            <TaskIntro
              eyebrow="Practice"
              title="Right Hand Practice"
              body="Use your right hand and press J when the dot appears. Practice trials are followed by the recorded blocks."
              primaryLabel="Start practice"
              onPrimary={startCurrentTrial}
            />
          ) : null}

          {phase === "block-intro" ? (
            <TaskIntro
              eyebrow={`Block ${currentTrial.block_number} of ${runState.manifest.blocks.length}`}
              title={`${capitalize(currentTrial.response_hand)} Hand Block`}
              body={`Use your ${currentTrial.response_hand} hand and press ${currentTrial.expected_key.toUpperCase()} for every dot in this block. No feedback is shown during experimental blocks.`}
              primaryLabel="Start block"
              onPrimary={startCurrentTrial}
            />
          ) : null}

          {phase === "ready-submit" || phase === "submitting" ? (
            <TaskIntro
              eyebrow="Submission"
              title={phase === "submitting" ? "Submitting" : "Ready To Submit"}
              body={
                submitError ??
                "All raw timing rows are captured. Submit the task and keep this page open until completion appears."
              }
              primaryLabel={phase === "submitting" ? "Submitting..." : "Submit task"}
              onPrimary={submitRows}
              disabled={phase === "submitting"}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function TimedStage({
  phase,
  trial,
  progress,
  total,
}: {
  phase: "waiting" | "stimulus";
  trial: PoffenbergerTaskTrial;
  progress: number;
  total: number;
}) {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex h-12 items-center justify-between px-4 text-xs font-semibold uppercase text-muted-foreground sm:px-6">
        <span>{trial.is_practice ? "Practice" : `Block ${trial.block_number}`}</span>
        <span>
          {Math.min(progress + 1, total)} / {total}
        </span>
      </div>
      <section
        className="relative mx-auto grid w-full max-w-5xl flex-1 place-items-center px-4"
        aria-label="Poffenberger timed trial stage"
      >
        <div className="relative h-[min(62vh,520px)] w-full min-w-[320px] max-w-4xl border-x border-border/70">
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground" />
            <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-foreground" />
          </div>
          {phase === "stimulus" ? (
            <div
              className={cn(
                "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-foreground",
                trial.visual_field === "lvf" ? "left-[24%]" : "right-[24%]"
              )}
              aria-label={`${trial.visual_field.toUpperCase()} stimulus`}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function TaskIntro({
  eyebrow,
  title,
  body,
  primaryLabel,
  onPrimary,
  disabled = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{body}</p>
      </div>
      <Button type="button" size="lg" onClick={onPrimary} disabled={disabled}>
        {primaryLabel}
      </Button>
    </div>
  );
}

function CenteredMessage({
  icon,
  title,
  detail,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        {icon ? (
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            {icon}
          </div>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
      </section>
    </main>
  );
}

function readIhttTrialState(runId: string): TrialRunPoffenbergerState | null {
  const state = readTrialRunState();
  if (state?.flow === "ihtt-poffenberger" && state.run_id === runId) {
    return state as TrialRunPoffenbergerState;
  }

  try {
    const raw = window.sessionStorage.getItem(TRIAL_RUN_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as TrialRunPoffenbergerState) : null;
    return parsed?.flow === "ihtt-poffenberger" && parsed.run_id === runId ? parsed : null;
  } catch {
    return null;
  }
}

function shouldShowTransition(
  current: PoffenbergerTaskTrial,
  next: PoffenbergerTaskTrial
): boolean {
  if (current.is_practice !== next.is_practice) return true;
  return !next.is_practice && current.block_number !== next.block_number;
}

function clearActiveTimer(ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
