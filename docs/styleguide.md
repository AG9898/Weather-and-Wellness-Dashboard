# styleguide.md — UI Implementation Reference (CLI Agent)

> **Related docs:** [storybook.md](storybook.md) · [shadcn.md](shadcn.md) · [animejs.md](animejs.md)

Use this document as the canonical UI style reference for frontend implementation tasks.
It defines the shared look-and-feel across pages so individual page work stays consistent.
Do not use `docs/UI_REDESIGN_2026.md` as active implementation guidance; that file is historical.

## 1) Source References

- Layout and atmosphere reference (do not clone 1:1):
  - `reference/UI Reference/landingpage.html`
  - `reference/UI Reference/landingpage.png`
- Quiet editorial task/dashboard reference for the Misokinesia redesign (templates, not production code):
  - `reference/UI Reference/Claude Design/design_handoff_misokinesia_redesign/reference.html`
  - `reference/UI Reference/Claude Design/design_handoff_misokinesia_redesign/README.md`
- Brand palette and typography source:
  - `reference/UI Reference/ubc_colour_guide_august_2025.pdf`

## 2) Scope and Non-Goals

- This guide is for visual direction and token consistency, not component parity.
- Do not recreate the full `WeatherMind` landing page as-is.
- References are **inspiration only** (not 1:1 remakes).
- Keep the vibe: clean, calm, data-oriented, modern lab interface (research tool, not marketing).
- Omit decorative components that are not part of the product requirements.

## 3) Visual Direction (Target Vibe)

- Standardized light and dark themes built from neutral surface ramps.
- One branded UI accent only, anchored to `--ubc-video-blue` (`#001328`).
- Quiet, high-contrast typography tuned for long-form task flow.
- Minimal, deliberate motion; no excessive animation.
- Clinical/research tone over marketing tone.
- Editorial hierarchy should come from asymmetric composition, hairline dividers, compact metadata, and intentional whitespace rather than ambient glow effects or stacked decorative cards.

**Phase 4 (implemented):** System-default light/dark toggle is active (default = system).
- **Light theme (default):** uses the paper-toned semantic mapping in this document as the source of truth.
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
| `--ubc-video-blue` | `#001328` | Branded accent anchor |
| `--ubc-navy` | `#000847` | Reserved brand token |
| `--ubc-blue-700` | `#001328` | Legacy compatibility token, same accent anchor |
| `--ubc-blue-600` | `#11263A` | Tonal lift of the accent family |
| `--ubc-blue-500` | `#23415A` | Tonal lift of the accent family |
| `--ubc-blue-300` | `#506A81` | Tonal lift of the accent family |
| `--ubc-blue-200` | `#8E9EAF` | Tonal lift of the accent family |
| `--ubc-blue-100` | `#CFD7DE` | Tonal lift of the accent family |
| `--ubc-earth` | `#878343` | Rare warm accent only |
| `--ink-100` | `#E6EDF8` | Light theme background / dark theme primary text |
| `--ink-70` | `#A9B6CC` | Secondary text (dark) / muted UI (light) |
| `--ink-45` | `#6E7C95` | Labels/meta text |

Notes:
- `#001328` corresponds to `RGB(0, 19, 40)` (UBC Video Blue).
- Do not introduce off-brand purple/pink as a default accent.
- Do not treat `--ubc-blue-*` as separate branded UI accents; they exist to support tonal lifts and legacy component migration.

### 4.3 Theme Guidance (Phase 4)

Theme switching is implemented by swapping **semantic** tokens (shadcn tokens) in `frontend/src/app/globals.css`:
- `:root` = **light theme** semantic tokens
- `.dark` = **tonal dark theme** semantic tokens

Brand tokens (`--ubc-*`, `--ink-*`) remain constant across themes; only the semantic mapping changes.

**Light theme rules (default):**
- Background uses a warm paper canvas (`#fbfaf6`) rather than a cool gray canvas.
- Cards, popovers, and sidebars use white or near-white neutral surfaces.
- Text uses dark neutral ink.
- Primary actions use `--primary`, mapped to `#001328`.
- Focus rings use `--ring`, a tonal lift of the same hue family.
- `secondary`, `accent`, and `muted` stay neutral; they are not blue support fills.
- Borders and hairlines use a slightly stronger ink line (`rgb(24 33 43 / 16%)`) so white cards stay legible on the paper canvas.
- Question containers and grouped form rows may use `--fieldset-bg` for a subtle ink wash; do not hardcode one-off translucent fills.

