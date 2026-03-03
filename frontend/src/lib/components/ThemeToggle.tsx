"use client";

import { LaptopMinimal, MoonStar, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/components/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

const LABEL_BY_THEME: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export default function ThemeToggle() {
  const { preference, resolvedTheme, cyclePreference } = useTheme();

  const Icon = preference === "system" ? LaptopMinimal : preference === "light" ? Sun : MoonStar;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 rounded-md px-2 text-xs"
      onClick={cyclePreference}
      title={`Theme: ${LABEL_BY_THEME[preference]} (resolved ${resolvedTheme}). Click to cycle system/light/dark.`}
      aria-label={`Theme ${LABEL_BY_THEME[preference]}. Click to cycle system, light, and dark.`}
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">
        {LABEL_BY_THEME[preference]}
      </span>
    </Button>
  );
}
