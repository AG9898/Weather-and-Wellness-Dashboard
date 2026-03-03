# styleguide.md — UI Implementation Reference (CLI Agent)

Use this document as the canonical UI style reference for frontend implementation tasks.
It defines the shared look-and-feel across pages so individual page work stays consistent.

## 1) Source References

- Layout and atmosphere reference (do not clone 1:1):
  - `reference/UI Reference/landingpage.html`
  - `reference/UI Reference/landingpage.png`
- Brand palette and typography source:
  - `reference/UI Reference/ubc_colour_guide_august_2025.pdf`

## 2) Scope and Non-Goals

- This guide is for visual direction and token consistency, not component parity.
- Do not recreate the full `WeatherMind` landing page as-is.
- References are **inspiration only** (not 1:1 remakes).
- Keep the vibe: clean, calm, data-oriented, modern lab interface (research tool, not marketing).
- Omit decorative components that are not part of the product requirements.

## 3) Visual Direction (Target Vibe)

- Light-first baseline with cool-tinted surfaces (not stark white).
- Glass-like surfaces for cards/panels with subtle borders and (optional) blur.
- Quiet, high-contrast typography tuned for long-form task flow.
- Minimal, deliberate motion; no excessive animation.
- Clinical/research tone over marketing tone.

**Phase 4 (implemented):** System-default light/dark toggle is active (default = system).
- **Light theme (default):** uses this document’s **hex token set** as the source of truth.
- **Dark theme:** a **tonal dark theme** derived from the light theme hues (same hue family, darker tones, controlled chroma).
- Theme preference is persisted in `localStorage` and the stored preference overrides system when set.
- Toggle control is exposed in RA navigation and applies globally to RA + participant pages.
- The visible toggle is binary (`light`/`dark`); if no explicit preference exists, initial theme resolution still uses system (`prefers-color-scheme`).

## 4) Brand Tokens (UBC-Based)

The UBC PDF is print-first and mostly CMYK/Pantone. In the PDF, some RGB/CMYK values are not internally consistent with the displayed web hex approximations.

For this repo:
- **Hex values are the source of truth** for the palette.
- Any RGB/CMYK values are informational and (when needed) should be derived from the hex tokens below, not copied from the PDF.

### 4.1 Print Swatches (Reference Only)

- If you need Pantone/CMYK for print assets, consult `reference/UI Reference/ubc_colour_guide_august_2025.pdf` directly.
- Do not use PDF swatch tables as web implementation guidance for this project.

### 4.2 Hex Token Set (Source of Truth)

| Token | Hex | Usage |
|---|---|---|
| `--ubc-video-blue` | `#001328` | Primary “ink” / deepest anchor |
| `--ubc-navy` | `#000847` | Nav bar / deepest surfaces (dark theme) |
| `--ubc-blue-700` | `#0052F5` | Primary actions / emphasis |
| `--ubc-blue-600` | `#00A2FA` | Secondary emphasis / interactive |
| `--ubc-blue-500` | `#33E0FC` | Focus ring / highlight |
| `--ubc-blue-300` | `#5CE5FC` | Soft accent / glow |
| `--ubc-blue-200` | `#7AF2F7` | Softer accent tint |
| `--ubc-blue-100` | `#9EFAF2` | Lightest accent tint |
| `--ubc-earth` | `#878343` | Rare warm accent only |
| `--ink-100` | `#E6EDF8` | Light theme background / dark theme primary text |
| `--ink-70` | `#A9B6CC` | Secondary text (dark) / muted UI (light) |
| `--ink-45` | `#6E7C95` | Labels/meta text |

Notes:
- `#001328` corresponds to `RGB(0, 19, 40)` (UBC Video Blue).
- Do not introduce off-brand purple/pink as a default accent.

### 4.3 Theme Guidance (Phase 4)

Theme switching is implemented by swapping **semantic** tokens (shadcn tokens) in `frontend/src/app/globals.css`:
- `:root` = **light theme** semantic tokens
- `.dark` = **tonal dark theme** semantic tokens

Brand tokens (`--ubc-*`, `--ink-*`) remain constant across themes; only the semantic mapping changes.

