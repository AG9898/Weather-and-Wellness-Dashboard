"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EditorialTaskHeader,
  EditorialTaskPanel,
  EditorialTaskShell,
} from "@/lib/components/EditorialPrimitives";

export default function CompletePage() {
  return (
    <EditorialTaskShell centered>
      <EditorialTaskPanel className="space-y-7 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary">
          <CheckCircle2 className="h-8 w-8 text-primary-foreground" aria-hidden="true" />
        </div>

        <EditorialTaskHeader
          stepTag="Complete"
          breadcrumb="Weather Wellness"
          kicker="Session complete"
          title="Thank You"
          description="You have completed all tasks. Please return this device to the research assistant."
          className="items-center text-center"
        />

        <Button
          asChild
          size="lg"
          className="w-full rounded-xl font-semibold text-primary-foreground"
        >
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </EditorialTaskPanel>
    </EditorialTaskShell>
  );
}
