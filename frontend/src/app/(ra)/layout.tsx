"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RAFloatingChrome, {
  shouldShowRAFloatingChrome,
} from "@/lib/components/RAFloatingChrome";
import { RAUserContext, type RAUser } from "@/lib/contexts/RAUserContext";

/**
 * Auth guard layout for RA-only pages.
 * Redirects to /login if no Supabase Auth session is present.
 * Wraps authorized content in the shared RA navigation shell.
 * Provides RAUserContext with role and lab_name from app_metadata.
 */
export default function RALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [raUser, setRAUser] = useState<RAUser>({ role: "ra", lab_name: "" });
  const showFloatingChrome = shouldShowRAFloatingChrome(pathname);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) {
        if (error.message.toLowerCase().includes("refresh token")) {
          await supabase.auth.signOut({ scope: "local" });
        }
        router.replace("/login");
        return;
      }
      if (!data.session) {
        router.replace("/login");
      } else {
        const meta = data.session.user.app_metadata ?? {};
        setRAUser({
          role: typeof meta.role === "string" ? meta.role : "ra",
          lab_name: typeof meta.lab_name === "string" ? meta.lab_name : "",
        });
        setAuthorized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setRAUser({ role: "ra", lab_name: "" });
        router.replace("/login");
      } else {
        const meta = session.user.app_metadata ?? {};
        setRAUser({
          role: typeof meta.role === "string" ? meta.role : "ra",
          lab_name: typeof meta.lab_name === "string" ? meta.lab_name : "",
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  return (
    <RAUserContext.Provider value={raUser}>
      <div className="min-h-screen bg-background">
        <main className={showFloatingChrome ? "pb-32 sm:pb-36" : undefined}>{children}</main>
        {showFloatingChrome ? <RAFloatingChrome /> : null}
      </div>
    </RAUserContext.Provider>
  );
}
