"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CompletePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Checkmark icon */}
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "var(--ubc-blue-700)" }}
        >
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Thank You</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have completed all tasks. Please return this device to the
            research assistant.
          </p>
        </div>

        <Button
          asChild
          size="lg"
          className="w-full rounded-xl font-semibold text-white"
          style={{ background: "var(--ubc-blue-700)" }}
        >
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
