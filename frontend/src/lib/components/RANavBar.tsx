"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, Home, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/lib/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/import-export", label: "Import / Export", icon: ArrowUpDown },
];

/**
 * Sticky top navigation bar for RA-facing pages.
 * Shows app name, navigation links, theme control, and a sign-out action.
 */
export default function RANavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/70 px-2.5 py-1.5 text-sm font-semibold tracking-wide text-foreground transition-colors hover:border-ring/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="W and W Research dashboard"
        >
          <span className="relative h-7 w-7 overflow-hidden rounded-full border border-border/70 bg-foreground/5">
            <Image
              src="/ww-mark.png"
              alt=""
              fill
              sizes="28px"
              className="object-cover"
            />
          </span>
          <span className="sr-only">W&amp;W Research</span>
          <span className="hidden sm:inline">W&amp;W Research</span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-border/80 bg-card/65 p-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:px-3 sm:text-sm",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent/75 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2.5 text-xs text-muted-foreground sm:px-3"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
