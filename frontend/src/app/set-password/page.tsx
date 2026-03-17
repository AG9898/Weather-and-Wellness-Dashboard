"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoginBackgroundPaths from "@/lib/components/LoginBackgroundPaths";
import { supabase } from "@/lib/supabase";

type PageState = "loading" | "ready" | "success" | "invalid";

export default function SetPasswordPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase JS v2 automatically picks up the access_token from the URL hash
    // when getSession() is called. We just need to confirm a session is present.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPageState("ready");
      } else {
        setPageState("invalid");
      }
    });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setPageState("success");
    setTimeout(() => router.replace("/dashboard"), 1500);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#001328_0%,#001a41_34%,#002455_68%,#001328_100%)] text-white">
      <LoginBackgroundPaths />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(92,229,252,0.14),transparent_24%),radial-gradient(circle_at_50%_72%,rgba(0,82,245,0.20),transparent_34%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="rounded-[1.6rem] border border-white/12 bg-gradient-to-b from-white/10 to-white/4 p-[1px] shadow-[0_30px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
            <div className="rounded-[1.55rem] bg-[linear-gradient(180deg,rgba(6,26,56,0.94),rgba(2,12,32,0.88))] p-7 sm:p-8">

              <p className="mb-1 text-xs font-semibold tracking-[0.32em] text-[#9efaf2]/82 uppercase">
                W&amp;W Research
              </p>

              {pageState === "loading" && (
                <p className="mt-4 text-sm text-[#d8e6ff]/72">Verifying invite…</p>
              )}

              {pageState === "invalid" && (
                <>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    Link expired
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-[#d8e6ff]/72">
                    This invite link is invalid or has already been used. Ask your lab
                    administrator to send a new invite.
                  </p>
                </>
              )}

              {pageState === "ready" && (
                <>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    Set your password
                  </h1>
                  <p className="mt-1 mb-6 text-sm leading-6 text-[#d8e6ff]/72">
                    Choose a password to activate your account.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-sm font-medium text-[#d8e6ff]/88">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="h-11 rounded-xl border-white/14 bg-white/9 text-white placeholder:text-white/36 focus-visible:ring-[#5ce5fc]/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm" className="text-sm font-medium text-[#d8e6ff]/88">
                        Confirm password
                      </Label>
                      <Input
                        id="confirm"
                        type="password"
                        required
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Re-enter password"
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
                      {loading ? "Setting password…" : "Activate account"}
                    </Button>
                  </form>
                </>
              )}

              {pageState === "success" && (
                <>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    Account activated
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-[#d8e6ff]/72">
                    Redirecting to dashboard…
                  </p>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
