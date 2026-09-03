import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_MISO_LOCALE,
  MISO_LOCALES,
  MISO_MESSAGES,
  MISO_OPTION_FIELDS,
  MISO_OPTION_LABELS,
  MISO_RA_LOCALE_STORAGE_KEY,
  isMisoLocale,
  misoLocaleTag,
  misoMessage,
  misoOptionKeys,
  misoOptionLabel,
  readRaMisoLocale,
  resolveMisoLocale,
  storeRaMisoLocale,
  type MisoMessageKey,
  type MisoOptionLabelSet,
} from "@/lib/i18n";

function readFrontendFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

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
    // RA launch-page keys live under `ra.launch.` precisely so they do not
    // inflate the participant chrome count this asserts.
    const chromeKeys = EN_KEYS.filter((key) => key.startsWith("chrome."));
    expect(chromeKeys).toHaveLength(120);
  });

  it("translates the RA launch page rather than leaving it English", () => {
    const launchKeys = EN_KEYS.filter((key) => key.startsWith("ra.launch."));
    expect(launchKeys.length).toBeGreaterThan(0);
    // Locale codes on the toggle are the only rows that are legitimately
    // identical in both locales.
    const sameInBothLocales = launchKeys.filter(
      (key) => MISO_MESSAGES.ko[key] === MISO_MESSAGES.en[key],
    );
    expect(sameInBothLocales).toEqual([
      "ra.launch.language.en",
      "ra.launch.language.ko",
    ]);
  });

  it("leaves no English-only remainder on the RA launch page", () => {
    // The launch page is localized as a whole surface (LOCALIZATION.md s1), so
    // every error branch the page can render must be a catalogue row — the
    // full-trial stimulus-set guard included, which is thrown as an Error and
    // surfaced verbatim.
    for (const key of [
      "ra.launch.error.dashboard",
      "ra.launch.error.dashboard_status",
      "ra.launch.error.start",
      "ra.launch.error.start_status",
      "ra.launch.error.trial",
      "ra.launch.error.trial_status",
      "ra.launch.error.trial_clip_count",
    ] as MisoMessageKey[]) {
      expect(MISO_MESSAGES.en[key]).toBeTruthy();
      expect(MISO_MESSAGES.ko[key]).toBeTruthy();
      expect(MISO_MESSAGES.ko[key]).not.toBe(MISO_MESSAGES.en[key]);
    }
  });

  it("interpolates the clip count into the full-trial guard in both locales", () => {
    expect(
      misoMessage("ra.launch.error.trial_clip_count", "en", { count: 5 }),
    ).toContain("only 5 clips");
    expect(
      misoMessage("ra.launch.error.trial_clip_count", "ko", { count: 5 }),
    ).toContain("5개");
  });

  it("localizes the recent-sessions demographic option keys", () => {
    // The dashboard returns stored keys; the launch table renders them through
    // these maps, so a raw `sex_female` must never reach the RA.
    expect(misoOptionLabel("sex", "sex_female", "en")).toBe("Female");
    expect(misoOptionLabel("sex", "sex_female", "ko")).toBe("여성");
    expect(misoOptionLabel("residence_status", "residence_citizenship", "ko")).toBe(
      "대한민국 국적",
    );
    // A pre-migration English literal is unknown to the map and must survive
    // verbatim rather than blanking the cell.
    expect(misoOptionLabel("sex", "Female", "ko")).toBe("Female");
  });

  it("keeps the KO GAD-7 distinct from the EN wording", () => {
    // Guards against a placeholder KO row being left as an English copy in a
    // validated instrument.
    expect(MISO_MESSAGES.ko["gad7.item.r1"]).not.toBe(
      MISO_MESSAGES.en["gad7.item.r1"],
    );
  });
});

