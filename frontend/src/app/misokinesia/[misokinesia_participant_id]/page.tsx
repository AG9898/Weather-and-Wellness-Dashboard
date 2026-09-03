"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import MisokinesiaVideoPlayer from "@/lib/components/MisokinesiaVideoPlayer";
import MisokinesiaQuestionnaire from "@/lib/components/MisokinesiaQuestionnaire";
import MisokinesiaEndOfTaskForm from "@/lib/components/MisokinesiaEndOfTaskForm";
import MisokinesiaSectionJumper from "@/lib/components/MisokinesiaSectionJumper";
import MisokinesiaMkaqForm, { MKAQ_ITEMS } from "@/lib/components/MisokinesiaMkaqForm";
import MisokinesiaGAD7Form from "@/lib/components/MisokinesiaGAD7Form";
import MisokinesiaMAQForm from "@/lib/components/MisokinesiaMAQForm";
import MisokinesiaDemographicsForm, {
  type DemographicsValues,
} from "@/lib/components/MisokinesiaDemographicsForm";
import {
  TRIAL_MAQ_ITEM_COUNT,
  TRIAL_MKAQ_ITEM_COUNT,
  type MisokinesiaTrialMode,
} from "@/lib/trial-mode";
import {
  patchSessionStatus,
  patchMisokinesiaDemographics,
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
  getSurveyPhaseFromTransition,
  type PostSurveyKey,
  type TransitionCardPhase,
} from "@/lib/misokinesia-phase";
import {
  getMisokinesiaSectionJumpState,
  misokinesiaSectionJumpSections,
  type MisokinesiaSectionTarget,
} from "@/lib/misokinesia-section-jump";
import {
  DEFAULT_MISO_LOCALE,
  misoLocaleTag,
  misoMessage,
  resolveMisoLocale,
  type MisoLocale,
  type MisoMessageKey,
} from "@/lib/i18n";
import { useTaskExitGuard } from "@/lib/useTaskExitGuard";

const MANIFEST_STORAGE_KEY = "misokinesia_manifest";
const PRE_CLIP_BUFFER_MS = 4000;
const PRE_CLIP_PROGRESS_MS = 2000;

/**
 * Meta-ledger label column. The floor keeps the EN ledger on the 140px rhythm
 * the editorial template specifies; `max-content` lets a Korean label that runs
 * wider push the column out instead of wrapping or clipping. EN labels all
 * measure under the floor, so EN rendering is unchanged.
 */
const META_LEDGER_COLUMNS = "minmax(140px, max-content) 1fr";

