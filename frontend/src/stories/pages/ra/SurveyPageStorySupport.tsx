import type { Decorator } from "@storybook/nextjs-vite";
import SurveyForm, {
  type ScaleOption,
  type SurveyItem,
} from "@/lib/components/SurveyForm";

export type SurveyStoryState = "replica" | "loading" | "empty" | "error";

interface SurveyStoryShellProps {
  state?: SurveyStoryState;
}

const CESD_SCALE: ScaleOption[] = [
  { value: 1, label: "Never" },
  { value: 2, label: "Rarely" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Often" },
];

const CESD_ITEMS: SurveyItem[] = [
  { number: 1, text: "I am being bothered by things that don't usually bother me." },
  { number: 2, text: "I am having trouble keeping my mind on what I am doing." },
  { number: 3, text: "I am feeling depressed." },
  { number: 4, text: "I am feeling everything I do is an effort." },
  { number: 5, text: "I am feeling hopeful about the future." },
  { number: 6, text: "I am feeling fearful." },
  { number: 7, text: "My sleep was restless." },
  { number: 8, text: "I am feeling happy." },
  { number: 9, text: "I am feeling lonely." },
  { number: 10, text: 'I cannot "get going."' },
];

export function SurveyStoryShell({ state = "replica" }: SurveyStoryShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {state === "empty" ? (
        <EmptySurveyReplica />
      ) : (
        <SurveyForm
          title="CES-D 10 — Depression Scale"
          stepLabel="Survey 2 of 4"
          instructions="Please indicate how often each statement describes you right now."
          items={CESD_ITEMS}
          scale={CESD_SCALE}
          submitting={state === "loading"}
          error={
            state === "error"
              ? "Server error (500): Failed to save survey responses."
              : null
          }
          onSubmit={() => undefined}
        />
      )}
    </main>
  );
}

function EmptySurveyReplica() {
  return (
    <div className="relative mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div
        className="relative space-y-4 rounded-[1.6rem] border border-border/90 p-5 shadow-[0_30px_60px_-52px_rgb(0_19_40/0.7)] sm:p-8"
        style={{ background: "var(--card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Survey 2 of 4
        </p>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          CES-D 10 — Depression Scale
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          No survey items are available for this session.
        </p>
      </div>
    </div>
  );
}

export function buildSurveyStoryParameters() {
  return {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/session/story-session/cesd10",
      },
    },
  };
}

export const surveyMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);
