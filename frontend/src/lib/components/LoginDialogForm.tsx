"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function LoginDialogForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const recoverStaleSession = async () => {
      const { error: sessionError } = await supabase.auth.getSession();
      if (!mounted || !sessionError) return;
      if (sessionError.message.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut({ scope: "local" });
      }
    };

    recoverStaleSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") ?? "/dashboard";
    router.replace(next);
  };

  return (
    <div className="space-y-6 p-7 text-white sm:p-8">
      <DialogHeader className="space-y-2 text-left">
        <p className="text-xs font-semibold tracking-[0.32em] text-white/64 uppercase">
          W&amp;W Research
        </p>
        <DialogTitle className="text-2xl font-bold tracking-tight text-white">RA Login</DialogTitle>
        <DialogDescription className="max-w-sm text-sm leading-6 text-white/72">
          Authorized UBC Psychology lab members can sign in here to access study dashboards and admin tools.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-white/86">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-11 rounded-xl border-white/12 bg-white/8 text-white placeholder:text-white/36 focus-visible:ring-white/18"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-white/86">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="........"
            className="h-11 rounded-xl border-white/12 bg-white/8 text-white placeholder:text-white/36 focus-visible:ring-white/18"
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-red-300/18 bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl border border-white/8 bg-white text-[#12161c] shadow-[0_12px_30px_rgba(0,0,0,0.22)] hover:bg-white/92"
        >
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </div>
  );
}
