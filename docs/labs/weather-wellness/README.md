# Weather & Wellness Lab

## Study Overview

The Weather & Wellness study investigates the relationship between daily weather conditions
and psychological wellbeing outcomes (loneliness, depression, anxiety, cognitive function).

Research assistants (RAs) administer a fixed battery of instruments per session:
- **Backward Digit Span** — working memory task
- **ULS-8** — loneliness (UCLA Loneliness Scale, 8-item)
- **CES-D 10** — depressive symptoms (Center for Epidemiologic Studies Depression)
- **GAD-7** — anxiety (Generalized Anxiety Disorder, 7-item)
- **CogFunc 8a** — cognitive function (PROMIS SF v2.0, 8-item)
- **Misokinesia task** — 29-clip video sensitivity task (optional, separate session)

Sessions are anonymous. Participants have no accounts; identity is a stable `participant_uuid`
assigned at first session.

## Data Access

Lab data is accessed via **Supabase Studio**. There is no participant-facing
data export. RA dashboard is read-only for data review; all bulk exports go through the
`/import-export` page (RA-only).

## Lab Slug

`weather-wellness` — used as `app_metadata.lab` value in Supabase Auth and as `labs.slug`
in the database.

## Component Docs

Global routing map: [`docs/INDEX.md`](../../INDEX.md)

This lab is organized by component. Component-specific API contracts, UX specs,
task docs, and operational references live under the component directory. Lab-level
docs cover cross-component concerns only.

### Weather

| Document | Purpose |
|---|---|
| [`weather/API.md`](weather/API.md) | FastAPI contracts — WW dashboard, sessions, surveys, admin, auth |
| [`weather/DESIGN_SPEC.md`](weather/DESIGN_SPEC.md) | WW participant and RA UX flows |
| [`weather/SCORING.md`](weather/SCORING.md) | Server-side scoring rules for all instruments |
| [`weather/ANALYTICS.md`](weather/ANALYTICS.md) | Analytics architecture — MLM model, KPIs, snapshot system |
| [`weather/WEATHER_INGESTION.md`](weather/WEATHER_INGESTION.md) | Weather data ingestion via UBC EOS station |
| [`weather/HISTORICAL_WEATHER_BACKFILL.md`](weather/HISTORICAL_WEATHER_BACKFILL.md) | Historical weather backfill procedure |
| [`weather/DIGITSPAN.md`](weather/DIGITSPAN.md) | Digit Span task specification |
| [`weather/ULS8.md`](weather/ULS8.md) | ULS-8 instrument specification |
| [`weather/CESD10.md`](weather/CESD10.md) | CES-D 10 instrument specification |
| [`weather/GAD7.md`](weather/GAD7.md) | GAD-7 instrument specification |
| [`weather/COGFUNC8A.md`](weather/COGFUNC8A.md) | CogFunc 8a instrument specification |

### Misokinesia

| Document | Purpose |
|---|---|
| [`misokinesia/API.md`](misokinesia/API.md) | FastAPI contracts — Misokinesia endpoints |
| [`misokinesia/DESIGN_SPEC.md`](misokinesia/DESIGN_SPEC.md) | Misokinesia UX flows, design system, and component conventions |
| [`misokinesia/MISOKINESIA.md`](misokinesia/MISOKINESIA.md) | Misokinesia task specification |

## Reference Materials

Research instruments and analysis scripts are in `reference/labs/weather-wellness/`.

## Authoritative Legacy Workbook

The current authoritative legacy import workbook is
`reference/data_complete.xlsx`.

- It supersedes `reference/data_full_1-230.xlsx`, which remains a historical
  pre-extension workbook snapshot.
- `data_complete.xlsx` is the workbook used for the 2026-04-07 authoritative
  import refresh and extends imported participant-session coverage through
  `2026-03-04`.
- Workbook-only derived columns such as `day`, `daylight`, `age_simple`,
  `*_z`, `month`, and `season_bin` are retained for reference in
  `imported_session_measures.supplemental_attributes_json` but are not part of
  the current transactional analytics pipeline.
