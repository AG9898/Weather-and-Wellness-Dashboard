"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startSession,
  ApiError,
  type StartSessionCreate,
} from "@/lib/api";
import PageContainer from "@/lib/components/PageContainer";
import CloudLoading from "@/lib/components/CloudLoading";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// ── Constants ─────────────────────────────────────────────────────────────────

const AGE_BAND_OPTIONS = ["Under 18", "18-24", "25-31", "32-38", ">38"];
const GENDER_OPTIONS = ["Woman", "Man", "Non-binary", "Prefer not to say"];
const ORIGIN_OPTIONS = ["Home", "Work", "Class", "Library", "Gym/Recreation Center", "Other"];
const COMMUTE_OPTIONS = ["Walk", "Transit", "Car", "Bike/Scooter", "Other"];
const TIME_OUTSIDE_OPTIONS = [
  "Never (0-30 minutes)",
  "Rarely (31 minutes- 60 minutes)",
  "Sometimes (61 minutes - 90 minutes)",
  "Often (over 90 minutes)",
];

// ── Form types ────────────────────────────────────────────────────────────────

interface DemoForm {
  age_band: string;
  gender: string;
  origin: string;
  origin_other_text: string;
  commute_method: string;
  commute_method_other_text: string;
  time_outside: string;
}

const EMPTY_FORM: DemoForm = {
  age_band: "",
  gender: "",
  origin: "",
  origin_other_text: "",
  commute_method: "",
  commute_method_other_text: "",
  time_outside: "",
};