type Phase =
  | "loading"
  | "demographics"
  | "intro"
  | "transition_mkaq"
  | "transition_gad7"
  | "transition_maq"
  | "mkaq"
  | "gad7"
  | "maq"
  | "pre_play"
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
  /**
   * Session locale. Fixed for the life of the session and resolved from the
   * manifest the RA's launch wrote to `sessionStorage` — the production
   * manifest echoes `language` back from `POST /misokinesia/start`, and the
   * locally built trial manifest carries the RA's launch-page selection. It is
   * page state, never a route segment, so refreshing mid-task recovers it from
   * the same manifest rather than from the URL.
   */
  const [locale, setLocale] = useState<MisoLocale>(DEFAULT_MISO_LOCALE);
  const [trialMode, setTrialMode] = useState(false);
  const [trialModeType, setTrialModeType] = useState<MisokinesiaTrialMode | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [showPreClipProgress, setShowPreClipProgress] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Demographics submission state
  const [demographicsSubmitting, setDemographicsSubmitting] = useState(false);
  const [demographicsError, setDemographicsError] = useState<string | null>(null);

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
    answers: Record<string, number | string | null>;
  } | null>(null);

  // Fullscreen state
  const taskContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenStarted, setFullscreenStarted] = useState(false);

  // ── Refresh/leave guard: active while a recorded task is in progress ──
  // Inactive on loading/error/completion states and in trial-run mode.
  useTaskExitGuard(
    !trialMode && phase !== "loading" && phase !== "error" && phase !== "complete"
  );

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
          setLocale(resolveMisoLocale(m.language));
          setSurveyOrder(parseSurveyOrder(m.post_survey_order));
          setTrialMode(Boolean(activeTrial));
          setTrialModeType(
            activeTrial ? resolveTrialModeType(m, trialState?.misokinesia_trial_mode) : null
          );
          setPhase("demographics");
          return;
        }
      } catch {
        // fall through to error
      }
    }

    // No manifest means no recorded locale, so this one screen is always the
    // default locale. Every other screen runs on the manifest's language.
    setLoadError(misoMessage("chrome.error.manifest_missing", DEFAULT_MISO_LOCALE));
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

  // ── Pre-clip black interstitial ──
  useEffect(() => {
    if (phase !== "pre_play") return;
    setShowPreClipProgress(true);
    const progressTimer = setTimeout(() => {
      setShowPreClipProgress(false);
    }, PRE_CLIP_PROGRESS_MS);
    const playTimer = setTimeout(() => {
      setPhase("playing");
    }, PRE_CLIP_BUFFER_MS);
    return () => {
      clearTimeout(progressTimer);
      clearTimeout(playTimer);
    };
  }, [phase]);

  // ── Fullscreen: sync button state with actual fullscreen state ──
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // ── Fullscreen: enter when fullscreenStarted becomes true ──
  useEffect(() => {
    if (!fullscreenStarted) return;
    const el = taskContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) return; // already fullscreen
    el.requestFullscreen().catch(() => {
      // Fullscreen request rejected (e.g. permissions policy) — proceed without fullscreen
    });
  }, [fullscreenStarted]);

  const enterFullscreen = useCallback(() => {
    const el = taskContainerRef.current;
    if (!el || document.fullscreenElement) return;
    el.requestFullscreen().catch(() => {});
  }, []);

  const exitFullscreen = useCallback(() => {
    if (!document.fullscreenElement) return;
    document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (phase !== "complete") return;
    setFullscreenStarted(false);
    exitFullscreen();
  }, [phase, exitFullscreen]);

  const totalClips = manifest?.clips.length ?? 0;
  const currentClip = manifest?.clips[currentClipIndex];
  const clipNumber = currentClipIndex + 1; // 1-based display

  // ── State transition handlers ──

  async function handleDemographicsSubmit(values: DemographicsValues) {
    setDemographicsError(null);
    if (trialMode) {
      // Trial mode: advance locally without calling the API
      setFullscreenStarted(true);
      setPhase("intro");
      return;
    }
    if (!manifest) return;
    setDemographicsSubmitting(true);
    try {
      await patchMisokinesiaDemographics(participantId, values);
      setFullscreenStarted(true);
      setPhase("intro");
    } catch (err) {
      setDemographicsError(getParticipantErrorMessage(err));
    } finally {
      setDemographicsSubmitting(false);
    }
  }

  function handleBegin() {
    setPhase(getPhaseAfterBegin());
  }

  function handleVideoEnded() {
    setPhase("questionnaire");
  }

  function handleQuestionnaireComplete(result: MisokinesiaTrialResponseResult) {
    if (!result.is_complete) {
      setCurrentClipIndex((prev) => prev + 1);
      setPhase("pre_play");
      return;
    }

    setSurveyIndex(0);
    setPhase(getPhaseAfterVideoComplete(surveyOrder));
  }

  function handleTransitionContinue(transition: TransitionCardPhase) {
    setPhase(getSurveyPhaseFromTransition(transition));
  }

  function handleSurveyComplete(
    key: PostSurveyKey,
    answers: Record<string, number | string | null>
  ) {
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
    setFullscreenStarted(false);
    exitFullscreen();
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

  const activeJumpSection = getActiveJumpSection(phase);

  function handleSectionJump(target: MisokinesiaSectionTarget) {
    const jumpState = getMisokinesiaSectionJumpState(target, surveyOrder);

    setSurveySubmitting(null);
    setPendingSurvey(null);
    setSurveyError(null);
    setCompleting(false);
    setCompleteError(null);
    setSessionPatchAttempt(0);

    if (typeof jumpState.currentClipIndex === "number") {
      setCurrentClipIndex(jumpState.currentClipIndex);
    }
    if (typeof jumpState.surveyIndex === "number") {
      setSurveyIndex(jumpState.surveyIndex);
    }
    setPhase(jumpState.phase);
  }

  // ── Render ──

  if (phase === "loading") {
    return (
      <Screen locale={locale}>
        <div
          className="rounded-2xl border border-border px-10 py-10 text-center"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {misoMessage("chrome.task.name", locale)}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {misoMessage("chrome.state.loading_session", locale)}
          </p>
        </div>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen locale={locale}>
        <div
          className="rounded-2xl border border-border px-10 py-10 text-center"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {misoMessage("chrome.error.session_kicker", locale)}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-destructive">{loadError}</p>
        </div>
      </Screen>
    );
  }

  // ── Task container: wraps all post-demographics phases ──
  // demographics is rendered outside the container so the container can mount
  // before fullscreen is requested on demographics submit.

  function renderPhaseContent() {
    if (phase === "demographics") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
          <MisokinesiaDemographicsForm
            locale={locale}
            submitting={demographicsSubmitting}
            error={demographicsError}
            onSubmit={handleDemographicsSubmit}
            onDeclineConsent={() => router.push("/misokinesia")}
          />
        </div>
      );
    }

    if (phase === "intro") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-8">
          <div className="w-full max-w-[620px]">
            {/* Step indicator */}
            <div className="mb-9 flex items-center gap-3">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                {misoMessage("chrome.step.intro_position", locale)}
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {misoMessage("chrome.step.trail", locale)}
              </span>
            </div>

            {/* Card */}
            <div
              className="rounded-2xl border border-border px-11 py-10"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {misoMessage("chrome.task.name", locale)}
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground">
                {misoMessage("chrome.intro.title", locale)}
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">
                {/* Clip count is a catalogue parameter, not a concatenation, so
                    the Korean form is free to place it where the grammar wants. */}
                {misoMessage("chrome.intro.body", locale, { n: totalClips })}
              </p>

              {/* Meta ledger */}
              <div className="mt-7 border-t border-border">
                {[
                  {
                    k: misoMessage("chrome.intro.meta.clips.label", locale),
                    v: misoMessage("chrome.intro.meta.clips.value", locale, {
                      n: totalClips,
                    }),
                  },
                  {
                    k: misoMessage("chrome.intro.meta.per_clip.label", locale),
                    v: misoMessage("chrome.intro.meta.per_clip.value", locale),
                  },
                  {
                    k: misoMessage("chrome.intro.meta.after_clips.label", locale),
                    v: misoMessage("chrome.intro.meta.after_clips.value", locale),
                  },
                  {
                    k: misoMessage("chrome.intro.meta.estimated.label", locale),
                    v: misoMessage("chrome.intro.meta.estimated.value", locale),
                  },
                ].map((row, i, arr) => (
                  <div
                    key={row.k}
                    className={cn(
                      "grid items-center gap-6 py-3",
                      i < arr.length - 1 && "border-b border-border"
                    )}
                    style={{ gridTemplateColumns: META_LEDGER_COLUMNS }}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {row.k}
                    </span>
                    <span className="text-[13px] text-foreground">{row.v}</span>
                  </div>
                ))}
              </div>

              {/* Pause note */}
              <div
                className="mt-6 flex items-center gap-2.5 rounded-[10px] px-3.5 py-3"
                style={{ background: "var(--fieldset-bg)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {misoMessage("chrome.intro.fullscreen_note", locale)}
                </span>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleBegin}
                  className="h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground"
                >
                  {misoMessage("chrome.intro.begin", locale)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (
      phase === "transition_mkaq" ||
      phase === "transition_gad7" ||
      phase === "transition_maq"
    ) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <TransitionCard
            surveyKey={getSurveyPhaseFromTransition(phase as TransitionCardPhase)}
            surveyPosition={surveyIndex + 1}
            totalSurveys={surveyOrder.length || 3}
            locale={locale}
            onContinue={() => handleTransitionContinue(phase as TransitionCardPhase)}
          />
        </div>
      );
    }

    if (phase === "mkaq" || phase === "gad7" || phase === "maq") {
      const activeSurvey = phase;

      if (surveySubmitting === activeSurvey) {
        return (
          <Screen locale={locale}>
            <div
              className="rounded-2xl border border-border px-10 py-10 text-center"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {misoMessage("chrome.state.saving_kicker", locale)}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {misoMessage("chrome.state.submitting_survey", locale)}
              </p>
            </div>
          </Screen>
        );
      }

      if (surveyError && pendingSurvey?.key === activeSurvey) {
        return (
          <Screen locale={locale}>
            <div
              className="rounded-2xl border border-border px-10 py-10 text-center"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {misoMessage("chrome.error.submission_kicker", locale)}
              </p>
              {/* `surveyError` is FastAPI text, English-only by design
                  (LOCALIZATION.md 6.12); only the frame around it follows locale. */}
              <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {surveyError}
              </div>
              <Button
                onClick={handleSurveyRetry}
                className="mt-6 h-11 rounded-xl px-[22px] text-sm text-primary-foreground"
              >
                {misoMessage("chrome.button.retry", locale)}
              </Button>
            </div>
          </Screen>
        );
      }

      if (activeSurvey === "gad7") {
        return (
          <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
            <MisokinesiaGAD7Form
              locale={locale}
              submitting={surveySubmitting === "gad7"}
              error={surveyError}
              onSubmit={(answers) => handleSurveyComplete("gad7", answers)}
            />
          </div>
        );
      }

      if (activeSurvey === "maq") {
        const maqItemCount = trialModeType === "short" ? TRIAL_MAQ_ITEM_COUNT : undefined;
        return (
          <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
            <MisokinesiaMAQForm
              locale={locale}
              submitting={surveySubmitting === "maq"}
              error={surveyError}
              itemCount={maqItemCount}
              onSubmit={(answers) => handleSurveyComplete("maq", answers)}
            />
          </div>
        );
      }

      const mkaqItems =
        trialModeType === "short" ? MKAQ_ITEMS.slice(0, TRIAL_MKAQ_ITEM_COUNT) : MKAQ_ITEMS;
      return (
        <div className="flex min-h-screen flex-col items-center justify-start pt-4 px-4">
          <MisokinesiaMkaqForm
            locale={locale}
            items={mkaqItems}
            onComplete={(answers) => handleSurveyComplete("mkaq", answers)}
          />
        </div>
      );
    }

    if (phase === "pre_play" && currentClip) {
      return (
        <div className="relative flex min-h-screen flex-col items-center justify-center bg-black">
          {showPreClipProgress && (
            <ProgressIndicator
              clipNumber={clipNumber}
              totalClips={totalClips}
              locale={locale}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80"
            />
          )}
          {/* Hidden video element preloads the clip during the buffer */}
          <video
            key={currentClip.public_url}
            preload="auto"
            playsInline
            aria-hidden="true"
            className="hidden"
          >
            <source src={currentClip.public_url} type="video/mp4" />
          </video>
        </div>
      );
    }

    if (phase === "playing" && currentClip) {
      return (
        <div className="flex min-h-screen bg-black">
          <MisokinesiaVideoPlayer
            publicUrl={currentClip.public_url}
            locale={locale}
            onEnded={handleVideoEnded}
            immersive
          />
        </div>
      );
    }

    if (phase === "questionnaire" && currentClip) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-start px-4">
          <MisokinesiaQuestionnaire
            locale={locale}
            misokinesiaParticipantId={participantId}
            stimulusId={currentClip.stimulus_id}
            displayOrder={clipNumber}
            clipNumber={clipNumber}
            totalClips={totalClips}
            trialMode={trialMode}
            isFinalClip={clipNumber === totalClips}
            onComplete={handleQuestionnaireComplete}
          />
        </div>
      );
    }

    if (phase === "end_of_task") {
      return (
        <div className="flex min-h-screen flex-col items-center justify-start px-4 pt-4">
          <MisokinesiaEndOfTaskForm
            locale={locale}
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
          <Screen locale={locale}>
            <div
              className="rounded-2xl border border-border px-10 py-10 text-center"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {misoMessage("chrome.task.name", locale)}
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                {misoMessage("chrome.state.saving_results", locale)}
              </p>
            </div>
          </Screen>
        );
      }

      if (completeError) {
        return (
          <Screen locale={locale}>
            <div
              className="rounded-2xl border border-border px-10 py-10 text-center"
              style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {misoMessage("chrome.error.session_kicker", locale)}
              </p>
              {/* Server-produced text (LOCALIZATION.md 6.12); frame only is localized. */}
              <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {completeError}
              </div>
              <Button
                onClick={handleRetry}
                className="mt-6 h-11 rounded-xl px-[22px] text-sm text-primary-foreground"
              >
                {misoMessage("chrome.button.retry", locale)}
              </Button>
            </div>
          </Screen>
        );
      }

      return (
        <Screen locale={locale}>
          <div
            className="rounded-2xl border border-border px-10 py-12 text-center"
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            {/* Check mark */}
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <svg
                className="h-7 w-7 text-primary-foreground"
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

            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {misoMessage("chrome.complete.kicker", locale)}
            </p>
            <h1 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-foreground">
              {misoMessage("chrome.complete.title", locale)}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {misoMessage("chrome.complete.body", locale)}
            </p>

            <Button
              onClick={() => router.push("/misokinesia")}
              className="mt-8 h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground"
            >
              {misoMessage("chrome.complete.back", locale)}
            </Button>
          </div>
        </Screen>
      );
    }

    return null;
  }

  return (
    <div
      ref={taskContainerRef}
      // `lang` is the whole Hangul typography switch: the KO font fallback,
      // relaxed line-height and `keep-all` line breaking hang off `[lang|="ko"]`
      // in globals.css. It also gives assistive tech the right language for the
      // subtree — the document element stays `en` for the RA shell.
      lang={misoLocaleTag(locale)}
      className="relative w-full min-h-screen bg-background"
    >
      {renderPhaseContent()}

      {trialMode && activeJumpSection && (
        <div className="absolute left-1/2 top-14 z-40 w-[calc(100%-2rem)] max-w-[34rem] -translate-x-1/2 sm:top-3 sm:w-[calc(100%-13rem)]">
          <MisokinesiaSectionJumper
            sections={misokinesiaSectionJumpSections(locale)}
            activeSection={activeJumpSection}
            locale={locale}
            onJump={handleSectionJump}
          />
        </div>
      )}

      {/* Fullscreen toggle button — visible in task phases after demographics advances */}
      {fullscreenStarted && phase !== "complete" && (
        <FullscreenButton
          isFullscreen={isFullscreen}
          locale={locale}
          onEnter={enterFullscreen}
          onExit={exitFullscreen}
        />
      )}
    </div>
  );
}

