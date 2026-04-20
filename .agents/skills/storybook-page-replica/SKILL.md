---
name: storybook-page-replica
description: Recreate or refine a chosen page in Storybook as a UI-only visual replica. Use when the goal is to match the deployed page layout and frontend elements, delegate page sections to sub-agents, and assemble the final replica story in Storybook.
---

# Storybook Page Replica

Use this skill when the task is to recreate a page in Storybook so it visually matches the deployed UI.

## Deployed Visual Inspection Defaults

- Deployed base URL: `SITE_URL` from repo root `.env`.
- Auth flow for deployed checks:
  - Visit base `SITE_URL` first.
  - Log in with:
    - Email: `aden219898@gmail.com`
    - Password: `Aden9898`
  - After successful login, navigate to the deployed route that corresponds to the target page.

## Purpose

- Prefer **full-page replica stories** over isolated component stories.
- Treat Storybook as a **visual workbench** for frontend layout and element composition.
- Ignore backend wiring unless the user explicitly asks for it.
- Use the **deployed UI** as the primary visual reference.
- Use **screenshots** and browser inspection when needed to confirm spacing, hierarchy, and element placement.

## Workflow

1. Read `docs/storybook.md`, `docs/styleguide.md`, and `docs/shadcn.md`.
2. Identify the target page and its real route/component structure in the repo.
3. Start the full app for visual inspection with `./scripts/dev.sh`.
4. Inspect the page in the browser at `http://localhost:3000/` and then use the page-specific localhost route so you spend time on the target screen instead of the sign-in flow.
5. For deployed visual inspection, open base `SITE_URL`, complete login, then navigate to the target deployed route before comparing visuals.
6. If needed, capture screenshots or compare against the deployed UI before editing.
7. Break the page into sections or elements and delegate those pieces to sub-agents.
8. Have sub-agents build or refine the individual UI pieces only.
9. Keep the **main agent** responsible for:
   - final assembly
   - layout ordering
   - spacing and alignment
   - cleanup and polish
   - matching the deployed page visually
10. Build the Storybook page story as the primary artifact.
11. Verify the final story in Storybook and re-check the same page in the browser.

## Story Rules

- Default to a **page story**.
- Create standalone element stories only when explicitly requested or when a page section needs isolated review.
- Keep page stories under a dedicated pages-first structure.
- Use real frontend components where possible.
- Do not introduce Storybook-only UI unless it is necessary to reproduce the page cleanly.
- Mock data, auth, and backend-dependent state as needed.
- Do not call live backend services from stories.

## Output Expectations

For each recreated page, prefer:

- `Replica` as the primary story
- `Loading`
- `Empty`
- `Error`
- `Dark`
- `Mobile`

The `Replica` story should match the deployed UI as closely as possible.

## Visual Truth

Use this order of truth:

1. repo components and page structure
2. Storybook rendering
3. deployed UI (after auth-gated login flow)
4. screenshots / browser inspection

If the deployed UI and repo code differ, match repo code unless the user explicitly requests deployed-first behavior.

## Guardrails

- Do not let sub-agents invent separate page shells.
- Do not treat Storybook as the source of backend correctness.
- Do not use Storybook to validate auth/session logic.
- Do not broaden a page replication task into a repo-wide redesign.
- Keep changes narrow and visually grounded.

## Preferred Request Shape

When working from a user request, capture:

- target page
- visual goal
- viewport or theme
- whether the task is replica-only or replica-plus-variants
- any known deviations from the deployed UI

## Acceptance Check

A page replica is ready when:

- the page structure matches the deployed UI
- major sections appear in the right order
- spacing and alignment are visually close
- key elements are present and styled correctly
- the page looks correct in Storybook and in browser inspection
