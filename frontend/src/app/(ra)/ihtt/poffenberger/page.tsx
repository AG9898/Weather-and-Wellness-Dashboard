"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startPoffenbergerSession,
  ApiError,
  type PoffenbergerStartRequest,
} from "@/lib/api";
import {
  getPoffenbergerDashboard,
  type PoffenbergerDashboardResponse,
} from "@/lib/api/ihtt-poffenberger";
import { useRAUser } from "@/lib/contexts/RAUserContext";
import { canAccessLab } from "@/lib/labs";
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

export default function PoffenbergerLaunchRoute() {
  const router = useRouter();
  const { role, lab_name } = useRAUser();
  const [form, setForm] = useState<PoffenbergerDemoForm>(EMPTY_POFFENBERGER_FORM);
  const [starting, setStarting] = useState(false);
  const [shortTrialStarting, setShortTrialStarting] = useState(false);
  const [fullTrialStarting, setFullTrialStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<PoffenbergerDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const authorized = canAccessLab(role, lab_name, "ihtt");

  useEffect(() => {
    if (!authorized) {
      router.replace("/unauthorized");
    }
  }, [authorized, router]);

  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;

    async function loadDashboard() {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const result = await getPoffenbergerDashboard();
        if (!cancelled) setDashboard(result);
      } catch (err) {
        if (cancelled) return;
        setDashboardError(
          err instanceof ApiError
            ? `Dashboard failed to load (${err.status}): ${err.message}`
            : "Dashboard failed to load. Please refresh and try again."
        );
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [authorized]);

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
      handedness: form.handedness,
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
    // No-write trials create no records, so they do not require demographics.
    if (starting || shortTrialStarting || fullTrialStarting) return;
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
      dashboard={dashboard}
      dashboardLoading={dashboardLoading}
      dashboardError={dashboardError}
    />
  );
}
