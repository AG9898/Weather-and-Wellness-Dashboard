"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import MisokinesiaVideoPlayer from "@/lib/components/MisokinesiaVideoPlayer";
import MisokinesiaQuestionnaire from "@/lib/components/MisokinesiaQuestionnaire";
import MisokinesiaEndOfTaskForm from "@/lib/components/MisokinesiaEndOfTaskForm";
import MisokinesiaMkaqForm, { MKAQ_ITEMS } from "@/lib/components/MisokinesiaMkaqForm";
import MisokinesiaGAD7Form from "@/lib/components/MisokinesiaGAD7Form";
import MisokinesiaMAQForm from "@/lib/components/MisokinesiaMAQForm";
import { TRIAL_MKAQ_ITEM_COUNT } from "@/lib/trial-mode";
import {
  patchSessionStatus,
  getParticipantErrorMessage,
  parseSurveyOrder,
  submitMisokinesiaGAD7,
  submitMisokinesiaMAQ,
  submitMisokinesiaMkaq,
  type MisokinesiaManifest,
  type MisokinesiaTrialResponseResult,
  type MisokinesiaGAD7Request,
  type MisokinesiaMAQRequest,
  type MisokinesiaMkaqRequest,
} from "@/lib/api";
import {
  adoptTrialRunStateFromLocation,
  getMisokinesiaSubmitMode,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";
import {
  getPhaseAfterBegin,
  getPhaseAfterVideoComplete,
  getNextPostSurveyPhase,
  type PostSurveyKey,
} from "@/lib/misokinesia-phase";

const MANIFEST_STORAGE_KEY = "misokinesia_manifest";

type Phase =
  | "loading"
  | "intro"
  | "mkaq"
  | "gad7"
  | "maq"
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

  // Post-video survey submission state
  const [surveyOrder, setSurveyOrder] = useState<PostSurveyKey[]>([]);
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [surveySubmitTrigger, setSurveySubmitTrigger] = useState(0);
  const [surveySubmitting, setSurveySubmitting] = useState<PostSurveyKey | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [pendingSurvey, setPendingSurvey] = useState<{
    key: PostSurveyKey;
    answers: Record<string, number>;
  } | null>(null);

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
          setSurveyOrder(parseSurveyOrder(m.post_survey_order));
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

  // ── Submit the active post-video survey when trigger fires ──
  useEffect(() => {
    if (surveySubmitTrigger === 0 || !pendingSurvey || !manifest) return;
    let cancelled = false;

    async function run() {
      setSurveyError(null);
      try {
        await runTrialAwareSubmit(getMisokinesiaSubmitMode(trialMode), {
          production: async () => {
            if (pendingSurvey!.key === "mkaq") {
              await submitMisokinesiaMkaq(
                participantId,
                pendingSurvey!.answers as unknown as MisokinesiaMkaqRequest
              );
              return;
            }
            if (pendingSurvey!.key === "gad7") {
              await submitMisokinesiaGAD7(
                participantId,
                pendingSurvey!.answers as unknown as MisokinesiaGAD7Request
              );
              return;
            }
            await submitMisokinesiaMAQ(
              participantId,
              pendingSurvey!.answers as unknown as MisokinesiaMAQRequest
            );
          },
          trial: () => {},
        });
        if (!cancelled) {
          const nextPhase = getNextPostSurveyPhase(surveyOrder, surveyIndex);
          setSurveySubmitting(null);
          setPendingSurvey(null);
          setSurveyError(null);
          if (nextPhase !== "end_of_task") {
            setSurveyIndex((index) => index + 1);
          }
          setPhase(nextPhase);
        }
      } catch (err) {
        if (!cancelled) {
          setSurveyError(getParticipantErrorMessage(err));
          setSurveySubmitting(null);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [
    surveySubmitTrigger,
    pendingSurvey,
    manifest,
    trialMode,
    participantId,
    surveyOrder,
    surveyIndex,
  ]);

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
    if (!result.is_complete) {
      setCurrentClipIndex((prev) => prev + 1);
      setPhase("playing");
      return;
    }

    setSurveyIndex(0);
    setPhase(getPhaseAfterVideoComplete(surveyOrder));
  }

  function handleSurveyComplete(key: PostSurveyKey, answers: Record<string, number>) {
    setPendingSurvey({ key, answers });
    setSurveySubmitting(key);
    setSurveySubmitTrigger((n) => n + 1);
  }

  function handleSurveyRetry() {
    if (!pendingSurvey) return;
    setSurveySubmitting(pendingSurvey.key);
    setSurveySubmitTrigger((n) => n + 1);
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

  if (phase === "mkaq" || phase === "gad7" || phase === "maq") {
    const activeSurvey = phase;

    if (surveySubmitting === activeSurvey) {
      return (
        <Screen>
          <p className="text-sm text-muted-foreground">Submitting questionnaire…</p>
        </Screen>
      );
    }

    if (surveyError && pendingSurvey?.key === activeSurvey) {
      return (
        <Screen>
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {surveyError}
          </div>
          <Button
            onClick={handleSurveyRetry}
            className="rounded-xl px-8 text-primary-foreground"
          >
            Retry
          </Button>
        </Screen>
      );
    }

    if (activeSurvey === "gad7") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
          <MisokinesiaGAD7Form
            submitting={surveySubmitting === "gad7"}
            error={surveyError}
            onSubmit={(answers) => handleSurveyComplete("gad7", answers)}
          />
        </div>
      );
    }

    if (activeSurvey === "maq") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
          <MisokinesiaMAQForm
            submitting={surveySubmitting === "maq"}
            error={surveyError}
            onSubmit={(answers) => handleSurveyComplete("maq", answers)}
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
        <MisokinesiaMkaqForm
          items={trialMode ? MKAQ_ITEMS.slice(0, TRIAL_MKAQ_ITEM_COUNT) : MKAQ_ITEMS}
          onComplete={(answers) => handleSurveyComplete("mkaq", answers)}
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
