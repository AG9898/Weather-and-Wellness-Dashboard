"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
import { useRAUser } from "@/lib/contexts/RAUserContext";
import { resolveLabLandingPath } from "@/lib/labs";

/**
 * Shown when an RA user navigates to a page outside their role or lab scope.
 */
export default function UnauthorizedPage() {
  const { role, lab_name } = useRAUser();
  const landingPath = resolveLabLandingPath(role, lab_name);

  return (
    <PageContainer>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <span className="inline-flex size-16 items-center justify-center rounded-full border border-border/70 bg-card/70 text-muted-foreground shadow-sm backdrop-blur-md">
          <ShieldOff className="size-7" />
        </span>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Access Denied
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            You do not have permission to view this page. Contact your lab administrator if
            you believe this is a mistake.
          </p>
        </div>

        <Button asChild variant="outline" className="rounded-full">
          <Link href={landingPath}>Return to Dashboard</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
