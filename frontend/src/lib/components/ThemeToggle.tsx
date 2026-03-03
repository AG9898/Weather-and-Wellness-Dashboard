"use client";

import { MoonStar, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/components/ThemeProvider";

export default function ThemeToggle() {
  const { resolvedTheme, cyclePreference } = useTheme();

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? MoonStar : Sun;
  const label = isDark ? "Dark" : "Light";
  const nextLabel = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 rounded-full px-2 text-xs"
      onClick={cyclePreference}
      title={`Theme: ${label}. Click to switch to ${nextLabel}.`}
      aria-label={`Theme ${label}. Toggle to ${nextLabel}.`}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">
        {label}
      </span>
    </Button>
  );
}
