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
import MisokinesiaDemographicsForm from "@/lib/components/MisokinesiaDemographicsForm";
import MisokinesiaQuestionnaire from "@/lib/components/MisokinesiaQuestionnaire";
import MisokinesiaEndOfTaskForm from "@/lib/components/MisokinesiaEndOfTaskForm";
import MisokinesiaMkaqForm, { MKAQ_ITEMS } from "@/lib/components/MisokinesiaMkaqForm";
import MisokinesiaGAD7Form from "@/lib/components/MisokinesiaGAD7Form";
import MisokinesiaMAQForm from "@/lib/components/MisokinesiaMAQForm";

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
  /** Demographics: pre-fill answers (age band selected) */
  demoAnswered?: boolean;
  /** Demographics: show inline error banner */
  demoError?: boolean;
  /** Demographics: show submitting state */
  demoSubmitting?: boolean;
  /** Questionnaire: number of answered questions (0-4) */
  clipAnswered?: number;
  /** Questionnaire: which clip number to show (default 3) */
  clipNumber?: number;
  /** Questionnaire: total clips count (default 25) */
  totalClips?: number;
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
      { k: "Scale", v: "1–4 · Never → Often" },
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

function DemoScaleChip({ label, selected }: { label: string; selected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[10px] border px-3 py-1.5 text-xs font-semibold",
        selected
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
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
                    i + 1 === surveyPosition ? "var(--primary)" : "var(--muted)",
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
                  i < copy.meta.length - 1 && "border-b border-border"
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
  clipAnswered = 0,
  clipNumber = 3,
  totalClips = 25,
  carouselAnswered = false,
  gad7Answered = 0,
  showTimingRow = false,
}: MisokinesiaParticipantStoryShellProps) {
  // Build mock answered responses for questionnaire
  const mockQuestionnaireResponses = Object.fromEntries(
    (["q1", "q2", "q3", "q4"] as const)
      .slice(0, clipAnswered)
      .map((k, i) => [k, i + 1])
  );

  // Build mock gad7 answers
  const GAD7_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"] as const;
  const mockGad7Answers = Object.fromEntries(
    GAD7_KEYS.slice(0, gad7Answered).map((k, i) => [k, (i % 4) + 1])
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
          Session data not found. Please ask the research assistant to restart the session.
        </p>
      </CenteredCard>
    );
  }

  // ── demographics ─────────────────────────────────────────────────────────────
  if (phase === "demographics") {
    // MisokinesiaDemographicsForm manages its own internal state, so we render it
    // with controlled error/submitting props. The demoAnswered arg is visual context
    // only — real state is inside the component.
    return (
      <div className="min-h-screen bg-background">
        <MisokinesiaDemographicsForm
          submitting={demoSubmitting}
          error={
            demoError
              ? "Something went wrong saving your demographics. Please try again."
              : null
          }
          onSubmit={() => {
            // no-op in Storybook
          }}
        />
        {demoAnswered && (
          <p className="sr-only">
            (Demo note: fields pre-filled state shown via demoAnswered=true arg)
          </p>
        )}
      </div>
    );
  }

  // ── intro ────────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-8">
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
            style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Misokinesia Task
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-foreground">
              Video Clip Questionnaire
            </h1>
            <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground">
              You will watch {totalClips} short video clips. After each clip, you will be asked a
              few questions about how you felt. There are no right or wrong answers — just answer
              honestly.
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
                    i < arr.length - 1 && "border-b border-border"
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
                The task will enter fullscreen when you click Begin. You can exit at any time using
                the button in the top corner.
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
    );
  }

  // ── per-clip questionnaire ───────────────────────────────────────────────────
  if (phase === "questionnaire") {
    return (
      <div className="min-h-screen bg-background">
        <MisokinesiaQuestionnaire
          misokinesiaParticipantId={DEMO_PARTICIPANT_ID}
          stimulusId={DEMO_STIMULUS_ID}
          displayOrder={clipNumber}
          clipNumber={clipNumber}
          totalClips={totalClips}
          trialMode={true}
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
    );
  }

  // ── transition cards ─────────────────────────────────────────────────────────
  if (
    phase === "transition_mkaq" ||
    phase === "transition_gad7" ||
    phase === "transition_maq"
  ) {
    return (
      <div className="min-h-screen bg-background">
        <TransitionCardMock phase={phase} />
      </div>
    );
  }

  // ── MkAQ carousel survey ─────────────────────────────────────────────────────
  if (phase === "mkaq") {
    return (
      <div className="min-h-screen bg-background">
        <MisokinesiaMkaqForm
          items={MKAQ_ITEMS}
          onComplete={() => {
            // no-op in Storybook
          }}
        />
      </div>
    );
  }

  // ── GAD-7 survey ─────────────────────────────────────────────────────────────
  if (phase === "gad7") {
    void mockGad7Answers;
    return (
      <div className="min-h-screen bg-background">
        <MisokinesiaGAD7Form
          submitting={false}
          error={null}
          onSubmit={() => {
            // no-op in Storybook
          }}
        />
      </div>
    );
  }

  // ── MAQ carousel survey ──────────────────────────────────────────────────────
  if (phase === "maq") {
    return (
      <div className="min-h-screen bg-background">
        <MisokinesiaMAQForm
          submitting={false}
          error={null}
          onSubmit={() => {
            // no-op in Storybook
          }}
        />
      </div>
    );
  }

  // ── end-of-task form ─────────────────────────────────────────────────────────
  if (phase === "end_of_task") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-start bg-background px-4 pt-4">
        <MisokinesiaEndOfTaskForm
          misokinesiaParticipantId={DEMO_PARTICIPANT_ID}
          trialMode={true}
          onComplete={() => {
            // no-op in Storybook
          }}
        />
        {showTimingRow && (
          <p className="sr-only">Demo: stronger responses timing row visible</p>
        )}
      </div>
    );
  }

  // ── completing (saving spinner) ───────────────────────────────────────────────
  if (phase === "completing") {
    return (
      <CenteredCard>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Misokinesia Task
        </p>
        <p className="mt-4 text-sm text-muted-foreground">Saving your results…</p>
      </CenteredCard>
    );
  }

  // ── complete error ────────────────────────────────────────────────────────────
  if (phase === "complete_error") {
    return (
      <CenteredCard>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Session Error
        </p>
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          Unable to save your results. Please ask the research assistant for help.
        </div>
        <Button className="mt-6 h-11 rounded-xl px-[22px] text-sm text-primary-foreground">
          Retry
        </Button>
      </CenteredCard>
    );
  }

  // ── complete (success screen) ─────────────────────────────────────────────────
  return (
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
      <h1 className="mt-3 text-[28px] font-bold tracking-[-0.02em] text-foreground">Thank you</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The session is complete. Please return this device to the research assistant.
      </p>

      <Button className="mt-8 h-11 min-w-[200px] rounded-xl px-[22px] text-sm text-primary-foreground">
        Back to Misokinesia
      </Button>
    </CenteredCard>
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
