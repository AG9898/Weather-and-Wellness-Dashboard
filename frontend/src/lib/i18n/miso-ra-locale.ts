/**
 * RA launch-page locale preference.
 *
 * Distinct from session locale: this is the language the RA has selected on
 * `/misokinesia` for the *next* session they start. It is a machine-local
 * convenience so the toggle is not silently reset between visits, and it is
 * stored in `localStorage` rather than sent anywhere. The authoritative session
 * locale is the `language` value posted to `POST /misokinesia/start` and echoed
 * back on the manifest.
 *
 * Every accessor is failure-tolerant: a browser with site data blocked, or a
 * server render with no `window`, must fall back to the default locale rather
 * than throw and take the launch page down.
 */

import {
  DEFAULT_MISO_LOCALE,
  resolveMisoLocale,
  type MisoLocale,
} from "./miso-locale";

export const MISO_RA_LOCALE_STORAGE_KEY = "ww:miso-ra-locale";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Read the RA's remembered launch locale. Returns the default locale when
 * nothing is stored, the value is unreadable, or it is not a supported locale.
 *
 * Call this from an effect, never during render: the first client render must
 * match the server render, which has no storage to read.
 */
export function readRaMisoLocale(): MisoLocale {
  const storage = getLocalStorage();
  if (!storage) return DEFAULT_MISO_LOCALE;
  try {
    return resolveMisoLocale(storage.getItem(MISO_RA_LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_MISO_LOCALE;
  }
}

/** Remember the RA's launch locale for their next visit. Never throws. */
export function storeRaMisoLocale(locale: MisoLocale): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(MISO_RA_LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage is unavailable (private mode, blocked site data). The toggle
    // still works for this visit; only the memory of it is lost.
  }
}

/**
 * BCP 47 tag for a Misokinesia locale, for `Intl` / `toLocaleDateString` calls
 * that need a real language tag rather than a catalogue key.
 */
export function misoLocaleTag(locale: MisoLocale): string {
  return locale === "ko" ? "ko-KR" : "en-CA";
}
