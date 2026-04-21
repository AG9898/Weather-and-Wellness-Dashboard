# Documentation Index

Canonical documentation routing map for this repository.

Use this file as the single source of truth for doc locations. Do not add root-level
stub docs that only redirect to lab-specific paths.

## Platform Docs (`docs/`)

| Path | Purpose |
|---|---|
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Deployment topology, runtime boundaries, routing architecture |
| [`docs/CONVENTIONS.md`](CONVENTIONS.md) | Coding and operational conventions |
| [`docs/DECISIONS.md`](DECISIONS.md) | Open and resolved architectural decisions |
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
| [`docs/UI_REDESIGN_2026.md`](UI_REDESIGN_2026.md) | 2026 UI direction and redesign scope notes |
| [`docs/migrations/README.md`](migrations/README.md) | Migration planning/archive docs (Alembic scripts live in `backend/alembic/`) |
| [`docs/workboard.json`](workboard.json) | Active task queue (canonical board) |

## Lab Docs (`docs/labs/`)

| Path | Purpose |
|---|---|
| [`docs/labs/README.md`](labs/README.md) | Lab onboarding template and multi-lab checklist |

### Weather & Wellness (`docs/labs/weather-wellness/`)

| Path | Purpose |
|---|---|
| [`docs/labs/weather-wellness/README.md`](labs/weather-wellness/README.md) | Lab overview and doc index |
| [`docs/labs/weather-wellness/API.md`](labs/weather-wellness/API.md) | FastAPI contracts for this lab |
| [`docs/labs/weather-wellness/ANALYTICS.md`](labs/weather-wellness/ANALYTICS.md) | Analytics snapshot/modeling design |
| [`docs/labs/weather-wellness/DESIGN_SPEC.md`](labs/weather-wellness/DESIGN_SPEC.md) | Participant and RA UX specifications |
| [`docs/labs/weather-wellness/SCORING.md`](labs/weather-wellness/SCORING.md) | Instrument scoring rules |
| [`docs/labs/weather-wellness/WEATHER_INGESTION.md`](labs/weather-wellness/WEATHER_INGESTION.md) | Live weather ingest and reconciliation |
| [`docs/labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md`](labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md) | Historical weather backfill process |
| [`docs/labs/weather-wellness/tasks/DIGITSPAN.md`](labs/weather-wellness/tasks/DIGITSPAN.md) | Digit Span task specification |
| [`docs/labs/weather-wellness/tasks/MISOKINESIA.md`](labs/weather-wellness/tasks/MISOKINESIA.md) | Misokinesia task specification |
| [`docs/labs/weather-wellness/surveys/`](labs/weather-wellness/surveys/) | Survey instrument specs (ULS8, CESD10, GAD7, CogFunc8a) |

## Archive Docs (Historical Context Only)

| Path | Purpose |
|---|---|
| [`docs/progress/PROGRESS_LOG.md`](progress/PROGRESS_LOG.md) | Archive-only historical progress log; active queue is `docs/workboard.json` |
| [`docs/ROUTING_CLEANUP.md`](ROUTING_CLEANUP.md) | Completed backend reliability playbook archive; canonical behavior lives in `docs/ARCHITECTURE.md` and `docs/labs/weather-wellness/ANALYTICS.md` |
| [`docs/labs/weather-wellness/tasks/working-misokinesia-add.md`](labs/weather-wellness/tasks/working-misokinesia-add.md) | Completed planning archive; current task spec is `docs/labs/weather-wellness/tasks/MISOKINESIA.md` |

## Maintenance Rules

- When adding, removing, renaming, or moving docs, update this file in the same commit.
- Update impacted links in canonical docs and nearest parent indexes (`AGENTS.md`,
  `docs/labs/<lab>/README.md`, and related docs sections).
