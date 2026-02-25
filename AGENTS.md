# AGENTS.md — Weather & Wellness + Misokinesia Research Web App

Internal lab web app for RAs to administer a Backwards Digit Span task and four validated
surveys (ULS-8, CES-D 10, GAD-7, CogFunc 8a), auto-score server-side, and store results
linked to a stable participant UUID and session ID. Lab team reads all data via Supabase
Studio; no CSV export exists. Two roles: authenticated LabMember (RA) and unauthenticated
Participant.

---

## Tech Stack

| Layer    | Technology                        | Role                                         |
|----------|-----------------------------------|----------------------------------------------|
| Frontend | Next.js + TypeScript + Tailwind   | UI, session flow, digit span timing          |
| Backend  | FastAPI (Python)                  | Canonical scoring, validation, all DB writes |
| Database | Supabase (PostgreSQL)             | Managed Postgres; lab reads via Studio       |
| Auth     | Supabase Auth                     | LabMember only; participants have no account |

---

## Core Architectural Rules

- **Client timing, server scoring.** Frontend handles digit presentation timing only. All scores computed in FastAPI. Never score on the client.
- **UUID identity.** All result tables FK to `participant_uuid`. Names stored once in `participants`; must not appear in any result row.
- **Session-scoped data.** Every result row references both `participant_uuid` AND `session_id`. No orphaned rows.
- **No CSV export.** All data access via Supabase Studio or direct SQL. Do not build export endpoints or UI.
- **Auth adapter.** `Depends(get_current_lab_member)` on all RA endpoints. Isolate Supabase JWT/SDK logic in `backend/app/auth.py`.
- **No bare fetch.** All frontend API calls go through typed wrappers in `src/lib/api/`. Never call `fetch` directly from a component.
- **Alembic only.** Never alter schema by editing DDL directly. All migrations via `alembic upgrade head`.

---

## Docs and References

- Do not assume a fixed docs file structure from this file.
- For project references, start from `reference/` and use the latest materials found there.
- Then check `docs/` for current implementation conventions, API contracts, and style guidance.
- For UI work, `docs/styleguide.md` is the canonical style reference.
- For shadcn component usage and CLI patterns, follow `docs/shadcn.md`.

---

## Dev Workflow

```bash
cd backend && uvicorn app.main:app --reload   # start backend
cd frontend && npm run dev                    # start frontend
cd backend && alembic upgrade head            # apply migrations
```

Copy `.env.example` → `.env`. Variables: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`. Never commit `.env`.

---

## Open Decisions

Check current decision records under `reference/` and/or `docs/` before resolving any open item.
Do not resolve open items without explicit instruction from the project owner.
