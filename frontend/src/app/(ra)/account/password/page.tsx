"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageContainer from "@/lib/components/PageContainer";
import { supabase } from "@/lib/supabase";

type PageState = "idle" | "saving" | "success";

function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message: unknown }).message).toLowerCase();
    if (msg.includes("same password") || msg.includes("different from the old")) {
      return "New password must be different from your current password.";
    }
    if (msg.includes("weak") || msg.includes("too short")) {
      return "Password is too weak. Please choose a stronger password.";
    }
  }
  return "Password update failed. Please try again.";
}

export default function ChangePasswordPage() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setPageState("saving");
    const { error: supaError } = await supabase.auth.updateUser({ password: newPassword });

    if (supaError) {
      setError(supabaseErrorMessage(supaError));
      setPageState("idle");
      return;
    }

    setNewPassword("");
    setConfirm("");
    setPageState("success");
  }

  return (
    <PageContainer narrow>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Change password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the password for your RA account.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        {pageState === "success" ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Password updated successfully. You are still signed in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                className="h-11 rounded-xl"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={pageState === "saving"}
              className="h-11 w-full rounded-xl text-primary-foreground"
            >
              {pageState === "saving" ? "Updating password…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
