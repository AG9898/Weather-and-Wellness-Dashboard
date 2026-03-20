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

Lab data is accessed via **Neon Console** (direct Postgres access). There is no participant-facing
data export. RA dashboard is read-only for data review; all bulk exports go through the
`/import-export` page (RA-only).

## Lab Slug

`weather-wellness` — used as `app_metadata.lab` value in Supabase Auth and as `labs.slug`
in the database.

## Key Documents

| Document | Purpose |
|---|---|
| `API.md` | FastAPI endpoint contracts for this lab's sessions, surveys, and tasks |
| `DESIGN_SPEC.md` | Participant and RA UX flows |
| `SCORING.md` | Server-side scoring rules for all instruments |
| `ANALYTICS.md` | Analytics architecture — MLM model, KPIs, snapshot system |
| `WEATHER_INGESTION.md` | Weather data ingestion via UBC EOS station |
| `HISTORICAL_WEATHER_BACKFILL.md` | Historical weather backfill procedure |
| `surveys/` | Instrument specifications (ULS8, CESD10, GAD7, CogFunc8a) |
| `tasks/` | Task specifications (Digit Span, Misokinesia) |

## Reference Materials

Research instruments and analysis scripts are in `reference/labs/weather-wellness/`.
