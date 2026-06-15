"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  WEATHER_WELLNESS_SECTIONS,
  WEATHER_WELLNESS_SECTION_LABELS,
  adoptTrialRunStateFromLocation,
  isTrialRunActiveForLocation,
  readTrialRunState,
  weatherWellnessSectionFromPath,
  weatherWellnessSectionPath,
  type WeatherWellnessSection,
} from "@/lib/trial-mode";
import { cn } from "@/lib/utils";

/**
 * WW trial-only section jumper. Renders only when the current participant page
 * is an active Weather Wellness trial run, and never in recorded sessions.
 *
 * Jumping performs client-side navigation only via `weatherWellnessSectionPath`,
 * which is pure and makes no survey/task/session writes. Pre-session sections
 * (Consent, Demographics) route back to the RA launch surface; all in-session
 * targets carry the `?trial=1` signal. Positioned at the bottom of the viewport
 * so it stays clear of the top-centered Trial Run watermark and the page's task
 * prompts, inputs, feedback, and primary buttons.
 */
export default function WeatherWellnessTrialSectionJumper() {
  const pathname = usePathname();
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] =
    useState<WeatherWellnessSection | null>(null);

  useEffect(() => {
    const location = { pathname, search: window.location.search };
    adoptTrialRunStateFromLocation(location);
    const isActive = isTrialRunActiveForLocation(location);
    setActive(isActive);
    setSessionId(readTrialRunState()?.session_id ?? null);
    setActiveSection(weatherWellnessSectionFromPath(pathname));
  }, [pathname]);

  if (!active || !sessionId) {
    return null;
  }

  const handleJump = (section: WeatherWellnessSection) => {
    router.push(weatherWellnessSectionPath(section, sessionId));
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-40 flex justify-center px-2 sm:bottom-3">
      <div
        className="pointer-events-auto inline-grid w-full max-w-[40rem] grid-flow-col auto-cols-fr gap-1 rounded-md border border-border bg-card/95 p-1 shadow-sm backdrop-blur"
        role="group"
        aria-label="Trial section jumps"
      >
        {WEATHER_WELLNESS_SECTIONS.map((section) => {
          const isActive = section === activeSection;
          return (
            <button
              key={section}
              type="button"
              className={cn(
                "min-w-0 rounded px-1.5 py-1.5 text-center text-[10px] font-semibold leading-none text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[11px]",
                isActive &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
              )}
              aria-pressed={isActive}
              onClick={() => handleJump(section)}
            >
              <span className="block truncate">
                {WEATHER_WELLNESS_SECTION_LABELS[section]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