**Dark theme rules:**
- Background uses a charcoal-neutral surface rather than a navy-heavy surface.
- Cards and overlays are slightly raised dark neutrals.
- Text uses a soft off-white neutral.
- `--primary` may be a tonal lift derived from `#001328` so primary actions remain contrast-safe.
- `secondary`, `accent`, and `muted` stay neutral in dark mode as well.

**Shared semantic additions:**
- `--brand-ink`: high-contrast brand heading ink. Light maps to `--ubc-video-blue`; dark maps to `#e6edf8`.
- `--brand-ink-soft`: secondary brand heading ink. Light maps to `--ubc-blue-500`; dark maps to `#cfd7de`.
- `--hairline`: a low-noise divider color. Light maps to `rgb(24 33 43 / 16%)`; dark maps to `rgb(255 255 255 / 12%)`.
- `--fieldset-bg`: subtle grouped-question surface. Light maps to `rgb(24 33 43 / 8%)`; dark maps to `color-mix(in srgb, white 3%, transparent)`.

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
- Border style: 1px low-contrast neutral border.
- Preferred card treatment: neutral surface, low-opacity border, restrained shadow, optional subtle blur where the page already uses glass treatment.

## 7) Component Language

- Top app bar: compact, high-information, sticky allowed.
- Hero/action zone: single dominant action per screen.
- Metric cards: compact, aligned label/value hierarchy, consistent icon sizing.
- Activity/data list: low-noise rows, clear separators, muted timestamps.
- Forms: high legibility, obvious focus state, clear required/invalid states.

### 7.1 Quiet Editorial Pattern

Use this pattern for task flows and operations pages that need more structure than a basic card stack:

- Start with a masthead or step indicator: small uppercase kicker, concise heading, one supporting sentence, and a hairline or progress element.
- Prefer white cards lifted on the paper canvas, separated rows, and fieldsets over nested cards.
- Use tabular metadata for counts, clip progress, pane numbers, timestamps, and response completion text.
- Chips and scale controls should be flat: neutral border + card fill when idle, `bg-primary text-primary-foreground` when selected, and border/text emphasis on hover.
- Avoid decorative ambient glows for new work. Use shadows, hairlines, and spacing for depth.
- Treat user-provided HTML/React design files as templates for layout and states; translate them into existing Next.js, Tailwind, shadcn, and lucide patterns.

## 8) Motion and Interaction

> For imperative/sequenced animation beyond CSS, see [animejs.md](animejs.md).

- Keep transitions 150-300ms.
- Use opacity/translate/scale lightly; avoid bouncy motion.
- Hover: slightly brighter surface + subtle elevation.
- Focus: visible ring in `--ring`; do not use cyan or unrelated highlight colors.
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
6. For isolated UI review and story expectations, follow `docs/storybook.md`.

## 11) shadcn/ui Usage

- Use `docs/shadcn.md` as the implementation guide for adding and composing shadcn components in this repo.
- Use `docs/storybook.md` when a reusable component or page section should be reviewed in isolation.
- Keep shadcn semantic tokens (`bg-background`, `text-foreground`, `border-border`, `ring-ring`) aligned to this style guide's UBC-based token direction.
- Prefer token-level updates in `frontend/src/app/globals.css` over scattered per-component color overrides.

## 12) Data Visualization / Highcharts

**Chart library:** Highcharts (`highcharts` + `highcharts-react-official`). Recharts has been removed from the project (T68).

**CSS variable theming:** Highcharts does not natively read CSS variables. Always resolve colors at component mount via:
```ts
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
```
Re-read on theme change by watching `document.documentElement.classList` (via `MutationObserver` or a `useEffect` dependency array). Never hardcode hex values directly in chart config — use the CSS variable reader so charts respect light/dark theme.

**Chart token assignments (weather chart):**

| Series | CSS Variable | Purpose |
|--------|-------------|---------|
| Temperature | `--chart-1` | Primary solid line (full opacity) |
| Precipitation | `--chart-2` | Secondary line (0.5 opacity) |
| Sunlight Hours | `--chart-3` | Tertiary line (0.5 opacity) |
| Grid lines | `--border` | CartesianGrid / xAxis / yAxis lines |
| Tick labels | `--muted-foreground` | Axis label text |
| Chart background | `transparent` | Inherits `var(--card)` from the parent card |

