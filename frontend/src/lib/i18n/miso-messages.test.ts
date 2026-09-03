import { describe, expect, it } from "vitest";

import {
  DEFAULT_MISO_LOCALE,
  MISO_LOCALES,
  MISO_MESSAGES,
  MISO_OPTION_FIELDS,
  MISO_OPTION_LABELS,
  isMisoLocale,
  misoMessage,
  misoOptionKeys,
  misoOptionLabel,
  resolveMisoLocale,
  type MisoMessageKey,
  type MisoOptionLabelSet,
} from "@/lib/i18n";

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

function placeholderNames(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort();
}

const EN_KEYS = Object.keys(MISO_MESSAGES.en) as MisoMessageKey[];

describe("miso locale", () => {
  it("defaults to English", () => {
    expect(DEFAULT_MISO_LOCALE).toBe("en");
    expect(MISO_LOCALES).toEqual(["en", "ko"]);
  });

  it("resolves unknown locales to the default instead of throwing", () => {
    expect(resolveMisoLocale("ko")).toBe("ko");
    expect(resolveMisoLocale("fr")).toBe("en");
    expect(resolveMisoLocale(null)).toBe("en");
    expect(resolveMisoLocale(undefined)).toBe("en");
    expect(isMisoLocale("ko")).toBe(true);
    expect(isMisoLocale("fr")).toBe(false);
  });
});

describe("miso message catalogue", () => {
  it("has identical key sets across locales", () => {
    const enKeys = Object.keys(MISO_MESSAGES.en).sort();
    const koKeys = Object.keys(MISO_MESSAGES.ko).sort();
    expect(koKeys).toEqual(enKeys);
  });

  it("has no empty value in either locale", () => {
    for (const locale of MISO_LOCALES) {
      for (const key of EN_KEYS) {
        const value = MISO_MESSAGES[locale][key];
        expect(typeof value, `${locale}:${key}`).toBe("string");
        expect(value.trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("uses the same placeholder set in both locales", () => {
    for (const key of EN_KEYS) {
      expect(placeholderNames(MISO_MESSAGES.ko[key]), key).toEqual(
        placeholderNames(MISO_MESSAGES.en[key]),
      );
    }
  });

  it("carries the 120 UI chrome keys documented in LOCALIZATION.md section 6", () => {
    const chromeKeys = EN_KEYS.filter((key) => key.startsWith("chrome."));
    expect(chromeKeys).toHaveLength(120);
  });

  it("keeps the KO GAD-7 distinct from the EN wording", () => {
    // Guards against a placeholder KO row being left as an English copy in a
    // validated instrument.
    expect(MISO_MESSAGES.ko["gad7.item.r1"]).not.toBe(
      MISO_MESSAGES.en["gad7.item.r1"],
    );
  });
});

describe("misoMessage", () => {
  it("resolves a key plus locale", () => {
    expect(misoMessage("chrome.button.submit", "en")).toBe("Submit");
    expect(misoMessage("chrome.button.submit", "ko")).toBe("제출");
  });

  it("interpolates placeholders", () => {
    expect(misoMessage("chrome.clip.progress", "en", { n: 3, m: 29 })).toBe(
      "Clip 3 of 29",
    );
    expect(misoMessage("chrome.clip.progress", "ko", { n: 3, m: 29 })).toBe(
      "영상 3 / 29",
    );
  });

  it("leaves an unsupplied placeholder visible rather than blanking it", () => {
    expect(misoMessage("chrome.clip.progress", "en", { n: 3 })).toBe("Clip 3 of {m}");
  });
});

describe("miso option labels", () => {
  it("registers a label entry for both locales on every option key", () => {
    for (const field of MISO_OPTION_FIELDS) {
      const options = MISO_OPTION_LABELS[field] as Readonly<
        Record<string, MisoOptionLabelSet>
      >;
      for (const [key, labels] of Object.entries(options)) {
        for (const locale of MISO_LOCALES) {
          expect(locale in labels, `${field}.${key}:${locale}`).toBe(true);
          const value = labels[locale];
          if (value !== null) {
            expect(value.trim(), `${field}.${key}:${locale}`).not.toBe("");
          }
        }
        // No option may be absent from both locales.
        expect(
          MISO_LOCALES.some((locale) => labels[locale] !== null),
          `${field}.${key}`,
        ).toBe(true);
      }
    }
  });

  it("offers a KO label for every option except the documented EN-only keys", () => {
    const enOnly = new Set(["fluent_lang_korean", "instruction_lang_korean"]);
    for (const field of MISO_OPTION_FIELDS) {
      const options = MISO_OPTION_LABELS[field] as Readonly<
        Record<string, MisoOptionLabelSet>
      >;
      for (const [key, labels] of Object.entries(options)) {
        if (enOnly.has(key)) {
          expect(labels.ko, key).toBeNull();
        } else {
          expect(labels.ko, key).not.toBeNull();
        }
      }
    }
  });

  it("splits the Case B divergent option sets by locale", () => {
    const enFluent = misoOptionKeys("fluent_languages", "en");
    const koFluent = misoOptionKeys("fluent_languages", "ko");
    expect(enFluent).toContain("fluent_lang_korean");
    expect(enFluent).not.toContain("fluent_lang_english");
    expect(koFluent).toContain("fluent_lang_english");
    expect(koFluent).not.toContain("fluent_lang_korean");

    const enInstruction = misoOptionKeys("instruction_languages", "en");
    const koInstruction = misoOptionKeys("instruction_languages", "ko");
    expect(enInstruction).toContain("instruction_lang_korean");
    expect(enInstruction).not.toContain("instruction_lang_english");
    expect(koInstruction).toContain("instruction_lang_english");
    expect(koInstruction).not.toContain("instruction_lang_korean");
  });

  it("keeps shared Case A keys in both locales", () => {
    expect(misoOptionKeys("residence_status", "en")).toEqual(
      misoOptionKeys("residence_status", "ko"),
    );
    expect(misoOptionLabel("residence_status", "residence_citizenship", "en")).toBe(
      "Canadian Citizenship",
    );
    expect(misoOptionLabel("residence_status", "residence_citizenship", "ko")).toBe(
      "대한민국 국적",
    );
  });

  it("keeps end-of-task timing keys aligned with the message catalogue", () => {
    const pairs = [
      ["timing_immediately", "end.timing.immediately"],
      ["timing_after_5s", "end.timing.after_5s"],
      ["timing_after_10s", "end.timing.after_10s"],
      ["timing_end_of_video", "end.timing.end_of_video"],
    ] as const;
    for (const [optionKey, messageKey] of pairs) {
      for (const locale of MISO_LOCALES) {
        expect(
          misoOptionLabel("stronger_responses_timing", optionKey, locale),
          `${optionKey}:${locale}`,
        ).toBe(MISO_MESSAGES[locale][messageKey]);
      }
    }
  });

  it("falls back rather than blanking an option the locale does not offer", () => {
    expect(misoOptionLabel("fluent_languages", "fluent_lang_korean", "ko")).toBe(
      "Korean",
    );
    expect(misoOptionLabel("fluent_languages", "fluent_lang_english", "en")).toBe(
      "영어",
    );
    expect(misoOptionLabel("fluent_languages", "legacy_unknown_key", "en")).toBe(
      "legacy_unknown_key",
    );
  });
});
