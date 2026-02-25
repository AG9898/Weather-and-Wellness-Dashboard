"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiPost, getParticipantErrorMessage, type DigitSpanRunResponse } from "@/lib/api";

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
    try {
      await apiPost<DigitSpanRunResponse>("/digitspan/runs", {
        session_id: sessionId,
        trials: results,
      });
      router.push(`/session/${sessionId}/uls8`);
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
      <Screen>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Study Task
        </p>
        <h1 className="text-2xl font-bold text-foreground">Backwards Digit Span</h1>

        <div className="mt-6 space-y-2 text-sm text-muted-foreground text-left">
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
      <Screen>
        <p className="text-lg text-foreground">We will begin with a practice trial...</p>
        <Advance />
      </Screen>
    );
  }

  if (phase === "instruction3") {
    return (
      <Screen>
        <p className="text-lg text-foreground">We will now begin the main trials...</p>
        <Advance />
      </Screen>
    );
  }

  if (phase === "instruction4") {
    return (
      <Screen>
        <p className="text-lg text-foreground">End of task.</p>
        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <button
          onClick={handleSubmitToBackend}
          disabled={submitting}
          className="mt-8 rounded-lg px-8 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          style={{ background: "var(--ubc-blue-700)" }}
        >
          {submitting ? "Submitting…" : "Continue"}
        </button>
      </Screen>
    );
  }

  if (phase === "submitting") {
    return (
      <Screen>
        <p className="text-lg text-muted-foreground">Submitting results…</p>
      </Screen>
    );
  }

  // Showing digits
  if (phase === "practice-showing" || phase === "trial-showing") {
    return (
      <Screen>
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
      <Screen>
        <p className={`text-3xl font-bold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
          {practiceFeedback}
        </p>
      </Screen>
    );
  }

  // Input phase (practice or trial)
  return (
    <Screen>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
        {phase === "practice-input" ? "Practice Trial" : `Trial ${trialIndex + 1} of 14`}
      </p>
      <p className="text-foreground mb-6">Type the sequence in backwards order:</p>
      <div className="text-4xl font-mono tracking-widest border-b-2 border-border pb-2 min-w-[200px] min-h-[1.4em] text-center text-foreground select-none">
        {entered.join(" ") || "\u00A0"}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Keys 1–9 to enter &middot; Backspace to delete &middot; Enter to submit
      </p>
    </Screen>
  );
}

// ── Shared layout components ──

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

function Advance() {
  return (
    <p className="mt-10 text-sm text-muted-foreground">Press Space to continue</p>
  );
}
