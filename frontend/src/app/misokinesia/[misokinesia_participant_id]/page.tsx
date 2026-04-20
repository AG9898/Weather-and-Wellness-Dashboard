"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import TrialRunWatermark from "@/lib/components/TrialRunWatermark";
import MisokinesiaVideoPlayer from "@/lib/components/MisokinesiaVideoPlayer";
import MisokinesiaQuestionnaire from "@/lib/components/MisokinesiaQuestionnaire";
import MisokinesiaEndOfTaskForm from "@/lib/components/MisokinesiaEndOfTaskForm";
import {
  patchSessionStatus,
  getParticipantErrorMessage,
  type MisokinesiaManifest,
  type MisokinesiaTrialResponseResult,
} from "@/lib/api";
import {
  adoptTrialRunStateFromLocation,
} from "@/lib/trial-mode";

const MANIFEST_STORAGE_KEY = "misokinesia_manifest";

type Phase =
  | "loading"
  | "intro"
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

  const totalClips = manifest?.clips.length ?? 0;
  const currentClip = manifest?.clips[currentClipIndex];
  const clipNumber = currentClipIndex + 1; // 1-based display

  // ── State transition handlers ──

  function handleVideoEnded() {
    setPhase("questionnaire");
  }

  function handleQuestionnaireComplete(result: MisokinesiaTrialResponseResult) {
    if (result.is_complete) {
      setPhase("end_of_task");
    } else {
      setCurrentClipIndex((prev) => prev + 1);
      setPhase("playing");
    }
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
        <TrialRunWatermark />
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen>
        <TrialRunWatermark />
        <p className="text-sm text-destructive">{loadError}</p>
      </Screen>
    );
  }

  if (phase === "intro") {
    return (
      <Screen>
        <TrialRunWatermark />
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
          onClick={() => setPhase("playing")}
          className="mt-8 rounded-xl px-8 text-primary-foreground"
        >
          Begin
        </Button>
      </Screen>
    );
  }

  if (phase === "playing" && currentClip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-3 py-4 sm:px-4">
        <TrialRunWatermark />
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
        <TrialRunWatermark />
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
        <TrialRunWatermark />
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
          <TrialRunWatermark />
          <p className="text-sm text-muted-foreground">Saving your results…</p>
        </Screen>
      );
    }

    if (completeError) {
      return (
        <Screen>
          <TrialRunWatermark />
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
        <TrialRunWatermark />
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
          onClick={() => router.push("/dashboard")}
          className="mt-8 rounded-xl px-8 text-primary-foreground"
        >
          Return to Dashboard
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
