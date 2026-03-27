# Design System Documentation: The Observational Luminary

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Observational Luminary."** This is not a standard dashboard; it is a cinematic window into complex data. The system moves away from the "boxed-in" utility of traditional SaaS and toward a high-end editorial experience. 

By leveraging **intentional asymmetry**, we break the rigid grid to guide the eye toward critical insights. Elements should feel like they are floating in a deep, atmospheric void, organized by light and tonal depth rather than structural lines. This system prioritizes "breathing room" (negative space) and sophisticated typography to elevate technical research into a premium visual narrative.

---

## 2. Colors & Atmospheric Depth
The palette is rooted in the deep charcoal and navy of a midnight sky, punctuated by the high-energy glow of electric blue and cyan.

### The "No-Line" Rule
**Strict Prohibition:** 1px solid borders are forbidden for sectioning or containment. 
Boundaries must be defined through:
- **Tonal Shifts:** Placing a `surface_container_low` element against a `surface` background.
- **Luminescent Transitions:** Using subtle gradients to suggest an edge.
- **Negative Space:** Utilizing the Spacing Scale (e.g., `spacing.12` or `spacing.16`) to create mental groupings.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the Material tiers to create "stacked" importance:
- **Base Layer:** `surface` (#0e1419) – The infinite void.
- **Sectioning:** `surface_container_low` (#161c21) – For large grouping areas.
- **Interaction/Cards:** `surface_container_high` (#252b30) – To bring data "closer" to the user.

### The Glass & Gradient Rule
For floating panels or navigation overlays, utilize **Glassmorphism**:
- **Background:** `surface_variant` (#2f353b) at 60% opacity.
- **Effect:** `backdrop-filter: blur(20px)`.
- **Signature Texture:** Primary CTAs should use a linear gradient from `primary` (#adc6ff) to `primary_container` (#4b8eff) at a 135-degree angle to provide a "lit-from-within" glow.

---

## 3. Typography
Typography is the voice of the system. It must feel authoritative yet graceful.

*   **Display & Headline (Manrope):** Use `display-lg` for hero moments and radical data-art headlines. These should feel oversized and cinematic.
*   **Body & UI (Manrope):** `body-md` and `body-lg` are used for all narrative and interface text. Manrope’s geometric yet warm proportions ensure readability in dark mode.
*   **Technical Data (Space Grotesk - Monospace):** All `label-md` and `label-sm` technical readouts, coordinates, and timestamps must use Space Grotesk. This creates a functional contrast between "Human Insight" (Manrope) and "System Data" (Space Grotesk).

---

## 4. Elevation & Depth
In this design system, elevation is an atmospheric property, not a shadow effect.

*   **The Layering Principle:** Depth is achieved by stacking. A `surface_container_lowest` card placed on a `surface_container_low` background creates a "sunken" or "carved" look, while the reverse creates a "lifted" look.
*   **Ambient Shadows:** If an element must float (e.g., a dropdown or modal), use an ultra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4)`. The shadow color should never be pure black; it should be a deep navy tint derived from the background.
*   **The "Ghost Border" Fallback:** For high-density data where separation is critical, use a "Ghost Border": `outline_variant` (#414755) at **15% opacity**. This provides a hint of structure without breaking the cinematic immersion.
*   **Glow States:** Instead of high-contrast hover states, use an outer glow (`drop-shadow`) using the `primary` color at 20% opacity to simulate light emission.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`), `rounded-md` (0.375rem). No border. Text color: `on_primary`.
- **Secondary:** Surface-glass fill (`surface_variant` at 40% opacity) with a "Ghost Border."
- **Tertiary:** Ghost button. Only text in `primary` color, with a subtle glow on hover.

### Cards & Data Modules
- **Rule:** No divider lines. Separate content using `spacing.5` (1.7rem) vertical gaps.
- **Styling:** Use `surface_container_low` for the base and `surface_container_high` for internal nested elements (like a code snippet box within a research card).

### Input Fields
- **Base State:** `surface_container_highest` background, `rounded-sm`.
- **Focus State:** Background remains the same, but the "Ghost Border" increases in opacity to 40%, and a 2px `primary` glow is applied to the bottom edge only.

### Technical Chips
- **Selection:** Small, `rounded-full` pills. Use `secondary_container` for the background and `on_secondary_container` for the text. Use Space Grotesk for the font.

### Progress & Particle Loaders
- Eschew standard circular loaders. Use a "Particle Field" animation—tiny cyan pixels (`primary_fixed_dim`) that coalesce into a line as data loads.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `primary` and `tertiary` (electric blue and orange-tinted accents) sparingly to draw attention to "Anomalies" or "Insights."
- **Do** use asymmetric layouts. If a dashboard has three columns, make them 20% / 50% / 30% to create an editorial feel.
- **Do** ensure all typography has a line-height of at least 1.5x for body text to maintain the "premium" feel.

### Don't
- **Don't** use 100% white (#ffffff). Use `on_surface` (#dde3ea) for text to prevent eye strain and maintain the atmospheric mood.
- **Don't** use standard Material icons in circles. Use thin-stroke (1px) custom icons that feel architectural and light.
- **Don't** use sharp corners. Use the `roundedness.md` (0.375rem) as the standard to soften the technical edge of the data.
- **Don't** use high-contrast dividers. If a visual break is needed, use a `spacing.px` height line with a gradient that fades to 0% opacity at both ends.