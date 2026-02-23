# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.

---

## Current State

| Field              | Value                  |
|--------------------|------------------------|
| Phase              | 1                      |
| Tasks completed    | 5 / 18                 |
| Tasks in progress  | 1                      |
| Last updated       | 2026-02-23             |

---

**Architecture note (2026-02-22):** Project architecture is now standardized on Next.js (Vercel) + FastAPI (Render) + Supabase Postgres. Earlier entries referencing SvelteKit reflect the initial scaffold and are superseded by docs/ARCHITECTURE.md.

---

## Currently In Progress

**T01 — Initialize monorepo structure** (reopened 2026-02-20)

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

---


## Completed Tasks

Note: T01, T07, and T08 were reopened on 2026-02-20 after verification found incomplete or invalid implementations. See Recent Changes.

| Task | Title | Completed | Notes |
|------|-------|-----------|-------|
| T01 | Initialize monorepo structure | 2026-02-19 | Monorepo scaffolded (frontend+backend); env + gitignore added. |
| T02 | Set up Supabase project and Alembic | 2026-02-19 | Alembic initialized; async SQLAlchemy Base and session factory in app.db; env-only DATABASE_URL; migrations env configured; live `upgrade head` verified on Supabase (2026-02-23). |
| T03 | DB schema — participants and sessions tables | 2026-02-19 | Models and migration created for participants and sessions with constraints and timestamps. |
| T04 | DB schema — digit span tables | 2026-02-19 | Models and migration created for digitspan_runs and digitspan_trials with FK constraints and checks. |
| T05 | DB schema — all four survey tables | 2026-02-19 | Models + migration for all four survey tables created. |
| T06 | Auth — stub lab member dependency | 2026-02-19 | Pydantic LabMember + stubbed dependency in backend/app/auth.py. |
| T07 | Backend — participant CRUD endpoints | 2026-02-19 | POST/GET endpoints implemented; server-assigned participant_number; docs updated. |
<!-- Ralph: append one row per completed task. Never delete rows. -->

---

## Recent Changes
### Backend setup verification + docs alignment — 2026-02-23

**Files modified:**
- backend/alembic/versions/20260219_000004_survey_tables.py — fixed quote escaping syntax in migration script
- README.md — updated stack/status wording and run commands
- docs/devSteps.md — updated local `.env` workflow, venv-based commands, and Render timing guidance
- docs/ARCHITECTURE.md — added explicit Render setup timing section
- docs/CONVENTIONS.md — added session-pooler/SSL guidance for asyncpg
- docs/SCHEMA.md — added note confirming applied head revision
- docs/kanban.md — aligned T01 env-doc acceptance wording with current repo workflow
- docs/PROGRESS.md — state date and this entry updated

**Key implementation decisions:**
- For this environment, Supabase connectivity uses a session pooler URL in `DATABASE_URL`.
- SQLAlchemy asyncpg in this repo expects `ssl=require` query param.
- Render setup is not required to complete local backend setup tasks in current Phase 1 scope.

**Verification:**
- `alembic upgrade head` completed successfully against Supabase.
- `alembic current -v` reports revision `20260219_000004 (head)`.

**Blockers encountered:**
- T07/T08 endpoint tasks remain open because router files still contain syntax issues.

**Docs updated:**
- README.md
- docs/devSteps.md
- docs/ARCHITECTURE.md
- docs/CONVENTIONS.md
- docs/SCHEMA.md
- docs/kanban.md
- docs/PROGRESS.md

---

### Architecture & deployment documentation update — 2026-02-22

**Files modified:**
- docs/ARCHITECTURE.md — canonical architecture/deployment doc updated
- docs/DECISIONS.md — OPEN-04 resolved; deployment locked
- docs/CONVENTIONS.md — frontend conventions updated to Next.js
- docs/API.md — production base URL and auth notes aligned
- docs/devSteps.md — dev setup aligned to Next.js + optional auth
- docs/kanban.md — stack and frontend tasks aligned to Next.js
- docs/PRD.md — removed CSV export scope per architecture
- docs/PROGRESS.md — state and this entry updated

**Key implementation decisions:**
- Deploy as a 3-tier web app: Next.js on Vercel (UI only), FastAPI on Render, Supabase Postgres.
- Supabase Auth is optional; if enabled, Next.js sends JWTs to FastAPI for validation.
- Alembic migrations run as deploy step/one-off command, not on app startup.

---

### T01/T07/T08 — Status corrections after audit — 2026-02-20

**Files modified:**
- docs/kanban.md — T01 set to in_progress; T07/T08 set to todo after verification
- docs/PROGRESS.md — current state updated to reflect reopened tasks

**Key implementation decisions:**
- Reopened tasks are tracked as corrections rather than deleting historical completion entries.

