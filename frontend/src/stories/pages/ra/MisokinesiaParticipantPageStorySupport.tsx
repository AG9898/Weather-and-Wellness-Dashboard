"use client";

/**
 * MisokinesiaParticipantPageStorySupport.tsx
 *
 * Storybook mock shell for the redesigned Misokinesia participant flow.
 * All components receive mocked props only — no backend calls are made.
 *
 * Phase coverage:
 *   loading, error, demographics, intro, questionnaire, transition_mkaq,
 *   transition_gad7, transition_maq, mkaq, gad7, maq, end_of_task,
 *   complete, completing, complete_error
 */

import type { Decorator } from "@storybook/nextjs-vite";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import MisokinesiaDemographicsForm, {
  type DemographicsFormValues,
} from "@/lib/components/MisokinesiaDemographicsForm";
import MisokinesiaQuestionnaire from "@/lib/components/MisokinesiaQuestionnaire";
import MisokinesiaEndOfTaskForm from "@/lib/components/MisokinesiaEndOfTaskForm";
import MisokinesiaSectionJumper from "@/lib/components/MisokinesiaSectionJumper";
import MisokinesiaMkaqForm, {
  MKAQ_ITEMS,
} from "@/lib/components/MisokinesiaMkaqForm";
import MisokinesiaGAD7Form from "@/lib/components/MisokinesiaGAD7Form";
import MisokinesiaMAQForm from "@/lib/components/MisokinesiaMAQForm";
import {
  MISOKINESIA_SECTION_JUMP_SECTIONS,
  type MisokinesiaSectionTarget,
} from "@/lib/misokinesia-section-jump";
import { TRIAL_MAQ_ITEM_COUNT, TRIAL_MKAQ_ITEM_COUNT } from "@/lib/trial-mode";

// ── Phase type ────────────────────────────────────────────────────────────────

export type ParticipantStoryPhase =
  | "loading"
  | "error"
  | "demographics"
  | "intro"
  | "questionnaire"
  | "transition_mkaq"
  | "transition_gad7"
  | "transition_maq"
  | "mkaq"
  | "gad7"
  | "maq"
  | "end_of_task"
  | "complete"
  | "completing"
  | "complete_error";

// ── Component props ───────────────────────────────────────────────────────────

export interface MisokinesiaParticipantStoryShellProps {
  phase?: ParticipantStoryPhase;
  /** Demographics: accept consent gate and pre-fill the selected pane */
  demoAnswered?: boolean;
  /** Demographics: show inline error banner */
  demoError?: boolean;
  /** Demographics: show submitting state */
  demoSubmitting?: boolean;
  /** Demographics: zero-based pane index from the sourced block carousel */
  demoPaneIndex?: number;
  /** Demographics: show required-field validation state */
  demoValidationAttempted?: boolean;
  /** Questionnaire: number of answered questions (0-4) */
  clipAnswered?: number;
  /** Questionnaire: which clip number to show (default 3) */
  clipNumber?: number;
  /** Questionnaire: total clips count (default 25) */
  totalClips?: number;
  /** Trial shell: true renders the trial-only section jumper */
  trialMode?: boolean;
  /** Trial shell: short uses shortened MkAQ/MAQ item sets, full uses production-length sets */
  trialVariant?: "short" | "full";
  /** MkAQ carousel: show first pane with all 5 items answered */
  carouselAnswered?: boolean;
  /** GAD-7: how many items answered (0-7) */
  gad7Answered?: number;
  /** End of task: show timing conditional row */
  showTimingRow?: boolean;
}

// ── Demo stub IDs ─────────────────────────────────────────────────────────────

const DEMO_PARTICIPANT_ID = "story-demo-participant";
const DEMO_STIMULUS_ID = "story-demo-stimulus";

const DEMOGRAPHICS_PANE_VALUES: Record<number, DemographicsFormValues> = {
  0: {
    age: 24,
    sex: "Female",
    gender_identity: "Woman",
  },
  1: {
    years_lived_canada: 5,
    residence_status: "Other",
    residence_status_other_text: "Temporary worker permit",
    student_type: "International",
    total_years_education: 16,
    cumulative_gpa: 3.7,
  },
  2: {
    majors_text: "Psychology and statistics",
    highest_education_completed: "Bachelors degree",
  },
  3: {
    ethnicity: ["Other"],
    ethnicity_other_text: "Mixed background",
    native_language: "English",
    english_fluency: "Strongly agree",
    fluent_languages: ["Other"],
    fluent_languages_other_text: "Spanish",
    english_speaking_frequency: "Always",
  },
  4: {
    non_english_schooling: true,
    instruction_languages: ["Other"],
    instruction_languages_other_text: "Spanish",
  },
  5: {
    diagnosed_disorders: ["Other"],
    diagnosed_disorders_other_text: "Sensory processing condition",
    adhd_diagnosis: true,
    adhd_medication: "Maybe",
  },
  6: {
    avid_videogamer: true,
    video_game_hours_per_week: 12,
    prescription_stimulants: false,
    regular_substances: ["Other"],
    regular_substances_other_text: "Tea",
    relationship_status: "Other",
    relationship_status_other_text: "Prefer to describe",
  },
  7: {
    occupational_status: "Other",
    occupational_status_other_text: "Research co-op",
  },
};

