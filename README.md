# Weather & Wellness + Misokinesia Research Web App

Monorepo for the lab app stack: Next.js frontend + FastAPI backend + Supabase Postgres.

Current workspace status: backend infra/migrations are set up and verified; frontend scaffold is pending completion (see T01).

## Project Docs
- Architecture: `docs/ARCHITECTURE.md`
- Task queue: `docs/kanban.md`
- Progress log: `docs/PROGRESS.md`
- Local setup/runbook: `docs/devSteps.md`

## Dev
- Backend deps: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Backend API: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload`
- DB migrations: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/alembic upgrade head`

## Environment
Create a root `.env` and set required values from `docs/CONVENTIONS.md`:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET` (only when auth is enabled)

Notes:
- Do not commit `.env`.
- For Supabase session pooler URLs used with asyncpg, prefer `...?ssl=require`.
