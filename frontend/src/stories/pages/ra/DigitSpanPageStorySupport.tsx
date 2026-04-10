import type { Decorator } from "@storybook/nextjs-vite";

export type DigitSpanStoryState = "startup" | "question";

interface DigitSpanStoryShellProps {
  state?: DigitSpanStoryState;
}

export function DigitSpanStoryShell({
  state = "startup",
}: DigitSpanStoryShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {state === "question" ? <DigitSpanQuestion /> : <DigitSpanStartup />}
    </main>
  );
}

function DigitSpanStartup() {
  return (
    <DigitSpanScreen>
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Study Task
      </p>
      <h1 className="text-2xl font-bold text-foreground">Backwards Digit Span</h1>

      <div className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
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
        <p className="font-mono text-sm text-muted-foreground">Sequence: 1 2 3 4 5</p>
        <p className="mt-1 font-mono text-sm text-foreground">Correct: 5 4 3 2 1</p>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        The sequences will get longer throughout the experiment.
      </p>
      <p className="mt-10 text-sm text-muted-foreground">Press Space to continue</p>
    </DigitSpanScreen>
  );
}

function DigitSpanQuestion() {
  return (
    <DigitSpanScreen>
      <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Trial 4 of 14
      </p>
      <p className="mb-6 text-foreground">Type the sequence in backwards order:</p>
      <div className="min-h-[1.4em] min-w-[200px] select-none border-b-2 border-border pb-2 text-center font-mono text-4xl tracking-widest text-foreground">
        8 2 6
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Keys 1-9 to enter &middot; Backspace to delete &middot; Enter to submit
      </p>
    </DigitSpanScreen>
  );
}

function DigitSpanScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md text-center">{children}</div>
    </div>
  );
}

export function buildDigitSpanStoryParameters() {
  return {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/session/story-session/digitspan",
      },
    },
  };
}

export const digitSpanMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);