// ── Transition card copy ─────────────────────────────────────────────────────

const TRANSITION_COPY = {
  transition_mkaq: {
    kicker: "Up next · Survey 1 of 3",
    title: "Misokinesia Assessment",
    description:
      "A short questionnaire about how certain visual stimuli affect you. Answer based on the past two weeks. There are no right or wrong answers.",
    meta: [
      { k: "Items", v: "21 statements" },
      { k: "Format", v: "4 panes · Previous available" },
      { k: "Scale", v: "0–3 · Not at all → Almost all" },
      { k: "Estimated", v: "≈ 5 minutes" },
    ],
    buttonLabel: "Begin assessment →",
  },
  transition_gad7: {
    kicker: "Up next · Survey 2 of 3",
    title: "Anxiety Questionnaire",
    description:
      "Seven short questions about feelings of anxiety. Answer based on the past two weeks. There are no right or wrong answers.",
    meta: [
      { k: "Items", v: "7 statements" },
      { k: "Format", v: "Single screen" },
      { k: "Scale", v: "0–3 · Not at all → Nearly every day" },
      { k: "Estimated", v: "≈ 1 minute" },
    ],
    buttonLabel: "Begin questionnaire →",
  },
  transition_maq: {
    kicker: "Up next · Survey 3 of 3",
    title: "Misophonia Assessment",
    description:
      "A short questionnaire about how certain sounds affect you. Answer based on the past two weeks. There are no right or wrong answers.",
    meta: [
      { k: "Items", v: "21 statements" },
      { k: "Format", v: "3 panes · Previous available" },
      { k: "Scale", v: "0–3 · Not at all → Almost all" },
      { k: "Estimated", v: "≈ 5 minutes" },
    ],
    buttonLabel: "Begin assessment →",
  },
} as const;

type TransitionPhase = "transition_mkaq" | "transition_gad7" | "transition_maq";

// ── Scale chip helper (for demo pre-fill display) ─────────────────────────────

