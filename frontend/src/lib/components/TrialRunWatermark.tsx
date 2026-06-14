"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  adoptTrialRunStateFromLocation,
  getTrialRunWatermarkLabel,
  isTrialRunActiveForLocation,
} from "@/lib/trial-mode";

export default function TrialRunWatermark() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const location = {
      pathname,
      search: window.location.search,
    };
    adoptTrialRunStateFromLocation(location);
    setActive(isTrialRunActiveForLocation(location));
  }, [pathname]);

  const label = getTrialRunWatermarkLabel(active);

  if (!label) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-2 z-50 max-w-[calc(100vw-1rem)] -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-bold uppercase leading-none text-foreground shadow-sm sm:top-3 sm:px-3 sm:text-xs"
    >
      {label}
    </div>
  );
}
