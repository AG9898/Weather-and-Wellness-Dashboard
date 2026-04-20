"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface MisokinesiaVideoPlayerProps {
  publicUrl: string;
  onEnded: () => void;
}

type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getActiveFullscreenElement() {
  const webkitDocument = document as WebkitFullscreenDocument;
  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

function supportsFullscreen(element: HTMLElement | null) {
  if (!element) return false;
  return Boolean(
    element.requestFullscreen ||
      (element as WebkitFullscreenElement).webkitRequestFullscreen
  );
}

async function requestFullscreen(element: HTMLElement) {
  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }

  const webkitElement = element as WebkitFullscreenElement;
  if (webkitElement.webkitRequestFullscreen) {
    await webkitElement.webkitRequestFullscreen();
  }
}

async function exitFullscreen() {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }

  const webkitDocument = document as WebkitFullscreenDocument;
  if (webkitDocument.webkitExitFullscreen) {
    await webkitDocument.webkitExitFullscreen();
  }
}

export default function MisokinesiaVideoPlayer({
  publicUrl,
  onEnded,
}: MisokinesiaVideoPlayerProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setAutoplayBlocked(false);
    setLoadError(null);
    video.currentTime = 0;
    video.load();

    const playPromise = video.play();
    if (!playPromise) return;

    playPromise
      .then(() => {
        setAutoplayBlocked(false);
      })
      .catch(() => {
        setAutoplayBlocked(true);
      });
  }, [publicUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    setFullscreenSupported(supportsFullscreen(frame));

    const syncFullscreenState = () => {
      setIsFullscreen(getActiveFullscreenElement() === frame);
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setAutoplayBlocked(false);
    } catch {
      setAutoplayBlocked(true);
    }
  };

  const handleToggleFullscreen = async () => {
    const frame = frameRef.current;
    if (!frame || !fullscreenSupported) return;

    try {
      if (getActiveFullscreenElement() === frame) {
        await exitFullscreen();
      } else {
        await requestFullscreen(frame);
      }
    } catch {
      // Keep playback available when fullscreen fails in this browser.
    }
  };

  const fullscreenLabel = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";

  return (
    <div className="w-full">
      <div
        ref={frameRef}
        className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--ring) 72%, transparent), transparent)",
          }}
        />

        <video
          ref={videoRef}
          key={publicUrl}
          className="relative h-full w-full bg-black object-contain"
          playsInline
          preload="auto"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate noremoteplayback"
          onEnded={onEnded}
          onError={() => setLoadError("This clip could not be loaded. Please ask the research assistant to restart the session.")}
        >
          <source src={publicUrl} type="video/mp4" />
          Your browser does not support embedded video playback.
        </video>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent px-4 pb-4 pt-10 text-center">
          {loadError ? (
            <p className="mx-auto max-w-xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {loadError}
            </p>
          ) : autoplayBlocked ? (
            <Button
              type="button"
              onClick={handlePlay}
              className="rounded-xl px-8 py-2.5 text-sm font-semibold"
            >
              Play Clip
            </Button>
          ) : (
            <p className="text-xs font-medium text-muted-foreground">
              The questionnaire will appear automatically when the clip ends.
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={handleToggleFullscreen}
          disabled={!fullscreenSupported}
          className="absolute bottom-4 right-4 z-20 rounded-lg border border-border/70 bg-background/85 backdrop-blur-sm"
          aria-label={fullscreenLabel}
          title={
            fullscreenSupported
              ? fullscreenLabel
              : "Fullscreen is unavailable in this browser"
          }
        >
          {isFullscreen ? (
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
}