**Light theme rules (default):**
- Background uses `--ink-100` (cool-tinted off-white); cards can be `white` or a slightly brighter tint of `--ink-100`.
- Text/headers use `--ubc-video-blue` for maximum contrast without harsh black.
- Primary actions use `--ubc-blue-700`; focus ring uses `--ubc-blue-500`.

**Tonal dark theme rules:**
- Background uses a deep blue tone (typically `--ubc-video-blue` or `--ubc-navy`); cards are a slightly lighter tone of the same hue family.
- Text uses `--ink-100`; muted text uses `--ink-70`.
- Accents remain the same hue family as the light theme (UBC blues), but avoid “neon on black” by keeping chroma controlled in semantic token mapping.

## 5) Typography

### 5.1 Font Families

- Primary UI font: `JetBrains Mono`.
- Fallback stack: `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `Liberation Mono`, `Courier New`, monospace.
- This repo maps both `font-sans` and `font-mono` to the JetBrains Mono stack for full UI consistency.

### 5.2 Type Scale and Weight

- H1: 36/44, 700
- H2: 28/36, 700
- H3: 22/30, 600
- Body: 16/24, 400-500
- Small/meta: 12/16, 500-600, uppercase tracking allowed for labels

Rules:
- Keep headings concise and high-contrast.
- Use weight/size/tracking (not family changes) to establish hierarchy.
- Avoid compressed text blocks; preserve breathing room.

## 6) Layout, Spacing, Shape

- Grid: 8px base rhythm.
- Max content width: 1200-1280px.
- Section vertical spacing: 48-96px depending on density.
- Card radius: 16-24px.
- Control radius: 10-16px.
- Border style: 1px low-contrast border (light: `--ubc-video-blue` at ~8–14% alpha; dark: `white` at ~8–14% alpha).
- Preferred card treatment: soft gradient + low-opacity border + subtle backdrop blur.

## 7) Component Language

- Top app bar: compact, high-information, sticky allowed.
- Hero/action zone: single dominant action per screen.
- Metric cards: compact, aligned label/value hierarchy, consistent icon sizing.
- Activity/data list: low-noise rows, clear separators, muted timestamps.
- Forms: high legibility, obvious focus state, clear required/invalid states.

## 8) Motion and Interaction

> For imperative/sequenced animation beyond CSS, see [animejs.md](animejs.md).

- Keep transitions 150-300ms.
- Use opacity/translate/scale lightly; avoid bouncy motion.
- Hover: slightly brighter surface + subtle elevation.
- Focus: visible ring in `--ubc-blue-500` or `--ubc-blue-300`.
- Respect `prefers-reduced-motion`.

## 9) Accessibility Baseline

- Body text contrast: target WCAG AA minimum.
- Never encode state with color alone.
- Keyboard navigation must be complete for task flows.
- Inputs and buttons need visible focus and disabled states.

## 10) Agent Implementation Rules

When asked to build/update a frontend page:

1. Start from this style guide for tokens, typography, spacing, and component feel.
2. Use user-provided page references only for structure/intent, not literal cloning.
3. Reuse existing project components before creating new ones.
4. Keep visual language consistent between RA and participant pages.
5. If a requested reference conflicts with this guide, follow user direction but preserve core tokens and type system.

## 11) shadcn/ui Usage

- Use `docs/shadcn.md` as the implementation guide for adding and composing shadcn components in this repo.
- Keep shadcn semantic tokens (`bg-background`, `text-foreground`, `border-border`, `ring-ring`) aligned to this style guide's UBC-based token direction.
- Prefer token-level updates in `frontend/src/app/globals.css` over scattered per-component color overrides.

## 12) Quick CSS Token Seed

```css
:root {
  --ubc-video-blue: #001328;
  --ubc-navy: #000847;
  --ubc-blue-700: #0052f5;
  --ubc-blue-600: #00a2fa;
  --ubc-blue-500: #33e0fc;
  --ubc-blue-300: #5ce5fc;
  --ubc-blue-200: #7af2f7;
  --ubc-blue-100: #9efaf2;
  --ubc-earth: #878343;
  --ink-100: #e6edf8;
  --ink-70: #a9b6cc;
  --ink-45: #6e7c95;
}
```

This token block is a starter; treat these hex values as canonical and map shadcn semantic tokens to them per theme.
