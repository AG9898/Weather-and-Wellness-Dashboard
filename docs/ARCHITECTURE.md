# Architecture — Phase 1

## Stack
Frontend: SvelteKit + TypeScript + Tailwind
Backend: FastAPI (Python)
DB: Postgres
Auth: Managed auth (recommended)

## Core Tables

participants
- participant_uuid (PK)
- participant_number (unique int)
- first_name
- last_name

sessions
- session_id (PK)
- participant_uuid (FK)
- status
- timestamps

digitspan_runs
digitspan_trials
survey_uls8
survey_cesd10
survey_gad7
survey_cogfunc8a

## Scoring
Client handles timing.
Server performs canonical scoring + validation.
