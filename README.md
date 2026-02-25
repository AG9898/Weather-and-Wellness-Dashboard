# Weather & Wellness + Misokinesia Research Web App

Monorepo for the lab app stack: Next.js frontend + FastAPI backend + Supabase Postgres.

Current workspace status: monorepo initialized — Next.js frontend and FastAPI backend both start cleanly. Backend infra/migrations are set up and verified.

## Project Docs
- Architecture: `docs/ARCHITECTURE.md`
- UI style guide: `docs/styleguide.md`
- shadcn component guide: `docs/shadcn.md`
- Task queue: `docs/kanban.md`
- Progress log: `docs/PROGRESS.md`
- Local setup/runbook: `docs/devSteps.md`

## Dev
- Backend deps: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Backend API: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload`
- Frontend deps: `cd frontend && npm install`
- Frontend dev: `cd frontend && npm run dev`
- DB migrations: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/alembic upgrade head`

### One-command local startup
- Start backend + frontend together: `./scripts/dev.sh`
- Stop both: `Ctrl+C`
- Optional ports/host override: `BACKEND_PORT=8001 FRONTEND_PORT=3001 HOST=127.0.0.1 ./scripts/dev.sh`

## Environment
Create a root `.env` and set required values from `docs/CONVENTIONS.md`:
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET` (only when auth is enabled)
- `NEXT_PUBLIC_SUPABASE_URL` (frontend, only when auth is enabled)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend, only when auth is enabled)

Notes:
- Do not commit `.env`.
- For Supabase session pooler URLs used with asyncpg, prefer `...?ssl=require`.
