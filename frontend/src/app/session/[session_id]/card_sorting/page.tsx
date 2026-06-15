"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  apiPatch,
  getCognitiveBattery,
  getParticipantErrorMessage,
  submitCardSortingRun,
  type CardSortingRuleKey,
  type CardSortingTrialInput,
  type CognitiveTaskKey,
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

const TASK: CognitiveTaskKey = "card_sorting";

// ── Card dimensions ──

type CardColor = "red" | "green" | "yellow" | "blue";
type CardShape = "triangle" | "star" | "cross" | "circle";
type CardNumber = 1 | 2 | 3 | 4;

const COLORS: CardColor[] = ["red", "green", "yellow", "blue"];
const SHAPES: CardShape[] = ["triangle", "star", "cross", "circle"];
const NUMBERS: CardNumber[] = [1, 2, 3, 4];

const COLOR_HEX: Record<CardColor, string> = {
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
};

interface CardFace {
  color: CardColor;
  shape: CardShape;
  number: CardNumber;
}

/**
 * The four fixed reference cards. Each dimension value maps to exactly one
 * reference index (1-based), matching CARD_SORTING.md.
 */
const REFERENCE_CARDS: CardFace[] = [
  { color: "red", shape: "triangle", number: 1 },
  { color: "green", shape: "star", number: 2 },
  { color: "yellow", shape: "cross", number: 3 },
  { color: "blue", shape: "circle", number: 4 },
];

// ── Trial counts ──

const PRODUCTION_CARDS = 64;
const TRIAL_MODE_CARDS = 8;

// ── Phases ──

type Phase =
  | "instruction1"
  | "instruction2"
  | "trial"
  | "feedback"
  | "end"
  | "submitting";

const FEEDBACK_MS = 900;

// ── Helpers ──

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Build a random response card. Values are always drawn from the canonical sets. */
function buildResponseCard(): CardFace {
  return {
    color: randomFrom(COLORS),
    shape: randomFrom(SHAPES),
    number: randomFrom(NUMBERS),
  };
}

function buildResponseCards(total: number): CardFace[] {
  return Array.from({ length: total }, () => buildResponseCard());
}

/**
 * The single correct reference index (1-based) for a response card under the
 * active rule dimension. Because each dimension value maps to exactly one
 * reference card, the active dimension's value determines the answer.
 */
function correctReferenceIndex(card: CardFace, rule: CardSortingRuleKey): number {
  if (rule === "color") {
    return REFERENCE_CARDS.findIndex((r) => r.color === card.color) + 1;
  }
  if (rule === "shape") {
    return REFERENCE_CARDS.findIndex((r) => r.shape === card.shape) + 1;
  }
  return REFERENCE_CARDS.findIndex((r) => r.number === card.number) + 1;
}

const SHIFT_STREAK = 10;
const MAX_CATEGORIES = 6;

// ── Page ──

