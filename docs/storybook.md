# storybook.md — Isolated UI Review Guide (CLI Agent)

> **Related docs:** [styleguide.md](styleguide.md) · [shadcn.md](shadcn.md) · [TESTING.md](TESTING.md)

Use this document when working on Storybook-related UI review in this repo.

## 1) Status in This Repo

Storybook is now installed in `frontend/` as a frontend workflow tool for this project. As of this document:

- Storybook should be treated as a **local UI review harness** for this repo.
- It is configured separately from the real Next.js application runtime.
- This file defines the intended use case and agent workflow for how Storybook should be used here.

## 2) Why We Want It Here

For this project, Storybook is intended to be a **focused UI screening and testing surface** for frontend work created by agents.

Use it to:
- inspect reusable UI in isolation before it gets buried inside a route
- make small visual corrections quickly
- verify variant states that are awkward to reach in the running app
- review light/dark theme behavior and responsive layout behavior
- exercise simple UI interactions without requiring the full app flow

Do **not** treat Storybook as:
- a replacement for the real Next.js app
- a replacement for backend/API integration testing
- a requirement to story every full page or participant flow
- a reason to do a repo-wide refactor of all frontend components

## 3) How Storybook Works

The official Storybook docs describe it as a small, development-only workshop that lives alongside your app and renders UI in isolation. In practice, the relevant model for this repo is:

- A **story** captures one rendered state of a UI component or page section.
- Stories are written in **Component Story Format (CSF)** as colocated `*.stories.tsx` files.
- Stories pass **args** to components to represent variations and edge cases.
- **Decorators** wrap stories in the providers/layout/context they need.
- **Globals** and toolbar controls can switch cross-cutting concerns like theme or viewport.
- **Play functions** can simulate user actions and assert UI behavior for interaction testing.
- Components that normally fetch data can be exercised with **mocked network requests** instead of hitting the real backend.

Official docs used for this summary:
- Why Storybook: https://storybook.js.org/docs/get-started/why-storybook
- Next.js with Vite framework guide: https://storybook.js.org/docs/get-started/frameworks/nextjs-vite
- Writing stories: https://storybook.js.org/docs/writing-stories
- Styling and CSS: https://storybook.js.org/docs/configure/styling-and-css
- Toolbars and globals: https://storybook.js.org/docs/essentials/toolbars-and-globals
- Interaction testing: https://storybook.js.org/docs/writing-tests/interaction-testing
- Mocking network requests: https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-network-requests

## 4) Project-Specific Storybook Policy

When Storybook is integrated, use it in a narrow, review-oriented way:

- Primary scope: shared components and selected page sections.
- Secondary scope: composite UI sections that benefit from isolated review.
- Out of scope by default: full route pages, end-to-end participant flows, and backend-dependent workflows.

For this repo, Storybook should be the first review surface for:
- `frontend/src/components/ui/*`
- reusable composites under `frontend/src/lib/components/*`
- visually important page sections that can be meaningfully mocked

Storybook should **not** become the authority for:
- database state
- auth/session correctness
- server scoring logic
- cross-route navigation behavior

## 5) Story Authoring Rules for Agents

When creating or updating reusable frontend UI, follow these rules:

1. Prefer stories for **shared components** and **reusable sections**, not full pages.
2. Keep stories **colocated** with the component they describe.
3. Default to **args** for state variation before reaching for custom story logic.
4. Use **decorators** for project wrappers such as theme/context, not copy-pasted layout shells in every story.
5. Do not call the real backend from stories.
6. If a component normally fetches data, use mock data or request mocking.
7. Only extract a separate presentational `View` component if a component is too coupled to story cleanly; do not trigger a broad UI/container rewrite.

Required states for reusable UI stories:
- default
- loading
- empty
- error
- long content / overflow
- dark theme
- mobile viewport when layout changes materially

Optional when relevant:
- disabled
- success
- destructive
- dense data state

## 6) Storybook Feedback Workflow for Agents

Agents should expect Storybook review feedback to arrive as a narrow request tied to a visible story state rather than as a broad redesign brief.

Typical feedback will reference:
- the story name
- the specific state or variant
- the theme or viewport when relevant
- what looks wrong
- the desired visual direction

Common examples:
- `Story: Dashboard/WeatherUnifiedCard. State: WithAnalyticsWindow, dark mode. Issue: the preset pills feel too heavy. Change: make inactive pills quieter and sharpen the active state.`
- `In UI/Button, the outline variant still feels too flat. Tighten the border contrast and reduce the hover fill.`
- `Open Dashboard/AnalyticsEffectPlotCard on mobile. The heading block is too dominant. Pull it back and give the chart more priority.`

When feedback arrives in this format, agents should:

1. Locate the named story first and treat it as the primary review surface.
2. Reproduce the exact state mentioned in the feedback before making changes.
3. Keep the edit narrow; do not reinterpret a minor Storybook note as a request for a broader redesign.
4. Prefer refining the existing component and story state over creating one-off variants or bypasses.
5. After the change, re-check the same story state first, then verify any closely related states that could be affected.
6. Keep visual changes aligned with `docs/styleguide.md` and component usage aligned with `docs/shadcn.md`.

Agent behavior rules:
- If the request is visually specific, respond to that visible issue directly instead of generalizing the problem.
- If the request touches shared styling or layout behavior, check the nearest related states as a regression pass.
- If the request is ambiguous, ask a narrow follow-up question tied to the story, state, and visible issue.
- Do not expand the task into page-wide cleanup unless the feedback explicitly asks for it.

Preferred user request shape for Storybook review:
- story name
- state or variant
- theme or viewport
- visible issue
- requested direction for the adjustment

## 7) How It Fits This Stack

This frontend is a **Next.js** app, not a Vite app. Storybook would still fit by using Storybook's Next.js framework integration, which currently supports a Vite-based builder for Next.js projects.

Project implications:
- The real app remains `next dev` / `next build`.
- Storybook is a separate frontend development process.
- Global styles should be imported through Storybook's preview config so existing Tailwind/shadcn tokens render correctly.
- Theme switching should be exposed as a Storybook global so components can be reviewed in both light and dark mode.
- API/auth-dependent UI should be mocked instead of connected to live Supabase/FastAPI services.

## 8) Relationship to Existing Docs

Use the docs together like this:

- `docs/styleguide.md`: visual direction, tokens, spacing, typography, chart theming
- `docs/shadcn.md`: component primitive usage and shadcn conventions
- `docs/storybook.md`: isolated UI review workflow, story scope, story-writing expectations
- `docs/TESTING.md`: broader testing context outside Storybook

When these docs conflict for frontend UI work:
- `styleguide.md` controls appearance
- `shadcn.md` controls primitive/component usage
- `storybook.md` controls isolated review workflow

## 9) Default Integration Shape for This Repo

When Storybook is actually added, the expected baseline is:

- install it inside `frontend/`
- use Storybook's Next.js framework guide for setup
- import `src/app/globals.css` in Storybook preview
- wrap stories with the app's theme provider
- add toolbar controls for theme
- start with shared components and a small number of composite sections

Use the repo's actual Storybook config as the source of truth for exact scripts and config details once they exist.
