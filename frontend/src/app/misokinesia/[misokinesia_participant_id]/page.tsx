"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import MisokinesiaVideoPlayer from "@/lib/components/MisokinesiaVideoPlayer";
import MisokinesiaQuestionnaire from "@/lib/components/MisokinesiaQuestionnaire";
import MisokinesiaEndOfTaskForm from "@/lib/components/MisokinesiaEndOfTaskForm";
import MisokinesiaMkaqForm, { MKAQ_ITEMS } from "@/lib/components/MisokinesiaMkaqForm";
import { TRIAL_MKAQ_ITEM_COUNT } from "@/lib/trial-mode";
import {
  patchSessionStatus,
  getParticipantErrorMessage,
  submitMisokinesiaMkaq,
  type MisokinesiaManifest,
  type MisokinesiaTrialResponseResult,
  type MisokinesiaMkaqRequest,
} from "@/lib/api";
import {
  adoptTrialRunStateFromLocation,
  getMisokinesiaSubmitMode,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";
import {
  getPhaseAfterBegin,
  getPhaseAfterMkaqComplete,
  getPhaseAfterQuestionnaireComplete,
} from "@/lib/misokinesia-phase";

const MANIFEST_STORAGE_KEY = "misokinesia_manifest";

type Phase =
  | "loading"
  | "intro"
  | "mkaq"
  | "playing"
  | "questionnaire"
  | "end_of_task"
  | "complete"
  | "error";

export default function MisokinesiaTaskPage() {
  const params = useParams();
  const router = useRouter();
  const participantId = params.misokinesia_participant_id as string;

  const [manifest, setManifest] = useState<MisokinesiaManifest | null>(null);
  const [trialMode, setTrialMode] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Complete-phase patch state
  const [sessionPatchAttempt, setSessionPatchAttempt] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // MkAQ submission state
  const [mkaqSubmitTrigger, setMkaqSubmitTrigger] = useState(0);
  const [mkaqSubmitting, setMkaqSubmitting] = useState(false);
  const [mkaqError, setMkaqError] = useState<string | null>(null);
  const [mkaqPendingAnswers, setMkaqPendingAnswers] = useState<Record<string, number> | null>(null);

  // ── Load manifest from sessionStorage on mount ──
  useEffect(() => {
    const trialState = adoptTrialRunStateFromLocation({
      pathname: window.location.pathname,
      search: window.location.search,
    });
    const activeTrial =
      trialState?.flow === "misokinesia" &&
      trialState.misokinesia_participant_id === participantId;

    const raw = sessionStorage.getItem(MANIFEST_STORAGE_KEY);
    if (raw) {
      try {
        const m = JSON.parse(raw) as MisokinesiaManifest;
        if (m.misokinesia_participant_id === participantId) {
          setManifest(m);
          setTrialMode(Boolean(activeTrial));
          setPhase("intro");
          return;
        }
      } catch {
        // fall through to error
      }
    }

    setLoadError(
      "Session data not found. Please ask the research assistant to restart the session."
    );
    setPhase("error");
  }, [participantId]);

  // ── Patch session status when entering complete phase ──
  useEffect(() => {
    if (sessionPatchAttempt === 0 || !manifest || trialMode) return;
    let cancelled = false;

    async function run() {
      setCompleteError(null);
      try {
        await patchSessionStatus(manifest!.session_id, "complete");
        if (!cancelled) setCompleting(false);
      } catch (err) {
        if (!cancelled) {
          setCompleteError(getParticipantErrorMessage(err));
          setCompleting(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sessionPatchAttempt, manifest, trialMode]);

  // ── Submit MkAQ when trigger fires ──
  useEffect(() => {
    if (mkaqSubmitTrigger === 0 || !mkaqPendingAnswers || !manifest) return;
    let cancelled = false;

    async function run() {
      setMkaqError(null);
      try {
        await runTrialAwareSubmit(getMisokinesiaSubmitMode(trialMode), {
          production: async () => {
            await submitMisokinesiaMkaq(
              participantId,
              mkaqPendingAnswers as unknown as MisokinesiaMkaqRequest
            );
          },
          trial: () => {},
        });
        if (!cancelled) {
          setMkaqSubmitting(false);
          setPhase(getPhaseAfterMkaqComplete());
        }
      } catch (err) {
        if (!cancelled) {
          setMkaqError(getParticipantErrorMessage(err));
          setMkaqSubmitting(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [mkaqSubmitTrigger, mkaqPendingAnswers, manifest, trialMode, participantId]);

  const totalClips = manifest?.clips.length ?? 0;
  const currentClip = manifest?.clips[currentClipIndex];
  const clipNumber = currentClipIndex + 1; // 1-based display

  // ── State transition handlers ──

  function handleBegin() {
    setPhase(getPhaseAfterBegin());
  }

  function handleVideoEnded() {
    setPhase("questionnaire");
  }

  function handleQuestionnaireComplete(result: MisokinesiaTrialResponseResult) {
    const nextPhase = getPhaseAfterQuestionnaireComplete(
      result.is_complete,
      manifest?.post_survey_order
    );
    if (nextPhase === "playing") {
      setCurrentClipIndex((prev) => prev + 1);
    }
    setPhase(nextPhase);
  }

  function handleMkaqComplete(answers: Record<string, number>) {
    setMkaqPendingAnswers(answers);
    setMkaqSubmitting(true);
    setMkaqSubmitTrigger((n) => n + 1);
  }

  function handleMkaqRetry() {
    setMkaqSubmitting(true);
    setMkaqSubmitTrigger((n) => n + 1);
  }

  function handleEndOfTaskComplete() {
    setPhase("complete");
    if (trialMode) {
      setCompleting(false);
      setSessionPatchAttempt(0);
      setCompleteError(null);
      return;
    }

    setCompleting(true);
    setSessionPatchAttempt(1);
  }

  function handleRetry() {
    setCompleting(true);
    setSessionPatchAttempt((prev) => prev + 1);
  }

  // ── Render ──

  if (phase === "loading") {
    return (
      <Screen>
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen>
        <p className="text-sm text-destructive">{loadError}</p>
      </Screen>
    );
  }

  if (phase === "intro") {
    return (
      <Screen>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Misokinesia Task
        </p>
        <h1 className="text-2xl font-bold text-foreground">Video Clip Questionnaire</h1>

        <div className="mt-6 space-y-2 text-sm text-muted-foreground text-left">
          <p>You will watch {totalClips} short video clips.</p>
          <p>After each clip, you will be asked a few questions about how you felt.</p>
          <p>There are no right or wrong answers — just answer honestly.</p>
        </div>

        <Button
          onClick={handleBegin}
          className="mt-8 rounded-xl px-8 text-primary-foreground"
        >
          Begin
        </Button>
      </Screen>
    );
  }

  if (phase === "mkaq") {
    if (mkaqSubmitting) {
      return (
        <Screen>
          <p className="text-sm text-muted-foreground">Submitting questionnaire…</p>
        </Screen>
      );
    }

    if (mkaqError) {
      return (
        <Screen>
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {mkaqError}
          </div>
          <Button
            onClick={handleMkaqRetry}
            className="rounded-xl px-8 text-primary-foreground"
          >
            Retry
          </Button>
        </Screen>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
        <MisokinesiaMkaqForm
          items={trialMode ? MKAQ_ITEMS.slice(0, TRIAL_MKAQ_ITEM_COUNT) : MKAQ_ITEMS}
          onComplete={handleMkaqComplete}
        />
      </div>
    );
  }

  if (phase === "playing" && currentClip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-3 py-4 sm:px-4">
        <div className="w-full max-w-[92rem] space-y-3">
          <ProgressIndicator clipNumber={clipNumber} totalClips={totalClips} />
          <MisokinesiaVideoPlayer
            publicUrl={currentClip.public_url}
            onEnded={handleVideoEnded}
          />
        </div>
      </div>
    );
  }

  if (phase === "questionnaire" && currentClip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start pt-8 px-4">
        <div className="w-full max-w-2xl">
          <ProgressIndicator clipNumber={clipNumber} totalClips={totalClips} />
        </div>
        <MisokinesiaQuestionnaire
          misokinesiaParticipantId={participantId}
          stimulusId={currentClip.stimulus_id}
          displayOrder={clipNumber}
          trialMode={trialMode}
          isFinalClip={clipNumber === totalClips}
          onComplete={handleQuestionnaireComplete}
        />
      </div>
    );
  }

  if (phase === "end_of_task") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start pt-8 px-4">
        <MisokinesiaEndOfTaskForm
          misokinesiaParticipantId={participantId}
          trialMode={trialMode}
          onComplete={handleEndOfTaskComplete}
        />
      </div>
    );
  }

  if (phase === "complete") {
    if (completing) {
      return (
        <Screen>
          <p className="text-sm text-muted-foreground">Saving your results…</p>
        </Screen>
      );
    }

    if (completeError) {
      return (
        <Screen>
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {completeError}
          </div>
          <Button
            onClick={handleRetry}
            className="rounded-xl px-8 text-primary-foreground"
          >
            Retry
          </Button>
        </Screen>
      );
    }

    return (
      <Screen>
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary"
        >
          <svg
            className="h-8 w-8 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Thank you</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The session is complete. Please return this device to the research assistant.
        </p>
        <Button
          onClick={() => router.push("/misokinesia")}
          className="mt-8 rounded-xl px-8 text-primary-foreground"
        >
          Back to Misokinesia
        </Button>
      </Screen>
    );
  }

  return null;
}

// ── Shared layout components ──

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

function ProgressIndicator({
  clipNumber,
  totalClips,
}: {
  clipNumber: number;
  totalClips: number;
}) {
  return (
    <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      Clip {clipNumber} of {totalClips}
    </p>
  );
}
