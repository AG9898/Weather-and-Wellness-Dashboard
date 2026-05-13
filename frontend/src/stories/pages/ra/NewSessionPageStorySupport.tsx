import type { Decorator } from "@storybook/nextjs-vite";
import { FlaskConical, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageContainer from "@/lib/components/PageContainer";
import RAFloatingChrome from "@/lib/components/RAFloatingChrome";
import { RAUserContext } from "@/lib/contexts/RAUserContext";

export type NewSessionStoryState = "replica" | "loading" | "empty" | "error";

interface NewSessionStoryShellProps {
  state?: NewSessionStoryState;
}

const filledDetails = {
  ageBand: "18-24",
  gender: "Prefer not to say",
  origin: "Class",
  commuteMethod: "Walk",
  timeOutside: "Sometimes (61 minutes - 90 minutes)",
};

export function NewSessionStoryShell({
  state = "replica",
}: NewSessionStoryShellProps) {
  return (
    <RAUserContext.Provider value={{ role: "admin", lab_name: "Weather & Wellness", email: "demo@example.com" }}>
      <div className="min-h-screen bg-background">
        <main className="pb-32 sm:pb-36">
          <NewSessionLaunchMock state={state} />
        </main>
        <RAFloatingChrome />
      </div>
    </RAUserContext.Provider>
  );
}

function NewSessionLaunchMock({ state }: { state: NewSessionStoryState }) {
  const loading = state === "loading";
  const empty = state === "empty";
  const error = state === "error";

  return (
    <PageContainer narrow>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Step 2 of 2 - Participant Details
          </p>
          <h1 className="text-2xl font-bold text-foreground">Enter Participant Details</h1>
          <p className="text-sm text-muted-foreground">
            All fields are required before starting the session.
          </p>
        </div>

        <div
          className="rounded-2xl border border-border p-6 shadow-[var(--shadow-card)]"
          style={{ background: "var(--card)" }}
        >
          <div className="flex flex-col gap-5">
            <MockField
              label="Age band"
              value={empty ? "Select age band" : filledDetails.ageBand}
              muted={empty}
            />
            <MockField
              label="Gender"
              value={empty ? "Select gender" : filledDetails.gender}
              muted={empty}
            />
            <MockField
              label="Coming from"
              value={empty ? "Select origin" : filledDetails.origin}
              muted={empty}
            />
            <MockField
              label="Commute method"
              value={empty ? "Select commute method" : filledDetails.commuteMethod}
              muted={empty}
            />
            <MockField
              label="Time spent outside today"
              value={empty ? "Select time outside" : filledDetails.timeOutside}
              muted={empty}
            />

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                A server error occurred. Please try again.
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl px-6 font-semibold"
                disabled={loading}
              >
                <RotateCcw className="mr-2 size-4" />
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="rounded-xl px-6 font-semibold text-primary-foreground"
                disabled={empty || loading}
              >
                <Play className="mr-2 size-4" />
                {loading ? "Starting..." : "Start Session"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl px-6 font-semibold"
                disabled={empty || loading}
              >
                <FlaskConical className="mr-2 size-4" />
                Run Test Trial
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Test trials use fake local-only session ids and do not create participant,
              session, survey, or digit span records.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function MockField({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-foreground">{label}</Label>
      <Input
        readOnly
        value={value}
        className={
          muted
            ? "border-border bg-input/30 text-muted-foreground"
            : "border-border bg-input/30"
        }
      />
    </div>
  );
}

export function buildNewSessionStoryParameters() {
  return {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/new-session",
      },
    },
  };
}

export const newSessionMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);
