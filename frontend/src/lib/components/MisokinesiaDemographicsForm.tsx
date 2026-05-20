"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MisokinesiaDemographicsFormProps {
  submitting: boolean;
  error: string | null;
  onSubmit: (values: DemographicsValues) => void;
}

export interface DemographicsValues {
  age_band: string | null;
  gender: string | null;
  gender_other_text: string | null;
  country: string | null;
  country_other_text: string | null;
  nationality: string | null;
}

const AGE_BANDS = ["Under 18", "18-24", "25-31", "32-38", "Over 38"];
const GENDERS = ["Woman", "Man", "Nonbinary person", "Prefer not to say", "Not listed"];
const COUNTRIES = ["Canada", "South Korea", "Not listed"];

function ChipGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              isSelected
                ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card/70 text-muted-foreground hover:border-ring/40 hover:text-foreground"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export default function MisokinesiaDemographicsForm({
  submitting,
  error,
  onSubmit,
}: MisokinesiaDemographicsFormProps) {
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [genderOtherText, setGenderOtherText] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [countryOtherText, setCountryOtherText] = useState("");
  const [nationality, setNationality] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      age_band: ageBand,
      gender,
      gender_other_text: gender === "Not listed" ? genderOtherText || null : null,
      country,
      country_other_text: country === "Not listed" ? countryOtherText || null : null,
      nationality: nationality || null,
    });
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div
        className="pointer-events-none absolute left-0 top-6 h-44 w-44 rounded-full opacity-35 blur-3xl"
        style={{ background: "color-mix(in srgb, var(--ring) 72%, transparent)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-52 w-52 rounded-full opacity-20 blur-3xl"
        style={{ background: "color-mix(in srgb, var(--primary) 68%, transparent)" }}
      />

      <div
        className="relative space-y-6 rounded-[1.6rem] border border-border/90 p-5 shadow-[0_30px_60px_-52px_rgb(0_19_40/0.7)] sm:p-8"
        style={{ background: "var(--card)" }}
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Before we begin
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            About you
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            All questions are optional. You can skip any you prefer not to answer.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Age band */}
          <fieldset className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
            <legend className="sr-only">Age group</legend>
            <p className="text-sm font-medium leading-snug text-foreground">
              What is your age group?
            </p>
            <ChipGroup
              options={AGE_BANDS}
              selected={ageBand}
              onChange={setAgeBand}
            />
          </fieldset>

          {/* Gender */}
          <fieldset className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
            <legend className="sr-only">Gender identity</legend>
            <p className="text-sm font-medium leading-snug text-foreground">
              What is your gender identity?
            </p>
            <ChipGroup
              options={GENDERS}
              selected={gender}
              onChange={setGender}
            />
            {gender === "Not listed" && (
              <input
                type="text"
                value={genderOtherText}
                onChange={(e) => setGenderOtherText(e.target.value)}
                placeholder="Please describe (optional)"
                className="mt-2 w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
              />
            )}
          </fieldset>

          {/* Country */}
          <fieldset className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
            <legend className="sr-only">Country of current residence</legend>
            <p className="text-sm font-medium leading-snug text-foreground">
              What is your country of current residence?
            </p>
            <ChipGroup
              options={COUNTRIES}
              selected={country}
              onChange={setCountry}
            />
            {country === "Not listed" && (
              <input
                type="text"
                value={countryOtherText}
                onChange={(e) => setCountryOtherText(e.target.value)}
                placeholder="Please specify (optional)"
                className="mt-2 w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
              />
            )}
          </fieldset>

          {/* Nationality */}
          <fieldset className="space-y-3 rounded-2xl border border-border/80 bg-background/55 p-4">
            <legend className="sr-only">Nationality</legend>
            <p className="text-sm font-medium leading-snug text-foreground">
              What is your nationality?
            </p>
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          </fieldset>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="min-w-36 rounded-xl px-6 text-primary-foreground"
            >
              {submitting ? "Saving…" : "Continue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
