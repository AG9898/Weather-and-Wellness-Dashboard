# storybook.md — Page-First Visual Replica Guide (CLI Agent)

> **Related docs:** [styleguide.md](styleguide.md) · [shadcn.md](shadcn.md) · [TESTING.md](TESTING.md)

Use this document when working on Storybook-related UI review in this repo.

Storybook is the WW Webapp page-first visual replica workbench: agents use it to recreate selected pages from the deployed UI, refine the frontend layout in isolation, and compare the result visually before or alongside route integration.

## 1) Status in This Repo

Storybook is now installed in `frontend/` as a frontend workflow tool for this project. As of this document:

- Storybook should be treated as a **local visual workbench** for this repo.
- It is configured separately from the real Next.js application runtime.
- This file defines the intended use case and agent workflow for how Storybook should be used here.

## 2) Why We Want It Here

For this project, Storybook is intended to be a **page-first replica surface** for frontend work created by agents.

Use it to:
- recreate the current deployed UI of a chosen page in isolation
- refine layout, spacing, hierarchy, and section composition before touching route integration
- make visual corrections quickly while watching Storybook hot reload
- verify variant states that are awkward to reach in the running app
- review light/dark theme behavior and responsive layout behavior

Do **not** treat Storybook as:
- a replacement for the real Next.js app
- the authority for backend wiring, auth correctness, database state, or end-to-end route behavior
- a replacement for backend/API integration testing
- a reason to do a repo-wide redesign while replicating one page

## 3) How Storybook Works

The official Storybook docs describe it as a small, development-only workshop that lives alongside your app and renders UI in isolation. In practice, the relevant model for this repo is:

- A **story** captures one rendered state of a UI component, section, or full page replica.
- Stories are written in **Component Story Format (CSF)** as colocated `*.stories.tsx` files.
- Stories pass **args** to components to represent variations and edge cases.
- **Decorators** wrap stories in the providers/layout/context they need.
- **Globals** and toolbar controls can switch cross-cutting concerns like theme or viewport.
- **Play functions** can simulate user actions and assert UI behavior for interaction testing.
- Components that normally fetch data can be exercised with **mocked network requests** instead of hitting the real backend.
- Full page stories may be assembled from real components and sections to visually match the deployed UI.

Official docs used for this summary:
- Why Storybook: https://storybook.js.org/docs/get-started/why-storybook
- Next.js with Vite framework guide: https://storybook.js.org/docs/get-started/frameworks/nextjs-vite
- Writing stories: https://storybook.js.org/docs/writing-stories
- Styling and CSS: https://storybook.js.org/docs/configure/styling-and-css
- Toolbars and globals: https://storybook.js.org/docs/essentials/toolbars-and-globals
- Interaction testing: https://storybook.js.org/docs/writing-tests/interaction-testing
- Mocking network requests: https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-network-requests

## 4) Project-Specific Storybook Policy

When Storybook is integrated, use it in a narrow, page-replica way:

- Primary scope: full page stories that recreate the current deployed UI.
- Secondary scope: reusable sections and individual elements when explicitly requested or when page iteration needs isolation.
- Out of scope by default: backend-dependent workflows, auth/session validation, and end-to-end participant flow testing.

Use the currently deployed page as the visual target. Use screenshots or Playwright capture when needed to compare structure, spacing, and hierarchy.

Storybook should **not** become the authority for:
- database state
- auth/session correctness
- server scoring logic
- cross-route navigation behavior

## 5) Story Authoring Rules for Agents

When creating or updating Storybook UI for this repo, follow these rules:

1. Default to **full-page replica stories**.
2. Split work into sections or element stories only when a page needs isolated iteration or the user explicitly asks for it.
3. Build page stories from real frontend components where possible.
4. Use **decorators** and mock data/providers for page setup; do not wire live backend behavior unless explicitly requested.
5. Do not call the real backend from stories.
6. If a page component is too coupled to story cleanly, extract the thinnest possible presentational layer instead of starting a broad rewrite.
7. Keep the main page shell and final layout consistency under one owner when multiple agents contribute sections.

Required states for page stories:
- Replica
- loading
- empty
- error
- dark theme
- mobile viewport

Optional when relevant:
- long content / overflow
- success
- destructive
- dense data state

## 6) Storybook Feedback Workflow for Agents

Agents should expect Storybook review feedback to arrive as a narrow request tied to a page replica or a visible section inside that page rather than as a broad redesign brief.

Typical feedback will reference:
- the story name
- the specific page state or variant
- the theme or viewport when relevant
- what looks wrong
- the desired visual direction

Common examples:
- `Story: Pages/RA/Dashboard. State: Replica. Issue: the hero block sits too tall compared with the deployed page. Change: tighten the headline zone and give the weather card more priority.`
- `Story: Pages/Public/Login. State: Replica, desktop. Issue: the CTA block looks wider than production. Match the deployed button sizing and spacing.`
- `Story: Pages/RA/ImportExport. State: Mobile. Issue: the action cards stack correctly but the heading rhythm feels loose. Tighten top spacing without changing content.`

When feedback arrives in this format, agents should:

1. Locate the named story first and treat it as the primary review surface.
2. Reproduce the exact state mentioned in the feedback before making changes.
3. Keep the edit narrow; do not reinterpret a minor Storybook note as a request for a broader redesign.
4. If sections were created separately, clean up spacing, ordering, and visual consistency in the assembled page story before stopping.
5. Prefer refining the existing page story and shared components over creating one-off bypasses.
6. After the change, re-check the same story state first, then verify any closely related states that could be affected.
7. Keep visual changes aligned with `docs/styleguide.md` and component usage aligned with `docs/shadcn.md`.

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
- Storybook is a separate frontend development process and visual editing surface for page replicas.
- Global styles should be imported through Storybook's preview config so existing Tailwind/shadcn tokens render correctly.
- Theme switching should be exposed as a Storybook global so components can be reviewed in both light and dark mode.
- API/auth-dependent UI should be mocked instead of connected to live Supabase/FastAPI services.

## 8) Relationship to Existing Docs

Use the docs together like this:

- `docs/styleguide.md`: visual direction, tokens, spacing, typography, chart theming
- `docs/shadcn.md`: component primitive usage and shadcn conventions
- `docs/storybook.md`: page-replica workflow, story scope, and visual review expectations
- `docs/TESTING.md`: broader testing context outside Storybook

When these docs conflict for frontend UI work:
- `styleguide.md` controls appearance
- `shadcn.md` controls primitive/component usage
- `storybook.md` controls the page-replica workflow

## 9) Default Integration Shape for This Repo

When Storybook is actually added, the expected baseline is:

- install it inside `frontend/`
- use Storybook's Next.js framework guide for setup
- import `src/app/globals.css` in Storybook preview
- wrap stories with the app's theme provider
- add toolbar controls for theme
- default to full-page stories under a dedicated page-story area
- keep element stories secondary and only add them when explicitly requested
- make screenshots or deployed-UI comparison part of the normal review loop

Use the repo's actual Storybook config as the source of truth for exact scripts and config details once they exist.