export default function CardSortingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.session_id as string;

  const isTrialMode = getWeatherWellnessSubmitMode(sessionId) === "trial";
  const totalCards = isTrialMode ? TRIAL_MODE_CARDS : PRODUCTION_CARDS;

  const cardsRef = useRef<CardFace[]>(buildResponseCards(totalCards));

  const [phase, setPhase] = useState<Phase>("instruction1");
  const [cardIndex, setCardIndex] = useState(0);
  const [results, setResults] = useState<CardSortingTrialInput[]>([]);
  const [feedback, setFeedback] = useState<"Correct" | "Incorrect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [taskOrder, setTaskOrder] = useState<CognitiveTaskKey[] | null>(null);
  const [ruleOrder, setRuleOrder] = useState<CardSortingRuleKey[] | null>(null);

  // Hidden task state — drives immediate feedback only, never rendered.
  const ruleIndexRef = useRef(0);
  const streakRef = useRef(0);
  const categoriesRef = useRef(0);

  const cardShownAtRef = useRef(0);

  // ── Resolve battery order + hidden rule order ──

  useEffect(() => {
    let cancelled = false;
    if (isTrialMode) {
      setTaskOrder(getOrCreateTrialCognitiveTaskOrder());
      // Trial mode never reads the backend manifest; use a local hidden rule
      // order so immediate feedback works without revealing anything.
      setRuleOrder(["color", "number", "shape", "color", "shape", "number"]);
      return;
    }
    getCognitiveBattery(sessionId)
      .then((battery) => {
        if (cancelled) return;
        setTaskOrder(battery.task_order);
        setRuleOrder(battery.card_sorting_rule_order);
      })
      .catch(() => {
        if (cancelled) return;
        setTaskOrder([TASK]);
        // Fallback hidden order so the task remains playable; backend remains
        // canonical for scoring.
        setRuleOrder(["color", "number", "shape", "color", "shape", "number"]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, isTrialMode]);

  const currentCard = cardsRef.current[cardIndex] ?? null;

  const progress = useMemo(
    () => ({
      current: cardIndex,
      total: totalCards,
      label: `${cardIndex} of ${totalCards} cards complete`,
      hidePercent: true,
    }),
    [cardIndex, totalCards]
  );

  const startTrial = (idx: number) => {
    setCardIndex(idx);
    setPhase("trial");
    cardShownAtRef.current = performance.now();
  };

  const beginTask = () => {
    ruleIndexRef.current = 0;
    streakRef.current = 0;
    categoriesRef.current = 0;
    startTrial(0);
  };

  // ── Handle a sort choice ──

  const selectReference = (referenceIndex: number) => {
    if (phase !== "trial" || !currentCard || !ruleOrder) return;

    const rt = Math.max(0, Math.round(performance.now() - cardShownAtRef.current));
    const activeRule = ruleOrder[ruleIndexRef.current] ?? ruleOrder[ruleOrder.length - 1];
    const isCorrect = correctReferenceIndex(currentCard, activeRule) === referenceIndex;

    const trial: CardSortingTrialInput = {
      trial_number: cardIndex + 1,
      card_color: currentCard.color,
      card_shape: currentCard.shape,
      card_number: currentCard.number,
      selected_reference_index: referenceIndex,
      reaction_time_ms: rt,
    };

    // Update hidden streak / category state (feedback only).
    if (isCorrect) {
      streakRef.current += 1;
      if (streakRef.current >= SHIFT_STREAK) {
        if (categoriesRef.current < MAX_CATEGORIES) {
          categoriesRef.current += 1;
        }
        streakRef.current = 0;
        // Advance to the next rule on the following trial. Cap at the final rule.
        if (ruleIndexRef.current < ruleOrder.length - 1) {
          ruleIndexRef.current += 1;
        }
      }
    } else {
      streakRef.current = 0;
    }

    setFeedback(isCorrect ? "Correct" : "Incorrect");
    setResults((prev) => [...prev, trial]);
    setPhase("feedback");
  };

  // ── Feedback auto-advance ──

  useEffect(() => {
    if (phase !== "feedback") return;
    const t = setTimeout(() => {
      setFeedback(null);
      const nextIdx = cardIndex + 1;
      if (nextIdx >= cardsRef.current.length) {
        setPhase("end");
      } else {
        startTrial(nextIdx);
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [phase, cardIndex]);

  // ── Submit to backend ──

  const handleSubmit = async () => {
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
          await submitCardSortingRun(sessionId, results);
          if (lastTask) {
            await apiPatch<SessionResponse>(`/sessions/${sessionId}/status`, {
              status: "complete",
            });
          }
          router.push(nextPath);
        },
      });
    } catch (err) {
      setError(getParticipantErrorMessage(err));
      setPhase("end");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──

  if (phase === "instruction1") {
    return (
      <Screen
        kicker="Study task"
        title="Card sorting"
        description="You will sort cards by matching each card to one of four reference cards."
        centered={false}
      >
        <div className="space-y-2 text-left text-sm text-muted-foreground">
          <p>Each card shows a color, a shape, and a number of shapes.</p>
          <p>
            There is a sorting rule, but it is not shown to you. Use the
            <strong> correct / incorrect </strong> feedback after each card to
            work out how to sort.
          </p>
          <p>The rule may change as you go. Keep adapting to the feedback.</p>
        </div>
        <ReferenceRow />
        <Advance onClick={() => setPhase("instruction2")} />
      </Screen>
    );
  }

  if (phase === "instruction2") {
    return (
      <Screen
        kicker="Card sorting"
        title="How to sort"
        description="Click the reference card you think the shown card belongs with."
      >
        <ReferenceRow />
        <Advance label="Start" onClick={beginTask} disabled={!ruleOrder} />
      </Screen>
    );
  }

  if (phase === "trial") {
    return (
      <Screen
        kicker="Card sorting"
        title="Match this card"
        description="Click the reference card it belongs with."
        progress={progress}
      >
        <CurrentCard card={currentCard} />
        <ReferenceRow onSelect={selectReference} />
      </Screen>
    );
  }

  if (phase === "feedback") {
    const tone =
      feedback === "Correct"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-red-700 dark:text-red-300";
    return (
      <Screen
        kicker="Card sorting"
        title="Match this card"
        description="Click the reference card it belongs with."
        progress={{ ...progress, current: cardIndex + 1, label: `${cardIndex + 1} of ${totalCards} cards complete` }}
      >
        <CurrentCard card={currentCard} />
        <p className={`mt-6 text-2xl font-bold ${tone}`}>{feedback}</p>
      </Screen>
    );
  }

  if (phase === "end") {
    return (
      <Screen
        kicker="Study task"
        title="End of task"
        description="Your responses have been recorded for this task."
        progress={{
          current: totalCards,
          total: totalCards,
          label: `${totalCards} of ${totalCards} cards complete`,
          hidePercent: true,
        }}
      >
        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}
        <Button
          onClick={handleSubmit}
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

// ── Shared layout ──

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

// ── Card visuals ──

function ShapeGlyph({ shape, color }: { shape: CardShape; color: CardColor }) {
  const fill = COLOR_HEX[color];
  const common = { fill, stroke: fill } as const;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {shape === "circle" && <circle cx="12" cy="12" r="9" {...common} />}
      {shape === "triangle" && <polygon points="12,3 21,21 3,21" {...common} />}
      {shape === "star" && (
        <polygon
          points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9"
          {...common}
        />
      )}
      {shape === "cross" && (
        <polygon
          points="9,2 15,2 15,9 22,9 22,15 15,15 15,22 9,22 9,15 2,15 2,9 9,9"
          {...common}
        />
      )}
    </svg>
  );
}

function CardTile({
  card,
  large = false,
  onClick,
  ariaLabel,
}: {
  card: CardFace;
  large?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const glyphs = Array.from({ length: card.number }, (_, i) => (
    <ShapeGlyph key={i} shape={card.shape} color={card.color} />
  ));
  const inner = (
    <div
      className={`flex flex-wrap items-center justify-center gap-1.5 rounded-xl border-2 border-border bg-card ${
        large ? "h-32 w-28 p-3" : "h-24 w-20 p-2"
      }`}
    >
      {glyphs}
    </div>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="rounded-xl transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {inner}
      </button>
    );
  }
  return inner;
}

function CurrentCard({ card }: { card: CardFace | null }) {
  if (!card) return <div className="h-32 w-28" />;
  return <CardTile card={card} large />;
}

function ReferenceRow({ onSelect }: { onSelect?: (referenceIndex: number) => void }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
      {REFERENCE_CARDS.map((card, i) => {
        const referenceIndex = i + 1;
        return (
          <CardTile
            key={referenceIndex}
            card={card}
            onClick={onSelect ? () => onSelect(referenceIndex) : undefined}
            ariaLabel={onSelect ? `Sort to reference card ${referenceIndex}` : undefined}
          />
        );
      })}
    </div>
  );
}

function Advance({
  label = "Continue",
  onClick,
  disabled,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="mt-10 rounded-xl px-8 text-primary-foreground"
    >
      {label}
    </Button>
  );
}
