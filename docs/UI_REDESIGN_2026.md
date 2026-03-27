# UI/UX Overhaul — Weather & Wellness Research Platform (2026)

> **Status:** Phase 1 implemented — March 2026
> **Scope:** Platform-wide theming reset for RA pages, participant pages, auth surfaces, and shared components
> **Out of scope:** Layout rewrites, participant flow redesign, backend changes

---

## 1. Direction Reset

The previous redesign direction improved the existing palette but still treated the interface as a UBC-blue tonal system. That kept too much chroma in the UI itself, especially in light mode, and left dark mode visually tied to navy-heavy surfaces.

Phase 1 replaces that approach with a standardized light/dark theme model:

- Light mode uses near-white neutral surfaces with dark neutral text.
- Dark mode uses charcoal-neutral surfaces with soft off-white text.
- The only branded UI accent is `--ubc-video-blue` (`#001328`).
- Dark mode may use tonal lifts derived from `#001328` for accessible focus, active, and primary-action contrast.
- Charts keep a separate, restrained visualization palette so data remains readable without turning the whole interface into a multi-accent system.

The reference image in `reference/UI Reference/theme makeover/stitch_research_dashboard_redesign/screen.png` is used here for tonal normalization, restraint, and natural dark-surface contrast. It is not a layout clone target.

---

## 2. Audit Findings

### 2.1 Theme Model Problem

The old theme system interpreted light and dark mode through the UBC blue family rather than through conventional neutral surface ramps.

That created three recurring issues:

- Light mode felt tinted instead of calm and baseline-neutral.
- Dark mode relied on deep navy surfaces that read more branded than standardized.
- Multiple bright blues appeared as UI chrome rather than staying limited to intentional emphasis.

### 2.2 Token Problem

The semantic token layer existed, but several decisions still pushed the UI toward legacy color behavior:

- `--primary` and `--ring` were mapped to bright accent blues.
- `--secondary`, `--accent`, and `--sidebar` still carried blue tint.
- Several components bypassed semantic tokens and used direct `--ubc-blue-*` fills or raw blue gradients.

### 2.3 Scope Problem

The previous overhaul document was RA-focused. That was too narrow for a theme reset because auth flows, participant surfaces, and shared components would otherwise keep the legacy palette alive.

This document now defines platform-wide theming rules. Page-specific redesign work can still be phased separately.

---

## 3. Design Principles

**Neutral surfaces first.** Light and dark modes should both feel like familiar, standardized interfaces before brand identity is layered on top.

**One branded UI accent.** The interface should not rotate between multiple bright blues. `#001328` is the brand anchor; derived tonal lifts are allowed only where contrast demands them.

**Semantic tokens are the source of truth.** Shared UI should consume `background`, `card`, `foreground`, `primary`, `accent`, `muted`, `border`, `input`, and `ring` tokens. Raw `--ubc-blue-*` tokens are legacy support, not the preferred authoring path.

**Charts are separate from chrome.** Data visualization may use additional restrained series colors, but those colors do not become general UI accents.

**Keep the existing structure.** This phase does not replace the floating chrome, typography stack, or current page layouts. It changes the theme system underneath them.

---

## 4. Color System — Revised

### 4.1 Brand Anchor and Tonal Support

The brand anchor remains:

```css
--ubc-video-blue: #001328;
```

Legacy `--ubc-blue-*` tokens are retained only as tonal lifts/shades of the same hue family so older components do not reintroduce unrelated bright blues:

```css
--ubc-blue-700: #001328;
--ubc-blue-600: #11263a;
--ubc-blue-500: #23415a;
--ubc-blue-300: #506a81;
--ubc-blue-200: #8e9eaf;
--ubc-blue-100: #cfd7de;
```

### 4.2 Light Theme Semantic Targets

Light mode is now a normalized neutral palette:

| Token | Target behavior |
|-------|------------------|
| `--background` | near-white neutral page canvas |
| `--card` / `--popover` | white or near-white surface |
| `--foreground` | dark neutral ink |
| `--muted-foreground` | mid neutral gray with AA-safe contrast |
| `--primary` | `#001328` |
| `--primary-foreground` | light text on dark fill |
| `--secondary` / `--accent` / `--muted` | neutral support surfaces, not blue fills |
| `--border` / `--input` | neutral separators and control fills |
| `--ring` | tonal lift of the same hue family, not cyan |

### 4.3 Dark Theme Semantic Targets

Dark mode is now a standardized charcoal theme:

| Token | Target behavior |
|-------|------------------|
| `--background` | dark neutral background, not navy-forward |
| `--card` / `--popover` | slightly raised dark neutral surfaces |
| `--foreground` | soft off-white text |
| `--muted-foreground` | subdued neutral supporting text |
| `--primary` | contrast-safe tonal lift derived from `#001328` |
| `--primary-foreground` | light text |
| `--secondary` / `--accent` / `--muted` | neutral dark support surfaces |
| `--border` / `--input` | low-contrast neutral separators |
| `--ring` | brighter tonal lift of the same hue family |

### 4.4 Chart Tokens

Charts use a restrained slate/steel palette via `--chart-*` tokens so multiple data series remain legible without turning the rest of the UI into a multi-accent system.

These chart colors are for data visualization only.

---

## 5. Elevation Model

Elevation now reinforces neutral themes rather than blue-tinted surfaces:

```css
--shadow-card:   0 1px 2px rgb(15 23 42 / 5%), 0 10px 24px rgb(15 23 42 / 6%);
--shadow-raised: 0 6px 18px rgb(15 23 42 / 8%), 0 24px 48px rgb(15 23 42 / 8%);
```

Usage:

- Level 0: page background
- Level 1: standard cards and data panels
- Level 2: hero/action cards
- Level 3: overlays and popovers

---

## 6. Component Rules

### 6.1 Primary Actions

- Primary buttons use the semantic `primary` token.
- Do not use bright blue gradients for standard actions.
- If a dark theme needs more contrast, use the defined tonal lift in `primary`, not a new accent hue.

### 6.2 Secondary and Ghost Treatments

- Secondary, ghost, muted, and hover surfaces stay neutral.
- Hover states should read as tonal elevation, not as colored fills.

### 6.3 Focus States

- Focus indicators use `ring`.
- Cyan rings and unrelated highlight colors are removed.

### 6.4 Navigation Chrome

- The floating chrome architecture stays.
- Active and hover states must be driven by semantic tokens and the new accent policy.

### 6.5 Auth Surfaces

- Login and password flows use the same dark neutral base as the main dark theme.
- Auth CTAs and highlights follow the single-accent system rather than blue gradients.

---

## 7. What Changed in Phase 1

Implemented changes:

- `frontend/src/app/globals.css` now defines a standardized neutral light/dark semantic palette.
- `frontend/src/app/layout.tsx` browser theme-color metadata now matches the new light/dark backgrounds.
- Shared chart components now fall back to restrained chart token colors instead of legacy bright blues.
- RA hero/action surfaces were moved toward semantic `primary`/`ring` usage.
- Login and set-password flows were re-toned to the new dark neutral system.

---

## 8. What Did Not Change

| Element | Status | Reason |
|---------|--------|--------|
| Theme preference behavior (`system` / `light` / `dark`) | Unchanged | Palette reset only in this phase |
| Floating dock concept | Unchanged | Structural redesign deferred |
| JetBrains Mono typography | Unchanged | Broader visual-language decisions deferred |
| Page layouts | Unchanged | This phase targets theme system, not layout composition |
| Participant flow logic | Unchanged | Theming only |

---

## 9. Follow-On Work

Later phases can build on this foundation with:

- broader auth-page visual redesign,
- page-by-page component cleanup away from legacy `--ubc-blue-*` usage,
- stricter semantic-token enforcement,
- and any larger visual-language decisions beyond color and tone.
