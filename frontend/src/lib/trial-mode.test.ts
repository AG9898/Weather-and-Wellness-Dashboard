import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TRIAL_RUN_ID_PREFIX,
  adoptTrialRunStateFromLocation,
  buildTrialRunPath,
  clearTrialRunState,
  createTrialRunMisokinesiaManifest,
  createTrialRunState,
  getMisokinesiaSubmitMode,
  getTrialRunWatermarkLabel,
  getWeatherWellnessSubmitMode,
  isTrialRunActiveForLocation,
  isTrialRunId,
  persistTrialRunState,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";

function createFakeSessionStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

beforeEach(() => {
  vi.stubGlobal("window", {
    sessionStorage: createFakeSessionStorage(),
  });
});

describe("trial-mode launch controls", () => {
  it("keeps the WW Run Test Trial launch control on the new-session page", () => {
    const source = readFrontendFile("src/app/(ra)/new-session/page.tsx");

    expect(source).toContain("Run Test Trial");
    expect(source).toContain("createTrialRunState(\"weather-wellness\")");
    expect(source).toContain("buildTrialRunPath(`/session/${trialState.session_id}/uls8`)");
  });

  it("keeps the Misokinesia Run Test Trial launch control on the launch surface", () => {
    const pageSource = readFrontendFile("src/app/(ra)/misokinesia/page.tsx");
    const componentSource = readFrontendFile("src/lib/components/MisokinesiaLaunchPage.tsx");

    expect(pageSource).toContain("createTrialRunState(\"misokinesia\")");
    expect(pageSource).toContain("getMisokinesiaTrialManifest()");
    expect(componentSource).toContain("Run Test Trial");
    expect(componentSource).toContain("onStartTrial");
  });
});

describe("trial-mode submit branching", () => {
  it("classifies fake WW session ids as trial submissions", () => {
    expect(getWeatherWellnessSubmitMode(`${TRIAL_RUN_ID_PREFIX}-session-123`)).toBe(
      "trial"
    );
    expect(getWeatherWellnessSubmitMode("real-session-id")).toBe("production");
  });

  it("classifies Misokinesia trial mode from the explicit component prop", () => {
    expect(getMisokinesiaSubmitMode(true)).toBe("trial");
    expect(getMisokinesiaSubmitMode(false)).toBe("production");
  });

  it("skips survey API work when WW trial mode is active", async () => {
    const apiPost = vi.fn();
    const localProgression = vi.fn();

    await runTrialAwareSubmit(getWeatherWellnessSubmitMode(`${TRIAL_RUN_ID_PREFIX}-session-uls8`), {
      production: apiPost,
      trial: localProgression,
    });

    expect(apiPost).not.toHaveBeenCalled();
    expect(localProgression).toHaveBeenCalledOnce();
  });

  it("skips digitspan API work when WW trial mode is active", async () => {
    const submitDigitSpan = vi.fn();
    const patchSessionComplete = vi.fn();
    const localCompletion = vi.fn();

    await runTrialAwareSubmit(
      getWeatherWellnessSubmitMode(`${TRIAL_RUN_ID_PREFIX}-session-digitspan`),
      {
        production: async () => {
          await submitDigitSpan();
          await patchSessionComplete();
        },
        trial: localCompletion,
      }
    );

    expect(submitDigitSpan).not.toHaveBeenCalled();
    expect(patchSessionComplete).not.toHaveBeenCalled();
    expect(localCompletion).toHaveBeenCalledOnce();
  });

  it("skips Misokinesia response and end-of-task API work when trial mode is active", async () => {
    const submitResponse = vi.fn();
    const submitEndOfTask = vi.fn();
    const localResponseProgression = vi.fn();
    const localEndProgression = vi.fn();

    await runTrialAwareSubmit(getMisokinesiaSubmitMode(true), {
      production: submitResponse,
      trial: localResponseProgression,
    });
    await runTrialAwareSubmit(getMisokinesiaSubmitMode(true), {
      production: submitEndOfTask,
      trial: localEndProgression,
    });

    expect(submitResponse).not.toHaveBeenCalled();
    expect(submitEndOfTask).not.toHaveBeenCalled();
    expect(localResponseProgression).toHaveBeenCalledOnce();
    expect(localEndProgression).toHaveBeenCalledOnce();
  });

  it("continues to call production API work outside trial mode", async () => {
    const submitSurvey = vi.fn();
    const submitMisokinesiaResponse = vi.fn();

    await runTrialAwareSubmit(getWeatherWellnessSubmitMode("real-session"), {
      production: submitSurvey,
      trial: vi.fn(),
    });
    await runTrialAwareSubmit(getMisokinesiaSubmitMode(false), {
      production: submitMisokinesiaResponse,
      trial: vi.fn(),
    });

    expect(submitSurvey).toHaveBeenCalledOnce();
    expect(submitMisokinesiaResponse).toHaveBeenCalledOnce();
  });
});

describe("trial-mode identity and watermark state", () => {
  it("generates clearly fake local-only ids and manifests", () => {
    const state = createTrialRunState("misokinesia");
    const manifest = createTrialRunMisokinesiaManifest(state, [
      {
        stimulus_id: "11111111-1111-1111-1111-111111111111",
        public_url: "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/a.mp4",
        sort_order: 1,
        duration_ms: 15000,
      },
      {
        stimulus_id: "22222222-2222-2222-2222-222222222222",
        public_url: "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/b.mp4",
        sort_order: 2,
        duration_ms: 15000,
      },
      {
        stimulus_id: "33333333-3333-3333-3333-333333333333",
        public_url: "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/c.mp4",
        sort_order: 3,
        duration_ms: 15000,
      },
      {
        stimulus_id: "44444444-4444-4444-4444-444444444444",
        public_url: "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/d.mp4",
        sort_order: 4,
        duration_ms: 15000,
      },
      {
        stimulus_id: "55555555-5555-5555-5555-555555555555",
        public_url: "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/e.mp4",
        sort_order: 5,
        duration_ms: 15000,
      },
    ]);

    expect(isTrialRunId(state.session_id)).toBe(true);
    expect(isTrialRunId(state.misokinesia_participant_id)).toBe(true);
    expect(manifest.clips).toHaveLength(5);
    expect(manifest.clips[0]).toMatchObject({
      stimulus_id: "11111111-1111-1111-1111-111111111111",
      public_url:
        "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/a.mp4",
      sort_order: 1,
      duration_ms: 15000,
    });
  });

  it("marks trial participant locations active and exposes the Trial Run label", () => {
    const state = createTrialRunState("weather-wellness");
    persistTrialRunState(state);
    const location = {
      pathname: `/session/${state.session_id}/uls8`,
      search: "?trial=1",
    };

    adoptTrialRunStateFromLocation(location);

    expect(isTrialRunActiveForLocation(location)).toBe(true);
    expect(getTrialRunWatermarkLabel(isTrialRunActiveForLocation(location))).toBe("Trial Run");
  });

  it("does not show the Trial Run label outside trial participant routes", () => {
    clearTrialRunState();

    expect(
      getTrialRunWatermarkLabel(
        isTrialRunActiveForLocation({
          pathname: "/session/real-session/uls8",
          search: "",
        })
      )
    ).toBeNull();
  });

  it("adds the trial query parameter to participant flow paths", () => {
    expect(buildTrialRunPath("/session/trial-local-session-1/uls8")).toBe(
      "/session/trial-local-session-1/uls8?trial=1"
    );
  });
});
