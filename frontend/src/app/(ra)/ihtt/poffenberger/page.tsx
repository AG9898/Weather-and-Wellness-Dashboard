"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startPoffenbergerSession,
  ApiError,
  type PoffenbergerStartRequest,
} from "@/lib/api";
import { useRAUser } from "@/lib/contexts/RAUserContext";
import PoffenbergerLaunchPage, {
  EMPTY_POFFENBERGER_FORM,
  isPoffenbergerFormComplete,
  type PoffenbergerDemoForm,
} from "@/lib/components/PoffenbergerLaunchPage";
import {
  persistPoffenbergerRunState,
  type PoffenbergerStoredRun,
} from "@/lib/poffenberger-task";
import {
  buildTrialRunPath,
  createTrialRunPoffenbergerState,
  persistTrialRunState,
  type PoffenbergerTrialMode,
} from "@/lib/trial-mode";

const IHTT_LAB_NAME = "ihtt";

/** True when the RA may operate the IHTT launch page: ihtt lab members and admins. */
function canAccessIhtt(role: string, labName: string): boolean {
  return role === "admin" || labName.toLowerCase() === IHTT_LAB_NAME;
}

export default function PoffenbergerLaunchRoute() {
  const router = useRouter();
  const { role, lab_name } = useRAUser();
  const [form, setForm] = useState<PoffenbergerDemoForm>(EMPTY_POFFENBERGER_FORM);
  const [starting, setStarting] = useState(false);
  const [shortTrialStarting, setShortTrialStarting] = useState(false);
  const [fullTrialStarting, setFullTrialStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authorized = canAccessIhtt(role, lab_name);

  useEffect(() => {
    if (!authorized) {
      router.replace("/unauthorized");
    }
  }, [authorized, router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  async function handleStart() {
    if (!isPoffenbergerFormComplete(form) || starting) return;
    setStarting(true);
    setError(null);

    const payload: PoffenbergerStartRequest = {
      age_band: form.age_band,
      gender: form.gender,
      origin: form.origin,
      origin_other_text: form.origin === "Other" ? form.origin_other_text.trim() : null,
      commute_method: form.commute_method,
      commute_method_other_text:
        form.commute_method === "Other" ? form.commute_method_other_text.trim() : null,
      time_outside: form.time_outside,
    };

    try {
      const result = await startPoffenbergerSession(payload);
      const stored: PoffenbergerStoredRun = {
        flow: "ihtt-poffenberger",
        mode: "production",
        run_id: result.run_id,
        session_id: result.session_id,
        participant_uuid: result.participant_uuid,
        start_path: result.start_path,
        manifest: result.manifest,
        created_at: new Date().toISOString(),
      };
      persistPoffenbergerRunState(stored);
      router.push(result.start_path);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? "Your session has expired. Please sign in again."
            : err.status === 403
              ? "Your account is not permitted to start IHTT sessions."
              : err.status >= 500
                ? "A server error occurred. Please try again."
                : "Could not start a session. Please try again."
          : "Unable to connect to the server. Please check your connection."
      );
      setStarting(false);
    }
  }

  function startTrial(mode: PoffenbergerTrialMode) {
    if (!isPoffenbergerFormComplete(form)) return;
    if (mode === "full") {
      setFullTrialStarting(true);
    } else {
      setShortTrialStarting(true);
    }
    setError(null);

    try {
      const trialState = createTrialRunPoffenbergerState(mode);
      persistTrialRunState(trialState);
      router.push(buildTrialRunPath(trialState.start_path));
    } catch {
      setError("Failed to start trial mode. Please try again.");
      if (mode === "full") {
        setFullTrialStarting(false);
      } else {
        setShortTrialStarting(false);
      }
    }
  }

  return (
    <PoffenbergerLaunchPage
      form={form}
      onFormChange={setForm}
      starting={starting}
      shortTrialStarting={shortTrialStarting}
      fullTrialStarting={fullTrialStarting}
      error={error}
      onStart={handleStart}
      onStartShortTrial={() => startTrial("short")}
      onStartFullTrial={() => startTrial("full")}
    />
  );
}
