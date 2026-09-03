/**
 * Misokinesia-scoped i18n layer.
 *
 * Deliberately repo-local and dependency-free: the catalogue is static, covers
 * one component, and is two locales deep, so a framework-wide i18n dependency
 * would cost more than it buys. There is no locale routing — locale is session
 * state resolved from the manifest, never a URL segment.
 *
 * Canonical string source: `docs/labs/weather-wellness/misokinesia/LOCALIZATION.md`.
 */

export {
  MISO_LOCALES,
  DEFAULT_MISO_LOCALE,
  isMisoLocale,
  resolveMisoLocale,
  type MisoLocale,
} from "./miso-locale";

export {
  MISO_MESSAGES,
  misoMessage,
  type MisoMessageKey,
  type MisoMessageParams,
} from "./miso-messages";

export {
  MISO_OPTION_LABELS,
  MISO_OPTION_FIELDS,
  misoOptionKeys,
  misoOptionLabel,
  type MisoOptionField,
  type MisoOptionKey,
  type MisoOptionLabelSet,
} from "./miso-option-labels";
