# CONVENTIONS.md — Code Style and Patterns

> Normative guide for all code in this project. Read before writing any new file.
> Updated when new patterns are established during implementation (not a log — always
> reflects the current standard).

---

## General (Both Frontend and Backend)

- **TypeScript everywhere** in the frontend. No `any` — prefer `unknown` + type narrowing.
- **Python type hints everywhere** in the backend. All FastAPI path functions and Pydantic models must be fully typed.
- **No business logic in route handlers.** Route handlers call service functions; service functions call scoring modules or DB helpers.
- **Never log PII.** Do not log `first_name`, `last_name`, or any identifiable data.
- **UUID v4** for all generated IDs (Python: `uuid.uuid4()`; never client-generated).

---

## Backend (FastAPI)

### Router organization
- One router file per domain: `participants.py`, `sessions.py`, `digitspan.py`, `surveys.py`
- Register routers in `backend/app/main.py` with appropriate prefixes

### Pydantic schemas
- Naming: `...Create` for request bodies, `...Response` for responses
- Never return SQLAlchemy ORM objects directly from endpoints — always serialize to a `...Response` schema
- Place schemas in `backend/app/schemas/`, one file per domain

### Scoring modules
- One file per instrument in `backend/app/scoring/`: `digitspan.py`, `uls8.py`, `cesd10.py`, `gad7.py`, `cogfunc8a.py`
- Each file exposes exactly **one public function**: `score(raw: ...) -> ScoredResult`
- Scoring functions are pure (no DB calls, no side effects) — testable in isolation
- Unit tests are required for each scoring function (all correct, all wrong, mixed)

### Auth
- `Depends(get_current_lab_member)` on all RA-only endpoints
- Participant-facing endpoints (submit digit span, submit survey): validate `session_id` exists and `status == "active"` before accepting data — return 400 or 409 otherwise
- All Supabase Auth SDK calls isolated in `backend/app/auth.py`

### DB access
- Alembic autogenerate from SQLAlchemy models; **always review** generated migration before committing
- `DATABASE_URL` from environment only — never hardcode connection strings
- FK constraints enforced at DB level (not just application level)
- All tables get `created_at TIMESTAMPTZ DEFAULT NOW()`
- For Supabase connectivity in IPv4-only environments, prefer session pooler `DATABASE_URL` values
- With SQLAlchemy asyncpg in this repo, use `ssl=require` query param (not `sslmode=require`)

---

## Frontend (Next.js)

### Route structure
- Each major screen is a `page.tsx` under the App Router
- RA-only pages: `src/app/(ra)/` — protected by auth guard (layout or middleware)
- Participant pages: `src/app/session/[session_id]/` — no auth required

### Components and state
- Shared reusable UI goes in `src/lib/components/`
- Application state: client-side stores in `src/lib/stores/` (current `session_id`, current step, participant mode flag)

### API calls
- **All** API calls go through typed wrapper functions in `src/lib/api/`
- Never call `fetch` directly from a component or page file
- Wrapper functions handle headers (including auth tokens) and type the response

### Styling
- Tailwind utility classes only
- Do not write custom CSS unless Tailwind cannot express the required style

### Digit span timing
- Use **`setTimeout` chains** driven by a state machine — never `setInterval`
- Client manages all digit presentation timing; server receives raw trial data only

---

## Database Conventions

- FKs enforced at the DB level, not just application level
- All tables get `created_at TIMESTAMPTZ DEFAULT NOW()`
- Alembic autogenerate from SQLAlchemy models; review migration before applying
- Connection string from `DATABASE_URL` env var only

---

## Adding a New Survey (Pattern)

Follow this sequence when adding any new instrument in future phases:

1. Confirm exact scoring rules and Likert range with project owner; update `docs/SCORING.md`
2. Create scoring module in `backend/app/scoring/<instrument>.py`
3. Create Pydantic schemas in `backend/app/schemas/`
4. Create Alembic migration for the new survey table; update `docs/SCHEMA.md` migration history
5. Add POST endpoint in `backend/app/routers/surveys.py`; update `docs/API.md`
6. Create Next.js survey route under `src/app/session/[session_id]/<instrument>/page.tsx`
7. Wire new route into the session flow sequence in the appropriate layout or store

---

## Environment Variables

| Variable             | Description                                |
|----------------------|--------------------------------------------|
| `DATABASE_URL`       | Supabase PostgreSQL connection string (backend) |
| `SUPABASE_URL`       | Supabase project URL (server-side use) |
| `SUPABASE_ANON_KEY`  | Supabase anonymous/public key (server-side use) |
| `SUPABASE_JWT_SECRET`| Used by FastAPI to validate Supabase JWTs (only if auth enabled) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (frontend auth; only if auth enabled) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (frontend auth; only if auth enabled) |