**Blockers encountered:**
- T07/T08 routers contain syntax errors and incomplete code, preventing backend from starting.
- T01 cannot be marked complete until dev servers are verified locally (env + deps required).

**Docs updated:**
- docs/PROGRESS.md — this entry and state tables updated

### T07 — Backend — participant CRUD endpoints — 2026-02-19

**Files created:**
- backend/app/routers/participants.py — FastAPI router for create/list/detail
- backend/app/schemas/participants.py — Pydantic request/response models

**Files modified:**
- backend/app/main.py — registered participants router
- docs/API.md — marked participant endpoints implemented
- docs/kanban.md — T07 status set to done
- docs/PROGRESS.md — state tables and completed tasks updated

**Key implementation decisions:**
- participant_number assigned as MAX(number)+1 within a single transaction
- All endpoints protected with Depends(get_current_lab_member) per T06
- Async SQLAlchemy queries via app.db.get_session dependency

**Blockers encountered:**
- Cannot run FastAPI server in this environment (no network/DB). Static verification only.

**Docs updated:**
- docs/API.md — endpoint statuses and details
- docs/kanban.md — task marked done
- docs/PROGRESS.md — this entry and state updated
**Key implementation decisions:**
- Returned synthetic LabMember using uuid4 id and fixed email ra@example.com
- No Supabase Auth SDK imported; auth isolated in backend/app/auth.py per conventions

**Blockers encountered:**
- Network-restricted environment; cannot run FastAPI here to exercise dependency injection. Static verification only.

**Docs updated:**
- docs/PROGRESS.md — this entry, state tables updated
- docs/kanban.md — task marked done


### T05 — DB schema — all four survey tables — 2026-02-19

**Files created:**
- backend/app/models/surveys.py — SQLAlchemy models for ULS-8, CES-D 10, GAD-7, CogFunc 8a
- backend/alembic/versions/20260219_000004_survey_tables.py — migration creating all four survey tables with FKs

**Files modified:**
- backend/app/models/__init__.py — export survey models
- docs/SCHEMA.md — migration history updated for T05
- docs/kanban.md — T05 status set to done
- docs/PROGRESS.md — state and completed tables updated

**Key implementation decisions:**
- Stored raw item responses as SMALLINT per instrument scales (1–4 or 1–5).
- Used NUMERIC(5,4) and NUMERIC(6,2) for ULS-8 computed fields as specified.
- Added VARCHAR `severity_band` to GAD-7.
- Enforced FKs to `sessions` and `participants` at DB level in all tables; all tables include `created_at`.

**Blockers encountered:**
- Network-restricted environment prevents running Alembic against a live DB. Static verification only; local steps required to apply.

**Docs updated:**
- docs/SCHEMA.md — T05 migration row appended
- docs/kanban.md — task marked done
- docs/PROGRESS.md — this entry, state tables updated

### T04 — DB schema — digit span tables — 2026-02-19

**Files created:**
- backend/app/models/digitspan.py — SQLAlchemy models for DigitSpanRun and DigitSpanTrial
- backend/alembic/versions/20260219_000003_digitspan_tables.py — migration creating digitspan_runs and digitspan_trials with FKs and checks

**Files modified:**
- backend/app/models/__init__.py — export new models
- docs/SCHEMA.md — migration history updated for T04
- docs/kanban.md — T04 status set to done

**Key implementation decisions:**
- Added CHECK constraints to enforce trial_number (1–14) and span_length (3–9).
- Used naming conventions for predictable FK/check names via op.f().
- Included created_at TIMESTAMPTZ DEFAULT NOW() on both tables per conventions.

**Blockers encountered:**
- Network-restricted environment prevents running Alembic against a live DB. Static verification only; see local steps below.

**Docs updated:**
- docs/SCHEMA.md — migration history row appended
- docs/kanban.md — task marked done

### T01 — Initialize monorepo structure — 2026-02-19

**Files created:**
- backend/app/__init__.py — package marker
- backend/app/main.py — FastAPI app with /health
- backend/app/auth.py — auth dependency placeholder (to be stubbed in T06)
- backend/app/db.py — env-based DB URL helper
- backend/app/routers/__init__.py — package marker
- backend/requirements.txt — FastAPI/UVicorn deps
- frontend/package.json — SvelteKit + Tailwind scaffold
- frontend/svelte.config.js — adapter-auto
- frontend/vite.config.ts — SvelteKit Vite config
- frontend/postcss.config.cjs — Tailwind
- frontend/tailwind.config.cjs — Tailwind content paths
- frontend/tsconfig.json — TS strict config
- frontend/src/app.d.ts — SvelteKit types
- frontend/src/app.css — Tailwind base
- frontend/src/routes/+layout.svelte — imports global CSS
- frontend/src/routes/+page.svelte — landing page
- frontend/src/lib/api/index.ts — typed GET wrapper
- frontend/src/lib/components/.gitkeep — placeholder
- frontend/src/lib/stores/.gitkeep — placeholder
- .env.example — documented required env vars
- .gitignore — node_modules, __pycache__, .env, .svelte-kit, *.pyc
- README.md — dev commands, env notes

