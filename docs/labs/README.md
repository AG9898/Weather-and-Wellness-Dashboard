# Labs Documentation Onboarding

Use this template when adding a new lab under `docs/labs/<lab-slug>/`.
For the canonical multi-lab model and isolation rules, see [`docs/MULTI_LAB.md`](../MULTI_LAB.md).

## Required Files

Create these files for each new lab:

- `docs/labs/<lab-slug>/README.md` (lab overview and local doc index)
- `docs/labs/<lab-slug>/API.md` (lab-specific API contracts)
- `docs/labs/<lab-slug>/SCORING.md` (scoring rules and server-side derivations)
- `docs/labs/<lab-slug>/DESIGN_SPEC.md` (participant and RA UX/task behavior)

## Optional Files

Create optional docs only when the lab actually needs them:

- `docs/labs/<lab-slug>/ANALYTICS.md` for derived analytics workflows and outputs
- `docs/labs/<lab-slug>/WEATHER_INGESTION.md` for weather data pipelines
- `docs/labs/<lab-slug>/HISTORICAL_WEATHER_BACKFILL.md` for one-time backfills
- `docs/labs/<lab-slug>/tasks/*.md` and `docs/labs/<lab-slug>/surveys/*.md` for instrument-level specs

## New Lab Checklist

- Register the lab in the `labs` table with a stable slug.
- Verify every data-writing endpoint enforces `lab_id` scoping from auth claims.
- Add the new lab docs to [`docs/INDEX.md`](../INDEX.md).
- Add the new lab reference in the root `AGENTS.md` Docs section.
- Ensure `docs/labs/<lab-slug>/README.md` links to all active lab docs and instrument leaves.
