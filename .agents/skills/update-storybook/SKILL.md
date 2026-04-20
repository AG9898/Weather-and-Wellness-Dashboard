---
name: update-storybook
description: Update an existing Storybook page story so it matches current frontend code after UI changes. Use when the story already exists and has drifted from the real route/component implementation. Sync all exported story states in the target story file, then run auth-gated deployed visual inspection by logging in at the base SITE_URL before visiting the target page.
---

# Update Storybook

Use this skill when a Storybook page already exists and needs to be brought up to date with recent frontend changes.

## Inputs

- Target story (`*.stories.tsx` path or Storybook title).
- Target app route/page the story is meant to represent.
- Optional deployed URL override for the route.

## Defaults

- Deployed base URL: `SITE_URL` from repo root `.env`.
- Auth flow for deployed checks:
  - Visit base `SITE_URL` first.
  - Log in with:
    - Email: `aden219898@gmail.com`
    - Password: `Aden9898`
  - After successful login, navigate to the route that corresponds to the target story.

## Workflow

1. Read `docs/storybook.md`, `docs/styleguide.md`, and `docs/shadcn.md`.
2. Locate the target story file and its support file (for example `*StorySupport.tsx`), plus the route/component files the story represents.
3. Treat current repo code as source of truth:
   - Compare route/component structure, props, layout, copy, and style tokens to the story implementation.
   - Identify drift between the story and current page code.
4. Update the target story to match current code.
5. Enforce all facets for that story:
   - Update every exported state in the same `*.stories.tsx` file, not only `Replica`.
   - Keep state-specific intent (loading/empty/error/mobile/dark/custom states), but align shared structure and styling across them.
6. Run local Storybook verification for the updated story.
7. Run deployed visual inspection as a secondary check:
   - Open base `SITE_URL` (or override), authenticate, then navigate to the target route.
   - Compare deployed visuals against the updated story for spacing, hierarchy, and key element parity.
8. Resolve differences with this rule:
   - If deployed visuals conflict with repo code, keep repo code alignment unless the user explicitly requests deployed-first behavior.
9. Report what changed per story state and call out any remaining visual gaps.

## Guardrails

- Do not create a new page story when the request is an update to an existing one.
- Keep changes scoped to the target story and directly related support/page files.
- Do not call live backend services from stories.
- Do not expand into unrelated redesign work.

## Verification

- Run `cd frontend && npm run build-storybook` after story updates.
- Ensure the target story renders and all exported states remain functional.
