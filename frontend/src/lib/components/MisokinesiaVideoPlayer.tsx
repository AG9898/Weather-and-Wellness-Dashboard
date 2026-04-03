"use client";

import { Button } from "@/components/ui/button";

interface MisokinesiaVideoPlayerProps {
  stimulusIndex: number;
  totalStimuli: number;
  publicUrl: string;
  onEnded: () => void;
}

export default function MisokinesiaVideoPlayer({
  stimulusIndex,
  totalStimuli,
  onEnded,
}: MisokinesiaVideoPlayerProps) {
  return (
    <div className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--ring) 72%, transparent), transparent)",
          }}
        />

        <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6">
          <p
            className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground"
            aria-label="Video placeholder"
          >
            Video placeholder
          </p>
          <p className="text-center text-3xl font-bold text-primary">
            Clip {stimulusIndex} of {totalStimuli}
          </p>
          <Button
            type="button"
            onClick={onEnded}
            className="mt-2 rounded-xl px-8 py-2.5 text-sm font-semibold"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
