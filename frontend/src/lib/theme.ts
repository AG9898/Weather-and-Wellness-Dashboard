export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ww-theme-preference";

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

export const THEME_INIT_SCRIPT = `(() => {
  const root = document.documentElement;
  const storageKey = "${THEME_STORAGE_KEY}";
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let storedPreference = "system";

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === "system" || raw === "light" || raw === "dark") {
      storedPreference = raw;
    }
  } catch {
    storedPreference = "system";
  }

  const resolvedTheme =
    storedPreference === "system"
      ? (systemPrefersDark ? "dark" : "light")
      : storedPreference;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
})();`;
