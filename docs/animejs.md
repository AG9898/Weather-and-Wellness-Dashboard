# animejs.md — Animation Library Reference

> **Related docs:** [styleguide.md](styleguide.md) (motion constraints) · [DESIGN_SPEC.md](DESIGN_SPEC.md) (UX intent) · [shadcn.md](shadcn.md) (component library)

Anime.js v4 is the chosen imperative animation library for this project. Use it for sequences, SVG drawings, text reveals, and any animation that CSS transitions cannot drive. For simple hover/focus transitions, keep using Tailwind utilities.

---

## 1. Compatibility

**Verdict: Highly compatible.**

| Axis | Detail |
|---|---|
| Framework | Works as vanilla JS inside any React `"use client"` component |
| Build tool | Next.js (webpack) — ESM imports work natively |
| TypeScript | Ships its own types; no `@types/animejs` needed |
| Package manager | `npm install animejs` |
| Bundle cost | ~10 KB full engine · ~3 KB WAAPI variant |
| SSR | DOM-free at import time — safe in Next.js; init inside `useEffect` |

Existing project assets that pair naturally with anime.js:

- **Lucide React icons** — render inline SVG; `createDrawable()` and `morphTo()` can animate them
- **`WeatherCard.tsx`** — entrance/reveal animations with `animate()`
- **`WeatherTrendChart.tsx`** — line-draw-on effect with `createDrawable()`
- **`SurveyForm.tsx`** — step-transition timelines with `createTimeline()`
- **Dashboard stat numbers** — numeric object property animation

**Alignment with style guide constraints** (see [styleguide.md §8](styleguide.md)):
- Keep `duration` 150–300 ms for UI transitions; reserve longer durations for data visualisations
- Use `ease: 'out(2)'` or `ease: 'inOut(2)'` as defaults — avoid bouncy spring easing in a clinical UI
- Always wrap animations in a `prefers-reduced-motion` guard (see React pattern below)

---

## 2. Installation

```bash
npm install animejs
```

### Import patterns

```ts
// Named imports — most common
import { animate, createTimeline, stagger } from 'animejs';

// SVG utilities — subpath or namespace
import { svg } from 'animejs';
import { morphTo, createDrawable, createMotionPath } from 'animejs/svg';

// Text splitting — subpath
import { splitText } from 'animejs';

// WAAPI variant (3 KB, hardware-accelerated, fewer features)
import { waapi } from 'animejs';
```

---

## 3. Core API

### 3.1 `animate(targets, parameters)`

The main engine. Accepts DOM targets and an options object; returns a controllable animation instance.

```ts
import { animate } from 'animejs';

const anim = animate('.card', {
  opacity:   [0, 1],          // from → to shorthand
  translateY: { from: 20, to: 0 },
  duration:  250,
  ease:      'out(2)',
  delay:     100,
});
```

**Targets** — any of:
- CSS selector string: `'.card'`
- DOM element: `ref.current`
- JS object: `{ value: 0 }` (for number tweening)
- Array of the above

**Animatable property types:**

| Type | Example |
|---|---|
| CSS properties | `opacity`, `backgroundColor`, `width` |
| CSS transforms | `translateX`, `rotate`, `scale` |
| CSS variables | `'--ubc-blue-500'` |
| HTML/SVG attributes | `cx`, `r`, `d`, `points` |
| JS object properties | `{ score: 0 }` → `{ score: 100 }` |

**Tween value forms:**

| Form | Syntax | Notes |
|---|---|---|
| To only | `opacity: 1` | Starts from current value |
| From → to | `opacity: [0, 1]` | Array shorthand |
| Object | `{ from: 0, to: 1 }` | Most explicit |
| Relative | `translateX: '+=20'` | Adds to current |
| Function | `(el, i) => i * 20` | Per-element value |

**Key playback parameters:**

