# CLAUDE.md — Weather & Wellness + Misokinesia Research Web App

Internal lab web app for RAs to administer a Backwards Digit Span task and four validated
surveys (ULS-8, CES-D 10, GAD-7, CogFunc 8a), auto-score server-side, and store results
linked to a stable participant UUID and session ID. Lab team reads all data via Supabase
Studio; no CSV export exists. Two roles: authenticated LabMember (RA) and unauthenticated
Participant.

---

## Tech Stack

| Layer    | Technology                        | Role                                         |
|----------|-----------------------------------|----------------------------------------------|
| Frontend | SvelteKit + TypeScript + Tailwind | UI, session flow, digit span timing          |
| Backend  | FastAPI (Python)                  | Canonical scoring, validation, all DB writes |
| Database | Supabase (PostgreSQL)             | Managed Postgres; lab reads via Studio       |
| Auth     | Supabase Auth                     | LabMember only; participants have no account |

---

## Core Architectural Rules

- **Client timing, server scoring.** Frontend handles digit presentation timing only. All scores computed in FastAPI. Never score on the client.
- **UUID identity.** All result tables FK to `participant_uuid`. Names stored once in `participants`; must not appear in any result row.
- **Session-scoped data.** Every result row references both `participant_uuid` AND `session_id`. No orphaned rows.
- **No CSV export.** All data access via Supabase Studio or direct SQL. Do not build export endpoints or UI.
- **Auth adapter.** `Depends(get_current_lab_member)` on all RA endpoints. Stub in dev (T06); real Supabase JWT in T18. Isolate SDK calls in `backend/app/auth.py`.
- **No bare fetch.** All frontend API calls go through typed wrappers in `src/lib/api/`. Never call `fetch` directly from a component.
- **Alembic only.** Never alter schema by editing DDL directly. All migrations via `alembic upgrade head`.

---

## Repository Structure

```
project-root/
├── CLAUDE.md                    ← this file (navigation hub — read first)
├── docs/
│   ├── kanban.md                ← Ralph task queue (JSON)
│   ├── SCORING.md               ← scoring summary index (points to instrument docs)
│   ├── SCHEMA.md                ← full DB schema (8 tables)
│   ├── CONVENTIONS.md           ← code style, patterns, file organization
│   ├── API.md                   ← living API reference (grows as backend builds)
│   ├── DECISIONS.md             ← open + resolved architectural decisions
│   ├── DESIGN_SPEC.md           ← UX flow, UI conventions
│   ├── PROGRESS.md              ← living task completion log
│   ├── DIGITSPAN.md             ← digit span task: timing, trials, instructions, scoring
│   ├── ULS8.md                  ← ULS-8 items, scale, scoring formula
│   ├── CESD10.md                ← CES-D 10 items, scale, scoring formula
│   ├── GAD7.md                  ← GAD-7 items, scale, scoring, severity bands
│   └── COGFUNC8A.md             ← CogFunc 8a items, scale, PROMIS reverse scoring
├── frontend/src/
│   ├── lib/components/          ← reusable UI components
│   ├── lib/stores/              ← session state, participant mode flag
│   ├── lib/api/                 ← typed fetch wrappers (all API calls go here)
│   └── routes/
│       ├── (ra)/                ← RA-only pages (auth-guarded)
│       └── session/[session_id] ← participant-facing pages (no auth)
└── backend/app/
    ├── routers/                 ← one file per domain
    ├── models/                  ← SQLAlchemy ORM models
    ├── schemas/                 ← Pydantic request/response schemas
    ├── scoring/                 ← one scoring module per instrument
    ├── db.py                    ← Supabase Postgres connection
    └── auth.py                  ← get_current_lab_member dependency
```

---

## Context Guide — Read Before Starting Any Task

| Task type                          | Read these docs                                                    |
|------------------------------------|--------------------------------------------------------------------|
| Infra / monorepo setup             | docs/CONVENTIONS.md, docs/DECISIONS.md                             |
| DB migration / ORM model           | docs/SCHEMA.md, docs/CONVENTIONS.md                                |
| Backend digit span scoring         | docs/DIGITSPAN.md, docs/SCHEMA.md, docs/CONVENTIONS.md            |
| Backend survey scoring (ULS-8)     | docs/ULS8.md, docs/SCHEMA.md, docs/CONVENTIONS.md                 |
| Backend survey scoring (CES-D 10)  | docs/CESD10.md, docs/SCHEMA.md, docs/CONVENTIONS.md               |
| Backend survey scoring (GAD-7)     | docs/GAD7.md, docs/SCHEMA.md, docs/CONVENTIONS.md                 |
| Backend survey scoring (CogFunc)   | docs/COGFUNC8A.md, docs/SCHEMA.md, docs/CONVENTIONS.md            |
| Backend API endpoint               | docs/SCHEMA.md, docs/CONVENTIONS.md, docs/API.md                  |
| Frontend digit span screen         | docs/DIGITSPAN.md, docs/API.md, docs/CONVENTIONS.md               |
| Frontend ULS-8 / CES-D 10 screens  | docs/ULS8.md, docs/CESD10.md, docs/API.md, docs/CONVENTIONS.md    |
| Frontend GAD-7 / CogFunc screens   | docs/GAD7.md, docs/COGFUNC8A.md, docs/API.md, docs/CONVENTIONS.md |
| Frontend RA pages                  | docs/API.md, docs/CONVENTIONS.md                                   |
| Auth implementation                | docs/CONVENTIONS.md, docs/DECISIONS.md                             |
| Any task touching open decisions   | docs/DECISIONS.md                                                  |

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

See `docs/DECISIONS.md`. Do not resolve open items without explicit instruction from the project owner.
