"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function LoginDialogForm() {
  const router = useRouter();
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

    router.replace("/dashboard");
  };

  return (
    <div className="space-y-6 p-7 text-white sm:p-8">
      <DialogHeader className="space-y-2 text-left">
        <p className="text-xs font-semibold tracking-[0.32em] text-[#9efaf2]/82 uppercase">
          W&amp;W Research
        </p>
        <DialogTitle className="text-2xl font-bold tracking-tight text-white">RA Login</DialogTitle>
        <DialogDescription className="max-w-sm text-sm leading-6 text-[#d8e6ff]/72">
          Authorized UBC Psychology lab members can sign in here to access study dashboards and admin tools.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-[#d8e6ff]/88">
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
            className="h-11 rounded-xl border-white/14 bg-white/9 text-white placeholder:text-white/36 focus-visible:ring-[#5ce5fc]/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-[#d8e6ff]/88">
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
            className="h-11 rounded-xl border-white/14 bg-white/9 text-white placeholder:text-white/36 focus-visible:ring-[#5ce5fc]/50"
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
          className="h-11 w-full rounded-xl border border-white/10 bg-[linear-gradient(135deg,#0052f5,#00a2fa)] text-white shadow-[0_12px_30px_rgba(0,82,245,0.28)] hover:brightness-110"
        >
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>
    </div>
  );
}
