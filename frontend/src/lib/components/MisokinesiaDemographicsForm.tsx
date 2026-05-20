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

function FlatChipGroup({
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
              "h-9 rounded-[10px] border px-3.5 text-xs font-medium transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-ring/60 hover:text-foreground"
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

  function handleSubmit(e: React.SyntheticEvent) {
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

  const rows: Array<{
    label: string;
    hint?: string;
    control: React.ReactNode;
  }> = [
    {
      label: "Age group",
      control: (
        <FlatChipGroup
          options={AGE_BANDS}
          selected={ageBand}
          onChange={setAgeBand}
        />
      ),
    },
    {
      label: "Gender identity",
      control: (
        <div className="space-y-3">
          <FlatChipGroup
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
              className="h-10 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          )}
        </div>
      ),
    },
    {
      label: "Country of current residence",
      control: (
        <div className="space-y-3">
          <FlatChipGroup
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
              className="h-10 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          )}
        </div>
      ),
    },
    {
      label: "Nationality",
      hint: "Free text",
      control: (
        <input
          type="text"
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          placeholder="Optional"
          className="h-10 w-full rounded-[10px] border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
        />
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[760px] px-8 py-16">
      {/* Step indicator */}
      <div className="mb-9 flex items-center gap-3">
        <span className="shrink-0 font-variant-numeric-tabular text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
          01 / 04
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Demographics → Intro → Task → Surveys
        </span>
      </div>

      {/* Kicker + heading + body */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Before we begin
      </p>
      <h1 className="mt-2.5 text-3xl font-bold tracking-[-0.02em] text-foreground">
        About you
      </h1>
      <p className="mt-2.5 max-w-[520px] text-sm leading-relaxed text-muted-foreground">
        All questions are optional. You can skip any you prefer not to answer.
        Your answers are stored anonymously.
      </p>

      {/* Form card */}
      <form onSubmit={handleSubmit}>
        <div
          className="mt-9 rounded-2xl border border-border px-7 py-2"
          style={{ background: "var(--card)", boxShadow: "var(--shadow-card)" }}
        >
          {rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid items-start gap-8 py-[22px]",
                i < rows.length - 1 && "border-b border-border"
              )}
              style={{ gridTemplateColumns: "200px 1fr" }}
            >
              <div>
                <div className="text-[13px] font-semibold text-foreground">
                  {row.label}
                </div>
                {row.hint && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {row.hint}
                  </div>
                )}
              </div>
              <div>{row.control}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-7 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground tabular-nums">
            Roughly 18 minutes to complete
          </span>
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 min-w-[160px] rounded-xl px-[22px] text-sm text-primary-foreground"
          >
            {submitting ? "Saving…" : "Continue →"}
          </Button>
        </div>
      </form>
    </div>
  );
}
