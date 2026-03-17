"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
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

  return (
    <PageContainer>
      {/* Hero action zone */}
      <div
        className="relative mb-8 overflow-hidden rounded-2xl border border-border px-8 py-10"
        style={{ background: "var(--card)" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--ubc-blue-600)" }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Misokinesia Research
            </p>
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Misokinesia Task
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Launch a participant session for the video-clip misokinesia questionnaire.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              size="lg"
              disabled={loading}
              onClick={handleStart}
              className="rounded-xl px-6 font-semibold text-primary-foreground"
              style={{ background: "var(--ubc-blue-700)" }}
            >
              <Video className="mr-2 size-4" />
              {loading ? "Starting…" : "Start Misokinesia Session"}
            </Button>
            {error && (
              <p className="max-w-xs text-right text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Placeholder KPI zone */}
      <div
        className="rounded-2xl border border-border px-8 py-8"
        style={{ background: "var(--card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Statistics
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Participant statistics and KPIs coming soon.
        </p>
      </div>
    </PageContainer>
  );
}
