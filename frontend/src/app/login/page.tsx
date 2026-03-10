"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import LoginBackgroundPaths from "@/lib/components/LoginBackgroundPaths";
import LoginDialogForm from "@/lib/components/LoginDialogForm";

const TITLE_WORDS = ["UBC", "PSYCHOLOGY"];

export default function LoginPage() {
  const [open, setOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const titleLetters = useMemo(
    () =>
      TITLE_WORDS.map((word) =>
        word.split("").map((letter, index) => ({
          id: `${word}-${index}`,
          letter,
        }))
      ),
    []
  );

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const heroEl = heroRef.current;
    if (!heroEl) return;

    const eyebrow = heroEl.querySelector<HTMLElement>("[data-hero-eyebrow]");
    const letters = Array.from(heroEl.querySelectorAll<HTMLElement>("[data-title-letter]"));
    const copy = heroEl.querySelector<HTMLElement>("[data-hero-copy]");
    const cta = heroEl.querySelector<HTMLElement>("[data-hero-cta]");

    const animations: Array<{ pause: () => void }> = [];

    if (eyebrow) {
      animations.push(
        animate(eyebrow, {
          opacity: [0, 1],
          translateY: [18, 0],
          duration: 700,
          ease: "out(2)",
        })
      );
    }

    if (letters.length) {
      animations.push(
        animate(letters, {
          opacity: [0, 1],
          translateY: [110, 0],
          rotateX: [55, 0],
          duration: 1100,
          delay: stagger(34, { start: 220 }),
          ease: "out(3)",
        })
      );
    }

    if (copy) {
      animations.push(
        animate(copy, {
          opacity: [0, 1],
          translateY: [20, 0],
          duration: 800,
          delay: 820,
          ease: "out(2)",
        })
      );
    }

    if (cta) {
      animations.push(
        animate(cta, {
          opacity: [0, 1],
          translateY: [18, 0],
          scale: [0.96, 1],
          duration: 850,
          delay: 980,
          ease: "out(2)",
        })
      );
    }

    return () => {
      animations.forEach((animation) => animation.pause());
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#001328_0%,#001a41_34%,#002455_68%,#001328_100%)] text-white">
      <LoginBackgroundPaths />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(92,229,252,0.14),transparent_24%),radial-gradient(circle_at_50%_72%,rgba(0,82,245,0.20),transparent_34%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div ref={heroRef} className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <p
            data-hero-eyebrow
            className="mb-6 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] font-semibold tracking-[0.34em] text-[#9efaf2]/88 uppercase backdrop-blur-md"
          >
            Weather &amp; Wellness Research Portal
          </p>

          <h1 className="max-w-5xl text-5xl font-bold tracking-[-0.08em] sm:text-7xl md:text-8xl lg:text-[8.6rem]">
            {titleLetters.map((word, wordIndex) => (
              <span
                key={TITLE_WORDS[wordIndex]}
                className="mr-3 inline-block sm:mr-5 md:mr-6"
              >
                {word.map(({ id, letter }) => (
                  <span
                    key={id}
                    data-title-letter
                    className="inline-block bg-gradient-to-b from-white via-[#dff6ff] to-[#79dbff] bg-clip-text pr-[0.02em] text-transparent [text-shadow:0_0_28px_rgba(92,229,252,0.16)]"
                  >
                    {letter}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p
            data-hero-copy
            className="mt-8 max-w-2xl text-sm leading-7 text-[#d3e2ff]/76 sm:text-base"
          >
            Lab member access for the Weather &amp; Wellness dashboard, participant sessions, and protected admin workflows.
          </p>

          <div
            data-hero-cta
            className="mt-10 inline-block rounded-[1.4rem] border border-white/12 bg-gradient-to-b from-white/14 to-white/4 p-[1px] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          >
            <Button
              type="button"
              onClick={() => setOpen(true)}
              className="h-14 rounded-[1.3rem] border border-white/10 bg-[#061a38]/88 px-8 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform duration-300 hover:-translate-y-0.5 hover:bg-[#0a2245]"
            >
              <span className="opacity-94">Lab Member Login</span>
              <span className="ml-3 text-[#79dbff]">{"->"}</span>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[calc(100%-2rem)] border-white/12 bg-[linear-gradient(180deg,rgba(6,26,56,0.94),rgba(2,12,32,0.88))] p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:max-w-md"
        >
          <LoginDialogForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