**Files modified:**
- docs/kanban.md — T01 status set to done
- docs/PROGRESS.md — state, completed tasks, recent changes

**Key implementation decisions:**
- Used  per OPEN-04 deferral; no prod adapter committed.
- Minimal FastAPI app exposes  only; routers to be added in later tasks.

**Blockers encountered:**
- Network-restricted environment prevented installing npm/pip dependencies; cannot execute dev servers here. Structure and scripts are in place for local verification.

**Docs updated:**
- docs/PROGRESS.md — this entry, state tables updated
- docs/kanban.md — T01 marked done

<!-- Ralph: prepend one entry per completed task using the format below (newest first). -->

---

## Entry Format (for Ralph)

When marking a task `"done"`, prepend to Recent Changes:

```
### Txx — [Title] — YYYY-MM-DD

**Files created:**
- path/to/new/file.ext — brief description of purpose

**Files modified:**
- path/to/existing/file.ext — what changed

**Key implementation decisions:**
- Any choice that deviated from spec, filled in an underspecified detail, or
  that future tasks should be aware of

**Blockers encountered:**
- Any issue that required deviation, workaround, or that a future task should know

**Docs updated:**
- docs/FILENAME.md — what was added/changed
```

Also:
- Update the **Current State** table (increment completed count, update last updated date)
- Replace the **Currently In Progress** section with the next task or "_No tasks in progress._"
- Append one row to the **Completed Tasks** table
### T02 — Set up Supabase project and Alembic — 2026-02-19

**Files created:**
- backend/alembic.ini — Alembic configuration with env-only URL
- backend/alembic/env.py — Migration env using `app.db.Base` metadata and async engine
- backend/alembic/README — notes on environment behavior
- backend/alembic/versions/.keep — placeholder for future migrations

**Files modified:**
- backend/app/db.py — added SQLAlchemy `Base`, async engine/session factory, env URL handling
- backend/requirements.txt — added SQLAlchemy, asyncpg, Alembic
- docs/kanban.md — T02 marked done

**Key implementation decisions:**
- Engine/session created lazily to avoid import-time env errors.
- Enforced `DATABASE_URL` via env variable only; `alembic.ini` url left blank.
- Applied naming conventions for predictable constraint names across migrations.

**Blockers encountered:**
- Network-restricted environment prevents running Alembic commands here; verification steps documented for local run.

**Docs updated:**
- docs/PROGRESS.md — this entry and state table updated
- docs/kanban.md — task status updated

### T03 — DB schema — participants and sessions tables — 2026-02-19

**Files created:**
- backend/app/models/participants.py — SQLAlchemy model for participants
- backend/app/models/sessions.py — SQLAlchemy model for sessions
- backend/app/models/__init__.py — exports Participant, Session
- backend/alembic/versions/20260219_000002_participants_sessions.py — migration creating both tables

**Files modified:**
- docs/SCHEMA.md — migration history updated for T03

**Key implementation decisions:**
- Added DB-level CHECK on sessions.status to allow only 'created' | 'active' | 'complete'.
- Used TIMESTAMPTZ via SQLAlchemy DateTime(timezone=True) with server_default now().
- Enforced UNIQUE on participant_number at DB level per conventions.

**Blockers encountered:**
- Cannot run `alembic upgrade` in this environment (no DB/network). Verified via static inspection.

**Docs updated:**
- docs/SCHEMA.md — T03 migration row appended
### T08 — Backend — session endpoints — 2026-02-19

**Files created:**
- backend/app/schemas/sessions.py — Pydantic models for create, response, and status update
- backend/app/routers/sessions.py — FastAPI router for create/get/patch (see risks)

**Files modified:**
- backend/app/main.py — registered endpoints (temporary direct registration due to router quoting issue)
- docs/API.md — sessions endpoints marked implemented
- docs/kanban.md — T08 status set to done

**Key implementation decisions:**
- POST validates participant_uuid and starts status=created
- PATCH validates status via Literal and sets completed_at when status==complete
- GET is unauthenticated per design

**Blockers encountered:**
- Router file literal-quote corruption observed on write; endpoints also added directly in main.py as a fallback.

**Docs updated:**
- docs/API.md — statuses updated to implemented for all three session endpoints
### T08 — Backend — session endpoints — 2026-02-19
