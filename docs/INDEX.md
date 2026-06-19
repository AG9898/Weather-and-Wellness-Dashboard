# Documentation Index

Canonical documentation routing map for this repository.

Use this file as the single source of truth for doc locations. Do not add root-level
stub docs that only redirect to lab-specific paths.

## Platform Docs (`docs/`)

| Path | Purpose |
|---|---|
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Deployment topology, runtime boundaries, routing architecture |
| [`docs/AI_CHAT.md`](AI_CHAT.md) | Planned RA data chatbot architecture, privacy boundary, and allowed data modes |
| [`docs/CONVENTIONS.md`](CONVENTIONS.md) | Coding and operational conventions |
| [`docs/DECISIONS.md`](DECISIONS.md) | Open and resolved architectural decisions |
| [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) | Production release pipeline, Railway/Vercel gates, and deployment secrets |
| [`docs/ENV_VARS.md`](ENV_VARS.md) | Canonical environment variable matrix and ownership |
| [`docs/TRIAL_MODE.md`](TRIAL_MODE.md) | Canonical trial-run behavior (IDs, watermark, consent, module boundaries) |
| [`docs/MULTI_LAB.md`](MULTI_LAB.md) | Multi-lab model and onboarding guidance |
| [`docs/PRD.md`](PRD.md) | Product requirements and scope framing |
| [`docs/SCHEMA.md`](SCHEMA.md) | Database schema and migration history |
| [`docs/TESTING.md`](TESTING.md) | Testing strategy, patterns, and references |
| [`docs/devSteps.md`](devSteps.md) | Development and verification runbook |
| [`docs/styleguide.md`](styleguide.md) | UI style system and visual direction |
| [`docs/shadcn.md`](shadcn.md) | shadcn usage guidance |
| [`docs/storybook.md`](storybook.md) | Storybook workflow and review expectations |
| [`docs/migrations/README.md`](migrations/README.md) | Migration planning/archive docs (Alembic scripts live in `backend/alembic/`) |
| [`docs/workboard.json`](workboard.json) | Active task queue (canonical board) |
| [`docs/workboard.schema.json`](workboard.schema.json) | JSON Schema for workboard validation (`ajv-cli validate -s docs/workboard.schema.json -d docs/workboard.json`) |

## Lab Docs (`docs/labs/`)

| Path | Purpose |
|---|---|
| [`docs/labs/README.md`](labs/README.md) | Lab onboarding template and multi-lab checklist |

### Weather & Wellness (`docs/labs/weather-wellness/`)

| Path | Purpose |
|---|---|
| [`docs/labs/weather-wellness/README.md`](labs/weather-wellness/README.md) | Lab overview and doc index |

#### Weather Component

| Path | Purpose |
|---|---|
| [`docs/labs/weather-wellness/weather/API.md`](labs/weather-wellness/weather/API.md) | FastAPI contracts — Weather-Wellness dashboard, sessions, surveys, admin, auth |
| [`docs/labs/weather-wellness/weather/ANALYTICS.md`](labs/weather-wellness/weather/ANALYTICS.md) | Analytics snapshot/modeling design |
| [`docs/labs/weather-wellness/weather/DESIGN_SPEC.md`](labs/weather-wellness/weather/DESIGN_SPEC.md) | WW participant and RA UX specifications |
| [`docs/labs/weather-wellness/weather/SCORING.md`](labs/weather-wellness/weather/SCORING.md) | Instrument scoring rules |
| [`docs/labs/weather-wellness/weather/WEATHER_INGESTION.md`](labs/weather-wellness/weather/WEATHER_INGESTION.md) | Live weather ingest and reconciliation |
| [`docs/labs/weather-wellness/weather/HISTORICAL_WEATHER_BACKFILL.md`](labs/weather-wellness/weather/HISTORICAL_WEATHER_BACKFILL.md) | Historical weather backfill process |
| [`docs/labs/weather-wellness/weather/DIGITSPAN.md`](labs/weather-wellness/weather/DIGITSPAN.md) | Digit Span task specification |
| [`docs/labs/weather-wellness/weather/STROOP.md`](labs/weather-wellness/weather/STROOP.md) | Stroop task specification |
| [`docs/labs/weather-wellness/weather/CARD_SORTING.md`](labs/weather-wellness/weather/CARD_SORTING.md) | WCST-64-inspired card sorting task specification |
| [`docs/labs/weather-wellness/weather/ULS8.md`](labs/weather-wellness/weather/ULS8.md) | ULS-8 instrument spec |
| [`docs/labs/weather-wellness/weather/CESD10.md`](labs/weather-wellness/weather/CESD10.md) | CES-D 10 instrument spec |
| [`docs/labs/weather-wellness/weather/GAD7.md`](labs/weather-wellness/weather/GAD7.md) | GAD-7 instrument spec |
| [`docs/labs/weather-wellness/weather/COGFUNC8A.md`](labs/weather-wellness/weather/COGFUNC8A.md) | CogFunc 8a instrument spec |

#### Misokinesia Component

| Path | Purpose |
|---|---|
| [`docs/labs/weather-wellness/misokinesia/API.md`](labs/weather-wellness/misokinesia/API.md) | FastAPI contracts — Misokinesia endpoints |
| [`docs/labs/weather-wellness/misokinesia/DESIGN_SPEC.md`](labs/weather-wellness/misokinesia/DESIGN_SPEC.md) | Misokinesia UX flows, design system, and component conventions |
| [`docs/labs/weather-wellness/misokinesia/MISOKINESIA.md`](labs/weather-wellness/misokinesia/MISOKINESIA.md) | Misokinesia task specification |

## Archive Docs (Historical Context Only)

| Path | Purpose |
|---|---|
| [`docs/progress/PROGRESS_LOG.md`](progress/PROGRESS_LOG.md) | Archive-only historical progress log; active queue is `docs/workboard.json` |
| [`docs/ROUTING_CLEANUP.md`](ROUTING_CLEANUP.md) | Completed backend reliability playbook archive; canonical behavior lives in `docs/ARCHITECTURE.md` and `docs/labs/weather-wellness/weather/ANALYTICS.md` |
| [`docs/UI_REDESIGN_2026.md`](UI_REDESIGN_2026.md) | Historical editorial dashboard notes; active UI guidance lives in `docs/styleguide.md` |
| `docs/labs/weather-wellness/tasks/working-misokinesia-add.md` | Completed planning archive (file removed); current task spec is `docs/labs/weather-wellness/misokinesia/MISOKINESIA.md` |

## Maintenance Rules

- When adding, removing, renaming, or moving docs, update this file in the same commit.
- Update impacted links in canonical docs and nearest parent indexes (`AGENTS.md`,
  `docs/labs/<lab>/README.md`, and related docs sections).
