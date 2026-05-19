"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MisokinesiaLaunchPage from "@/lib/components/MisokinesiaLaunchPage";
import {
  startMisokinesiaSession,
  getMisokinesiaTrialManifest,
  type MisokinesiaManifest,
  ApiError,
} from "@/lib/api";
import {
  buildTrialRunPath,
  createTrialRunMisokinesiaManifest,
  createTrialRunState,
  persistTrialRunState,
} from "@/lib/trial-mode";

const MISOKINESIA_MANIFEST_KEY = "misokinesia_manifest";

export default function MisokinesiaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const manifest: MisokinesiaManifest = await startMisokinesiaSession();
      sessionStorage.setItem(MISOKINESIA_MANIFEST_KEY, JSON.stringify(manifest));
      router.push(`/misokinesia/${manifest.misokinesia_participant_id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Server error (${err.status}): ${err.message}`
          : "Failed to start session. Please try again."
      );
      setLoading(false);
    }
  }

  async function handleStartShortTrial() {
    setTrialLoading(true);
    setError(null);
    try {
      const trialState = createTrialRunState("misokinesia", "short");
      const trialManifest = await getMisokinesiaTrialManifest();
      const manifest = createTrialRunMisokinesiaManifest(trialState, trialManifest.clips, "short");
      persistTrialRunState(trialState);
      sessionStorage.setItem(MISOKINESIA_MANIFEST_KEY, JSON.stringify(manifest));
      router.push(
        buildTrialRunPath(`/misokinesia/${trialState.misokinesia_participant_id}`)
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Trial launch failed (${err.status}): ${err.message}`
          : "Failed to start trial mode. Please try again."
      );
      setTrialLoading(false);
    }
  }

  return (
    <MisokinesiaLaunchPage
      loading={loading}
      trialLoading={trialLoading}
      error={error}
      onStart={handleStart}
      onStartTrial={handleStartShortTrial}
    />
  );
}
