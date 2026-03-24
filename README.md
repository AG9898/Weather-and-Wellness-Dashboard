<p align="center">
  <img src="reference/UI%20Reference/Logo/logo.png" alt="UBC Psychology Lab Platform" width="120" />
</p>

<h1 align="center">UBC Psychology Lab Research Platform</h1>

<p align="center">
  Multi-lab research platform for administering tasks and validated surveys —
  scoring server-side, storing results in Supabase Postgres, with per-lab data isolation.
</p>

---

## Stack

| Layer    | Technology                        | Role                                         |
|----------|-----------------------------------|----------------------------------------------|
| Frontend | Next.js + TypeScript + Tailwind   | UI, session flow, digit span timing          |
| Backend  | FastAPI (Python)                  | Canonical scoring, validation, all DB writes |
| Database | Supabase (PostgreSQL)            | Managed Postgres; lab reads via Supabase Studio |
| Auth     | Supabase Auth                     | LabMembers only; participants have no account |

## Roles

| Role | Description |
|---|---|
| **LabMember (RA)** | Authenticated; runs sessions, views dashboard, accesses `/import-export` |
| **Participant** | Unauthenticated; completes a single session flow via `session_id` |

## Platform rules

- **Client timing, server scoring.** Frontend handles digit presentation timing only. All scores computed in FastAPI.
- **Anonymous participants.** Results linked by `participant_uuid` + `session_id` — no names or direct identifiers.
- **Lab isolation.** Each lab's data is scoped to its `study_id`. LabMembers cannot read or write another lab's data.
- **Alembic only.** Never alter schema by editing DDL directly. All migrations via `alembic upgrade head`.

## Labs

| Lab slug | Study |
|---|---|
| `weather-wellness` | Weather & Wellness — daily weather × psychological wellbeing (ULS-8, CES-D 10, GAD-7, CogFunc 8a, Digit Span, Misokinesia) |

New lab? See `docs/MULTI_LAB.md`.

## Repository layout

| Path | What it contains |
|---|---|
| `frontend/` | Next.js app — participant + RA UIs, typed API wrappers, Route Handlers |
| `backend/` | FastAPI app — routers, scoring modules, DB models, Alembic migrations |
| `docs/` | Platform-wide: architecture, schema, conventions, decisions, style guide |
| `docs/labs/<slug>/` | Lab-specific: API contracts, design spec, scoring rules, surveys, tasks |
| `reference/UI Reference/` | Universal design assets — logo, branding, component mockups |
| `reference/labs/<slug>/` | Lab-specific research instruments and analysis scripts |
| `scripts/` | Local dev helpers (e.g. `scripts/dev.sh`) |

---

## Quickstart (local development)

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project (database + auth)

### 1) Create `.env` (repo root)

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string (include `?sslmode=require` for IPv4) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_JWT_SECRET` | Backend JWT validation |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend auth |

Optional:

| Variable | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | CORS allow-list (defaults to localhost dev origins) |
| `UPSTASH_REDIS_REST_URL` | Vercel cache layer (Route Handlers) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel cache layer |

Never commit `.env`. Full environment variable reference: `docs/CONVENTIONS.md`.

### 2) Backend (FastAPI)

**macOS / Linux / WSL:**
```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m dotenv -f ../.env run -- alembic upgrade head
python -m dotenv -f ../.env run -- uvicorn app.main:app --reload
```

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
python -m dotenv -f ..\.env run -- alembic upgrade head
python -m dotenv -f ..\.env run -- uvicorn app.main:app --reload
```

- Health check: `http://127.0.0.1:8000/health`
- OpenAPI docs: `http://127.0.0.1:8000/docs`

### 3) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://127.0.0.1:3000`

### One-command startup (bash)

```bash
./scripts/dev.sh
# Override ports:
BACKEND_PORT=8001 FRONTEND_PORT=3001 ./scripts/dev.sh
```

---

## Documentation

**Platform-wide:**

| Document | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | Deployment topology, caching, auth |
| `docs/SCHEMA.md` | Database schema and migrations |
| `docs/CONVENTIONS.md` | Coding standards (full stack) |
| `docs/DECISIONS.md` | Architectural decisions log |
| `docs/MULTI_LAB.md` | Multi-lab data model and onboarding |
| `docs/TESTING.md` | Test infrastructure |
| `docs/styleguide.md` | UI design system |
| `docs/shadcn.md` | shadcn/ui component usage |
| `docs/devSteps.md` | Local setup checklist |

**Weather & Wellness lab:**

| Document | Purpose |
|---|---|
| `docs/labs/weather-wellness/README.md` | Lab overview and data access |
| `docs/labs/weather-wellness/API.md` | FastAPI endpoint contracts |
| `docs/labs/weather-wellness/DESIGN_SPEC.md` | Participant + RA UX flows |
| `docs/labs/weather-wellness/SCORING.md` | Scoring rules |
| `docs/labs/weather-wellness/ANALYTICS.md` | Analytics architecture (MLM, KPIs) |
| `docs/labs/weather-wellness/surveys/` | Survey instrument specs |
| `docs/labs/weather-wellness/tasks/` | Task specs (Digit Span, Misokinesia) |

---

## Deployment

| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Railway (target cutover from Render), health at `/health` |
| Database | Supabase Postgres (target region: `ca-central-1`) |
| Auth | Supabase Auth (same Canada-region project as the target DB) |
| Scheduled jobs | GitHub Actions (weather ingestion; Render keep-alive is transitional until cutover) |

---

## Privacy and data handling

- Participants are anonymous by design. Do not add PII collection.
- Never log direct identifiers or secrets.
- Admin Import/Export is RA-only and must remain protected server-side.
- Lab data isolation is enforced at the application layer; LabMembers cannot access other labs' data.