**Temperature summary histogram guidance:**
- Use a single Highcharts column series for 1°C `frequency_bins` in the active summary window.
- Overlay the selected window's mean temperature plus cold/hot threshold markers using `plotLines` and, when helpful, restrained `plotBands`.
- Treat threshold overlays as descriptive metadata from the temperature-summary payload, not as mixed-model outputs or general significance annotations.
- For histogram drilldown, use Highcharts point hover/click events to drive React state and render the interactive hover card or side panel outside the native tooltip.
- Do not rely on a clickable Highcharts HTML tooltip as the primary interaction surface for participant drilldown. Keep the tooltip informational or omit it when a richer React hover card is present.

**General chart rules:**
- `chart.backgroundColor: "transparent"` always — let the parent card surface show through.
- `credits.enabled: false` always.
- `legend.enabled: false` when custom toggle UI is provided above the chart.
- `tooltip.shared: true` for multi-series charts. Use `useHTML: true` for rich tooltip HTML; set `backgroundColor: "var(--card)"` so the tooltip inherits the card theme.
- `plotOptions.series.connectNulls: false` — do not interpolate across missing data points.
- Semi-transparent series (opacity 0.5) are used to visually subordinate secondary data series to the primary one.
- Keep chart colors restrained and distinct, but do not reuse them as general UI accent colors.
- **SSR guard:** Wrap `<HighchartsReact>` in a `mounted` state guard (`useState(false)` + `useEffect(() => setMounted(true), [])`) to prevent SSR/hydration errors since Highcharts requires `window`.
- **Tooltip `this` typing:** Highcharts 12 types `formatter` as `(this: Point) => string`. For shared tooltip access, cast: `const ctx = this as unknown as { points?: Point[]; x?: number }`.
- **Theme re-read pattern:** Use `MutationObserver` on `document.documentElement` with `attributeFilter: ["class"]` to detect theme class changes and call `setChartColors(readChartColors())` so charts re-theme without a page reload.

**Critical: keep `chartOptions` as the single source of truth for series data and visibility.**

`HighchartsReact` compares the `options` prop by reference (`===`). When the reference changes it calls `chart.update(newOptions, true, true)`, resetting every series to whatever is in `options.series[n].data`. This creates a dangerous race condition when data is managed imperatively:

- **Never put `data: []` in `chartOptions` and push data via `series.setData()`** — any state update that causes `chartOptions` to recompute (e.g. `setChartColors(readChartColors())` after a theme change) will create a new options reference, trigger `chart.update` with empty arrays, and wipe all series data before `setData()` can restore it.
- **Never use `series.setVisible()` as the primary visibility mechanism** — same race applies: a concurrent `chart.update` from a color re-sync will override it.
- **Do** include computed `data` arrays and `visible` booleans directly in the `chartOptions` `useMemo`, with all relevant state (`rangeItems`, `showTemp`, etc.) as deps. React's declarative render is the authority; Highcharts follows it.
- **Do** use imperative calls (`setData`, `setVisible`) only when you can guarantee no concurrent `chart.update` — which is rarely safe when color/theme state exists alongside data state.

## 13) Quick CSS Token Seed

```css
:root {
  --ubc-video-blue: #001328;
  --ubc-navy: #000847;
  --ubc-blue-700: #001328;
  --ubc-blue-600: #11263a;
  --ubc-blue-500: #23415a;
  --ubc-blue-300: #506a81;
  --ubc-blue-200: #8e9eaf;
  --ubc-blue-100: #cfd7de;
  --ubc-earth: #878343;
  --ink-100: #e6edf8;
  --ink-70: #a9b6cc;
  --ink-45: #6e7c95;
}
```

This token block is a starter; treat these hex values as canonical and map shadcn semantic tokens to a neutral light/dark system with `#001328` as the only branded UI accent family.

The light semantic mapping should use the current paper theme:

```css
:root {
  --background: #fbfaf6;
  --foreground: #18212b;
  --card: #ffffff;
  --muted: color-mix(in srgb, #fbfaf6 86%, var(--foreground) 6%);
  --muted-foreground: #5d6773;
  --border: rgb(24 33 43 / 16%);
  --hairline: rgb(24 33 43 / 16%);
  --primary: var(--ubc-video-blue);
  --primary-foreground: #f8fafc;
  --primary-hover: var(--ubc-blue-500);
  --ring: #36506b;
  --brand-ink: var(--ubc-video-blue);
  --brand-ink-soft: var(--ubc-blue-500);
  --fieldset-bg: rgb(24 33 43 / 8%);
}
```