| Param | Default | Description |
|---|---|---|
| `duration` | `600` | Milliseconds |
| `delay` | `0` | Delay before start (ms) |
| `ease` | `'out(2)'` | Easing function name |
| `loop` | `false` | `true` or count |
| `alternate` | `false` | Reverses on each loop |
| `reversed` | `false` | Play in reverse |
| `autoplay` | `true` | Start immediately |

**Instance methods:**

```ts
anim.play();
anim.pause();
anim.reverse();
anim.seek(500);    // jump to 500 ms
anim.restart();
```

**Callbacks:**

```ts
animate('.el', {
  opacity: 1,
  onBegin:    (anim) => { /* started */ },
  onComplete: (anim) => { /* finished */ },
  onUpdate:   (anim) => { /* each frame */ },
  onLoop:     (anim) => { /* loop boundary */ },
});
```

---

### 3.2 `createTimeline(parameters)`

Sequences multiple animations with absolute or relative positioning.

```ts
import { createTimeline } from 'animejs';

const tl = createTimeline({ defaults: { duration: 250, ease: 'out(2)' } });

tl.add('.card-header', { opacity: [0, 1], translateY: [16, 0] })
  .add('.card-body',   { opacity: [0, 1] }, '-=100')   // 100 ms before previous ends
  .add('.card-footer', { opacity: [0, 1] }, '>');       // after previous ends
```

**`.add(target, params, position?)`**

| Position value | Meaning |
|---|---|
| `500` (ms) | Absolute time in the timeline |
| `'<'` | Same start as previous animation |
| `'>'` | Right after previous animation ends |
| `'-=100'` | 100 ms before previous ends (overlap) |
| `'+=100'` | 100 ms after previous ends (gap) |
| `'label-name'` | At a named label |

**Other methods:**

```ts
tl.label('phase-two');                    // create a named marker
tl.call(() => updateState(), 'phase-two'); // fire callback at label
tl.sync(anotherTimeline, 0);              // nest another timeline
```

---

### 3.3 `stagger(value, options?)`

Distributes values or delays progressively across multiple targets.

```ts
import { animate, stagger } from 'animejs';

// Stagger delay — each card starts 60 ms after the previous
animate('.metric-card', {
  opacity:    [0, 1],
  translateY: [12, 0],
  duration:   250,
  delay:      stagger(60),
});

// Stagger a value range — first element gets scale 1, last gets 0.5
animate('.bar', {
  scaleY: stagger([1, 0.5]),
});
```

**`stagger(value, options)` options:**

| Option | Description |
|---|---|
| `from` | Start index: `0` (default), `'first'`, `'last'`, `'center'`, or `[x, y]` for grids |
| `grid` | `[cols, rows]` — enables 2D grid stagger |
| `axis` | `'x'` or `'y'` for grid stagger direction |

---

### 3.4 `waapi.animate()` — Lightweight Variant

A 3 KB alternative backed by the Web Animation API. Automatically hardware-accelerated. Use for simple CSS property/transform animations where the full engine isn't needed.

```ts
import { waapi } from 'animejs';

waapi.animate('.badge', {
  opacity: [0, 1],
  scale:   [0.9, 1],
  duration: 200,
  ease: 'out(2)',
});
```

**Limitations vs. full `animate()`:** no JS object animation, no SVG attribute animation, no `stagger()` support, fewer easing types.

---

## 4. Text Animation — `splitText()`

Available since v4.2.0. Splits an element's text into `<span>` wrappers for per-character, per-word, or per-line animation.

### API

```ts
import { splitText } from 'animejs';

const splitter = splitText(target, options);
```

| Parameter | Type | Description |
|---|---|---|
| `target` | `string \| HTMLElement` | CSS selector or element |
| `options.lines` | `boolean` | Split into lines |
| `options.words` | `boolean \| { wrap: 'clip' }` | Split into words; `wrap: 'clip'` clips overflow for reveal effects |
| `options.chars` | `boolean` | Split into individual characters |
| `options.includeSpaces` | `boolean` | Preserve space spans |
| `options.accessible` | `boolean` | Maintain `aria-label` on parent |
| `options.debug` | `boolean` | Visual debugging outlines |