describe("post-video survey forms", () => {
  const INSTRUMENTS = [
    { prefix: "mkaq", items: 21, scalePoints: 4 },
    { prefix: "maq", items: 21, scalePoints: 4 },
  ] as const;

  it.each(INSTRUMENTS)(
    "carries every $prefix item and scale anchor in both locales",
    ({ prefix, items, scalePoints }) => {
      for (let i = 1; i <= items; i += 1) {
        const key = `${prefix}.item.q${i}` as MisoMessageKey;
        expect(MISO_MESSAGES.en[key]).toBeTruthy();
        expect(MISO_MESSAGES.ko[key]).toBeTruthy();
        // A KO row identical to EN would mean an untranslated placeholder.
        expect(MISO_MESSAGES.ko[key]).not.toBe(MISO_MESSAGES.en[key]);
      }
      for (let point = 0; point < scalePoints; point += 1) {
        const key = `${prefix}.scale.${point}` as MisoMessageKey;
        expect(MISO_MESSAGES.en[key]).toBeTruthy();
        expect(MISO_MESSAGES.ko[key]).toBeTruthy();
      }
    },
  );

  it("carries all seven GAD-7 items, the stem and the four scale anchors", () => {
    for (let i = 1; i <= 7; i += 1) {
      const key = `gad7.item.r${i}` as MisoMessageKey;
      expect(MISO_MESSAGES.ko[key]).not.toBe(MISO_MESSAGES.en[key]);
    }
    for (const key of [
      "gad7.stem",
      "gad7.scale.0",
      "gad7.scale.1",
      "gad7.scale.2",
      "gad7.scale.3",
      "gad7.difficulty.stem",
    ] as MisoMessageKey[]) {
      expect(MISO_MESSAGES.ko[key]).not.toBe(MISO_MESSAGES.en[key]);
    }
  });

  it("keeps the EN GAD-7 difficulty labels byte-identical to the stored whitelist", () => {
    // `difficulty_impact` is not key-migrated: a KO session displays the Korean
    // label but submits the English one, which the backend validates against
    // `_VALID_GAD7_DIFFICULTY_IMPACTS` and a DB CHECK. Editing these EN rows
    // would start rejecting submissions with a 422.
    expect([
      MISO_MESSAGES.en["gad7.difficulty.not_at_all"],
      MISO_MESSAGES.en["gad7.difficulty.somewhat"],
      MISO_MESSAGES.en["gad7.difficulty.very"],
      MISO_MESSAGES.en["gad7.difficulty.extremely"],
    ]).toEqual([
      "Not difficult at all",
      "Somewhat difficult",
      "Very difficult",
      "Extremely difficult",
    ]);
    expect(MISO_MESSAGES.ko["gad7.difficulty.somewhat"]).toBe("다소 어려웠다");
  });

  it("submits the English difficulty label whatever the locale", () => {
    const source = readFrontendFile(
      "src/lib/components/MisokinesiaGAD7Form.tsx",
    );
    // The radio value and the stored answer come from the EN catalogue; only
    // the visible label goes through `misoMessage(..., locale)`.
    expect(source).toContain("return MISO_MESSAGES.en[key];");
    expect(source).not.toContain('"Not difficult at all"');
  });

  it("holds no inline instrument or chrome literal in the three survey forms", () => {
    for (const file of [
      "src/lib/components/MisokinesiaMkaqForm.tsx",
      "src/lib/components/MisokinesiaMAQForm.tsx",
      "src/lib/components/MisokinesiaGAD7Form.tsx",
    ]) {
      const source = readFrontendFile(file);
      expect(source).toContain("misoMessage(");
      expect(source).not.toContain("Please rate each statement");
      expect(source).not.toContain("Almost all the time");
      expect(source).not.toMatch(/&larr;\s*Previous/);
      expect(source).not.toMatch(/Next\s*&rarr;/);
      expect(source).not.toMatch(/>\s*Submit\s*</);
      expect(source).not.toMatch(/"Submitting/);
    }
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

describe("RA launch locale preference", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  function stubStorage(initial?: string) {
    const store = new Map<string, string>();
    if (initial !== undefined) {
      store.set(MISO_RA_LOCALE_STORAGE_KEY, initial);
    }
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    };
    return store;
  }

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("falls back to the default locale with no storage available", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(readRaMisoLocale()).toBe(DEFAULT_MISO_LOCALE);
    // Storing without storage must be a no-op, never a throw.
    expect(() => storeRaMisoLocale("ko")).not.toThrow();
  });

  it("remembers the RA selection across visits", () => {
    const store = stubStorage();
    storeRaMisoLocale("ko");
    expect(store.get(MISO_RA_LOCALE_STORAGE_KEY)).toBe("ko");
    expect(readRaMisoLocale()).toBe("ko");
  });

  it("ignores an unsupported stored value instead of trusting it", () => {
    stubStorage("fr");
    expect(readRaMisoLocale()).toBe("en");
  });

  it("survives storage that throws", () => {
    (globalThis as { window?: unknown }).window = {
      get localStorage(): Storage {
        throw new Error("blocked site data");
      },
    };
    expect(readRaMisoLocale()).toBe(DEFAULT_MISO_LOCALE);
    expect(() => storeRaMisoLocale("ko")).not.toThrow();
  });

  it("maps each locale to a real BCP 47 tag for Intl formatting", () => {
    expect(misoLocaleTag("en")).toBe("en-CA");
    expect(misoLocaleTag("ko")).toBe("ko-KR");
  });
});
