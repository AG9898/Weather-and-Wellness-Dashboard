"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Home, MessageSquare, Users, Video } from "lucide-react";
import { useRAUser } from "@/lib/contexts/RAUserContext";

/**
 * Lab-scoped navigation registry.
 *
 * Each lab owns its own dock item set. "Dashboard" is a per-lab landing route,
 * not one shared page: Weather-Wellness lands on the weather dashboard, while
 * IHTT lands on the Poffenberger page (its de-facto dashboard for now).
 *
 * Auth is single-lab today (`app_metadata.lab` / `lab_name` is one slug). Only
 * admins span labs, so the lab switcher is admin-only. When real per-RA
 * multi-lab membership lands, widen {@link resolveAvailableLabs} — the rest of
 * the dock derives from it.
 */

export type LabSlug = "ww" | "ihtt";

export interface LabDockItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface LabConfig {
  slug: LabSlug;
  /** Human-readable name shown in the lab switcher. */
  label: string;
  /** Lab-scoped dock items, in display order. */
  items: LabDockItem[];
}

export const LAB_REGISTRY: Record<LabSlug, LabConfig> = {
  ww: {
    slug: "ww",
    label: "Weather-Wellness",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/chat", label: "Chat", icon: MessageSquare },
      { href: "/misokinesia", label: "Misokinesia", icon: Video },
    ],
  },
  ihtt: {
    slug: "ihtt",
    label: "IHTT",
    items: [
      { href: "/ihtt/poffenberger", label: "Dashboard", icon: Home },
      { href: "/import-export", label: "Export", icon: ArrowUpDown },
    ],
  },
};

/** Admin-only items appended to every lab's dock. */
export const ADMIN_DOCK_ITEMS: LabDockItem[] = [
  { href: "/users", label: "Users", icon: Users },
];

export const LAB_SLUGS = Object.keys(LAB_REGISTRY) as LabSlug[];
export const DEFAULT_LAB_SLUG: LabSlug = "ww";
export const ACTIVE_LAB_STORAGE_KEY = "ra_active_lab";

export function isLabSlug(value: string | null | undefined): value is LabSlug {
  return value === "ww" || value === "ihtt";
}

/** Map a raw `app_metadata.lab_name` to a known slug, or null if unrecognized. */
export function normalizeLabSlug(labName: string | null | undefined): LabSlug | null {
  if (!labName) return null;
  const value = labName.trim().toLowerCase();
  return isLabSlug(value) ? value : null;
}

/**
 * Labs the caller may operate. Admins span every lab; a regular RA is scoped to
 * their single `lab_name` (falling back to the default when unrecognized).
 */
export function resolveAvailableLabs(
  role: string,
  labName: string | null | undefined
): LabSlug[] {
  if (role === "admin") return LAB_SLUGS;
  return [normalizeLabSlug(labName) ?? DEFAULT_LAB_SLUG];
}

/**
 * Initial active lab. Admins restore a previously chosen lab from storage;
 * everyone otherwise starts on their own lab.
 */
export function resolveInitialActiveLab(
  role: string,
  labName: string | null | undefined,
  stored: string | null
): LabSlug {
  const available = resolveAvailableLabs(role, labName);
  if (role === "admin" && isLabSlug(stored) && available.includes(stored)) {
    return stored;
  }
  return normalizeLabSlug(labName) ?? available[0] ?? DEFAULT_LAB_SLUG;
}

/**
 * Whether the caller may operate a given lab's pages. Admins span every lab; a
 * regular RA may only access the lab matching their `lab_name`.
 */
export function canAccessLab(
  role: string,
  labName: string | null | undefined,
  lab: LabSlug
): boolean {
  return role === "admin" || normalizeLabSlug(labName) === lab;
}

/** First page an authenticated user should see when no explicit `next` route exists. */
export function resolveLabLandingPath(
  role: string,
  labName: string | null | undefined,
  stored: string | null = null
): string {
  const lab = resolveInitialActiveLab(role, labName, stored);
  return LAB_REGISTRY[lab].items[0]?.href ?? "/dashboard";
}

/** Dock items for a lab: its own items, plus admin items for admins. */
export function buildDockItems(lab: LabSlug, role: string): LabDockItem[] {
  const items = [...LAB_REGISTRY[lab].items];
  if (role === "admin") items.push(...ADMIN_DOCK_ITEMS);
  return items;
}

export interface UseActiveLab {
  activeLab: LabSlug;
  setActiveLab: (lab: LabSlug) => void;
  /** True when the caller may switch labs (admins today). */
  canSwitch: boolean;
  availableLabs: LabSlug[];
}

/**
 * Resolve and persist the caller's active lab. Non-admins are pinned to their
 * single lab; admins may switch, with the choice persisted across navigation.
 */
export function useActiveLab(): UseActiveLab {
  const { role, lab_name } = useRAUser();
  const canSwitch = role === "admin";
  const availableLabs = useMemo(
    () => resolveAvailableLabs(role, lab_name),
    [role, lab_name]
  );
  const [activeLab, setActiveLabState] = useState<LabSlug>(() =>
    resolveInitialActiveLab(role, lab_name, null)
  );

  // Hydrate from storage after mount (admins only); also re-resolve when the
  // authenticated user's role/lab becomes available.
  useEffect(() => {
    const stored = canSwitch
      ? window.localStorage.getItem(ACTIVE_LAB_STORAGE_KEY)
      : null;
    setActiveLabState(resolveInitialActiveLab(role, lab_name, stored));
  }, [role, lab_name, canSwitch]);

  const setActiveLab = useCallback(
    (lab: LabSlug) => {
      if (!canSwitch || !availableLabs.includes(lab)) return;
      setActiveLabState(lab);
      window.localStorage.setItem(ACTIVE_LAB_STORAGE_KEY, lab);
    },
    [canSwitch, availableLabs]
  );

  return { activeLab, setActiveLab, canSwitch, availableLabs };
}

/**
 * Guard a lab-scoped page. Redirects to /unauthorized when the caller's lab does
 * not match (admins always pass) and returns whether access is allowed so the
 * page can render a fallback while redirecting.
 */
export function useLabGuard(lab: LabSlug): boolean {
  const { role, lab_name } = useRAUser();
  const router = useRouter();
  const authorized = canAccessLab(role, lab_name, lab);

  useEffect(() => {
    if (!authorized) router.replace("/unauthorized");
  }, [authorized, router]);

  return authorized;
}
