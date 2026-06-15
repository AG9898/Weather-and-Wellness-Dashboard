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
  type SessionResponse,
  type StroopRunResponse,
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

// ── Stimuli ──

type StroopColor = "red" | "blue" | "green" | "yellow";
type Condition = "congruent" | "incongruent";

const COLORS: StroopColor[] = ["red", "blue", "green", "yellow"];

/** One response key per color. Keys are matched case-insensitively. */
const KEY_TO_COLOR: Record<string, StroopColor> = {
  r: "red",
  b: "blue",
  g: "green",
  y: "yellow",
};

/** CSS color values for the rendered ink. */
const COLOR_HEX: Record<StroopColor, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#ca8a04",
};

// ── Trial counts ──

const PRODUCTION_SCORED_TRIALS = 80; // 40 congruent + 40 incongruent
const TRIAL_MODE_SCORED_TRIALS = 12; // 6 congruent + 6 incongruent
const PRACTICE_TRIALS = 4;
const TIMEOUT_MS = 3000;
const PRACTICE_FEEDBACK_MS = 1200;
const INTER_TRIAL_GAP_MS = 500;

// ── Types ──

interface StroopStimulus {
  condition: Condition;
  word: StroopColor;
  ink_color: StroopColor;
}

interface ScoredTrial {
  trial_number: number;
  condition: Condition;
  word: string;
  ink_color: string;
  response_key: string | null;
  response_color: string | null;
  reaction_time_ms: number | null;
  timed_out: boolean;
}

type Phase =
  | "instruction1"
  | "instruction2"
  | "practice-trial"
  | "practice-feedback"
  | "instruction3"
  | "trial"
  | "inter-trial"
  | "instruction4"
  | "submitting";

// ── Helpers ──

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomColor(): StroopColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/** Build one stimulus for the given condition. */
function buildStimulus(condition: Condition): StroopStimulus {
  const ink = randomColor();
  if (condition === "congruent") {
    return { condition, word: ink, ink_color: ink };
  }
  // Incongruent: word meaning must differ from ink color.
  let word = randomColor();
  while (word === ink) word = randomColor();
  return { condition, word, ink_color: ink };
}

/** Balanced, shuffled scored stimulus list (half congruent, half incongruent). */
function buildScoredStimuli(total: number): StroopStimulus[] {
  const half = Math.floor(total / 2);
  const stimuli: StroopStimulus[] = [];
  for (let i = 0; i < half; i++) stimuli.push(buildStimulus("congruent"));
  for (let i = 0; i < total - half; i++) stimuli.push(buildStimulus("incongruent"));
  return shuffle(stimuli);
}

/** Practice stimuli mix both conditions but are unscored. */
function buildPracticeStimuli(): StroopStimulus[] {
  return shuffle([
    buildStimulus("congruent"),
    buildStimulus("congruent"),
    buildStimulus("incongruent"),
    buildStimulus("incongruent"),
  ]).slice(0, PRACTICE_TRIALS);
}

// ── Page ──

