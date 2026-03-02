"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/import-export", label: "Import / Export" },
];

/**
 * Sticky top navigation bar for RA-facing pages.
 * Shows app name, navigation links, and a sign-out action.
 */
export default function RANavBar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <header
      className="sticky top-0 z-50 border-b border-border"
      style={{ background: "var(--card)" }}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-wide text-foreground/90 hover:text-foreground transition-colors"
        >
          W&amp;W Research
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-foreground/70 hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="rounded-md px-3 py-1.5 text-sm text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
