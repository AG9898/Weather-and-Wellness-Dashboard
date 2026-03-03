"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div
        className="w-full max-w-sm rounded-2xl border border-border p-8 space-y-6"
        style={{ background: "var(--card)" }}
      >
        {/* Header */}
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            W&amp;W Research
          </p>
          <h1 className="text-2xl font-bold text-foreground">RA Login</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="block text-sm font-medium text-muted-foreground"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border-border bg-input/30"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="block text-sm font-medium text-muted-foreground"
            >
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border-border bg-input/30"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl text-primary-foreground"
            style={{
              background: "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
            }}
          >
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