export default function StroopPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const isTrialMode = getWeatherWellnessSubmitMode(sessionId) === "trial";
  const scoredCount = isTrialMode ? TRIAL_MODE_SCORED_TRIALS : PRODUCTION_SCORED_TRIALS;

  const practiceRef = useRef<StroopStimulus[]>(buildPracticeStimuli());
  const scoredRef = useRef<StroopStimulus[]>(buildScoredStimuli(scoredCount));

  const [phase, setPhase] = useState<Phase>("instruction1");
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  const [results, setResults] = useState<ScoredTrial[]>([]);
  const [practiceFeedback, setPracticeFeedback] = useState<"Correct" | "Incorrect" | "Too slow" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taskOrder, setTaskOrder] = useState<CognitiveTaskKey[] | null>(null);

  // RT capture: stimulus render time and a per-trial timeout handle.
  const stimulusShownAtRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answeredRef = useRef<boolean>(false);
  // Ref indirection breaks the startScoredTrial <-> recordScoredTrial cycle.
  const recordScoredTrialRef = useRef<
    (idx: number, color: StroopColor | null, key: string | null, timedOut: boolean) => void
  >(() => {});

  // ── Resolve assigned battery order so completion routes correctly ──

  useEffect(() => {
    let cancelled = false;
    if (isTrialMode) {
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
  }, [sessionId, isTrialMode]);

  const clearTrialTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ── Current stimulus for the active block ──

  const currentStimulus: StroopStimulus | null =
    phase === "practice-trial"
      ? practiceRef.current[practiceIndex] ?? null
      : phase === "trial"
      ? scoredRef.current[trialIndex] ?? null
      : null;

  // ── Begin a practice trial ──

  const startPracticeTrial = useCallback(
    (idx: number) => {
      setPracticeIndex(idx);
      setPhase("practice-trial");
      answeredRef.current = false;
      stimulusShownAtRef.current = performance.now();
      clearTrialTimeout();
      timeoutRef.current = setTimeout(() => {
        if (answeredRef.current) return;
        answeredRef.current = true;
        setPracticeFeedback("Too slow");
        setPhase("practice-feedback");
      }, TIMEOUT_MS);
    },
    [clearTrialTimeout]
  );

  // ── Begin a scored trial ──

  const startScoredTrial = useCallback(
    (idx: number) => {
      setTrialIndex(idx);
      setPhase("trial");
      answeredRef.current = false;
      stimulusShownAtRef.current = performance.now();
      clearTrialTimeout();
      timeoutRef.current = setTimeout(() => {
        if (answeredRef.current) return;
        answeredRef.current = true;
        recordScoredTrialRef.current(idx, null, null, true);
      }, TIMEOUT_MS);
    },
    [clearTrialTimeout]
  );

  // ── Record one scored trial then advance ──

  const recordScoredTrial = useCallback(
    (idx: number, responseColor: StroopColor | null, responseKey: string | null, timedOut: boolean) => {
      clearTrialTimeout();
      const stimulus = scoredRef.current[idx];
      const rt = timedOut ? null : Math.round(performance.now() - stimulusShownAtRef.current);
      const trial: ScoredTrial = {
        trial_number: idx + 1,
        condition: stimulus.condition,
        word: stimulus.word.toUpperCase(),
        ink_color: stimulus.ink_color,
        response_key: timedOut ? null : responseKey,
        response_color: timedOut ? null : responseColor,
        reaction_time_ms: rt,
        timed_out: timedOut,
      };
      setResults((prev) => {
        const updated = [...prev, trial];
        if (updated.length >= scoredRef.current.length) {
          setPhase("instruction4");
        } else {
          setPhase("inter-trial");
          setTimeout(() => startScoredTrial(idx + 1), INTER_TRIAL_GAP_MS);
        }
        return updated;
      });
    },
    [clearTrialTimeout, startScoredTrial]
  );

  // Keep the ref pointed at the latest recordScoredTrial for timeout callbacks.
  useEffect(() => {
    recordScoredTrialRef.current = recordScoredTrial;
  }, [recordScoredTrial]);

  // ── Handle practice answer ──

  const answerPractice = useCallback(
    (responseColor: StroopColor) => {
      const stimulus = practiceRef.current[practiceIndex];
      answeredRef.current = true;
      clearTrialTimeout();
      setPracticeFeedback(responseColor === stimulus.ink_color ? "Correct" : "Incorrect");
      setPhase("practice-feedback");
    },
    [practiceIndex, clearTrialTimeout]
  );

  // ── Practice feedback auto-advance ──

  useEffect(() => {
    if (phase !== "practice-feedback") return;
    const t = setTimeout(() => {
      setPracticeFeedback(null);
      const nextIdx = practiceIndex + 1;
      if (nextIdx >= practiceRef.current.length) {
        setPhase("instruction3");
      } else {
        startPracticeTrial(nextIdx);
      }
    }, PRACTICE_FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [phase, practiceIndex, startPracticeTrial]);

  // ── Keyboard handler ──

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Advance instruction screens with Space.
      if (phase === "instruction1" || phase === "instruction2" || phase === "instruction3") {
        if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          if (phase === "instruction1") setPhase("instruction2");
          else if (phase === "instruction2") startPracticeTrial(0);
          else if (phase === "instruction3") startScoredTrial(0);
        }
        return;
      }

      // Accept only the configured color keys during a trial.
      if (phase === "practice-trial" || phase === "trial") {
        if (answeredRef.current) return;
        const color = KEY_TO_COLOR[e.key.toLowerCase()];
        if (!color) return; // ignore unrelated keys
        e.preventDefault();
        if (phase === "practice-trial") {
          answerPractice(color);
        } else {
          answeredRef.current = true;
          recordScoredTrial(trialIndex, color, e.key.toLowerCase(), false);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [phase, trialIndex, startPracticeTrial, startScoredTrial, answerPractice, recordScoredTrial]);

  // ── Cleanup any pending timeout on unmount ──

  useEffect(() => () => clearTrialTimeout(), [clearTrialTimeout]);

  // ── Submit to backend ──

  const handleSubmitToBackend = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPhase("submitting");
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
          await apiPost<StroopRunResponse>("/stroop/runs", {
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
        title="Stroop"
        description="You will see color words shown in colored ink. Respond to the ink color, not the word."
        centered={false}
      >
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p>Each screen shows one word printed in a color.</p>
          <p>
            Press the key for the <strong>ink color</strong> of the word, ignoring what the word
            says.
          </p>
        </div>
        <ColorKeyLegend />
        <Advance />
      </Screen>
    );
  }

  if (phase === "instruction2") {
    return (
      <Screen
        kicker="Practice"
        title="Practice trials"
        description="A few practice trials with feedback come first so you can learn the keys."
      >
        <ColorKeyLegend />
        <Advance />
      </Screen>
    );
  }

  if (phase === "practice-trial") {
    return (
      <Screen kicker="Practice" title="Respond to the ink color" description="Press the key for the color of the ink.">
        <StimulusWord stimulus={currentStimulus} />
        <ColorKeyLegend compact />
      </Screen>
    );
  }

  if (phase === "practice-feedback") {
    const tone =
      practiceFeedback === "Correct"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-red-700 dark:text-red-300";
    return (
      <Screen kicker="Practice" title="Practice feedback" description="The scored task begins after practice.">
        <p className={`text-3xl font-bold ${tone}`}>{practiceFeedback}</p>
      </Screen>
    );
  }

  if (phase === "instruction3") {
    return (
      <Screen
        kicker="Scored task"
        title="Main trials"
        description="Respond as quickly and accurately as you can to the ink color."
        progress={{
          current: 0,
          total: scoredCount,
          label: `0 of ${scoredCount} trials complete`,
          hidePercent: true,
        }}
      >
        <ColorKeyLegend />
        <Advance />
      </Screen>
    );
  }

  if (phase === "trial") {
    return (
      <Screen
        kicker="Scored task"
        title="Respond to the ink color"
        description="Press the key for the color of the ink."
        progress={{
          current: trialIndex,
          total: scoredCount,
          label: `${trialIndex} of ${scoredCount} trials complete`,
          hidePercent: true,
        }}
      >
        <StimulusWord stimulus={currentStimulus} />
        <ColorKeyLegend compact />
      </Screen>
    );
  }

  if (phase === "inter-trial") {
    return (
      <Screen
        kicker="Scored task"
        title="Respond to the ink color"
        description="Press the key for the color of the ink."
        progress={{
          current: trialIndex + 1,
          total: scoredCount,
          label: `${trialIndex + 1} of ${scoredCount} trials complete`,
          hidePercent: true,
        }}
      >
        <div className="text-7xl font-bold select-none text-muted-foreground">+</div>
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
          current: scoredCount,
          total: scoredCount,
          label: `${scoredCount} of ${scoredCount} trials complete`,
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

  // submitting
  return (
    <Screen
      kicker="Study task"
      title="Submitting results"
      description="Please wait while the task advances."
    />
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

function Screen({ children, kicker, title, description, centered = true, progress }: ScreenProps) {
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
        {children && <div className="flex flex-col items-center text-center">{children}</div>}
      </EditorialTaskPanel>
    </EditorialTaskShell>
  );
}

function StimulusWord({ stimulus }: { stimulus: StroopStimulus | null }) {
  return (
    <div
      className="text-7xl font-extrabold uppercase tracking-wide select-none"
      style={{ color: stimulus ? COLOR_HEX[stimulus.ink_color] : "transparent", minHeight: "1.1em" }}
    >
      {stimulus ? stimulus.word : " "}
    </div>
  );
}

function ColorKeyLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${compact ? "mt-6" : "mt-8"}`}>
      {COLORS.map((color) => {
        const key = Object.keys(KEY_TO_COLOR).find((k) => KEY_TO_COLOR[k] === color) ?? "";
        return (
          <span
            key={color}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: COLOR_HEX[color] }}
            />
            <span className="font-mono font-semibold uppercase">{key}</span>
            <span className="capitalize text-muted-foreground">{color}</span>
          </span>
        );
      })}
    </div>
  );
}

function Advance() {
  return <p className="mt-10 text-sm text-muted-foreground">Press Space to continue</p>;
}