function isFormComplete(f: DemoForm): boolean {
  if (!f.age_band || !f.gender || !f.origin || !f.commute_method || !f.time_outside) return false;
  if (f.origin === "Other" && !f.origin_other_text.trim()) return false;
  if (f.commute_method === "Other" && !f.commute_method_other_text.trim()) return false;
  return true;
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Step = "consent" | "demographics";

export default function NewSessionPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("consent");
  const [demoForm, setDemoForm] = useState<DemoForm>(EMPTY_FORM);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // ── Step 1 handlers ──────────────────────────────────────────────────────

  const handleConsent = () => setStep("demographics");

  const handleNoConsent = () => router.push("/dashboard");

  // ── Step 2 handlers ──────────────────────────────────────────────────────

  const handleBackToConsent = () => {
    setDemoForm(EMPTY_FORM);
    setStartError(null);
    setStep("consent");
  };

  const handleDemoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isFormComplete(demoForm) || starting) return;

    setStarting(true);
    setStartError(null);

    const payload: StartSessionCreate = {
      age_band: demoForm.age_band,
      gender: demoForm.gender,
      origin: demoForm.origin,
      origin_other_text: demoForm.origin === "Other" ? demoForm.origin_other_text.trim() : null,
      commute_method: demoForm.commute_method,
      commute_method_other_text:
        demoForm.commute_method === "Other" ? demoForm.commute_method_other_text.trim() : null,
      time_outside: demoForm.time_outside,
    };

    try {
      const result = await startSession(payload);
      router.push(result.start_path);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setStartError("Your session has expired. Please sign in again.");
        } else if (err.status >= 500) {
          setStartError("A server error occurred. Please try again.");
        } else {
          setStartError("Could not start a new entry. Please try again.");
        }
      } else {
        setStartError("Unable to connect to the server. Please check your connection.");
      }
      setStarting(false);
    }
  };

  // ── Step 1: Consent ───────────────────────────────────────────────────────

  if (step === "consent") {
    return (
      <div
        className="flex flex-col gap-4 px-4 sm:px-6 py-6"
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="space-y-1 text-center shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Step 1 of 2 — Study Consent
          </p>
          <h1 className="text-2xl font-bold text-foreground">Consent Form</h1>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden grow min-h-0">
          <iframe
            src="/consent-form.pdf"
            className="w-full h-full"
            title="Study Consent Form"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 shrink-0">
          <Button
            onClick={handleNoConsent}
            variant="outline"
            size="lg"
            className="rounded-xl font-semibold"
          >
            I Do Not Consent
          </Button>
          <Button
            onClick={handleConsent}
            size="lg"
            className="rounded-xl font-semibold text-primary-foreground"
            style={{ background: "var(--ubc-blue-700)" }}
          >
            I Consent
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Demographics ──────────────────────────────────────────────────

  return (
    <PageContainer narrow>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Step 2 of 2 — Participant Details
          </p>
          <h1 className="text-2xl font-bold text-foreground">Enter Participant Details</h1>
          <p className="text-sm text-muted-foreground">
            All fields are required before starting the session.
          </p>
        </div>

        <div
          className="rounded-2xl border border-border p-6"
          style={{ background: "var(--card)" }}
        >
          <form onSubmit={handleDemoSubmit} className="flex flex-col gap-5">

            {/* Age band */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="age_band" className="text-sm text-foreground">Age band</Label>
              <Select
                value={demoForm.age_band}
                onValueChange={(v) => setDemoForm((f) => ({ ...f, age_band: v }))}
                disabled={starting}
              >
                <SelectTrigger id="age_band" className="border-border bg-input/30 focus:ring-ring">
                  <SelectValue placeholder="Select age band" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_BAND_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gender" className="text-sm text-foreground">Gender</Label>
              <Select
                value={demoForm.gender}
                onValueChange={(v) => setDemoForm((f) => ({ ...f, gender: v }))}
                disabled={starting}
              >
                <SelectTrigger id="gender" className="border-border bg-input/30 focus:ring-ring">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Origin */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="origin" className="text-sm text-foreground">Coming from</Label>
              <Select
                value={demoForm.origin}
                onValueChange={(v) =>
                  setDemoForm((f) => ({ ...f, origin: v, origin_other_text: "" }))
                }
                disabled={starting}
              >
                <SelectTrigger id="origin" className="border-border bg-input/30 focus:ring-ring">
                  <SelectValue placeholder="Select origin" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGIN_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {demoForm.origin === "Other" && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <Input
                    id="origin_other_text"
                    value={demoForm.origin_other_text}
                    onChange={(e) =>
                      setDemoForm((f) => ({ ...f, origin_other_text: e.target.value }))
                    }
                    placeholder="Describe origin (no names or personal details)"
                    disabled={starting}
                    className="border-border bg-input/30 focus-visible:ring-ring"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Do not enter names, initials, or any information that could identify the participant.
                  </p>
                </div>
              )}
            </div>

            {/* Commute method */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="commute_method" className="text-sm text-foreground">
                Commute method
              </Label>
              <Select
                value={demoForm.commute_method}
                onValueChange={(v) =>
                  setDemoForm((f) => ({ ...f, commute_method: v, commute_method_other_text: "" }))
                }
                disabled={starting}
              >
                <SelectTrigger
                  id="commute_method"
                  className="border-border bg-input/30 focus:ring-ring"
                >
                  <SelectValue placeholder="Select commute method" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUTE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {demoForm.commute_method === "Other" && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <Input
                    id="commute_method_other_text"
                    value={demoForm.commute_method_other_text}
                    onChange={(e) =>
                      setDemoForm((f) => ({
                        ...f,
                        commute_method_other_text: e.target.value,
                      }))
                    }
                    placeholder="Describe commute method (no names or personal details)"
                    disabled={starting}
                    className="border-border bg-input/30 focus-visible:ring-ring"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Do not enter names, initials, or any information that could identify the participant.
                  </p>
                </div>
              )}
            </div>

            {/* Time outside */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time_outside" className="text-sm text-foreground">
                Time spent outside today
              </Label>
              <Select
                value={demoForm.time_outside}
                onValueChange={(v) => setDemoForm((f) => ({ ...f, time_outside: v }))}
                disabled={starting}
              >
                <SelectTrigger
                  id="time_outside"
                  className="border-border bg-input/30 focus:ring-ring"
                >
                  <SelectValue placeholder="Select time outside" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OUTSIDE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error banner */}
            {startError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {startError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1 rounded-xl font-semibold"
                onClick={handleBackToConsent}
                disabled={starting}
              >
                Back
              </Button>
              <Button
                type="submit"
                size="lg"
                className="flex-1 rounded-xl font-semibold text-primary-foreground"
                style={{ background: "var(--ubc-blue-700)" }}
                disabled={!isFormComplete(demoForm) || starting}
              >
                {starting ? (
                  <>
                    <CloudLoading size="sm" className="mr-1.5" />
                    Starting…
                  </>
                ) : (
                  "Start Session"
                )}
              </Button>
            </div>

          </form>
        </div>
      </div>
    </PageContainer>
  );
}
