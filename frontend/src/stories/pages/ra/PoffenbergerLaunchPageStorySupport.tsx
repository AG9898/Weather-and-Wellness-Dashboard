import { useState } from "react";
import type { Decorator } from "@storybook/nextjs-vite";
import PoffenbergerLaunchPage, {
  EMPTY_POFFENBERGER_FORM,
  type PoffenbergerDemoForm,
} from "@/lib/components/PoffenbergerLaunchPage";
import RAFloatingChrome from "@/lib/components/RAFloatingChrome";
import { RAUserContext } from "@/lib/contexts/RAUserContext";

export type PoffenbergerLaunchStoryState =
  | "empty"
  | "ready"
  | "starting"
  | "short_trial"
  | "full_trial"
  | "error";

interface PoffenbergerLaunchStoryShellProps {
  state?: PoffenbergerLaunchStoryState;
}

const COMPLETE_FORM: PoffenbergerDemoForm = {
  age_band: "18-24",
  gender: "Woman",
  origin: "Class",
  origin_other_text: "",
  commute_method: "Walk",
  commute_method_other_text: "",
  time_outside: "Rarely (31 minutes- 60 minutes)",
};

function initialFormFor(state: PoffenbergerLaunchStoryState): PoffenbergerDemoForm {
  return state === "empty" ? EMPTY_POFFENBERGER_FORM : COMPLETE_FORM;
}

export function PoffenbergerLaunchStoryShell({
  state = "ready",
}: PoffenbergerLaunchStoryShellProps) {
  const [form, setForm] = useState<PoffenbergerDemoForm>(() => initialFormFor(state));

  return (
    <RAUserContext.Provider
      value={{ role: "admin", lab_name: "ihtt", email: "demo@example.com" }}
    >
      <div className="min-h-screen bg-background">
        <main className="pb-32 sm:pb-36">
          <PoffenbergerLaunchPage
            form={form}
            onFormChange={setForm}
            starting={state === "starting"}
            shortTrialStarting={state === "short_trial"}
            fullTrialStarting={state === "full_trial"}
            error={
              state === "error"
                ? "Server error (500): Could not start a session. Please try again."
                : null
            }
          />
        </main>
        <RAFloatingChrome />
      </div>
    </RAUserContext.Provider>
  );
}

export function buildPoffenbergerLaunchStoryParameters() {
  return {
    layout: "fullscreen" as const,
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/ihtt/poffenberger",
      },
    },
  };
}

export const poffenbergerLaunchMobileDecorator: Decorator = (StoryComponent) => (
  <div className="mx-auto min-h-screen max-w-[430px] border-x border-border/70 bg-background shadow-[0_24px_70px_-50px_rgb(0_19_40/0.5)]">
    <StoryComponent />
  </div>
);
