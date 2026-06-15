"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  apiPost,
  apiPatch,
  getCognitiveBattery,
  getParticipantErrorMessage,
  type CognitiveTaskKey,
  type DigitSpanRunResponse,
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

// ── Constants ──

const SPANS = [3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9];
const PRACTICE_SEQUENCE = [1, 3, 5, 7, 9];
const DIGIT_DISPLAY_MS = 1000;
const INTER_DIGIT_GAP_MS = 100;
const PRACTICE_FEEDBACK_MS = 2000;

// ── Types ──

interface TrialData {
  trial_number: number;
  span_length: number;
  sequence_shown: string;
  sequence_entered: string;
  correct: boolean;
}

type Phase =
  | "instruction1"
  | "instruction2"
  | "practice-showing"
  | "practice-input"
  | "practice-feedback"
  | "instruction3"
  | "trial-showing"
  | "trial-input"
  | "instruction4"
  | "submitting";

// ── Helpers ──

/** Sample `count` unique digits from 1-9 without replacement. */
function sampleDigits(count: number): number[] {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** Pre-generate all 14 trial sequences. */
function generateSequences(): number[][] {
  return SPANS.map((span) => sampleDigits(span));
}

// ── Page ──

export default function DigitSpanPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  // All sequences pre-generated
  const sequencesRef = useRef<number[][]>(generateSequences());

  const [phase, setPhase] = useState<Phase>("instruction1");
  const [trialIndex, setTrialIndex] = useState(0); // 0-13 for scored trials
  const [currentDigit, setCurrentDigit] = useState<number | null>(null);
  const [entered, setEntered] = useState<string[]>([]);
  const [practiceFeedback, setPracticeFeedback] = useState<string | null>(null);
  const [results, setResults] = useState<TrialData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taskOrder, setTaskOrder] = useState<CognitiveTaskKey[] | null>(null);

  // ── Resolve the assigned battery order so completion routes correctly ──

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
        // Fall back to single-task behavior if the manifest is unavailable.
        if (!cancelled) setTaskOrder(["digitspan"]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ── Digit presentation via setTimeout chains ──

  const showSequence = useCallback(
    (seq: number[], onDone: () => void) => {
      let i = 0;
      const showNext = () => {
        if (i >= seq.length) {
          setCurrentDigit(null);
          onDone();
          return;
        }
        setCurrentDigit(seq[i]);
        setTimeout(() => {
          setCurrentDigit(null);
          i++;
          setTimeout(showNext, INTER_DIGIT_GAP_MS);
        }, DIGIT_DISPLAY_MS);
      };
      showNext();
    },
    []
  );

  // ── Start practice ──

  const startPractice = useCallback(() => {
    setPhase("practice-showing");
    setEntered([]);
    showSequence(PRACTICE_SEQUENCE, () => {
      setPhase("practice-input");
    });
  }, [showSequence]);

  // ── Start a scored trial ──

  const startTrial = useCallback(
    (idx: number) => {
      setTrialIndex(idx);
      setPhase("trial-showing");
      setEntered([]);
      showSequence(sequencesRef.current[idx], () => {
        setPhase("trial-input");
      });
    },
    [showSequence]
  );

  // ── Submit practice answer ──

  const submitPractice = useCallback(() => {
    const enteredStr = entered.join("");
    const correctStr = [...PRACTICE_SEQUENCE].reverse().join("");
    const isCorrect = enteredStr === correctStr;
    setPracticeFeedback(isCorrect ? "Correct" : "Incorrect");
    setPhase("practice-feedback");
    setTimeout(() => {
      setPracticeFeedback(null);
      setPhase("instruction3");
    }, PRACTICE_FEEDBACK_MS);
  }, [entered]);

  // ── Submit scored trial answer ──

  const submitTrial = useCallback(() => {
    const seq = sequencesRef.current[trialIndex];
    const enteredStr = entered.join("");
    const correctStr = [...seq].reverse().join("");
    const isCorrect = enteredStr === correctStr;

    const trialData: TrialData = {
      trial_number: trialIndex + 1,
      span_length: SPANS[trialIndex],
      sequence_shown: seq.join(" "),
      sequence_entered: enteredStr,
      correct: isCorrect,
    };

    setResults((prev) => {
      const updated = [...prev, trialData];
      if (updated.length === 14) {
        setPhase("instruction4");
      } else {
        const nextIdx = trialIndex + 1;
        setTrialIndex(nextIdx);
        setPhase("trial-showing");
        setEntered([]);
        showSequence(sequencesRef.current[nextIdx], () => {
          setPhase("trial-input");
        });
      }
      return updated;
    });
  }, [entered, trialIndex, showSequence]);

  // ── Keyboard handler ──

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        phase === "instruction1" ||
        phase === "instruction2" ||
        phase === "instruction3"
      ) {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          if (phase === "instruction1") setPhase("instruction2");
          else if (phase === "instruction2") startPractice();
          else if (phase === "instruction3") startTrial(0);
        }
        return;
      }

      if (phase === "practice-input" || phase === "trial-input") {
        if (e.key >= "1" && e.key <= "9") {
          setEntered((prev) => [...prev, e.key]);
        } else if (e.key === "Backspace") {
          setEntered((prev) => prev.slice(0, -1));
        } else if (e.key === "Enter") {
          if (phase === "practice-input") submitPractice();
          else submitTrial();
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, startPractice, startTrial, submitPractice, submitTrial]);

  // ── Submit to backend ──

  const handleSubmitToBackend = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPhase("submitting");
    setError(null);
    const order = taskOrder ?? ["digitspan"];
    const lastTask = isLastCognitiveTask(order, "digitspan");
    const nextPath = nextCognitiveTaskPath(sessionId, order, "digitspan");
    try {
      await runTrialAwareSubmit(getWeatherWellnessSubmitMode(sessionId), {
        trial: () => {
          router.push(buildTrialRunPath(nextPath));
        },
        production: async () => {
          await apiPost<DigitSpanRunResponse>("/digitspan/runs", {
            session_id: sessionId,
            trials: results,
          });
          if (lastTask) {
            await apiPatch<SessionResponse>(`/sessions/${sessionId}/status`, { status: "complete" });
          }
          router.push(nextPath);
        },
      });
    } catch (err) {
      setError(getParticipantErrorMessage(err));
      setPhase("instruction4");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──

  if (phase === "instruction1") {
    return (
      <Screen
        kicker="Study task"
        title="Backwards Digit Span"
        description="You will be shown a number sequence, one number at a time, then enter it in reverse order."
        centered={false}
      >
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p>You will be shown a number sequence, one number at a time.</p>
          <p>Memorize the number sequence.</p>
          <p>
            You will then be asked to type the sequence in reverse/backwards order.
            For example...
          </p>
        </div>

        <div
          className="mt-5 rounded-xl border border-border px-6 py-4 text-left"
          style={{ background: "var(--card)" }}
        >
          <p className="text-sm font-mono text-muted-foreground">Sequence: 1 2 3 4 5</p>
          <p className="text-sm font-mono text-foreground mt-1">Correct: 5 4 3 2 1</p>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          The sequences will get longer throughout the experiment.
        </p>
        <Advance />
      </Screen>
    );
  }

  if (phase === "instruction2") {
    return (
      <Screen
        kicker="Practice"
        title="Practice trial"
        description="A short practice sequence comes first so you can try the response format."
      >
        <Advance />
      </Screen>
    );
  }

  if (phase === "instruction3") {
    return (
      <Screen
        kicker="Scored task"
        title="Main trials"
        description="The sequences will get longer as the task continues."
        progress={{
          current: 0,
          total: SPANS.length,
          label: `0 of ${SPANS.length} trials complete`,
          hidePercent: true,
        }}
      >
        <Advance />
      </Screen>
    );
  }

  if (phase === "instruction4") {
    return (
      <Screen
        kicker="Study task"
        title="End of task"
        description="Your responses have been recorded for this task."
        progress={{
          current: SPANS.length,
          total: SPANS.length,
          label: `${SPANS.length} of ${SPANS.length} trials complete`,
          hidePercent: true,
        }}
      >
        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button
          onClick={handleSubmitToBackend}
          disabled={submitting}
          className="mt-8 rounded-xl px-8 text-primary-foreground"
        >
          {submitting ? "Submitting…" : "Continue"}
        </Button>
      </Screen>
    );
  }

  if (phase === "submitting") {
    return (
      <Screen
        kicker="Study task"
        title="Submitting results"
        description="Please wait while the task advances to the completion screen."
      />
    );
  }

  // Showing digits
  if (phase === "practice-showing" || phase === "trial-showing") {
    const isTrial = phase === "trial-showing";
    return (
      <Screen
        kicker={isTrial ? "Scored task" : "Practice"}
        title={isTrial ? `Trial ${trialIndex + 1} of ${SPANS.length}` : "Practice sequence"}
        description="Watch each digit as it appears."
        progress={
          isTrial
            ? {
                current: trialIndex,
                total: SPANS.length,
                label: `${trialIndex} of ${SPANS.length} trials complete`,
                hidePercent: true,
              }
            : undefined
        }
      >
        <div
          className="text-8xl font-bold tabular-nums text-foreground select-none"
          style={{ lineHeight: "1.1", minHeight: "1em" }}
        >
          {currentDigit !== null ? currentDigit : "\u00A0"}
        </div>
      </Screen>
    );
  }

  // Practice feedback
  if (phase === "practice-feedback") {
    const isCorrect = practiceFeedback === "Correct";
    return (
      <Screen
        kicker="Practice"
        title="Practice feedback"
        description="The main task will begin after this feedback."
      >
        <p
          className={`text-3xl font-bold ${
            isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          }`}
        >
          {practiceFeedback}
        </p>
      </Screen>
    );
  }

  // Input phase (practice or trial)
  const isPracticeInput = phase === "practice-input";
  return (
    <Screen
      kicker={isPracticeInput ? "Practice trial" : "Scored task"}
      title={isPracticeInput ? "Enter the practice sequence" : `Trial ${trialIndex + 1} of ${SPANS.length}`}
      description="Type the sequence in backwards order."
      progress={
        isPracticeInput
          ? undefined
          : {
              current: trialIndex,
              total: SPANS.length,
              label: `${trialIndex} of ${SPANS.length} trials complete`,
              hidePercent: true,
            }
      }
    >
      <div className="min-h-[1.4em] min-w-[200px] border-b-2 border-border pb-2 text-center font-mono text-4xl text-foreground tabular-nums select-none">
        {entered.join(" ") || "\u00A0"}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Keys 1–9 to enter &middot; Backspace to delete &middot; Enter to submit
      </p>
    </Screen>
  );
}

// ── Shared layout components ──

interface ScreenProps {
  children?: React.ReactNode;
  kicker: string;
  title: string;
  description?: string;
  centered?: boolean;
  progress?: {
    current: number;
    total: number;
    label: string;
    hidePercent?: boolean;
  };
}

function Screen({
  children,
  kicker,
  title,
  description,
  centered = true,
  progress,
}: ScreenProps) {
  return (
    <EditorialTaskShell centered={centered}>
      <EditorialTaskPanel className="space-y-7">
        <EditorialTaskHeader
          stepTag="05 / 05"
          breadcrumb="Weather Wellness"
          kicker={kicker}
          title={title}
          description={description}
          progress={progress}
        />
        {children && (
          <div className="flex flex-col items-center text-center">
            {children}
          </div>
        )}
      </EditorialTaskPanel>
    </EditorialTaskShell>
  );
}

function Advance() {
  return (
    <p className="mt-10 text-sm text-muted-foreground">Press Space to continue</p>
  );
}
