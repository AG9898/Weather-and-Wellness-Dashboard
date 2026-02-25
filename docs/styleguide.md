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
- Keep only the vibe: dark, calm, data-oriented, modern lab interface.
- Omit decorative components that are not part of the product requirements.

## 3) Visual Direction (Target Vibe)

- Dark, atmospheric background with layered depth (not flat black).
- Glass-like surfaces for cards/panels with subtle borders and blur.
- Quiet, high-contrast typography tuned for long-form task flow.
- Minimal, deliberate motion; no excessive animation.
- Clinical/research tone over marketing tone.

## 4) Brand Tokens (UBC-Based)

The PDF is print-first and mostly CMYK/Pantone. Values below are extracted from the PDF.
For web implementation, use the web token set and keep the relative hue order.

### 4.1 Official Swatches Found in PDF

| Swatch | Source value in PDF |
|---|---|
| `UBC Video Blue` | `RGB(0, 19, 40)` |
| `PANTONE 282 C` | `CMYK(100, 90, 13, 68)` |
| `PANTONE 2935 C` | `CMYK(100, 68, 4, 0)` |
| `PANTONE 3005 C` | `CMYK(100, 35, 0, 2)` |
| `PANTONE 2995 C` | `CMYK(80, 12, 1, 0)` |
| `PANTONE 298 C` | `CMYK(64, 10, 1, 0)` |
| `PANTONE 297 C` | `CMYK(52, 5, 3, 0)` |
| `PANTONE 2975 C` | `CMYK(38, 2, 5, 0)` |
| `PANTONE 8383 C` | `CMYK(34, 36, 67, 20)` |

### 4.2 Web Token Set (Use in Frontend)

| Token | Hex | Usage |
|---|---|---|
| `--ubc-video-blue` | `#001328` | Global dark background anchor |
| `--ubc-navy` | `#000847` | Deepest surfaces/nav |
| `--ubc-blue-700` | `#0052F5` | Primary action emphasis |
| `--ubc-blue-600` | `#00A2FA` | Secondary action/interactive hover |
| `--ubc-blue-500` | `#33E0FC` | Data highlights, selected states |
| `--ubc-blue-300` | `#5CE5FC` | Subtle accents |
| `--ubc-blue-200` | `#7AF2F7` | Soft glow/surface tint |
| `--ubc-blue-100` | `#9EFAF2` | Lightest accent tint |
| `--ubc-earth` | `#878343` | Rare warm accent only |
| `--ink-100` | `#E6EDF8` | Primary text on dark |
| `--ink-70` | `#A9B6CC` | Secondary text |
| `--ink-45` | `#6E7C95` | Labels/meta text |

Notes:
- `#001328` is exact from PDF metadata (`UBC Video Blue`).
- Other hex values are web approximations derived from the PDF swatches.
- Do not introduce off-brand purple/pink as a default accent.

## 5) Typography

### 5.1 Font Families

- Primary UI font: `Whitney Salishan` (PDF source family: Book/Medium/MediumItalic/Semibold/Bold).
- Fallback stack (if Whitney unavailable): `Inter`, `Segoe UI`, `Helvetica Neue`, `Arial`, sans-serif.
- Numeric/meta font: `JetBrains Mono`, `SFMono-Regular`, `Menlo`, monospace.

### 5.2 Type Scale and Weight

- H1: 36/44, 700
- H2: 28/36, 700
- H3: 22/30, 600
- Body: 16/24, 400-500
- Small/meta: 12/16, 500-600, uppercase tracking allowed for labels

Rules:
- Keep headings concise and high-contrast.
- Use mono only for IDs, counts, telemetry, and timestamps.
- Avoid compressed text blocks; preserve breathing room.

## 6) Layout, Spacing, Shape

- Grid: 8px base rhythm.
- Max content width: 1200-1280px.
- Section vertical spacing: 48-96px depending on density.
- Card radius: 16-24px.
- Control radius: 10-16px.
- Border style: 1px low-contrast border (`white/8-14%` equivalent).
- Preferred card treatment: soft gradient + low-opacity border + subtle backdrop blur.

## 7) Component Language

- Top app bar: compact, high-information, sticky allowed.
- Hero/action zone: single dominant action per screen.
- Metric cards: compact, aligned label/value hierarchy, consistent icon sizing.
- Activity/data list: low-noise rows, clear separators, muted timestamps.
- Forms: high legibility, obvious focus state, clear required/invalid states.

## 8) Motion and Interaction

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

This token block is a starter; adapt naming to the local design-token system if one already exists.
