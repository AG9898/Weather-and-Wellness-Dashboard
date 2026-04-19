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
      className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-md border border-amber-300 bg-amber-100/95 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-950 shadow-sm"
    >
      {label}
    </div>
  );
}
