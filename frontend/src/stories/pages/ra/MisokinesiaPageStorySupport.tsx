import type { Decorator } from "@storybook/nextjs-vite";
import MisokinesiaLaunchPage from "@/lib/components/MisokinesiaLaunchPage";
import RAFloatingChrome from "@/lib/components/RAFloatingChrome";
import { RAUserContext } from "@/lib/contexts/RAUserContext";
import type {
  MisoDashboardResponse,
  MisoVideoScoresResponse,
} from "@/lib/api/misokinesia";

export type MisokinesiaStoryState = "replica" | "loading" | "empty" | "error";
export type MisokinesiaDemographicsVariant = "mixed" | "all_null";

interface MisokinesiaStoryShellProps {
  state?: MisokinesiaStoryState;
  demographicsVariant?: MisokinesiaDemographicsVariant;
}

const liveDashboardData: MisoDashboardResponse = {
  active_stimuli_count: 25,
  recent_sessions: [
    {
      misokinesia_participant_number: 149,
      started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 30 * 1000).toISOString(),
      age: 24,
      sex: "Female",
      residence_status: "Student Visa",
      avg_clip_score: 15.5,
    },
    {
      misokinesia_participant_number: 148,
      started_at: new Date(Date.now() - 72 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
      age: 31,
      sex: "Male",
      residence_status: "Permanent Resident",
      avg_clip_score: 12.9,
    },
    {
      misokinesia_participant_number: 147,
      started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
      age: null,
      sex: null,
      residence_status: null,
      avg_clip_score: null,
    },
  ],
};

const liveVideoScores: MisoVideoScoresResponse = {
  top_5: [
    { video_label: "Ankle Wagging", avg_score: 17.4, response_count: 24 },
    { video_label: "Finger Tapping", avg_score: 16.8, response_count: 24 },
    { video_label: "Pen Clicking", avg_score: 16.1, response_count: 23 },
  ],
  bottom_5: [
    { video_label: "Page Turning", avg_score: 7.2, response_count: 23 },
    { video_label: "Hair Twirling", avg_score: 8.4, response_count: 24 },
    { video_label: "Foot Shift", avg_score: 9.1, response_count: 24 },
  ],
};

const emptyDashboardData: MisoDashboardResponse = {
  active_stimuli_count: 25,
  recent_sessions: [],
};

const emptyVideoScores: MisoVideoScoresResponse = {
  top_5: [],
  bottom_5: [],
};

function getDashboardData(
  state: MisokinesiaStoryState,
  demographicsVariant: MisokinesiaDemographicsVariant
): MisoDashboardResponse {
  if (state === "empty") {
    return emptyDashboardData;
  }
  if (demographicsVariant === "all_null") {
    return {
      ...liveDashboardData,
      recent_sessions: liveDashboardData.recent_sessions.map((session) => ({
        ...session,
        age: null,
        sex: null,
        residence_status: null,
      })),
    };
  }
  return liveDashboardData;
}

export function MisokinesiaStoryShell({
  state = "replica",
  demographicsVariant = "mixed",
}: MisokinesiaStoryShellProps) {
  const isLoading = state === "loading";
  const errorMsg =
    state === "error"
      ? "Server error (500): Failed to start session."
      : null;

  return (
    <RAUserContext.Provider
      value={{ role: "admin", lab_name: "Weather & Wellness", email: "demo@example.com" }}
    >
      <div className="min-h-screen bg-background">
        <main className="pb-32 sm:pb-36">
          <MisokinesiaLaunchPage
            loading={isLoading}
            dashboard={getDashboardData(state, demographicsVariant)}
            videoScores={state === "empty" ? emptyVideoScores : liveVideoScores}
            dashboardLoading={isLoading}
            dashboardError={errorMsg}
            error={state === "error" ? errorMsg : null}
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
