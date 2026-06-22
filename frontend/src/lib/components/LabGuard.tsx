"use client";

import { useLabGuard, type LabSlug } from "@/lib/labs";

/**
 * Wraps a lab-scoped page so its content only mounts for callers who belong to
 * the lab (admins always pass). Unauthorized callers are redirected to
 * /unauthorized and see a loading fallback in the meantime. Because children are
 * not rendered until authorized, their data-loading effects never run for
 * out-of-lab users.
 */
export default function LabGuard({
  lab,
  children,
}: {
  lab: LabSlug;
  children: React.ReactNode;
}) {
  const authorized = useLabGuard(lab);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}
