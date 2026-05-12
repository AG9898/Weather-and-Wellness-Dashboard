"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitation } from "@/lib/api";
import LoginBackgroundPaths from "@/lib/components/LoginBackgroundPaths";
import {
  getInviteActivationCopy,
  getInviteActivationErrorState,
  type InviteActivationState,
} from "@/lib/invitation-ui";

export default function SetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const [pageState, setPageState] = useState<InviteActivationState>("ready");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!inviteToken) {
      setPageState("missing");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await acceptInvitation({ token: inviteToken, password });
    } catch (activationError) {
      setPageState(getInviteActivationErrorState(activationError));
      setLoading(false);
      return;
    }

    setPageState("success");
    setLoading(false);
    setTimeout(() => router.replace("/login"), 1800);
  };

  const displayState: InviteActivationState =
    pageState === "ready" && !inviteToken ? "missing" : pageState;
  const stateCopy = getInviteActivationCopy(displayState);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#12161c_0%,#171c22_36%,#1d232b_68%,#12161c_100%)] text-white">
      <LoginBackgroundPaths />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(96,127,153,0.16),transparent_24%),radial-gradient(circle_at_50%_72%,rgba(0,19,40,0.24),transparent_36%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="rounded-[1.6rem] border border-white/12 bg-gradient-to-b from-white/10 to-white/4 p-[1px] shadow-[0_30px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
            <div className="rounded-[1.55rem] bg-[linear-gradient(180deg,rgba(22,28,34,0.96),rgba(16,20,25,0.92))] p-7 sm:p-8">

              <p className="mb-1 text-xs font-semibold tracking-[0.32em] text-white/64 uppercase">
                W&amp;W Research
              </p>

              {displayState === "loading" && (
                <p className="mt-4 text-sm text-white/72">{stateCopy.body}</p>
              )}

              {displayState !== "loading" &&
                displayState !== "ready" &&
                displayState !== "success" && (
                <>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    {stateCopy.title}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {stateCopy.body}
                  </p>
                </>
              )}

              {displayState === "ready" && (
                <>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    {stateCopy.title}
                  </h1>
                  <p className="mt-1 mb-6 text-sm leading-6 text-white/72">
                    {stateCopy.body}
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-sm font-medium text-white/86">
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
                        className="h-11 rounded-xl border-white/12 bg-white/8 text-white placeholder:text-white/36 focus-visible:ring-white/18"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm" className="text-sm font-medium text-white/86">
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
                      {loading ? "Setting password…" : "Activate account"}
                    </Button>
                  </form>
                </>
              )}

              {displayState === "success" && (
                <>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                    {stateCopy.title}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {stateCopy.body}
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
