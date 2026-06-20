# Labs Documentation Onboarding

Use this template when adding a new lab under `docs/labs/<lab-slug>/`.
For the canonical multi-lab model and isolation rules, see [`docs/MULTI_LAB.md`](../MULTI_LAB.md).

## Required Files

Create these files for each new lab:

- `docs/labs/<lab-slug>/README.md` (lab overview and local doc index)

For each active lab component, create a component directory:

- `docs/labs/<lab-slug>/<component>/API.md` (component-specific API contracts)
- `docs/labs/<lab-slug>/<component>/DESIGN_SPEC.md` (participant and RA UX/task behavior)
- `docs/labs/<lab-slug>/<component>/<COMPONENT>.md` (task or instrument protocol)
- `docs/labs/<lab-slug>/<component>/SCORING.md` when the component has server-side scoring or derived fields

## Optional Files

Create optional docs only when the lab actually needs them:

- `docs/labs/<lab-slug>/<component>/ANALYTICS.md` for derived analytics workflows and outputs
- `docs/labs/<lab-slug>/<component>/WEATHER_INGESTION.md` for weather data pipelines
- `docs/labs/<lab-slug>/<component>/HISTORICAL_WEATHER_BACKFILL.md` for one-time backfills
- Additional instrument docs under the component directory when a component contains multiple tasks or surveys

## Known Labs

| Lab slug | Display name | Components |
|---|---|---|
| `weather-wellness` | Weather & Wellness | `weather`, `misokinesia` |
| `ihtt` | Interhemispheric Transfer Time | `poffenberger` |

## New Lab Checklist

- Register the lab in the `labs` table with a stable slug.
- Verify every data-writing endpoint enforces `lab_id` scoping from auth claims.
- Add the new lab docs to [`docs/INDEX.md`](../INDEX.md).
- Add the new lab reference in the root `AGENTS.md` Docs section.
- Ensure `docs/labs/<lab-slug>/README.md` links to all active lab docs and instrument leaves.
