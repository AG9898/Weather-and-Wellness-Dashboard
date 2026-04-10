import type { Decorator } from "@storybook/nextjs-vite";
import MisokinesiaLaunchPage from "@/lib/components/MisokinesiaLaunchPage";
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
    <RAUserContext.Provider value={{ role: "admin", lab_name: "Weather & Wellness" }}>
      <div className="min-h-screen bg-background">
        <main className="pb-32 sm:pb-36">
          <MisokinesiaLaunchPage
            loading={state === "loading"}
            error={
              state === "error" ? "Server error (500): Failed to start session." : null
            }
            statsState={state === "replica" || state === "loading" ? "replica" : state}
          />
        </main>
        <RAFloatingChrome />
      </div>
    </RAUserContext.Provider>
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
