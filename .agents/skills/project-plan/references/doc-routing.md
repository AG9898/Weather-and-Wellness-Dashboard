# Doc Routing

Use `AGENTS.md` as the top-level router, then open only the docs implied by the proposal.

## Routing

- Product goals, scope, and success criteria: `docs/PRD.md`
- Runtime ownership, subsystem boundaries, and data flow: `docs/ARCHITECTURE.md`
- Platform-wide engineering guardrails and patterns: `docs/CONVENTIONS.md`
- Persisted schema changes or migration impacts: `docs/SCHEMA.md`
- Multi-lab isolation, lab onboarding, and tenant-scoping rules: `docs/MULTI_LAB.md`
- Testing strategy and required validation depth: `docs/TESTING.md`
- Existing decisions or whether an open decision blocks progress: `docs/DECISIONS.md`
- UI direction, layout/motion/theming, and component style: `docs/styleguide.md`
- shadcn component usage and CLI conventions: `docs/shadcn.md`
- Storybook scope and story authoring expectations: `docs/storybook.md`
- Current redesign direction and visual priorities: `docs/UI_REDESIGN_2026.md`
- Lab-level API contracts, scoring rules, and design constraints: `docs/labs/weather-wellness/*.md`
- Study instruments and task-specific behavior: `docs/labs/weather-wellness/tasks/*.md` and `docs/labs/weather-wellness/surveys/*.md`
- Weather ingestion/backfill behavior: `docs/labs/weather-wellness/WEATHER_INGESTION.md` and `docs/labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md`
- Active queue and task metadata: `docs/workboard.json` (only when task planning or edits are requested)
- Historical archive only: `docs/progress/PROGRESS_LOG.md` (read only when user explicitly asks for history)

## Selection Heuristics

- Start with the narrowest likely docs.
- Expand only when the proposal crosses subsystem boundaries.
- For mixed proposals, read one doc per concern rather than preloading all docs.

Common combinations:

- New participant/RA workflow: `docs/PRD.md` + `docs/ARCHITECTURE.md` + `docs/CONVENTIONS.md`
- API or scoring change: `docs/labs/weather-wellness/API.md` + `docs/labs/weather-wellness/SCORING.md` + `docs/SCHEMA.md`
- Data model or tenancy change: `docs/SCHEMA.md` + `docs/MULTI_LAB.md` + `docs/DECISIONS.md`
- UI redesign/new component work: `docs/styleguide.md` + `docs/storybook.md` + `docs/labs/weather-wellness/DESIGN_SPEC.md`
- Analytics/dashboard metrics work: `docs/labs/weather-wellness/ANALYTICS.md` + `docs/PRD.md` + `docs/TESTING.md`
