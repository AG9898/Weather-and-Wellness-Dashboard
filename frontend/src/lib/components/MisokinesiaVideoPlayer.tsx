"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface MisokinesiaVideoPlayerProps {
  publicUrl: string;
  onEnded: () => void;
}

export default function MisokinesiaVideoPlayer({
  publicUrl,
  onEnded,
}: MisokinesiaVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return (
    <div className="w-full">
      <div
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
      </div>
    </div>
  );
}
