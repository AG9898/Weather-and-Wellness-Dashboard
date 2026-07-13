"use client";

import { usePathname } from "next/navigation";
import {
  shouldGuardWeatherWellnessPath,
  useTaskExitGuard,
} from "@/lib/useTaskExitGuard";

/**
 * Layout-level refresh/leave guard for the Weather-Wellness participant session
 * shell. Rendered once inside `/session/[id]/layout.tsx` so every in-progress
 * task page (surveys + cognitive tasks) installs the guard, while the idle
 * session index, the completion page, and trial-run sessions do not.
 *
 * Client-side task-to-task transitions use `router.push` and never trigger
 * `beforeunload`, so this only intercepts hard refresh / tab close / external
 * navigation.
 */
export default function SessionExitGuard() {
  const pathname = usePathname();
  useTaskExitGuard(shouldGuardWeatherWellnessPath(pathname));
  return null;
}
