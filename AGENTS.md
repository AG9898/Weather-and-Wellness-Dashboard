# AGENTS.md — UBC Psychology Lab Research Platform

Internal research platform for UBC Psychology labs. Each lab uses the platform to administer
tasks and validated surveys, auto-score server-side, and store results linked to a stable
participant UUID and session ID. Lab members access data via Neon Console. The platform
supports multiple labs and studies; each lab is isolated by `lab_id` in the database and by
`app_metadata.lab` in auth. Two roles: authenticated LabMember (RA/admin) and unauthenticated
Participant.

---

## Tech Stack

| Layer    | Technology                        | Role                                         |
|----------|-----------------------------------|----------------------------------------------|
| Frontend | Next.js + TypeScript + Tailwind   | UI, session flow, digit span timing          |
| Backend  | FastAPI (Python)                  | Canonical scoring, validation, all DB writes |
| Database | Neon (PostgreSQL)                 | Managed Postgres; lab reads via Neon Console |
| Auth     | Supabase Auth                     | LabMember only; participants have no account |

---

## Core Architectural Rules

- **Client timing, server scoring.** Frontend handles digit presentation timing only. All scores computed in FastAPI. Never score on the client.
- **UUID identity.** All result tables FK to `participant_uuid`. Participants are anonymous; do not collect or store names or other direct identifiers.
- **Session-scoped data.** Every result row references both `participant_uuid` AND `session_id`. No orphaned rows.
- **Consent gating is UI-only.** The consent screen gates the participant flow but does not write a consent row/flag to the database.
- **Lab isolation is enforced.** Every data-writing endpoint must resolve the caller's `lab_id` from auth and reject cross-lab writes. Participants, sessions, and study results are always scoped to a single `study_id`. See `docs/MULTI_LAB.md` for the data model.
- **Default timezone.** Day-level semantics (study days, weather linking, dashboard date filtering) use `America/Vancouver` by default. Lab-level overrides are stored in the `labs` table.
- **Study-specific derived fields** (e.g. daylight exposure minutes) are documented in `docs/labs/<lab>/` for the relevant study. Do not assume they apply platform-wide.
- **No participant-facing export.** Participants never download data. Lab access is via Neon Console by default.
- **Admin Import/Export is allowed.** RA-only Import/Export may provide controlled CSV/XLSX downloads and legacy imports. Keep endpoints RA-protected (`Depends(get_current_lab_member)`); do not expose secrets; avoid adding PII.
- **RA navigation is minimal.** RA UI centers on `/dashboard` with an admin-only `/import-export` page; avoid reintroducing participant/session list UIs unless explicitly requested.
- **Start-session demographics are required.** The RA must select demographic values (preset options) before creating a new participant+session; store values on `participants` only.
- **Auth adapter.** `Depends(get_current_lab_member)` on all RA endpoints. Isolate Supabase JWT/SDK logic in `backend/app/auth.py`.
- **No bare fetch.** All frontend API calls go through typed wrappers in `src/lib/api/`. Never call `fetch` directly from a component.
- **Alembic only.** Never alter schema by editing DDL directly. All migrations via `alembic upgrade head`.

---

## Docs and References

- For platform-wide concerns (architecture, conventions, decisions, schema, testing), use `docs/` root files.
- For lab-specific API contracts, design specs, and scoring rules, use `docs/labs/<lab-slug>/`.
- For study-specific research instruments and analysis scripts, use `reference/labs/<lab-slug>/`.
- For universal UI assets (branding, logos, component mockups), use `reference/UI Reference/`.
- For UI style, `docs/styleguide.md` is the canonical reference.
- For shadcn component usage and CLI patterns, follow `docs/shadcn.md`.
- For the multi-lab data model and onboarding new labs, see `docs/MULTI_LAB.md`.

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

Check current decision records under `docs/DECISIONS.md` before resolving any open item.
Do not resolve open items without explicit instruction from the project owner.
