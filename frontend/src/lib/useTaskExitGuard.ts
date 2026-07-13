import { useEffect } from "react";
import { isTrialRunId } from "@/lib/trial-mode";

/**
 * Shared participant task-page refresh/leave guard.
 *
 * While `active` is true, installs a `beforeunload` listener so an accidental
 * refresh, tab close, or navigation away during an in-progress task prompts the
 * browser's native confirmation dialog. This is a UX safeguard only — it does
 * not replace the server-side "real run" validity rule (a session only becomes
 * `active` at the first data write). See the three study DESIGN_SPEC docs and
 * `docs/CONVENTIONS.md` (Session validity & data quality).
 *
 * The guard is intentionally inert unless `active`, so callers pass `false` on
 * loading/idle/completion states and in trial-run rehearsal mode.
 */
export function useTaskExitGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      // Modern browsers show the native prompt from preventDefault() alone.
      event.preventDefault();
      // Some older engines still require a non-empty returnValue. Assign it via
      // a non-deprecated view of the property to keep that fallback.
      (event as { returnValue: string }).returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active]);
}

/**
 * Pure predicate for the Weather-Wellness participant session shell.
 *
 * Returns true only for an in-progress `/session/[id]/<task>` task page of a
 * recorded (non-trial) session. Returns false for:
 *  - the idle session index (`/session/[id]` with no task segment),
 *  - the terminal completion page (`/session/[id]/complete`),
 *  - trial-run sessions (fake ids prefixed by the trial-run id prefix),
 *  - any non-session pathname.
 *
 * Trial-run detection is by session-id prefix, matching the WW submit-mode
 * convention (`getWeatherWellnessSubmitMode`), so no query string is needed.
 */
export function shouldGuardWeatherWellnessPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "session") return false;

  const sessionId = parts[1];
  if (!sessionId) return false;

  const taskSegment = parts[2];
  if (!taskSegment) return false; // idle session index
  if (taskSegment === "complete") return false; // terminal state

  if (isTrialRunId(sessionId)) return false; // trial-run rehearsal

  return true;
}
