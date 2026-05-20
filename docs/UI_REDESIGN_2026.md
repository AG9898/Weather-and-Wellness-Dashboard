# UI Redesign 2026 — Historical Editorial Dashboard Notes

> **Status:** Historical reference only
> **Current baseline:** The 2026 semantic theme re-tone is already implemented in the app
> **Canonical UI guide:** `docs/styleguide.md`
> **Do not use this file for active implementation tasks.**

This file is retained only as historical context for the earlier editorial dashboard exploration.
Current UI direction, token rules, light/dark theme guidance, and quiet editorial patterns live in
`docs/styleguide.md`. Agents should start from `docs/styleguide.md` and the relevant lab design
spec instead of using this document as a second UI guide.

---

## 1. Purpose

The previous 2026 UI work largely completed the platform theme reset:

- normalized light/dark semantic tokens,
- removed the bright-blue chrome problem,
- re-toned auth surfaces,
- and moved shared UI closer to `primary` / `ring` semantic usage.

That work changed the **palette system** but not the **layout language**.

This document defines the next step: shift the RA dashboard from a stacked utility page into a more intentional, dashboard-centered research workspace with a stronger editorial feel.

The reference material in `reference/UI Reference/theme makeover/` is used here for:

- compositional inspiration,
- hierarchy,
- pacing,
- asymmetry,
- atmosphere,
- and section framing.

It is **not** a cloning target and its code is **not** a source of truth.

---

## 2. Direction

### 2.1 Creative Target

The desired direction is a **hybrid editorial dashboard**:

- more distinctly dashboard-centered than the current page,
- more artistic in composition,
- more research-workspace than admin utility,
- still clinical, credible, and data-first.

This is not a cinematic marketing landing page. It is a lab operations surface with stronger visual authorship.

### 2.2 What Should Feel Different

The current dashboard mostly reads as:

- a hero action card,
- followed by a weather card,
- followed by an analytics card,
- inside a generic shared shell.

The redesigned dashboard should instead feel like:

- a single composed workspace,
- with one dominant data canvas,
- one clear structural hierarchy,
- supporting secondary regions,
- and a stronger sense of narrative flow across the page.

### 2.3 Desired User Impression

When an RA lands on `/dashboard`, the page should feel:

- like the central operating surface for the lab,
- quieter and more deliberate,
- more analytical,
- more premium,
- and less like stacked shadcn cards.

The first read should be:

1. what this lab is monitoring right now,
2. what the primary action is,
3. where the live or recent data sits,
4. where secondary lab actions and context live.

---

## 3. Reference Interpretation

The useful lessons from `reference/UI Reference/theme makeover/` are:

- large editorial headings and stronger sectional hierarchy,
- asymmetrical composition,
- a dominant central workspace,
- companion rails or supporting modules,
- quieter chrome,
- atmosphere created by tone, spacing, and depth instead of many colors,
- and a more composed relationship between narrative context and data.

The project should **not** inherit directly from the references:

- hard sci-fi naming,
- fictional telemetry styling,
- copied rail layouts,
- copied tables/charts,
- or copied HTML/CSS structure.

The translation must stay grounded in the actual product:

- participant/session workflows,
- weather-linked dashboard content,
- lab-specific study needs,
- and RA operational tasks.

---

## 4. Platform-Wide Direction vs Lab-Specific Composition

This redesign must be scoped so that there is a **shared platform direction** without forcing every lab page into the same dashboard layout.

### 4.1 Shared Across Labs

All lab-specific pages should inherit the same overall design language:

- the same semantic token system,
- the same surface hierarchy,
- the same typography rules,
- the same motion rules,
- the same spacing rhythm,
- the same chrome principles,
- and the same dashboard composition vocabulary.

This shared direction should make the product feel like one platform.

### 4.2 Allowed to Vary By Lab

Each lab page may, and likely should, differ in:

- section order,
- module density,
- information priority,
- navigation composition,
- action placement,
- presence or absence of a side context rail,
- presence or absence of large data canvases,
- and the ratio between narrative, controls, and analysis.

Labs should be free to compose different page structures because their studies and workflows are not uniform.

### 4.3 Constraint

Labs may vary in **composition**, but not in **visual identity fundamentals**.

That means:

- no separate lab-specific palette systems,
- no unrelated accent colors,
- no unrelated typography systems,
- and no one-off page aesthetics that break platform coherence.

The platform should provide a **dashboard grammar**, not a single dashboard template.

---

## 5. Core Design Rules

### 5.1 Dashboard First, Card Stack Second

Pages in this redesign should be composed as dashboards first, not as vertical piles of isolated cards.

Preferred structure:

- masthead or editorial header,
- dominant workspace,
- supporting modules,
- quiet utility actions.

### 5.2 One Primary Workspace

Each lab dashboard page should have one visually dominant region.

Examples:

- a weather-analysis workspace,
- a study monitoring panel,
- a session activity surface,
- or a model/results workspace.

The page should not give equal weight to every module.

### 5.3 Intentional Asymmetry

Use asymmetry to improve hierarchy, not for novelty.

Good uses:

- wide main canvas + narrow context rail,
- large masthead + offset utility actions,
- strong left-aligned content blocks with staggered supporting modules.

Avoid symmetric three-card rows as the default composition language.

### 5.4 Atmosphere Through Tone, Not Noise

Art direction should come from:

- tonal layering,
- sectional rhythm,
- spacing,
- restrained gradients,
- background texture,
- and subtle depth.

It should not come from:

- many accent colors,
- loud borders,
- decorative icon clutter,
- or excessive glow.

### 5.5 Dashboard Chrome Should Support the Page

The dashboard route may use different RA chrome from the rest of the RA app if needed.

For this phase, dashboard chrome should become:

- quieter,
- more structural,
- less visually dominant than the page content,
- and more compatible with wide editorial composition.

---

## 6. Visual Draft

### 6.1 What the Dashboard Should Look Like

The target visual structure for the RA dashboard is:

- a tall editorial masthead instead of a boxed hero card,
- a primary action integrated into the masthead rather than isolated in a standalone panel,
- a wide data workspace below or adjacent to the masthead,
- a secondary rail or companion column for summary, context, undo/session actions, or lab notes,
- and stronger separation between primary and secondary content through space and tone rather than borders.

The weather and analytics regions should feel like parts of one coordinated research surface, not like unrelated modules.

### 6.2 Typography

For this phase, keep the repo's JetBrains Mono-led identity.

The new feel should therefore come mainly from:

- scale contrast,
- reduced visual clutter,
- calmer uppercase/meta usage,
- more breathing room,
- and clearer hierarchy between title, section kicker, body, and data labels.

### 6.3 Motion

Motion should remain restrained:

- staged reveal of major sections,
- subtle canvas/chart load-in,
- gentle emphasis on active modules,
- no ambient perpetual motion unless it is extremely low-noise.

---

## 7. Implementation Strategy

### 7.1 Replace the Role of This Document

This file replaces the old theme-retone plan as the active UI redesign document.

The theme retone should now be treated as completed background work, not the main roadmap.

### 7.2 Introduce Dashboard Composition Primitives

Frontend should gain reusable composition primitives rather than a single hard-coded dashboard layout.

Suggested primitives:

- `DashboardCanvas`
- `DashboardMasthead`
- `DashboardWorkspace`
- `DashboardContextRail`
- `DashboardMetricStrip`
- `DashboardSectionKicker`
- `DashboardQuietTable`
- `DashboardActionCluster`

These primitives should define layout language and hierarchy, not business logic.

### 7.3 Allow Dashboard-Specific RA Chrome

`/dashboard` should be allowed to diverge from the current floating dock shell if needed.

Recommended outcome:

- dashboard-specific top utility bar or restrained shell,
- optional dashboard rail only if the layout benefits from it,
- shared RA shell can remain for non-dashboard routes in this phase.

### 7.4 Recompose the Current Dashboard

The current dashboard should be rebuilt around:

- a masthead,
- a dominant weather/analytics workspace,
- integrated primary action,
- and a secondary region for auxiliary actions and summaries.

This should replace the current:

- hero box,
- weather card,
- analytics card

stacking model.

### 7.5 Add Lab Dashboard Profiles

Introduce a frontend configuration layer so each lab dashboard can choose composition without redefining the visual system.

Suggested types:

- `LabDashboardProfile`
- `LabDashboardSection`
- `DashboardModuleKind`
- `DashboardChromeMode`

A lab dashboard profile should control:

- title and kicker,
- section ordering,
- active modules,
- preferred composition mode,
- and available quick actions.

This stays frontend-only for this phase.

---

## 8. Initial Route Scope

### Included

- RA dashboard route
- dashboard-specific RA chrome on `/dashboard`
- shared dashboard primitives used by future lab dashboards

### Not Included Yet

- login page
- set-password page
- participant task flows
- participant completion pages
- broad restyling of all RA routes

---

## 9. Acceptance Criteria

This redesign phase is successful when:

- `/dashboard` no longer reads as a simple stack of independent cards,
- the dashboard has one dominant workspace and a clear supporting hierarchy,
- weather and analytics feel coordinated rather than adjacent,
- the dashboard chrome no longer competes with the page composition,
- at least two future lab dashboards can be described using the same composition primitives but different layouts,
- and the platform feels more authored without losing its research-tool credibility.

---

## 10. Explicit Non-Goals

This redesign does not aim to:

- copy the reference layouts,
- turn the product into a marketing site,
- introduce multiple accent systems,
- redesign every route at once,
- or let each lab invent an unrelated visual language.

The goal is a stronger platform dashboard direction with controlled, lab-specific layout flexibility.
