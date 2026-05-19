# Doc Routing

Open only the docs implied by the proposal.

## Routing

- Product scope, capability, or success criteria: `docs/PRD.md`
- Runtime ownership, subsystem boundaries, auth/data flow, deployment: `docs/ARCHITECTURE.md`
- Engineering guardrails, coding patterns, and constraints: `docs/CONVENTIONS.md`
- Existing decisions, tradeoffs, or open architectural questions: `docs/DECISIONS.md`
- Environment variables and configuration behavior: `docs/ENV_VARS.md`
- Test strategy and required verification depth: `docs/TESTING.md`
- UI direction, layout, visual language, component patterns: `docs/styleguide.md`
- shadcn component usage and CLI patterns: `docs/shadcn.md`
- Storybook-driven isolated UI review: `docs/storybook.md`
- Multi-lab data model and lab isolation rules: `docs/MULTI_LAB.md`
- Database schema, table definitions, and Alembic conventions: `docs/SCHEMA.md`
- 2026 UI redesign direction and scope context: `docs/UI_REDESIGN_2026.md`
- Docs map and where canonical sources live: `docs/INDEX.md`
- Active task queue and task metadata: `docs/workboard.json` (only when task planning or edits are requested)

## Selection Heuristics

- Start with the narrowest likely docs.
- Expand only when the proposal crosses subsystem boundaries.
- For mixed proposals, read one doc per concern instead of preloading everything.

Common combinations:

- New product feature: `docs/PRD.md` + `docs/ARCHITECTURE.md` + `docs/CONVENTIONS.md`
- Data or migration change: `docs/SCHEMA.md` + `docs/ARCHITECTURE.md` + `docs/DECISIONS.md`
- Auth/session or env behavior change: `docs/ARCHITECTURE.md` + `docs/ENV_VARS.md` + `docs/DECISIONS.md`
- Multi-lab or isolation concern: `docs/MULTI_LAB.md` + `docs/ARCHITECTURE.md` + `docs/DECISIONS.md`
- UI redesign/component behavior: `docs/styleguide.md` + `docs/shadcn.md` + `docs/storybook.md`
- Work planning and sequencing: targeted `docs/workboard.json` queries
