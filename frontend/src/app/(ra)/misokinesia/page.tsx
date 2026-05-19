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
  type MisokinesiaTrialMode,
  persistTrialRunState,
} from "@/lib/trial-mode";

const MISOKINESIA_MANIFEST_KEY = "misokinesia_manifest";

export default function MisokinesiaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [shortTrialLoading, setShortTrialLoading] = useState(false);
  const [fullTrialLoading, setFullTrialLoading] = useState(false);
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

  async function startTrial(mode: MisokinesiaTrialMode) {
    if (mode === "full") {
      setFullTrialLoading(true);
    } else {
      setShortTrialLoading(true);
    }
    setError(null);
    try {
      const trialState = createTrialRunState("misokinesia", mode);
      const trialManifest = await getMisokinesiaTrialManifest(mode === "full");
      const manifest = createTrialRunMisokinesiaManifest(
        trialState,
        trialManifest.clips,
        mode
      );
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
      if (mode === "full") {
        setFullTrialLoading(false);
      } else {
        setShortTrialLoading(false);
      }
    }
  }

  async function handleStartShortTrial() {
    await startTrial("short");
  }

  async function handleStartFullTrial() {
    await startTrial("full");
  }

  return (
    <MisokinesiaLaunchPage
      loading={loading}
      shortTrialLoading={shortTrialLoading}
      fullTrialLoading={fullTrialLoading}
      error={error}
      onStart={handleStart}
      onStartShortTrial={handleStartShortTrial}
      onStartFullTrial={handleStartFullTrial}
    />
  );
}
