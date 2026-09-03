"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LabGuard from "@/lib/components/LabGuard";
import MisokinesiaLaunchPage from "@/lib/components/MisokinesiaLaunchPage";
import {
  startMisokinesiaSession,
  getMisokinesiaTrialManifest,
  type MisokinesiaManifest,
  ApiError,
} from "@/lib/api";
import {
  getMisoDashboard,
  getMisoVideoScores,
  type MisoDashboardResponse,
  type MisoVideoScoresResponse,
} from "@/lib/api/misokinesia";
import {
  DEFAULT_MISO_LOCALE,
  misoMessage,
  readRaMisoLocale,
  storeRaMisoLocale,
  type MisoLocale,
} from "@/lib/i18n";
import {
  buildTrialRunPath,
  createTrialRunMisokinesiaManifest,
  createTrialRunState,
  type MisokinesiaTrialMode,
  persistTrialRunState,
} from "@/lib/trial-mode";

const MISOKINESIA_MANIFEST_KEY = "misokinesia_manifest";
const SHORT_TRIAL_CLIP_COUNT = 5;

// Misokinesia is a Weather-Wellness instrument; guard against out-of-lab access.
export default function MisokinesiaPage() {
  return (
    <LabGuard lab="ww">
      <MisokinesiaPageContent />
    </LabGuard>
  );
}

function MisokinesiaPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [shortTrialLoading, setShortTrialLoading] = useState(false);
  const [fullTrialLoading, setFullTrialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<MisoDashboardResponse | null>(null);
  const [videoScores, setVideoScores] = useState<MisoVideoScoresResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  // Seeded from the default so the first client render matches the server
  // render; the RA's remembered choice is adopted in the effect below.
  const [locale, setLocale] = useState<MisoLocale>(DEFAULT_MISO_LOCALE);
  // The dashboard load runs once on mount; the ref lets its error message pick
  // up the current locale without making the fetch re-run on every toggle.
  const localeRef = useRef(locale);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    setLocale(readRaMisoLocale());
  }, []);

  function handleLocaleChange(next: MisoLocale) {
    setLocale(next);
    storeRaMisoLocale(next);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const [dashboardResult, videoScoresResult] = await Promise.all([
          getMisoDashboard(),
          getMisoVideoScores(),
        ]);
        if (cancelled) {
          return;
        }
        setDashboard(dashboardResult);
        setVideoScores(videoScoresResult);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setDashboardError(
          err instanceof ApiError
            ? misoMessage("ra.launch.error.dashboard_status", localeRef.current, {
                status: err.status,
                message: err.message,
              })
            : misoMessage("ra.launch.error.dashboard", localeRef.current)
        );
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const manifest: MisokinesiaManifest = await startMisokinesiaSession(locale);
      sessionStorage.setItem(MISOKINESIA_MANIFEST_KEY, JSON.stringify(manifest));
      router.push(`/misokinesia/${manifest.misokinesia_participant_id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? misoMessage("ra.launch.error.start_status", locale, {
              status: err.status,
              message: err.message,
            })
          : misoMessage("ra.launch.error.start", locale)
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
      if (mode === "full" && trialManifest.clips.length <= SHORT_TRIAL_CLIP_COUNT) {
        throw new Error(
          `Full trial manifest returned only ${trialManifest.clips.length} clips. Expected the full active stimulus set.`
        );
      }
      const manifest = createTrialRunMisokinesiaManifest(
        trialState,
        trialManifest.clips,
        mode,
        locale
      );
      persistTrialRunState(trialState);
      sessionStorage.setItem(MISOKINESIA_MANIFEST_KEY, JSON.stringify(manifest));
      router.push(
        buildTrialRunPath(`/misokinesia/${trialState.misokinesia_participant_id}`)
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? misoMessage("ra.launch.error.trial_status", locale, {
              status: err.status,
              message: err.message,
            })
          : err instanceof Error
            ? err.message
            : misoMessage("ra.launch.error.trial", locale)
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
      locale={locale}
      onLocaleChange={handleLocaleChange}
      loading={loading}
      shortTrialLoading={shortTrialLoading}
      fullTrialLoading={fullTrialLoading}
      error={error}
      dashboard={dashboard}
      videoScores={videoScores}
      dashboardLoading={dashboardLoading}
      dashboardError={dashboardError}
      onStart={handleStart}
      onStartShortTrial={handleStartShortTrial}
      onStartFullTrial={handleStartFullTrial}
    />
  );
}
