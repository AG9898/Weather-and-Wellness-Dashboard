"use client";

import { MoonStar, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/components/ThemeProvider";

interface ThemeToggleProps {
  variant?: "button" | "menu";
  className?: string;
}

export default function ThemeToggle({
  variant = "button",
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, cyclePreference } = useTheme();

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? MoonStar : Sun;
  const label = isDark ? "Dark" : "Light";
  const nextLabel = isDark ? "light" : "dark";

  if (variant === "menu") {
    return (
      <Button
        type="button"
        variant="ghost"
        className={cn(
          "h-11 w-full justify-between rounded-2xl px-3 text-sm hover:bg-accent/70",
          className
        )}
        onClick={cyclePreference}
        title={`Theme: ${label}. Click to switch to ${nextLabel}.`}
        aria-label={`Theme ${label}. Toggle to ${nextLabel}.`}
      >
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4" />
          Theme
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 rounded-full px-2 text-xs", className)}
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
