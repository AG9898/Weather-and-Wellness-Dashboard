"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RANavBar from "@/lib/components/RANavBar";

/**
 * Auth guard layout for RA-only pages.
 * Redirects to /login if no Supabase Auth session is present.
 * Wraps authorized content in the shared RA navigation shell.
 */
export default function RALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

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
        setAuthorized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
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
    <div className="min-h-screen bg-background">
      <RANavBar />
      <main>{children}</main>
    </div>
  );
}
