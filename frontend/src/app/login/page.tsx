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
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4"
      style={{
        background: "linear-gradient(135deg, #001328 0%, #001f5e 50%, #002d80 100%)",
      }}
    >
      {/* Blob 1 — upper right */}
      <svg
        className="login-blob absolute pointer-events-none"
        style={{
          top: "4%",
          right: "7%",
          width: 300,
          height: 280,
          opacity: 0.22,
          filter: "blur(3px)",
          animation: "blob-drift-1 22s ease-in-out infinite alternate",
        }}
        viewBox="0 0 300 280"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0052f5" />
            <stop offset="60%" stopColor="#00a2fa" />
            <stop offset="100%" stopColor="#33e0fc" />
          </linearGradient>
        </defs>
        <path
          d="M155,15 C225,0 292,55 286,140 C280,218 212,278 135,270 C58,262 8,198 14,118 C20,38 85,30 155,15Z"
          fill="url(#lg1)"
        />
      </svg>

      {/* Blob 2 — lower left */}
      <svg
        className="login-blob absolute pointer-events-none"
        style={{
          bottom: "7%",
          left: "4%",
          width: 370,
          height: 330,
          opacity: 0.17,
          filter: "blur(5px)",
          animation: "blob-drift-2 19s ease-in-out infinite alternate",
        }}
        viewBox="0 0 370 330"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0052f5" />
            <stop offset="55%" stopColor="#33e0fc" />
            <stop offset="100%" stopColor="#5ce5fc" />
          </linearGradient>
        </defs>
        <path
          d="M185,22 C268,5 352,78 346,178 C340,262 268,322 168,314 C68,306 10,238 16,146 C22,54 102,39 185,22Z"
          fill="url(#lg2)"
        />
      </svg>

      {/* Blob 3 — middle left */}
      <svg
        className="login-blob absolute pointer-events-none"
        style={{
          top: "38%",
          left: "6%",
          width: 245,
          height: 265,
          opacity: 0.28,
          filter: "blur(2px)",
          animation: "blob-drift-3 24s ease-in-out infinite alternate",
        }}
        viewBox="0 0 245 265"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg3" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00a2fa" />
            <stop offset="100%" stopColor="#5ce5fc" />
          </linearGradient>
        </defs>
        <path
          d="M122,18 C182,5 240,60 235,134 C230,206 175,260 104,252 C33,244 3,186 12,112 C21,38 62,31 122,18Z"
          fill="url(#lg3)"
        />
      </svg>

      {/* Blob 4 — upper center-left */}
      <svg
        className="login-blob absolute pointer-events-none"
        style={{
          top: "7%",
          left: "28%",
          width: 205,
          height: 190,
          opacity: 0.20,
          filter: "blur(3px)",
          animation: "blob-drift-4 20s ease-in-out infinite alternate",
        }}
        viewBox="0 0 205 190"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0052f5" />
            <stop offset="100%" stopColor="#00a2fa" />
          </linearGradient>
        </defs>
        <path
          d="M102,13 C155,1 202,45 196,104 C190,161 146,188 88,181 C30,174 2,132 8,76 C14,20 49,25 102,13Z"
          fill="url(#lg4)"
        />
      </svg>

      {/* Blob 5 — lower right */}
      <svg
        className="login-blob absolute pointer-events-none"
        style={{
          bottom: "10%",
          right: "5%",
          width: 285,
          height: 255,
          opacity: 0.25,
          filter: "blur(3px)",
          animation: "blob-drift-5 26s ease-in-out infinite alternate",
        }}
        viewBox="0 0 285 255"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="lg5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00a2fa" />
            <stop offset="100%" stopColor="#5ce5fc" />
          </linearGradient>
        </defs>
        <path
          d="M142,18 C212,5 280,64 274,142 C268,218 204,252 126,245 C48,238 7,176 14,100 C21,24 72,31 142,18Z"
          fill="url(#lg5)"
        />
      </svg>

      {/* Glassmorphism card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{
          background: "rgba(0, 28, 76, 0.38)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(255, 255, 255, 0.13)",
        }}
      >
        {/* Header */}
        <div className="space-y-1 text-center">
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: "rgba(147, 210, 252, 0.85)" }}
          >
            W&amp;W Research
          </p>
          <h1 className="text-2xl font-bold text-white">RA Login</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="block text-sm font-medium"
              style={{ color: "rgba(200, 228, 255, 0.85)" }}
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
              className="rounded-lg bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-blue-400/50"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: "rgba(200, 228, 255, 0.85)" }}
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
              className="rounded-lg bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-blue-400/50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "#fca5a5" }}>
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #0052f5, #00a2fa)",
            }}
          >
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
