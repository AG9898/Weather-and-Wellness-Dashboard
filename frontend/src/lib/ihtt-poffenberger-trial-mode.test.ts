import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  POFFENBERGER_FULL_BLOCKS,
  POFFENBERGER_FULL_PRACTICE_TRIALS,
  POFFENBERGER_FULL_TRIALS_PER_BLOCK,
  POFFENBERGER_SHORT_TRIAL_BLOCKS,
  POFFENBERGER_SHORT_TRIALS_PER_BLOCK,
  createTrialRunPoffenbergerManifest,
  createTrialRunPoffenbergerState,
  isTrialRunId,
} from "@/lib/trial-mode";
import type {
  PoffenbergerManifest,
  PoffenbergerResponseHand,
  PoffenbergerVisualField,
} from "@/lib/api";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function countValues<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }),
    {} as Record<T, number>
  );
}

function expectBalancedFields(fields: PoffenbergerVisualField[]): void {
  const counts = countValues(fields);
  expect(counts.lvf).toBe(fields.length / 2);
  expect(counts.rvf).toBe(fields.length / 2);
}

function allBlockHands(manifest: PoffenbergerManifest): PoffenbergerResponseHand[] {
  return manifest.blocks.map((block) => block.response_hand);
}

describe("IHTT Poffenberger API wrappers", () => {
  it("exports typed recorded start and submit wrappers through src/lib/api", () => {
    const source = readFrontendFile("src/lib/api/index.ts");

    expect(source).toContain("export async function startPoffenbergerSession");
    expect(source).toContain("export async function submitPoffenbergerRun");
    expect(source).toContain('"/ihtt/poffenberger/start"');
    expect(source).toContain('`/ihtt/poffenberger/runs/${encodeURIComponent(runId)}/submit`');
    expect(source).toContain("PoffenbergerStartResponse");
    expect(source).toContain("PoffenbergerSubmitRequest");
  });
});

describe("IHTT Poffenberger no-write trial helpers", () => {
  it("creates a short balanced local manifest covering both hands and visual fields", () => {
    const manifest = createTrialRunPoffenbergerManifest("short");

    expect(manifest.practice_trials.length).toBeGreaterThan(0);
    expectBalancedFields(manifest.practice_trials.map((trial) => trial.visual_field));
    expect(manifest.blocks).toHaveLength(POFFENBERGER_SHORT_TRIAL_BLOCKS);
    expect(new Set(allBlockHands(manifest))).toEqual(new Set(["left", "right"]));

    manifest.blocks.forEach((block, blockIndex) => {
      expect(block.block_number).toBe(blockIndex + 1);
      expect(block.expected_key).toBe(block.response_hand === "left" ? "f" : "j");
      expect(block.trials).toHaveLength(POFFENBERGER_SHORT_TRIALS_PER_BLOCK);
      expectBalancedFields(block.trials.map((trial) => trial.visual_field));
    });

    expect(manifest.blocks.flatMap((block) => block.trials).map((trial) => trial.global_trial_number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("creates a production-length full trial manifest with balanced blocks", () => {
    const manifest = createTrialRunPoffenbergerManifest("full");
    const handCounts = countValues(allBlockHands(manifest));

    expect(manifest.practice_trials).toHaveLength(POFFENBERGER_FULL_PRACTICE_TRIALS);
    expectBalancedFields(manifest.practice_trials.map((trial) => trial.visual_field));
    expect(manifest.blocks).toHaveLength(POFFENBERGER_FULL_BLOCKS);
    expect(handCounts.left).toBe(POFFENBERGER_FULL_BLOCKS / 2);
    expect(handCounts.right).toBe(POFFENBERGER_FULL_BLOCKS / 2);

    manifest.blocks.forEach((block) => {
      expect(block.trials).toHaveLength(POFFENBERGER_FULL_TRIALS_PER_BLOCK);
      expectBalancedFields(block.trials.map((trial) => trial.visual_field));
    });

    const experimentalTrials = manifest.blocks.flatMap((block) => block.trials);
    expect(experimentalTrials).toHaveLength(600);
    expect(experimentalTrials[0].global_trial_number).toBe(1);
    expect(experimentalTrials[599].global_trial_number).toBe(600);
  });

  it("creates fake local state and does not import recorded write wrappers", () => {
    const state = createTrialRunPoffenbergerState("short");
    const source = readFrontendFile("src/lib/trial-mode.ts");

    expect(state.flow).toBe("ihtt-poffenberger");
    expect(state.poffenberger_trial_mode).toBe("short");
    expect(isTrialRunId(state.run_id)).toBe(true);
    expect(isTrialRunId(state.session_id)).toBe(true);
    expect(isTrialRunId(state.participant_uuid)).toBe(true);
    expect(state.start_path).toBe(`/ihtt/poffenberger/${state.run_id}`);
    expect(state.manifest.blocks).toHaveLength(POFFENBERGER_SHORT_TRIAL_BLOCKS);
    expect(source).not.toContain("startPoffenbergerSession(");
    expect(source).not.toContain("submitPoffenbergerRun(");
    expect(source).not.toContain("patchSessionStatus(");
  });
});
