import { describe, expect, it } from "vitest";

import {
  buildPoffenbergerSubmitPayload,
  createPoffenbergerSubmittedTrial,
  flattenPoffenbergerManifest,
  isExpectedPoffenbergerKey,
} from "@/lib/poffenberger-task";
import { createTrialRunPoffenbergerState } from "@/lib/trial-mode";

describe("IHTT Poffenberger participant task helpers", () => {
  it("records stimulus-onset to assigned-key reaction time", () => {
    const state = createTrialRunPoffenbergerState("full");
    const trial = flattenPoffenbergerManifest(state.manifest)[0];

    expect(isExpectedPoffenbergerKey("J", trial.expected_key)).toBe(true);

    const row = createPoffenbergerSubmittedTrial(
      trial,
      {
        client_trial_started_at_ms: 100,
        client_stimulus_onset_ms: 1450.25,
        client_response_at_ms: 1788.75,
        client_trial_ended_at_ms: 1790,
      },
      "J"
    );

    expect(row.pressed_key).toBe("j");
    expect(row.reaction_time_ms).toBe(339);
    expect(row.is_timeout).toBe(false);
    expect(row.is_practice).toBe(true);
  });

  it("records timeout rows without client-computed scoring fields", () => {
    const state = createTrialRunPoffenbergerState("full");
    const trial = flattenPoffenbergerManifest(state.manifest).find(
      (candidate) => !candidate.is_practice
    );

    expect(trial).toBeDefined();
    const row = createPoffenbergerSubmittedTrial(
      trial!,
      {
        client_trial_started_at_ms: 2000,
        client_stimulus_onset_ms: 3120,
        client_response_at_ms: null,
        client_trial_ended_at_ms: 5120,
      },
      null
    );

    expect(row.pressed_key).toBeNull();
    expect(row.reaction_time_ms).toBeNull();
    expect(row.is_timeout).toBe(true);
    expect(row).not.toHaveProperty("is_accurate");
    expect(row).not.toHaveProperty("condition_key");
  });

  it("builds a raw submit payload with all practice and experimental rows", () => {
    const state = createTrialRunPoffenbergerState("full");
    const rows = flattenPoffenbergerManifest(state.manifest).map((trial, index) =>
      createPoffenbergerSubmittedTrial(
        trial,
        {
          client_trial_started_at_ms: index * 3000,
          client_stimulus_onset_ms: index * 3000 + trial.jitter_ms,
          client_response_at_ms: index * 3000 + trial.jitter_ms + 250,
          client_trial_ended_at_ms: index * 3000 + trial.jitter_ms + 260,
        },
        trial.expected_key
      )
    );

    const payload = buildPoffenbergerSubmitPayload(state, rows);

    expect(payload.run_id).toBe(state.run_id);
    expect(payload.session_id).toBe(state.session_id);
    expect(payload.trials).toHaveLength(610);
    expect(payload.trials[0]).toMatchObject({
      block_number: 0,
      global_trial_number: 1,
      is_practice: true,
    });
    expect(payload.trials[10]).toMatchObject({
      block_number: 1,
      global_trial_number: 11,
      is_practice: false,
    });
    expect(payload).not.toHaveProperty("condition_summaries");
    expect(payload).not.toHaveProperty("mean_rt_ms");
  });
});
