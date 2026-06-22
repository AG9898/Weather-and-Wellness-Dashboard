<!-- CLAUDE.md is a symlink to this file. Claude CLI injects it on startup; AGENTS.md is the canonical source. Edit AGENTS.md only. -->
# AGENTS.md — UBC Psychology Lab Research Platform

Internal research platform for UBC Psychology labs. Each lab uses the platform to administer
tasks and validated surveys, auto-score server-side, and store results linked to a stable
participant UUID and session ID. Lab members access data via Supabase Studio. The platform
supports multiple labs and studies; each lab is isolated by `lab_id` in the database and by
`app_metadata.lab` in auth. Two roles: authenticated LabMember (RA/admin) and unauthenticated
Participant.

---

## Tech Stack

| Layer    | Technology                        | Role                                         |
|----------|-----------------------------------|----------------------------------------------|
| Frontend | Next.js + TypeScript + Tailwind   | UI, session flow, digit span timing          |
| Backend  | FastAPI (Python)                  | Canonical scoring, validation, all DB writes |
| Database | Supabase (PostgreSQL)            | Managed Postgres; lab reads via Supabase Studio |
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
- **No participant-facing export.** Participants never download data. Lab access is via Supabase Studio by default.
- **Admin Import/Export is allowed.** RA-only Import/Export may provide controlled CSV/XLSX downloads and legacy imports. Keep endpoints RA-protected (`Depends(get_current_lab_member)`); do not expose secrets; avoid adding PII.
- **RA navigation is minimal.** RA UI centers on `/dashboard` with an admin-only `/import-export` page; avoid reintroducing participant/session list UIs unless explicitly requested.
- **Start-session demographics are required.** The RA must select demographic values (preset options) before creating a new participant+session; store values on `participants` only.
- **Auth adapter.** `Depends(get_current_lab_member)` on all RA endpoints. Isolate Supabase JWT/SDK logic in `backend/app/auth.py`.
- **No bare fetch.** All frontend API calls go through typed wrappers in `src/lib/api/`. Never call `fetch` directly from a component.
- **Alembic only.** Never alter schema by editing DDL directly. All migrations via `alembic upgrade head`.
- **Pinned backend deps.** `backend/requirements.txt` (runtime) and `backend/requirements-dev.txt` (test toolchain) are exact-pinned and are the single source of truth CI and Railway install from. When adding/bumping a backend dependency, edit these files (never install ad-hoc), and run `scripts/check-deps.sh --fix` to sync `backend/.venv`. Run `scripts/check-deps.sh` before backend tests so local matches CI; do not "fix" a CI-only test failure without first ruling out venv drift via that script.
- **Active task board.** Use `docs/workboard.json` as the canonical active task queue. `docs/progress/PROGRESS_LOG.md` is archive history only.
- **Repo-local task skills.** Use the repo-local workflow skills under `.codex/skills/` (`project-plan`, `query-workboard`, `start-task`, `ralphloop`) for planning, board execution, or delegated loops. These are symlinked from `.agents/skills/`, where the canonical implementations live. `ralph_loop.sh` is CLI fallback only.
  - To inspect the active queue without executing: use `query-workboard`.
  - To implement a single task end-to-end: use `start-task`.
  - To run autonomous multi-task loops (e.g. "complete the next 3 tasks"): use `ralphloop`.
  - Do not invoke `ralphloop` for a single task; do not invoke `start-task` in a loop manually.
- **Workboard schema.** Active tasks in this repo use the lean `tasks[]` schema in `docs/workboard.json`, with `docs`, `files`, `commands`, and `acceptance_criteria` fields. Do not expect older `read_docs` or `updates_docs` fields from other repos.

---

## Docs and References

- Start with `docs/INDEX.md` for the canonical documentation routing map.
- For platform-wide concerns (architecture, conventions, decisions, schema, testing), use `docs/` root files.
- For the planned RA data chatbot and LLM data-access boundary, use `docs/AI_CHAT.md`.
- For lab-specific API contracts, design specs, and scoring rules, use `docs/labs/<lab-slug>/`.
- **Lab component structure.** Each lab under `docs/labs/<lab-slug>/` is organized by component. The lab `README.md` is the navigation hub. Each component lives in its own subdirectory (`docs/labs/<lab-slug>/<component>/`) and contains its own `API.md`, `DESIGN_SPEC.md`, and component-specific assets. Lab-level docs cover cross-component concerns only. Weather-Wellness components: `weather/` and `misokinesia/`. IHTT component: `poffenberger/`.
- For study-specific research instruments and analysis scripts, use `reference/labs/<lab-slug>/`.
- For universal UI assets (branding, logos, component mockups), use `reference/UI Reference/`.
- For UI style, `docs/styleguide.md` is the canonical reference. `docs/UI_REDESIGN_2026.md` is historical context only and is not active implementation guidance.
- For shadcn component usage and CLI patterns, follow `docs/shadcn.md`.
- For the multi-lab data model and onboarding new labs, see `docs/MULTI_LAB.md`.
- For environment and secret configuration, see `docs/ENV_VARS.md`.
- For active task metadata and current work queue, use `docs/workboard.json`.
- For repo-local task automation prompts and loop guidance, use `.codex/skills/`.

