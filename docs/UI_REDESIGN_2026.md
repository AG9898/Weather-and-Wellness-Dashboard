# UI/UX Overhaul — Weather & Wellness Research Platform (2026)

> **Status:** Approved for implementation — March 2026
> **Scope:** RA-facing dashboard and shared design system
> **Out of scope:** Participant session pages, login page, backend

---

## 1. Audit Findings

### 1.1 Light Mode — Core Problem: "Blue Soup"

The pre-overhaul light mode mapped all semantic surface tokens to the same cool-blue hue family:

| Token | Old Value | Problem |
|-------|-----------|---------|
| `--background` | `#e6edf8` | Heavily chromatic blue — not a neutral canvas |
| `--card` | `#f7fafe` | Only marginally lighter than background — no surface separation |
| `--primary` | `#0052f5` | Electric cobalt on blue surfaces feels neon, not intentional |
| `--muted-foreground` | `#6e7c95` | ~4.4:1 contrast on `#f7fafe` — barely AA, feels washed out |
| `--ring` | `#33e0fc` | Neon cyan focus ring — too electric for light mode |

The result: a monochromatic blue wash where the primary action button "glares" (it's the only saturated element in a desaturated blue field) and body text reads as low-contrast. The eye has nowhere to rest.

### 1.2 Dark Mode — Works Well

Dark mode (`--background: #001328`) gives the UBC blues proper canvas contrast. The blues read as intentional signals against the deep navy. No structural changes needed here.

### 1.3 Navigation Architecture

`RANavBar.tsx` is defined but not used. The layout renders `RAFloatingChrome.tsx` exclusively — a macOS-dock-inspired floating navigation with:
- Fixed utility button (top-left, 48px) — opens popover for Theme + Sign Out
- Bottom floating dock with spring-physics scaling on hover
- Auto-hide on scroll-down, auto-return on scroll-up

This pattern is creative, distinctive, and works well for a focused research tool used on tablets/desktops. **It is preserved** in the overhaul.

**Problems found:**
- Active dock item has no visible state indicator — only proximity scaling (invisible unless you know to hover)
- Fixed utility button partially overlaps page content headings (no top clearance in `PageContainer`)

### 1.4 Card Elevation Model

Pre-overhaul: cards defined by border only (`border border-border`). With very subtle borders on blue-tinted cards against a blue-tinted background, the card boundaries are visually weak.

### 1.5 Typography

JetBrains Mono for all UI text — intentional and distinctive for a research tool. **Preserved.**
Issues: eyebrow label patterns slightly inconsistent across pages; some body descriptions missing `leading-relaxed`.

### 1.6 Empty States

The Misokinesia statistics section showed bare placeholder text with no visual design. Analytics section already had a styled empty state notice.

---

## 2. Design Principles

**Neutral canvas, intentional accent.** The UBC blues are strong, distinctive brand colors. They don't need to change — the surfaces around them need to become more neutral so the blues read as purposeful signals rather than ambient noise.

**Elevation through shadow, not just border.** Cards should feel like lifted surfaces. Shadows provide depth cues that borders alone cannot. Light mode particularly benefits from this — borders disappear on low-contrast backgrounds.

**Contrast hierarchy.** Primary text (headings, data values) should be near-black. Secondary text (descriptions, labels) should pass WCAG AA comfortably (~6:1) with clear visual separation from primary. The current design collapsed this distinction.

**Keep the creative decisions.** The floating dock, spring animations, scrollbar raindrop effect, and JetBrains Mono stack are all deliberate and distinctive choices. The overhaul refines execution, it does not replace the design language.

---

## 3. Color System — Revised

### 3.1 Brand Tokens (Unchanged)

Brand tokens (`--ubc-*`, `--ink-*`) are **not modified**. They remain the source of truth for the palette.

```css
--ubc-video-blue: #001328;
--ubc-navy:       #000847;
--ubc-blue-700:   #0052f5;
--ubc-blue-600:   #00a2fa;
--ubc-blue-500:   #33e0fc;
--ubc-blue-300:   #5ce5fc;
--ubc-blue-200:   #7af2f7;
--ubc-blue-100:   #9efaf2;
--ubc-earth:      #878343;
--ink-100:        #e6edf8;
--ink-70:         #a9b6cc;
--ink-45:         #6e7c95;
```

### 3.2 Light Mode Semantic Tokens — Before vs After

| Token | Before | After | Rationale |
|-------|--------|-------|-----------|
| `--background` | `#e6edf8` | `#f1f4f8` | Lighter, far less chromatic — neutral canvas |
| `--card` | `#f7fafe` | `#ffffff` | Pure white — clear surface separation from background |
| `--card-foreground` | `#001328` | `#0b1829` | Warmer charcoal, same visual weight |
| `--foreground` | `#001328` | `#0b1829` | Same as card-foreground |
| `--popover` | `#ffffff` | `#ffffff` | Unchanged |
| `--popover-foreground` | `#001328` | `#0b1829` | Warmer |
| `--primary` | `#0052f5` | `#0052f5` | **Unchanged** — looks much better on white canvas |
| `--secondary` | `#dfe9f8` | `#e8edf9` | Slightly lighter |
| `--secondary-foreground` | `#001328` | `#0b1829` | Warmer |
| `--muted` | `#edf3fb` | `#f5f7fb` | Lighter |
| `--muted-foreground` | `#6e7c95` | `#536078` | Darker — ~6.3:1 on white, clear WCAG AA |
| `--accent` | `#d7eefc` | `#dce9fb` | Slight hue shift, kept similar |
| `--accent-foreground` | `#001328` | `#0b1829` | Warmer |
| `--border` | `rgb(0 19 40 / 12%)` | `rgb(11 24 41 / 9%)` | Slightly warmer, slightly lighter |
| `--input` | `rgb(0 19 40 / 10%)` | `rgb(11 24 41 / 7%)` | Lighter input backgrounds |
| `--ring` | `#33e0fc` | `#0052f5` | Primary blue ring — not neon cyan |
| `--sidebar` | `#f7fafe` | `#ffffff` | Matches new card white |

### 3.3 New Elevation Tokens

```css
--shadow-card:   0 1px 3px rgb(0 0 0 / 5%), 0 1px 2px rgb(0 0 0 / 4%);
--shadow-raised: 0 4px 16px rgb(0 0 0 / 7%), 0 2px 4px rgb(0 0 0 / 4%);
```

- `--shadow-card`: default card elevation (most surfaces)
- `--shadow-raised`: hero/primary action cards (slightly more prominent)

### 3.4 Dark Mode Changes (Minimal)

| Token | Before | After | Rationale |
|-------|--------|-------|-----------|
| `--card-foreground` | `#e6edf8` | `#e2e8f4` | Marginally warmer |
| `--foreground` | `#e6edf8` | `#e2e8f4` | Consistent with card-foreground |
| `--popover-foreground` | `#e6edf8` | `#e2e8f4` | Consistent |
| `--ring` | `#5ce5fc` | `#00a2fa` | Matches dark primary — more expected |
| `--muted-foreground` | `#a9b6cc` | `#8fa0b8` | Slightly darker for better body text contrast |

---

## 4. Elevation Model

Cards use shadow + border (not border alone):

```
Level 0: page background      bg-background, no shadow
Level 1: standard card         bg-card, shadow-[var(--shadow-card)], border border-border
Level 2: hero / raised card    bg-card, shadow-[var(--shadow-raised)], border border-border
Level 3: popovers/dropdowns    existing shadow-lg treatment (unchanged)
```

The hero card on Dashboard and Misokinesia pages uses Level 2; data cards (Weather, Analytics, Statistics) use Level 1.

---

## 5. Navigation Chrome

### 5.1 Floating Dock — Active State

Active dock items now receive a visible background tint:
```tsx
// active item:
"bg-primary/10 text-foreground border-primary/20"
// inactive item:
"text-muted-foreground hover:bg-accent/75 hover:text-foreground"
```

The `bg-primary/10` (10% opacity blue fill) provides an immediate visual cue for the current page without being heavy or dominating the icon.

### 5.2 Content Clearance

`PageContainer.tsx` gains top clearance to prevent the fixed utility button (64px from top of viewport) from overlapping page headings:

```tsx
// RA pages (floating chrome active): pt-16 sm:pt-20
// Non-RA pages: py-8 (unchanged)
```

A `floatingChrome` prop is added to `PageContainer` to opt into the top clearance. The RA pages that use `PageContainer` pass this prop.

---

## 6. Typography Canonical Patterns

All RA pages standardize to:

**Eyebrow label:**
```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
```

**Page heading (H1):**
```tsx
<h1 className="text-3xl font-bold leading-tight text-foreground">
```

**Body description:**
```tsx
<p className="text-sm leading-relaxed text-muted-foreground">
```

**Section heading (within card):**
```tsx
<h2 className="text-xl font-bold text-foreground">
```

---

## 7. Empty State Pattern

For sections with no data (e.g. Misokinesia statistics):

```tsx
<div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
  <div className="rounded-full bg-muted p-3">
    <Icon className="size-5 text-muted-foreground" />
  </div>
  <div className="space-y-1">
    <p className="text-sm font-medium text-foreground">No data yet</p>
    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
      Descriptive context sentence.
    </p>
  </div>
</div>
```

---

## 8. What Did Not Change

| Element | Status | Reason |
|---------|--------|--------|
| Login page | Unchanged | Dark mode hero works excellently as-is |
| JetBrains Mono typography | Unchanged | Intentional, distinctive research-tool voice |
| Floating dock concept | Unchanged | Creative, functional, worth keeping |
| Scrollbar raindrop animation | Unchanged | Signature design detail |
| UBC brand tokens | Unchanged | Source-of-truth hex values |
| Dark mode (mostly) | Minor ring + text warmth | Dark mode had no fundamental contrast problems |
| Highcharts integration | Unchanged | Derives colors from semantic tokens automatically |
| Participant session pages | Out of scope | Separate concern, not RA-facing |

---

## 9. File Change Index

| File | Type of Change |
|------|---------------|
| `frontend/src/app/globals.css` | Light + dark mode token overhaul, elevation variables |
| `frontend/src/lib/components/PageContainer.tsx` | `floatingChrome` prop for top clearance |
| `frontend/src/lib/components/RAFloatingChrome.tsx` | Active item visual indicator |
| `frontend/src/app/(ra)/dashboard/page.tsx` | Shadow elevation on cards |
| `frontend/src/app/(ra)/misokinesia/page.tsx` | Shadow elevation, styled empty state |
| `frontend/src/app/(ra)/import-export/page.tsx` | Shadow elevation, top clearance prop |
| `docs/styleguide.md` | Updated sections 3, 4.3, 6, 13 |