**Returns** `TextSplitter` with:
- `split.lines[]` — array of line wrapper elements
- `split.words[]` — array of word wrapper elements
- `split.chars[]` — array of character wrapper elements
- `split.addEffect(fn)` — declare animations here; re-runs on resize, reverts with `split.revert()`
- `split.revert()` — restores original DOM
- `split.refresh()` — updates splits after DOM changes

> **Note:** Word splitting uses `Intl.Segmenter` when available — correctly splits CJK languages.

### Examples

**Character-by-character fade-in** (dashboard heading, stat labels):

```ts
const split = splitText('.dashboard-title', { chars: true });

split.addEffect(() => {
  animate(split.chars, {
    opacity:    [0, 1],
    translateY: [8, 0],
    duration:   300,
    ease:       'out(2)',
    delay:      stagger(20),
  });
});
```

**Word slide-up reveal** (page titles, survey instructions):

```ts
const split = splitText('.page-heading', {
  words: { wrap: 'clip' },
});

split.addEffect(() => {
  animate(split.words, {
    translateY: ['100%', '0%'],
    duration:   350,
    ease:       'out(3)',
    delay:      stagger(40),
  });
});
```

**Line stagger entrance** (survey question text):

```ts
const split = splitText('.question-body', { lines: true });

split.addEffect(() => {
  animate(split.lines, {
    opacity:    [0, 1],
    translateY: [6, 0],
    duration:   250,
    delay:      stagger(50),
  });
});
```

---

## 5. SVG Animation

```ts
// Namespace import
import { svg } from 'animejs';

// Or direct named imports from subpath
import { morphTo, createDrawable, createMotionPath } from 'animejs/svg';
```

### 5.1 `svg.morphTo(shapeTarget, precision?)` — Shape Morphing

Morphs the `d` attribute of an `<path>` or `points` of `<polygon>`/`<polyline>`.

```ts
import { animate, svg } from 'animejs';

// Morph weather icon: sun path → cloud path
animate('#weather-icon-path', {
  d:        svg.morphTo('#cloud-path'),
  duration: 400,
  ease:     'inOut(2)',
});
```

| Parameter | Type | Description |
|---|---|---|
| `shapeTarget` | `string \| SVGElement` | Target shape to morph into |
| `precision` | `number` (optional) | Interpolated point count (0 = no extrapolation) |

**Project application:** animating weather condition icons between states (sun → cloud → rain) using `<path>` elements with matching point counts.

---

### 5.2 `svg.createDrawable(selector, start?, end?)` — Stroke Draw-On

Exposes a `draw` property (percentage of stroke visible) that can be animated.

```ts
import { animate, svg } from 'animejs';

// Draw a trend line from left to right
animate(svg.createDrawable('.trend-line'), {
  draw:     '0 1',     // from 0% to 100% visible
  duration: 800,
  ease:     'linear',
});

// Multi-step — draw in, then erase from left
animate(svg.createDrawable('path'), {
  draw:     ['0 0', '0 1', '1 1'],
  duration: 1200,
  ease:     'inOut(3)',
});
```

| `draw` value | Meaning |
|---|---|
| `'0 1'` | Draw from start to end |
| `'1 0'` | Erase from end to start |
| `'0 0'` | Nothing visible |
| `'0.25 0.75'` | Middle 50% visible |

**Project applications:**
- Animating the `WeatherTrendChart.tsx` line on mount
- Drawing Lucide icon strokes on hover
- Loading progress paths

---

### 5.3 `svg.createMotionPath(pathSelector, offset?)` — Follow a Path

Returns `{ translateX, translateY, rotate }` tween values that track a path.

