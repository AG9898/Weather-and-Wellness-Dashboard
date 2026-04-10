"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MisokinesiaLaunchPage from "@/lib/components/MisokinesiaLaunchPage";
import {
  startMisokinesiaSession,
  type MisokinesiaManifest,
  ApiError,
} from "@/lib/api";

const MISOKINESIA_MANIFEST_KEY = "misokinesia_manifest";

export default function MisokinesiaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  return <MisokinesiaLaunchPage loading={loading} error={error} onStart={handleStart} />;
}