---

## Task Execution

- Start from `AGENTS.md`, then `docs/workboard.json`, then the selected task’s `docs` and `files` entries.
- Treat a task’s `commands` array as its preferred verification checklist.
- If a task `commands` array is empty or absent, add unit tests for changed modules plus a build check.
- If `commands` exist but omit a coverage type clearly required by the changed code (for example, a new API endpoint with no route test), add only that missing coverage.
- Never run the full test suite as a substitute for targeted coverage.
- Update canonical docs when behavior, contracts, schema, or workflow guidance changes.
- Do not append to `docs/progress/PROGRESS_LOG.md`; it is archive-only.
- Mark the task done only by updating `docs/workboard.json` after verification passes.

---

## Documentation Maintenance

Every agent session is responsible for leaving documentation in a better state than it found.
These rules are not optional and apply to every task, not just doc-specific tasks.

- **Update docs when you change behaviour.** If a task changes an API contract, scoring rule,
  env var, route, schema, or workflow, you must update the relevant canonical doc in the same
  commit. Do not defer doc updates to a follow-on task.

- **Maintain routing and links.** If you create, rename, move, or delete any file under `docs/`,
  update `docs/INDEX.md` in the same commit and fix all affected references. Also add or update
  links in the nearest parent index (`docs/labs/<lab>/README.md`, `AGENTS.md` Docs section, or
  `docs/labs/README.md` as appropriate). An unreachable file is as bad as a missing file.

- **Fix broken links you encounter.** If you open a doc and find a broken relative link, fix it
  before you close the file — even if it is outside your task scope. Record the fix in your
  commit message.

- **Do not create planning or working-draft docs.** Use workboard.json task notes for in-flight
  design decisions. Do not create `working-*.md` or `*_DRAFT.md` files in the docs tree.

- **One source of truth per topic.** Before creating a new doc, check whether the topic is
  already covered. If it is, extend the existing doc. Duplication is a bug.

- **Path format.** All doc references use paths relative to the repo root
  (e.g. `docs/labs/weather-wellness/weather/API.md`). Never use bare filenames or leading slashes.

---

## Dev Workflow

```bash
set -a && source .env && set +a && cd backend && PYTHONPATH=. uvicorn app.main:app --reload   # start backend
cd frontend && npm run dev                    # start frontend
scripts/alembic-upgrade-head.sh                    # apply migrations
scripts/check-deps.sh                         # verify backend/.venv matches the pins
scripts/check-deps.sh --fix                   # reinstall venv to match the pins
```

All backend commands must be run from the repo root using the `cd backend && PYTHONPATH=.` prefix pattern shown above after loading repo-root `.env`, except migrations, which should use `scripts/alembic-upgrade-head.sh`.
Before running backend tests, run `scripts/check-deps.sh` (or `--fix`) so the local `backend/.venv` matches the pins CI installs — a stale venv makes tests pass locally but fail in CI (and vice versa).
Copy `.env.example` → `.env` at the repo root.
See `docs/ENV_VARS.md` for the full variable reference (including conditional requirements).
If `.env.example` is missing, derive required variables from the Railway/Vercel/current backend sections in `docs/ARCHITECTURE.md` and `docs/ENV_VARS.md`.
Never commit `.env`.
For migrations, set `DATABASE_MIGRATION_URL` to the Supabase session pooler or direct DB URL. Do not run Alembic through the transaction pooler on port `6543`.

### Operational Tooling

For service or infrastructure debugging, assume the project may already have the Vercel, Supabase, and Railway CLIs configured locally. Agents may use them for log inspection, environment checks, deployment status, or service diagnostics when relevant. These tools are optional aids, not required validation steps.

---

## Open Decisions

Check current decision records under `docs/DECISIONS.md` before resolving any open item.
Do not resolve open items without explicit instruction from the project owner.
