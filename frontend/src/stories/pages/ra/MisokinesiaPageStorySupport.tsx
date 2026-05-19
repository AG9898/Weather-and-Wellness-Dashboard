import type { Decorator } from "@storybook/nextjs-vite";
import { FlaskConical, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
import RAFloatingChrome from "@/lib/components/RAFloatingChrome";
import { RAUserContext } from "@/lib/contexts/RAUserContext";

export type MisokinesiaStoryState = "replica" | "loading" | "empty" | "error";

interface MisokinesiaStoryShellProps {
  state?: MisokinesiaStoryState;
}

export function MisokinesiaStoryShell({
  state = "replica",
}: MisokinesiaStoryShellProps) {
  return (
    <RAUserContext.Provider value={{ role: "admin", lab_name: "Weather & Wellness", email: "demo@example.com" }}>
      <div className="min-h-screen bg-background">
        <main className="pb-32 sm:pb-36">
          <MisokinesiaLaunchMock state={state} />
        </main>
        <RAFloatingChrome />
      </div>
    </RAUserContext.Provider>
  );
}

function MisokinesiaLaunchMock({ state }: { state: MisokinesiaStoryState }) {
  const loading = state === "loading";
  const statsCopy = {
    replica: "Participant statistics and KPIs coming soon.",
    loading: "Participant statistics and KPIs coming soon.",
    empty: "No participant statistics yet. Start a session to begin collecting responses.",
    error: "Participant statistics could not be loaded. Try refreshing the page.",
  } satisfies Record<MisokinesiaStoryState, string>;

  return (
    <PageContainer>
      <div
        className="relative mb-8 overflow-hidden rounded-2xl border border-border px-6 py-8 shadow-[var(--shadow-raised)] sm:px-8 sm:py-10"
        style={{ background: "var(--card)" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-16 blur-3xl"
          style={{ background: "var(--ring)" }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Misokinesia Research
            </p>
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Misokinesia Task
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Launch a participant session for the video-clip misokinesia questionnaire.
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <Button
              size="lg"
              disabled={loading}
              className="rounded-xl px-6 font-semibold text-primary-foreground"
            >
              <Video className="mr-2 size-4" />
              {loading ? "Starting..." : "Start Misokinesia Session"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={loading}
              className="rounded-xl px-6 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              Run Short Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={loading}
              className="rounded-xl px-6 font-semibold"
            >
              <FlaskConical className="mr-2 size-4" />
              Run Full Trial
            </Button>
            <p className="text-left text-xs leading-relaxed text-muted-foreground sm:text-right">
              Test trials use local fake ids and do not write research data.
            </p>
            {state === "error" && (
              <p className="text-left text-sm text-destructive sm:text-right">
                Server error (500): Failed to start session.
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-border px-8 py-8 shadow-[var(--shadow-card)]"
        style={{ background: "var(--card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Statistics
        </p>
        <p
          className={
            state === "error"
              ? "mt-2 text-sm text-destructive"
              : "mt-2 text-sm text-muted-foreground"
          }
        >
          {statsCopy[state]}
        </p>
      </div>
    </PageContainer>
  );
}

export function buildMisokinesiaStoryParameters() {
  return {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/misokinesia",
      },
    },
  };
}

export const misokinesiaMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);
