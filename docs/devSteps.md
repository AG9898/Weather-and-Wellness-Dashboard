# devSteps.md — Developer Setup and Verification Steps

> This guide lists the steps only the developer can perform locally (env config,
> Supabase setup, installs, and running servers). Each step includes related task IDs.
> For deployment boundaries and env ownership, see `docs/ARCHITECTURE.md` and
> `docs/CONVENTIONS.md`.

---

## Prereqs

- Python 3.11+ and Node.js 18+ installed
- Supabase project created (Phase 1)

---

## Setup Steps

| Step | Action | Related tasks |
|------|--------|---------------|
| 1 | Create a Supabase project and collect: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. If auth is enabled, also collect `SUPABASE_JWT_SECRET` and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the frontend. | T02 | 
| 2 | Create a local root `.env` and fill required variables. | T01, T02 |
| 3 | Install backend deps: `cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`. | T01 |
| 4 | Install frontend deps: `cd frontend && npm install`. | T01 |
| 5 | Apply migrations: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/alembic upgrade head`. | T02, T03, T04, T05 |
| 6 | Start backend: `cd backend && set -a && source ../.env && set +a && PYTHONPATH=. .venv/bin/uvicorn app.main:app --reload`. | T01, T07, T08 |
| 7 | Start frontend: `cd frontend && npm run dev`. | T01 |
| 8 | After T07/T08 are corrected, smoke-test endpoints (create participant, create session, update session status) and confirm rows appear in Supabase Studio. | T07, T08 |

---

## Verification Checklist

- `alembic upgrade head` completes without errors against your Supabase DB. (T02–T05)
- `alembic current -v` reports `Rev: 20260219_000004 (head)` after initial setup. (T02–T05)
- Backend starts cleanly and exposes `/health`. (T01)
- Frontend dev server starts without Next.js compile errors. (T01)
- Participant/session endpoints return expected status codes once T07/T08 are fixed. (T07–T08)

---

## Render Requirement Timing

- You do **not** need Render configured to complete local backend setup tasks in Phase 1 (`T02`–`T06` and schema work in `T03`–`T05`).
- You need Render only when deploying/running the hosted FastAPI service.
- Render backend env vars when deployed:
  - `DATABASE_URL` (required now)
  - `SUPABASE_JWT_SECRET` (required once T18 auth is enabled)
  - `SUPABASE_URL` / `SUPABASE_ANON_KEY` (only if backend code consumes them in that phase)

---

## Pooler Note

- In IPv4-only environments, use Supabase **session pooler** for `DATABASE_URL`.
- With SQLAlchemy asyncpg in this repo, use `ssl=require` in the URL query string.
