/**
 * Misokinesia session locale.
 *
 * Component-scoped on purpose: `ko` is an available locale inside the
 * Misokinesia participant flow only. The Weather component and the RA dashboard
 * stay English-only. See
 * `docs/labs/weather-wellness/misokinesia/LOCALIZATION.md` section 1.
 *
 * Locale is fixed for the lifetime of a session. The RA selects it at session
 * start (`POST /misokinesia/start`, `language` body field); it is persisted on
 * `misokinesia_participants.language` and echoed in the manifest. Locale travels
 * as session state, never as a URL segment.
 *
 * Locale selects labels only. Stored values are language-independent option
 * keys, so a KO session and an EN session produce directly comparable rows.
 */

export const MISO_LOCALES = ["en", "ko"] as const;

export type MisoLocale = (typeof MISO_LOCALES)[number];

/** A session with no recorded locale is English. */
export const DEFAULT_MISO_LOCALE: MisoLocale = "en";

export function isMisoLocale(value: unknown): value is MisoLocale {
  return (
    typeof value === "string" && (MISO_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Narrow an untrusted locale (manifest field, query param, stored column) to a
 * supported locale, falling back to the default rather than throwing — an
 * unexpected locale must never block a participant mid-session.
 */
export function resolveMisoLocale(value: unknown): MisoLocale {
  return isMisoLocale(value) ? value : DEFAULT_MISO_LOCALE;
}