```ts
import { animate, svg } from 'animejs';

// Spread directly — element follows the path
animate('.loading-dot', {
  ...svg.createMotionPath('.track-path'),
  duration: 1200,
  ease:     'linear',
  loop:     true,
});

// Or destructure for manual control
const { translateX, translateY, rotate } = svg.createMotionPath('.track');
animate('.indicator', { translateX, translateY, rotate, duration: 800 });
```

**Project application:** animated loading indicator that follows a curved SVG track.

---

## 6. React / Next.js Integration Pattern

Canonical hook pattern — safe for SSR (Next.js), cleans up on unmount, respects `prefers-reduced-motion`.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

export function WeatherCardGrid() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect reduced motion
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) return;

    const cards = rootRef.current?.querySelectorAll('.metric-card');
    if (!cards?.length) return;

    const anim = animate(cards, {
      opacity:    [0, 1],
      translateY: [12, 0],
      duration:   250,
      ease:       'out(2)',
      delay:      stagger(60),
    });

    return () => { anim.pause(); };
  }, []);

  return (
    <div ref={rootRef}>
      {/* cards */}
    </div>
  );
}
```

**Rules:**
- Always `"use client"` — anime.js requires DOM access
- Always init inside `useEffect` — never at module scope
- Always check `prefers-reduced-motion` before running animations
- Use `ref.current` instead of global CSS selectors to avoid cross-component targeting
- For `splitText()`, use `split.addEffect()` — it re-runs on resize automatically
- Return cleanup: `anim.pause()` or `anim.cancel()` to stop on unmount

---

## 7. Full Feature Catalogue

| Feature | Import path | Description | Project relevance |
|---|---|---|---|
| `animate()` | `animejs` | Core JS animation engine (~10 KB) | Primary animation driver |
| `waapi.animate()` | `animejs` | WAAPI variant (~3 KB, GPU-accelerated) | Simple CSS/transform animations |
| `createTimeline()` | `animejs` | Sequenced multi-target timelines | Survey step transitions, entrance sequences |
| `stagger()` | `animejs` | Progressive delay/value distribution | Card grids, list item entrances |
| `splitText()` | `animejs` | Text → lines / words / chars | Heading reveals, stat label animation |
| `svg.morphTo()` | `animejs/svg` | SVG shape morphing (`d`, `points`) | Weather icon state changes |
| `svg.createDrawable()` | `animejs/svg` | Stroke draw-on animation (`draw` prop) | Chart line reveal, icon drawing |
| `svg.createMotionPath()` | `animejs/svg` | Element follows an SVG path | Loading indicators on track |
| `Draggable` | `animejs` | Physics-based drag with friction/velocity | Draggable dashboard widgets (future) |
| `ScrollObserver` | `animejs` | Scroll-triggered / scroll-synced animations | Dashboard section reveals on scroll |
| `createTimer()` | `animejs` | Precise JS timer (replaces `setInterval`) | Data polling countdown displays |
| `Scope` | `animejs` | Scoped context + media query integration | Component-level animation isolation |
| `Engine` | `animejs` | Global config: fps, speed, timeUnit | Tune globally (e.g., `Engine.speed`) |

---

## 8. Easing Reference

Built-in ease names follow the pattern `'in(n)'`, `'out(n)'`, `'inOut(n)'` where `n` is a power (1–10):

| Ease string | Behaviour |
|---|---|
| `'linear'` | Constant speed |
| `'out(2)'` | Smooth deceleration (default UI feel) |
| `'inOut(2)'` | Accelerate then decelerate |
| `'in(3)'` | Slow start, fast end |
| `'out(3)'` | Fast start, slow end (snappy) |
| `'steps(6)'` | 6-step discrete jump |
| `cubicBezier(x1,y1,x2,y2)` | Custom cubic bézier |
| `spring(mass, stiffness, damping, velocity)` | Physics spring — avoid in clinical UI |

> Per [styleguide.md §8](styleguide.md): avoid bouncy spring easing. Stick to `out(2)`–`out(3)` for standard UI transitions and `inOut(2)`–`inOut(3)` for enter/exit sequences.
