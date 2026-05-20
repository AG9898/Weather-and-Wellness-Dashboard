import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildMkaqPanes, MKAQ_ITEMS } from "@/lib/components/MisokinesiaMkaqForm";
import { buildMaqPanes, MAQ_ITEMS } from "@/lib/components/MisokinesiaMAQForm";

import {
  TRIAL_MAQ_ITEM_COUNT,
  TRIAL_MKAQ_ITEM_COUNT,
  TRIAL_RUN_ID_PREFIX,
  adoptTrialRunStateFromLocation,
  buildTrialRunPath,
  clearTrialRunState,
  createTrialRunMisokinesiaManifest,
  createTrialRunState,
  createTrialSurveyOrder,
  getMisokinesiaSubmitMode,
  getTrialRunWatermarkLabel,
  getWeatherWellnessSubmitMode,
  isTrialRunActiveForLocation,
  isTrialRunId,
  persistTrialRunState,
  runTrialAwareSubmit,
} from "@/lib/trial-mode";
import {
  getPhaseAfterBegin,
  getPhaseAfterQuestionnaireComplete,
  getPhaseAfterVideoComplete,
  getNextPostSurveyPhase,
  getTransitionPhase,
  getSurveyPhaseFromTransition,
} from "@/lib/misokinesia-phase";
import { parseSurveyOrder } from "@/lib/api";

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

  it("keeps the Misokinesia Run Short Trial launch control on the launch surface", () => {
    const pageSource = readFrontendFile("src/app/(ra)/misokinesia/page.tsx");
    const componentSource = readFrontendFile("src/lib/components/MisokinesiaLaunchPage.tsx");

    expect(pageSource).toContain('startTrial("short")');
    expect(pageSource).toContain("createTrialRunState(\"misokinesia\", mode)");
    expect(pageSource).toContain("getMisokinesiaTrialManifest(mode === \"full\")");
    expect(componentSource).toContain("Run Short Trial");
    expect(componentSource).toContain("onStartShortTrial");
  });

  it("keeps the Misokinesia Run Full Trial launch control on the launch surface", () => {
    const pageSource = readFrontendFile("src/app/(ra)/misokinesia/page.tsx");
    const componentSource = readFrontendFile("src/lib/components/MisokinesiaLaunchPage.tsx");
    const apiSource = readFrontendFile("src/lib/api/index.ts");

    expect(pageSource).toContain("createTrialRunState(\"misokinesia\", mode)");
    expect(pageSource).toContain("getMisokinesiaTrialManifest(mode === \"full\")");
    expect(pageSource).toContain("Full trial manifest returned only");
    expect(apiSource).toContain('"/misokinesia/trial-manifest?full=true"');
    expect(componentSource).toContain("Run Full Trial");
    expect(componentSource).toContain("onStartFullTrial");
  });

  it("keeps Misokinesia video tallies tied to the manifest clip count", () => {
    const pageSource = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );

    expect(pageSource).toContain("const totalClips = manifest?.clips.length ?? 0");
    expect(pageSource).toContain("<p>You will watch {totalClips} short video clips.</p>");
    expect(pageSource).toContain("Clip {clipNumber} of {totalClips}");
  });

  it("keeps Misokinesia playback on the shared video player path", () => {
    const pageSource = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    const playerUsages = pageSource.match(/<MisokinesiaVideoPlayer/g) ?? [];

    expect(playerUsages).toHaveLength(1);
    expect(pageSource).toContain("publicUrl={currentClip.public_url}");
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

describe("MkAQ typed wrapper and carousel pane logic", () => {
  it("exports submitMisokinesiaMkaq from src/lib/api/index.ts", () => {
    const source = readFrontendFile("src/lib/api/index.ts");
    expect(source).toContain("export async function submitMisokinesiaMkaq");
    expect(source).toContain("MisokinesiaMkaqRequest");
    expect(source).toContain("MisokinesiaMkaqResponse");
  });

  it("MisokinesiaMkaqForm does not use bare fetch", () => {
    const source = readFrontendFile("src/lib/components/MisokinesiaMkaqForm.tsx");
    // No bare fetch() calls — all API calls go through typed wrappers
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it("groups 21 items into 5/5/5/6 panes", () => {
    const panes = buildMkaqPanes(MKAQ_ITEMS);
    expect(panes).toHaveLength(4);
    expect(panes[0]).toHaveLength(5);
    expect(panes[1]).toHaveLength(5);
    expect(panes[2]).toHaveLength(5);
    expect(panes[3]).toHaveLength(6);
  });

  it("groups 10 items into 5/5 panes", () => {
    const panes = buildMkaqPanes(MKAQ_ITEMS.slice(0, 10));
    expect(panes).toHaveLength(2);
    expect(panes[0]).toHaveLength(5);
    expect(panes[1]).toHaveLength(5);
  });

  it("MKAQ_ITEMS exports all 21 items with correct keys and wording", () => {
    expect(MKAQ_ITEMS).toHaveLength(21);
    expect(MKAQ_ITEMS[0].key).toBe("q1");
    expect(MKAQ_ITEMS[20].key).toBe("q21");
    // Spec requires instrument wording; items must not use "misokinesia" or "fidgeting"
    for (const item of MKAQ_ITEMS) {
      expect(item.text.toLowerCase()).not.toContain("misokinesia");
      expect(item.text.toLowerCase()).not.toContain("fidgeting");
    }
  });

  it("preserves item order across panes", () => {
    const panes = buildMkaqPanes(MKAQ_ITEMS);
    const flat = panes.flat();
    flat.forEach((item, idx) => {
      expect(item.key).toBe(MKAQ_ITEMS[idx].key);
    });
  });
});

describe("MkAQ production participant flow placement", () => {
  it("participant page includes the mkaq phase in the state machine", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain('"mkaq"');
    expect(source).toContain("getPhaseAfterBegin");
    expect(source).toContain("getPhaseAfterVideoComplete");
    expect(source).toContain("getNextPostSurveyPhase");
  });

  it("participant page calls submitMisokinesiaMkaq for production submissions", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain("submitMisokinesiaMkaq");
  });

  it("participant page does not use bare fetch", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it("routes begin phase directly to playing", () => {
    expect(getPhaseAfterBegin()).toBe("pre_play");
  });

  it("routes final questionnaire completion to mkaq when clips are complete", () => {
    expect(getPhaseAfterQuestionnaireComplete(true, "mkaq,gad7,maq")).toBe("mkaq");
    expect(getPhaseAfterQuestionnaireComplete(true, undefined)).toBe("mkaq");
    expect(getPhaseAfterQuestionnaireComplete(false, "mkaq,gad7,maq")).toBe("playing");
    expect(getPhaseAfterQuestionnaireComplete(false, undefined)).toBe("playing");
  });
});

describe("MkAQ Trial Run shortened carousel (T149)", () => {
  it("parseSurveyOrder returns a valid permutation of survey keys", () => {
    const order = parseSurveyOrder("mkaq,gad7,maq");
    expect(order).toHaveLength(3);
    expect(order).toContain("mkaq");
    expect(order).toContain("gad7");
    expect(order).toContain("maq");
  });

  it("trial manifest includes post_survey_order", () => {
    const state = createTrialRunState("misokinesia");
    const clips = Array.from({ length: 5 }, (_, i) => ({
      stimulus_id: `${"0".repeat(8)}-0000-0000-0000-${"0".repeat(11)}${i + 1}`,
      public_url: `https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/${i}.mp4`,
      sort_order: i + 1,
      duration_ms: 15000,
    }));

    const manifest = createTrialRunMisokinesiaManifest(state, clips, "short");
    expect(parseSurveyOrder(manifest.post_survey_order)).toHaveLength(3);
  });

  it("participant page uses 10-item subset for trial mode MkAQ", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain("TRIAL_MKAQ_ITEM_COUNT");
    expect(source).toContain("MKAQ_ITEMS.slice(0, TRIAL_MKAQ_ITEM_COUNT)");
    expect(source).toContain('trialModeType === "short"');
  });

  it("TRIAL_MKAQ_ITEM_COUNT is 10", () => {
    expect(TRIAL_MKAQ_ITEM_COUNT).toBe(10);
  });

  it("TRIAL_MAQ_ITEM_COUNT is 10", () => {
    expect(TRIAL_MAQ_ITEM_COUNT).toBe(10);
  });

  it("createTrialSurveyOrder returns a three-survey permutation", () => {
    const order = createTrialSurveyOrder();

    expect(order).toHaveLength(3);
    expect(new Set(order)).toEqual(new Set(["mkaq", "gad7", "maq"]));
  });

  it("trial MkAQ submit does not call mkaq backend endpoint", async () => {
    const submitMkaq = vi.fn();
    const localAdvance = vi.fn();

    await runTrialAwareSubmit(getMisokinesiaSubmitMode(true), {
      production: submitMkaq,
      trial: localAdvance,
    });

    expect(submitMkaq).not.toHaveBeenCalled();
    expect(localAdvance).toHaveBeenCalledOnce();
  });

  it("launch page creates a local short trial survey order", () => {
    const source = readFrontendFile("src/app/(ra)/misokinesia/page.tsx");
    expect(source).toContain("createTrialRunMisokinesiaManifest(");
    expect(source).toContain("trialManifest.clips");
    expect(source).toContain("mode");
  });

  it("trial manifest records whether it was created for short or full mode", () => {
    const state = createTrialRunState("misokinesia", "full");
    const manifest = createTrialRunMisokinesiaManifest(
      state,
      [
        {
          stimulus_id: "11111111-1111-1111-1111-111111111111",
          public_url:
            "https://example.supabase.co/storage/v1/object/public/misokinesia-stimuli/a.mp4",
          sort_order: 1,
          duration_ms: 15000,
        },
      ],
      "full"
    );

    expect(manifest.trial_mode).toBe("full");
  });

  it("routes through the randomized post-video survey order via transition cards", () => {
    expect(getPhaseAfterVideoComplete(["gad7", "mkaq", "maq"])).toBe("transition_gad7");
    expect(getNextPostSurveyPhase(["gad7", "mkaq", "maq"], 0)).toBe("transition_mkaq");
    expect(getNextPostSurveyPhase(["gad7", "mkaq", "maq"], 2)).toBe("end_of_task");
  });
});

describe("MAQ post-video survey carousel (T174)", () => {
  it("exports all 21 MAQ items with sound issues wording", () => {
    expect(MAQ_ITEMS).toHaveLength(21);
    expect(MAQ_ITEMS[0]).toMatchObject({
      id: "q1",
      text: "My sound issues currently make me unhappy.",
    });
    expect(MAQ_ITEMS[3]).toMatchObject({
      id: "q4",
      text: "I feel that no one understands my problems with certain sounds.",
    });
    expect(MAQ_ITEMS[20]).toMatchObject({
      id: "q21",
      text: "I am worried that my whole life will be affected by sound issues.",
    });
  });

  it("groups production MAQ items into q1-q7, q8-q14, and q15-q21 panes", () => {
    const panes = buildMaqPanes(MAQ_ITEMS);

    expect(panes).toHaveLength(3);
    expect(panes.map((pane) => pane.map((item) => item.id))).toEqual([
      ["q1", "q2", "q3", "q4", "q5", "q6", "q7"],
      ["q8", "q9", "q10", "q11", "q12", "q13", "q14"],
      ["q15", "q16", "q17", "q18", "q19", "q20", "q21"],
    ]);
  });

  it("groups trial MAQ items into q1-q5 and q6-q10 panes", () => {
    const panes = buildMaqPanes(MAQ_ITEMS, 10);

    expect(panes).toHaveLength(2);
    expect(panes.map((pane) => pane.map((item) => item.id))).toEqual([
      ["q1", "q2", "q3", "q4", "q5"],
      ["q6", "q7", "q8", "q9", "q10"],
    ]);
  });

  it("MisokinesiaMAQForm keeps API work outside the component", () => {
    const source = readFrontendFile("src/lib/components/MisokinesiaMAQForm.tsx");

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).toContain("onSubmit({ ...answers })");
    expect(source).toContain("disabled={!currentPaneComplete || submitting}");
    expect(source).toContain("disabled={!allAnswered || submitting}");
  });
});

describe("trial-mode identity and watermark state", () => {
  it("generates clearly fake local-only ids and manifests", () => {
    const state = createTrialRunState("misokinesia");
    const manifest = createTrialRunMisokinesiaManifest(
      state,
      [
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
      ],
      "short"
    );

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

describe("T183 transition cards — phase helpers", () => {
  it("getTransitionPhase maps each post-survey key to its transition phase", () => {
    expect(getTransitionPhase("mkaq")).toBe("transition_mkaq");
    expect(getTransitionPhase("gad7")).toBe("transition_gad7");
    expect(getTransitionPhase("maq")).toBe("transition_maq");
  });

  it("getSurveyPhaseFromTransition strips the prefix back to the survey key", () => {
    expect(getSurveyPhaseFromTransition("transition_mkaq")).toBe("mkaq");
    expect(getSurveyPhaseFromTransition("transition_gad7")).toBe("gad7");
    expect(getSurveyPhaseFromTransition("transition_maq")).toBe("maq");
  });

  it("participant page includes all three transition phases in the Phase union", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain('"transition_mkaq"');
    expect(source).toContain('"transition_gad7"');
    expect(source).toContain('"transition_maq"');
  });

  it("participant page renders TransitionCard and calls handleTransitionContinue", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain("TransitionCard");
    expect(source).toContain("handleTransitionContinue");
  });
});

describe("T185 miso demographics — participant UI and trial skip", () => {
  it("exports patchMisokinesiaDemographics from src/lib/api/index.ts", () => {
    const source = readFrontendFile("src/lib/api/index.ts");
    expect(source).toContain("export async function patchMisokinesiaDemographics");
    expect(source).toContain("MisokinesiaDemographicsRequest");
  });

  it("participant page includes demographics as the first phase", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain('"demographics"');
    expect(source).toContain('setPhase("demographics")');
  });

  it("participant page skips demographics API call in trial mode", () => {
    const source = readFrontendFile(
      "src/app/misokinesia/[misokinesia_participant_id]/page.tsx"
    );
    expect(source).toContain("handleDemographicsSubmit");
    expect(source).toContain("if (trialMode)");
    expect(source).toContain("patchMisokinesiaDemographics");
  });

  it("MisokinesiaDemographicsForm does not use bare fetch", () => {
    const source = readFrontendFile("src/lib/components/MisokinesiaDemographicsForm.tsx");
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
