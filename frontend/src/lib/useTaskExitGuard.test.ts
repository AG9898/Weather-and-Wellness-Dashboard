import { describe, expect, it } from "vitest";

import { createTrialRunSessionId } from "@/lib/trial-mode";
import { shouldGuardWeatherWellnessPath } from "@/lib/useTaskExitGuard";

describe("shouldGuardWeatherWellnessPath", () => {
  it("guards in-progress WW survey and cognitive task pages of a recorded session", () => {
    const sessionId = "session-abc-123";
    for (const segment of [
      "uls8",
      "cesd10",
      "gad7",
      "cogfunc",
      "digitspan",
      "stroop",
      "card_sorting",
    ]) {
      expect(shouldGuardWeatherWellnessPath(`/session/${sessionId}/${segment}`)).toBe(true);
    }
  });

  it("does not guard the terminal completion page", () => {
    expect(shouldGuardWeatherWellnessPath("/session/session-abc-123/complete")).toBe(false);
  });

  it("does not guard the idle session index (no task segment)", () => {
    expect(shouldGuardWeatherWellnessPath("/session/session-abc-123")).toBe(false);
  });

  it("does not guard trial-run sessions", () => {
    const trialSessionId = createTrialRunSessionId();
    expect(shouldGuardWeatherWellnessPath(`/session/${trialSessionId}/uls8`)).toBe(false);
    expect(shouldGuardWeatherWellnessPath(`/session/${trialSessionId}/digitspan`)).toBe(false);
  });

  it("does not guard non-session pathnames", () => {
    expect(shouldGuardWeatherWellnessPath("/misokinesia/some-id")).toBe(false);
    expect(shouldGuardWeatherWellnessPath("/ihtt/poffenberger/run-1")).toBe(false);
    expect(shouldGuardWeatherWellnessPath("/dashboard")).toBe(false);
    expect(shouldGuardWeatherWellnessPath("/")).toBe(false);
  });
});