function DemoScaleChip({
  label,
  selected,
}: {
  label: string;
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[10px] border px-3 py-1.5 text-xs font-semibold",
        selected
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

// ── Shared loading/error/status screen ───────────────────────────────────────

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border border-border px-10 py-10 text-center"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function StoryFullscreenButton() {
  return (
    <button
      type="button"
      aria-label="Exit fullscreen"
      className="fixed right-3 top-3 z-50 flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
    >
      Fullscreen
    </button>
  );
}

function getActiveJumpSection(
  phase: ParticipantStoryPhase,
): MisokinesiaSectionTarget | null {
  if (phase === "intro") return "intro";
  if (phase === "questionnaire") return "clips";
  if (phase === "transition_mkaq" || phase === "mkaq") return "mkaq";
  if (phase === "transition_gad7" || phase === "gad7") return "gad7";
  if (phase === "transition_maq" || phase === "maq") return "maq";
  if (phase === "end_of_task") return "end";
  if (
    phase === "complete" ||
    phase === "completing" ||
    phase === "complete_error"
  ) {
    return "done";
  }
  return null;
}

function TrialTaskContainer({
  phase,
  trialMode,
  children,
}: {
  phase: ParticipantStoryPhase;
  trialMode: boolean;
  children: React.ReactNode;
}) {
  const activeJumpSection = getActiveJumpSection(phase);

  return (
    <div className="relative min-h-screen w-full bg-background">
      {children}
      {trialMode && activeJumpSection && (
        <div className="absolute left-1/2 top-14 z-40 w-[calc(100%-2rem)] max-w-[34rem] -translate-x-1/2 sm:top-3 sm:w-[calc(100%-13rem)]">
          <MisokinesiaSectionJumper
            sections={MISOKINESIA_SECTION_JUMP_SECTIONS}
            activeSection={activeJumpSection}
            onJump={() => {
              // no-op in Storybook; route state is mocked by story args
            }}
          />
        </div>
      )}
      {phase !== "complete" &&
        phase !== "completing" &&
        phase !== "complete_error" && <StoryFullscreenButton />}
    </div>
  );
}

// ── Transition card replica ───────────────────────────────────────────────────

function TransitionCardMock({ phase }: { phase: TransitionPhase }) {
  const copy = TRANSITION_COPY[phase];
  const surveyPosition =
    phase === "transition_mkaq" ? 1 : phase === "transition_gad7" ? 2 : 3;
  const totalSurveys = 3;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[620px]">
        {/* Stage strip */}
        <div className="mb-9 flex items-center gap-2.5">
          <span className="shrink-0 font-[variant-numeric:tabular-nums] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Clips complete
          </span>
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
            {surveyPosition} / {totalSurveys} surveys
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-border px-11 py-10"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {copy.kicker}
          </p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
            {copy.title}
          </h1>
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
                  i < copy.meta.length - 1 && "border-b border-border",
                )}
                style={{ gridTemplateColumns: "140px 1fr" }}
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
              Take a breath before continuing — you can pause between questions.
            </span>
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground">
              {copy.buttonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────

export function MisokinesiaParticipantStoryShell({
  phase = "demographics",
  demoAnswered = false,
  demoError = false,
  demoSubmitting = false,
  demoPaneIndex = 0,
  demoValidationAttempted = false,
  clipAnswered = 0,
  clipNumber = 3,
  totalClips = 25,
  trialMode = true,
  trialVariant = "short",
  carouselAnswered = false,
  gad7Answered = 0,
  showTimingRow = false,
}: MisokinesiaParticipantStoryShellProps) {
  // Build mock gad7 answers
  const GAD7_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"] as const;
  const mockGad7Answers = Object.fromEntries(
    GAD7_KEYS.slice(0, gad7Answered).map((k, i) => [k, (i % 4) + 1]),
  );

  // ── loading ──────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <CenteredCard>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Misokinesia Task
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Loading session…</p>
      </CenteredCard>
    );
  }

  // ── error ────────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <CenteredCard>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Session Error
        </p>
        <p className="mt-4 text-sm leading-relaxed text-destructive">
          Session data not found. Please ask the research assistant to restart
          the session.
        </p>
      </CenteredCard>
    );
  }

  // ── demographics ─────────────────────────────────────────────────────────────
  if (phase === "demographics") {
    const showDemographicsPane =
      demoAnswered || demoError || demoSubmitting || demoValidationAttempted;
    const demoValues = demoValidationAttempted
      ? {}
      : (DEMOGRAPHICS_PANE_VALUES[demoPaneIndex] ??
        DEMOGRAPHICS_PANE_VALUES[0]);
    return (
      <div className="min-h-screen bg-background">
        <MisokinesiaDemographicsForm
          submitting={demoSubmitting}
          error={
            demoError
              ? "Something went wrong saving your demographics. Please try again."
              : null
          }
          initialConsentAccepted={showDemographicsPane}
          initialPaneIndex={demoPaneIndex}
          initialValues={demoValues}
          initialValidationAttempted={demoValidationAttempted}
          onSubmit={() => {
            // no-op in Storybook
          }}
        />
      </div>
    );
  }

  // ── intro ────────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="flex min-h-screen flex-col items-center justify-center px-8">
          <div className="w-full max-w-[620px]">
            {/* Step indicator */}
            <div className="mb-9 flex items-center gap-3">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
                02 / 04
              </span>
              <div className="h-px flex-1 bg-border" />
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Demographics → Intro → Task → Surveys
              </span>
            </div>

            {/* Card */}
            <div
              className="rounded-2xl border border-border px-11 py-10"
              style={{
                background: "var(--card)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Misokinesia Task
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground">
                Video Clip Questionnaire
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">
                You will watch {totalClips} short video clips. After each clip,
                you will be asked a few questions about how you felt. There are
                no right or wrong answers — just answer honestly.
              </p>

              {/* Meta ledger */}
              <div className="mt-7 border-t border-border">
                {[
                  { k: "Clips", v: `${totalClips} short video clips` },
                  { k: "Per clip", v: "4 questions · scale 1–5" },
                  { k: "After clips", v: "3 short surveys" },
                  { k: "Estimated", v: "≈ 18 minutes total" },
                ].map((row, i, arr) => (
                  <div
                    key={row.k}
                    className={cn(
                      "grid items-center gap-6 py-3",
                      i < arr.length - 1 && "border-b border-border",
                    )}
                    style={{ gridTemplateColumns: "140px 1fr" }}
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
                  The task will enter fullscreen when you click Begin. You can
                  exit at any time using the button in the top corner.
                </span>
              </div>

              <div className="mt-6 flex justify-end">
                <Button className="h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground">
                  Begin →
                </Button>
              </div>
            </div>
          </div>
        </div>
      </TrialTaskContainer>
    );
  }

  // ── per-clip questionnaire ───────────────────────────────────────────────────
  if (phase === "questionnaire") {
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="min-h-screen">
          <MisokinesiaQuestionnaire
            misokinesiaParticipantId={DEMO_PARTICIPANT_ID}
            stimulusId={DEMO_STIMULUS_ID}
            displayOrder={clipNumber}
            clipNumber={clipNumber}
            totalClips={totalClips}
            trialMode={trialMode}
            isFinalClip={false}
            onComplete={() => {
              // no-op in Storybook
            }}
            // Pass initial answered state via key so component re-mounts per story
            key={`clip-${clipAnswered}`}
          />
          {/* Visual annotation for answered-state stories — not rendered in the component itself */}
          {clipAnswered > 0 && (
            <div className="sr-only">
              Demo: {clipAnswered} of 4 questions answered
            </div>
          )}
        </div>
      </TrialTaskContainer>
    );
  }

  // ── transition cards ─────────────────────────────────────────────────────────
  if (
    phase === "transition_mkaq" ||
    phase === "transition_gad7" ||
    phase === "transition_maq"
  ) {
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="min-h-screen">
          <TransitionCardMock phase={phase} />
        </div>
      </TrialTaskContainer>
    );
  }

  // ── MkAQ carousel survey ─────────────────────────────────────────────────────
  if (phase === "mkaq") {
    const items =
      trialVariant === "short"
        ? MKAQ_ITEMS.slice(0, TRIAL_MKAQ_ITEM_COUNT)
        : MKAQ_ITEMS;

    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="min-h-screen">
          <MisokinesiaMkaqForm
            items={items}
            onComplete={() => {
              // no-op in Storybook
            }}
          />
          {carouselAnswered && (
            <p className="sr-only">Demo: current MkAQ pane answered</p>
          )}
        </div>
      </TrialTaskContainer>
    );
  }

  // ── GAD-7 survey ─────────────────────────────────────────────────────────────
  if (phase === "gad7") {
    void mockGad7Answers;
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="min-h-screen">
          <MisokinesiaGAD7Form
            submitting={false}
            error={null}
            onSubmit={() => {
              // no-op in Storybook
            }}
          />
        </div>
      </TrialTaskContainer>
    );
  }

  // ── MAQ carousel survey ──────────────────────────────────────────────────────
  if (phase === "maq") {
    const itemCount =
      trialVariant === "short" ? TRIAL_MAQ_ITEM_COUNT : undefined;

    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="min-h-screen">
          <MisokinesiaMAQForm
            submitting={false}
            error={null}
            itemCount={itemCount}
            onSubmit={() => {
              // no-op in Storybook
            }}
          />
        </div>
      </TrialTaskContainer>
    );
  }

  // ── end-of-task form ─────────────────────────────────────────────────────────
  if (phase === "end_of_task") {
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <div className="flex min-h-screen flex-col items-center justify-start px-4 pt-4">
          <MisokinesiaEndOfTaskForm
            misokinesiaParticipantId={DEMO_PARTICIPANT_ID}
            trialMode={trialMode}
            onComplete={() => {
              // no-op in Storybook
            }}
          />
          {showTimingRow && (
            <p className="sr-only">
              Demo: stronger responses timing row visible
            </p>
          )}
        </div>
      </TrialTaskContainer>
    );
  }

  // ── completing (saving spinner) ───────────────────────────────────────────────
  if (phase === "completing") {
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <CenteredCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Misokinesia Task
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Saving your results…
          </p>
        </CenteredCard>
      </TrialTaskContainer>
    );
  }

  // ── complete error ────────────────────────────────────────────────────────────
  if (phase === "complete_error") {
    return (
      <TrialTaskContainer phase={phase} trialMode={trialMode}>
        <CenteredCard>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Session Error
          </p>
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            Unable to save your results. Please ask the research assistant for
            help.
          </div>
          <Button className="mt-6 h-11 rounded-xl px-[22px] text-sm text-primary-foreground">
            Retry
          </Button>
        </CenteredCard>
      </TrialTaskContainer>
    );
  }

  // ── complete (success screen) ─────────────────────────────────────────────────
  return (
    <TrialTaskContainer phase={phase} trialMode={trialMode}>
      <CenteredCard>
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
          Session complete
        </p>
        <h1 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-foreground">
          Thank you
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The session is complete. Please return this device to the research
          assistant.
        </p>

        <Button className="mt-8 h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground">
          Back to Misokinesia
        </Button>
      </CenteredCard>
    </TrialTaskContainer>
  );
}

// ── Decorators ────────────────────────────────────────────────────────────────

export const misokinesiaMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);

// Visual chip helper export (available for other story authors who need it)
export { DemoScaleChip };