function getActiveJumpSection(phase: Phase): MisokinesiaSectionTarget | null {
  if (phase === "intro") return "intro";
  if (phase === "pre_play" || phase === "playing" || phase === "questionnaire") return "clips";
  if (phase === "transition_mkaq" || phase === "mkaq") return "mkaq";
  if (phase === "transition_gad7" || phase === "gad7") return "gad7";
  if (phase === "transition_maq" || phase === "maq") return "maq";
  if (phase === "end_of_task") return "end";
  if (phase === "complete") return "done";
  return null;
}

// ── Shared layout components ──

/**
 * Centred single-card frame for the loading, saving, error and completion
 * states. `locale` is here only to carry the `lang` attribute: these states
 * render outside the task container, so they need their own typography scope.
 */
function Screen({
  locale = DEFAULT_MISO_LOCALE,
  children,
}: {
  locale?: MisoLocale;
  children: React.ReactNode;
}) {
  return (
    <div
      lang={misoLocaleTag(locale)}
      className="flex min-h-screen items-center justify-center px-4"
    >
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

function FullscreenButton({
  isFullscreen,
  locale = DEFAULT_MISO_LOCALE,
  onEnter,
  onExit,
}: {
  isFullscreen: boolean;
  locale?: MisoLocale;
  onEnter: () => void;
  onExit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={isFullscreen ? onExit : onEnter}
      aria-label={
        isFullscreen
          ? misoMessage("chrome.fullscreen.exit", locale)
          : misoMessage("chrome.fullscreen.enter_aria", locale)
      }
      className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {isFullscreen ? (
        <>
          <ExitFullscreenIcon />
          {misoMessage("chrome.fullscreen.exit", locale)}
        </>
      ) : (
        <>
          <EnterFullscreenIcon />
          {misoMessage("chrome.fullscreen.enter", locale)}
        </>
      )}
    </button>
  );
}

function EnterFullscreenIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function resolveTrialModeType(
  manifest: MisokinesiaManifest,
  stateMode?: MisokinesiaTrialMode
): MisokinesiaTrialMode {
  if (manifest.trial_mode === "full" || manifest.trial_mode === "short") {
    return manifest.trial_mode;
  }
  if (stateMode === "full" || stateMode === "short") {
    return stateMode;
  }
  return manifest.clips.length > 5 ? "full" : "short";
}

function ProgressIndicator({
  clipNumber,
  totalClips,
  locale = DEFAULT_MISO_LOCALE,
  className = "",
}: {
  clipNumber: number;
  totalClips: number;
  locale?: MisoLocale;
  className?: string;
}) {
  return (
    <p className={`mb-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground ${className}`}>
      {/* Both numbers are catalogue parameters — the KO form orders them itself. */}
      {misoMessage("chrome.clip.progress", locale, {
        n: clipNumber,
        m: totalClips,
      })}
    </p>
  );
}

// ── A5 Survey Transition Card ──

interface TransitionCardMeta {
  k: string;
  v: string;
}

interface TransitionCardCopy {
  kicker: string;
  title: string;
  description: string;
  meta: TransitionCardMeta[];
  buttonLabel: string;
}

/**
 * Catalogue keys per survey. Only the survey-specific half is keyed here; the
 * shared frame (kicker, meta labels, pause note) is the same three keys for all
 * three cards, so it is resolved once in `buildTransitionCardCopy`.
 */
const TRANSITION_CARD_KEYS: Record<
  PostSurveyKey,
  {
    title: MisoMessageKey;
    description: MisoMessageKey;
    metaItems: MisoMessageKey;
    metaFormat: MisoMessageKey;
    metaScale: MisoMessageKey;
    metaEstimated: MisoMessageKey;
    button: MisoMessageKey;
  }
> = {
  mkaq: {
    title: "chrome.transition.mkaq.title",
    description: "chrome.transition.mkaq.description",
    metaItems: "chrome.transition.mkaq.meta.items",
    metaFormat: "chrome.transition.mkaq.meta.format",
    metaScale: "chrome.transition.mkaq.meta.scale",
    metaEstimated: "chrome.transition.mkaq.meta.estimated",
    button: "chrome.transition.begin_assessment",
  },
  gad7: {
    title: "chrome.transition.gad7.title",
    description: "chrome.transition.gad7.description",
    metaItems: "chrome.transition.gad7.meta.items",
    metaFormat: "chrome.transition.gad7.meta.format",
    metaScale: "chrome.transition.gad7.meta.scale",
    metaEstimated: "chrome.transition.gad7.meta.estimated",
    button: "chrome.transition.begin_questionnaire",
  },
  maq: {
    title: "chrome.transition.maq.title",
    description: "chrome.transition.maq.description",
    metaItems: "chrome.transition.maq.meta.items",
    metaFormat: "chrome.transition.maq.meta.format",
    metaScale: "chrome.transition.maq.meta.scale",
    metaEstimated: "chrome.transition.maq.meta.estimated",
    button: "chrome.transition.begin_assessment",
  },
};

function buildTransitionCardCopy(
  surveyKey: PostSurveyKey,
  locale: MisoLocale,
  surveyPosition: number,
  totalSurveys: number
): TransitionCardCopy {
  const keys = TRANSITION_CARD_KEYS[surveyKey];
  return {
    // Position and total are catalogue parameters, so `다음 · 설문 1 / 3` can
    // order them differently from `Up next · Survey 1 of 3`.
    kicker: misoMessage("chrome.transition.kicker", locale, {
      pos: surveyPosition,
      total: totalSurveys,
    }),
    title: misoMessage(keys.title, locale),
    description: misoMessage(keys.description, locale),
    meta: [
      {
        k: misoMessage("chrome.transition.meta.items.label", locale),
        v: misoMessage(keys.metaItems, locale),
      },
      {
        k: misoMessage("chrome.transition.meta.format.label", locale),
        v: misoMessage(keys.metaFormat, locale),
      },
      {
        k: misoMessage("chrome.transition.meta.scale.label", locale),
        v: misoMessage(keys.metaScale, locale),
      },
      {
        k: misoMessage("chrome.transition.meta.estimated.label", locale),
        v: misoMessage(keys.metaEstimated, locale),
      },
    ],
    buttonLabel: misoMessage(keys.button, locale),
  };
}

function TransitionCard({
  surveyKey,
  surveyPosition,
  totalSurveys,
  locale = DEFAULT_MISO_LOCALE,
  onContinue,
}: {
  surveyKey: PostSurveyKey;
  surveyPosition: number;
  totalSurveys: number;
  locale?: MisoLocale;
  onContinue: () => void;
}) {
  const copy = buildTransitionCardCopy(
    surveyKey,
    locale,
    surveyPosition,
    totalSurveys
  );

  return (
    <div className="w-full max-w-[620px]">
      {/* Stage strip: "Clips complete ✓" — hairline — survey dots — "N / M surveys" */}
      <div className="mb-9 flex items-center gap-2.5">
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {misoMessage("chrome.transition.strip.clips_complete", locale)}
        </span>
        {/* Check glyph */}
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          style={{ width: 18, height: 18 }}
          aria-hidden
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="h-px flex-1 bg-border" aria-hidden />
        {/* Survey dots */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: totalSurveys }).map((_, i) => (
            <span
              key={i}
              className="block h-1 rounded-full"
              style={{
                width: 24,
                background:
                  i + 1 === surveyPosition
                    ? "var(--primary)"
                    : "var(--muted)",
              }}
            />
          ))}
        </div>
        <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {misoMessage("chrome.transition.strip.survey_count", locale, {
            n: surveyPosition,
            m: totalSurveys,
          })}
        </span>
      </div>

      {/* Card */}
      <div
        className="rounded-2xl border border-border px-11 py-10"
        style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
      >
        {/* Kicker */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {copy.kicker}
        </p>

        {/* Title */}
        <h1 className="mt-3 text-[34px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
          {copy.title}
        </h1>

        {/* Description */}
        <p className="mt-3.5 text-[14px] leading-relaxed text-muted-foreground">
          {copy.description}
        </p>

        {/* Meta ledger */}
        <div className="mt-7 border-t border-border">
          {copy.meta.map((row, i) => (
            <div
              key={row.k}
              className={cn(
                "grid items-center gap-6 py-3",
                i < copy.meta.length - 1 && "border-b border-border"
              )}
              style={{ gridTemplateColumns: META_LEDGER_COLUMNS }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {row.k}
              </span>
              <span className="text-[13px] text-foreground">{row.v}</span>
            </div>
          ))}
        </div>

        {/* Pause note */}
        <div
          className="mt-6 flex items-center gap-2.5 rounded-[10px] px-3.5 py-3"
          style={{ background: "var(--fieldset-bg)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
            className="shrink-0 text-muted-foreground"
          >
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <span className="text-xs leading-relaxed text-muted-foreground">
            {misoMessage("chrome.transition.pause_note", locale)}
          </span>
        </div>

        {/* CTA */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={onContinue}
            className="h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground"
          >
            {copy.buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
