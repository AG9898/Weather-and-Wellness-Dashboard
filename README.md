<p align="center">
  <img src="reference/UI%20Reference/Logo/logo.png" alt="Weather &amp; Wellness" width="120" />
</p>

<h1 align="center">Weather &amp; Wellness + Misokinesia Research Web App</h1>

<p align="center">
  Internal lab web app for administering a Backwards Digit Span task and validated surveys,
  scoring server-side, and storing results in Supabase (Postgres).
</p>

---

## Stack (at a glance)

- **Frontend:** Next.js (TypeScript) + Tailwind + shadcn/ui (`frontend/`)
- **Backend:** FastAPI (Python) - canonical validation/scoring + all DB writes (`backend/`)
- **Database:** Supabase Postgres (lab reads data via Supabase Studio)
- **Auth:** Supabase Auth for LabMembers/RAs only (participants do not have accounts)

## Roles and flow

- **LabMember (RA):** authenticated; uses `/dashboard` and RA-only admin tools like `/import-export`
- **Participant:** unauthenticated; completes a single session flow via a `session_id`

Core rules:

- **Client timing, server scoring:** the frontend handles digit presentation timing only; the backend scores everything.
- **Anonymous participants:** results are linked by `participant_uuid` + `session_id` (no names or direct identifiers).
- **Session-scoped rows:** no orphaned results; every result row references both identifiers.
- **Study timezone:** day-level semantics use `America/Vancouver`.

## What this app includes

- **Backwards Digit Span task** (client timing; server scoring)
- **Validated surveys**: ULS-8, CES-D 10, GAD-7, CogFunc 8a (scored server-side)
- **RA dashboard** for study progress + weather context
- **RA-only Import/Export** for controlled legacy imports and admin exports (CSV/XLSX)
- **Weather ingestion** (scheduled via GitHub Actions) with day-level semantics in `America/Vancouver`

## Repository layout

| Path | What it contains |
|---|---|
| `frontend/` | Next.js app (participant + RA UIs, typed API wrappers, optional cache handlers) |
| `backend/` | FastAPI app (routers, scoring modules, DB models, Alembic migrations) |
| `docs/` | API contracts, architecture, schema, scoring rules, style guide |
| `reference/` | Study materials + UI references (source PDFs/images, legacy data) |
| `scripts/` | Local dev helpers (e.g. `scripts/dev.sh`) |

## Quickstart (local development)

### Prereqs

- Python 3.11+
- Node.js 18+
- A Supabase project + Postgres connection string

### 1) Create `.env` (repo root)

Create a file at `.env` and set at least:

- `DATABASE_URL` (Supabase session pooler URL; include `ssl=require`)

Optional / when enabled:

- `ALLOWED_ORIGINS` (CORS allow-list; defaults to localhost dev origins when unset)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (backend Supabase SDK usage)
- `SUPABASE_JWT_SECRET` (backend JWT validation when RA auth is enabled)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend auth when enabled)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (Vercel cache layer)

Notes:

- Do not commit `.env`.
- Full environment conventions live in `docs/CONVENTIONS.md`.

### 2) Backend (FastAPI)

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
python -m dotenv -f ..\.env run -- alembic upgrade head
python -m dotenv -f ..\.env run -- uvicorn app.main:app --reload
```

macOS/Linux/WSL (bash):

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m dotenv -f ../.env run -- alembic upgrade head
python -m dotenv -f ../.env run -- uvicorn app.main:app --reload
```

Backend URLs:

- Health: `http://127.0.0.1:8000/health`
- OpenAPI docs: `http://127.0.0.1:8000/docs`

### 3) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend URL (default): `http://127.0.0.1:3000`

### One-command startup (optional)

If you have a bash-compatible shell (WSL, Git Bash, macOS/Linux), you can start both services with:

```bash
./scripts/dev.sh
```

Overrides:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=3001 HOST=127.0.0.1 ./scripts/dev.sh
```

## Documentation index

- Architecture and deployment: `docs/ARCHITECTURE.md`
- Backend API contracts: `docs/API.md`
- Schema + migrations: `docs/SCHEMA.md`
- Scoring rules: `docs/SCORING.md` and per-instrument docs in `docs/`
- UI style guide: `docs/styleguide.md`
- shadcn usage guide: `docs/shadcn.md`
- Local setup / verification checklist: `docs/devSteps.md`
- Decisions log: `docs/DECISIONS.md`

## Deployment (high level)

- **Frontend:** Vercel (Next.js)
- **Backend:** Render (FastAPI), health endpoint at `/health`
- **Database:** Supabase Postgres (lab reads via Supabase Studio)
- **Scheduled jobs:** GitHub Actions (e.g. daily weather ingestion) - see `docs/ARCHITECTURE.md`

## Privacy and data handling

- Participants are anonymous by design; do not add PII collection.
- Do not log direct identifiers or secrets.
- Admin Import/Export features are RA-only and must remain protected server-side.
