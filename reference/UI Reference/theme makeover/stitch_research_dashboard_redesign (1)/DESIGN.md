# Design System Document: Precision Austerity

## 1. Overview & Creative North Star
**Creative North Star: The Silent Observer**

This design system is a rejection of the "consumerized" web. It moves away from the rounded, glowing, and vibrant trends of modern SaaS to embrace the quiet authority of a high-end scientific journal. It is built on the principle of **Precision Austerity**: every pixel must justify its existence. 

The aesthetic is intellectual, cold, and meticulously organized. By utilizing radical 0px border radii and an absolute prohibition of borders and glassmorphism, we create a "Paper & Stone" digital environment. Depth is not simulated with light and shadow, but through the intellectual layering of tonal values—mimicking the way a researcher might stack monochromatic obsidian plates.

## 2. Colors & Tonal Depth

### The "No-Line" Rule
Traditional UI relies on borders to define space. This system forbids them. Boundaries must be defined solely through background color shifts. If two elements touch, their distinction comes from the jump between `surface` (#10141a) and `surface_container` (#1c2026). If you cannot distinguish two sections, increase the breathing room (using the Spacing Scale) rather than adding a line.

### Surface Hierarchy & Nesting
Depth is achieved through a "Recessive Layering" model. Instead of elements popping "out" toward the user, we treat the screen as a carved surface where information is nested "into" the interface.

- **Base Layer:** `surface` (#10141a) – The infinite void of the research environment.
- **Primary Workspaces:** `surface_container_low` (#181c22) – Large, breathable areas for data visualization.
- **Interactive Nodes:** `surface_container_high` (#262a31) – Smaller modules or active selection states.
- **Accents:** `primary_container` (#58a6ff) – Used sparingly for data peaks, active cursors, or critical callouts.

### Signature Textures
While we avoid "glow," we utilize **Tonal Bleed**. When a primary action is required, use a subtle linear gradient from `primary` (#a2c9ff) to `primary_container` (#58a6ff) at a 45-degree angle. This provides a "machined metal" finish rather than a digital neon glow.

## 3. Typography: The Editorial Mix
The system relies on the friction between the humanistic **Newsreader** (Serif) and the technical **Space Grotesk** (Mono-style) to convey "Validated Intelligence."

- **The Display Scale (Newsreader):** Use `display-lg` and `headline-lg` in thin weights for section titles. These should feel like the masthead of a prestigious journal—large, airy, and evocative.
- **The Data Scale (Space Grotesk):** Use `label-md` and `label-sm` for all technical readouts. **Crucial:** All labels must be set to `text-transform: uppercase` with a letter-spacing of `0.05em` to achieve the "Small-Caps" scientific look.
- **The Narrative Scale (Inter):** Use `body-md` for descriptions. Inter provides a neutral, high-legibility bridge between the editorial serif and the technical mono.

## 4. Elevation & Depth: Tonal Layering
We do not use shadows. We do not use glass. We use **Contrast Ratios**.

- **The Layering Principle:** To lift a card, do not add a shadow. Instead, place a `surface_container_highest` (#31353c) element onto a `surface` (#10141a) background. The sharp contrast of the values creates a "hard" elevation that feels structural.
- **The "Ghost Border" Fallback:** In rare accessibility cases where a boundary is invisible (e.g., a dark image on a dark background), use a 1px "Ghost Border" using `outline_variant` at 15% opacity. This is a last resort.
- **Intentional Asymmetry:** Break the grid. Align a large `display-lg` heading to the far left, while the corresponding data modules sit on a 1/3rd column to the right. This "editorial" use of negative space prevents the UI from looking like a standard dashboard.

## 5. Components

### Buttons
- **Primary:** Sharp 0px corners. Background: `primary_container`. Text: `on_primary_container` (Space Grotesk, Uppercase). 
- **Secondary:** No background. Text: `primary`. On hover, shift background to `surface_container_low`.
- **Tertiary:** `label-sm` typography with a thin `primary` underline (2px offset).

### Input Fields
- **State:** No boxes. Inputs are defined by a `surface_container_lowest` background and a 1px bottom-bar using `primary_container`.
- **Typography:** User input should always be in `Space Grotesk` to distinguish "System Data" from "User Entry."

### Data Modules (Cards)
- **Structure:** No borders, no shadows. Use `surface_container` for the module body. 
- **Separation:** Forbid the use of divider lines. Use `1.4rem` (Spacing 4) of vertical white space to separate content blocks within a module.

### Chips & Tags
- **Style:** Rectangular, 0px radius. Background: `surface_container_highest`. 
- **Text:** `label-sm` (Space Grotesk), Uppercase.

## 6. Do's and Don'ts

### Do:
- **Use "Averaged" Spacing:** Use large gaps (Spacing 16 or 20) between major editorial sections to let the serif typography breathe.
- **Embrace Sharpness:** Every corner must be `0px`. Roundness suggests "friendly"; this system is "authoritative."
- **Use Color as a Scalar:** Use `primary` (#a2c9ff) only for functional data points. If everything is blue, nothing is important.

### Don't:
- **Don't use Shadows:** Even a 1% opacity shadow breaks the "Austerity" of the system.
- **Don't use Center-Alignment:** High-end editorial design almost exclusively uses left-aligned typography or intentional "staggered" layouts.
- **Don't use Dividers:** If you feel the need for a line, you haven't used enough white space or a strong enough tonal shift.