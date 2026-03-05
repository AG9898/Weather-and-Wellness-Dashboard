# CONVENTIONS.md — Code Style and Patterns

> Normative guide for all code in this project. Read before writing any new file.
> Updated when new patterns are established during implementation (not a log — always
> reflects the current standard).

---

## General (Both Frontend and Backend)

- **TypeScript everywhere** in the frontend. No `any` — prefer `unknown` + type narrowing.
- **Python type hints everywhere** in the backend. All FastAPI path functions and Pydantic models must be fully typed.
- **No business logic in route handlers.** Route handlers call service functions; service functions call scoring modules or DB helpers.
- **Never log PII.** Do not log any direct identifiers. Participants are anonymous: do not collect or store names.
- **UUID v4** for all generated IDs (Python: `uuid.uuid4()`; never client-generated).

---

## Backend (FastAPI)

### Router organization
- One router file per domain: `participants.py`, `sessions.py`, `digitspan.py`, `surveys.py`
- Register routers in `backend/app/main.py` with appropriate prefixes

### Admin endpoints (Import/Export)
- Admin data operations (imports/exports) must be **RA-only** (`Depends(get_current_lab_member)`).
- Import endpoints must be **preview-first** (no writes) and then explicit **commit**.
- File uploads use `multipart/form-data`; file downloads must set `Content-Disposition` with the required filename.
- Do not attempt to reconstruct raw survey item rows from imported aggregate values; store aggregates in a dedicated mapping table.
- Import parsing must be deterministic for Excel serial dates and times (see `docs/API.md` Admin Data section); always store the full source row payload in `imported_session_measures.source_row_json`.
- Normalize imported demographic strings conservatively (trim whitespace; canonicalize obvious variants) while preserving the original raw values in `source_row_json`.

### Start session demographics + daylight exposure (Phase 3)
- The RA “Start New Entry” flow must collect participant demographics **before** creating a participant+session.
- Demographic fields are stored on `participants` only (never on `sessions`).
- If the RA selects `"Other"` for `origin` or `commute_method`, store the detail in a dedicated `*_other_text` column (length-limited; avoid PII in UI copy).
- `participants.daylight_exposure_minutes` is derived at session start time as minutes since `DAYLIGHT_START_LOCAL_TIME` in the study timezone (see `docs/DECISIONS.md` RESOLVED-12). Use `compute_daylight_exposure_minutes(session_start_utc)` from `backend/app/config.py`.
- All day-level timezone operations use `STUDY_TIMEZONE = "America/Vancouver"` from `backend/app/config.py`. Never hardcode `"America/Vancouver"` or `"America/Edmonton"` directly in routers or services — import from `app.config`.

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
- Use `PageContainer` (from `src/lib/components/PageContainer.tsx`) as the content wrapper on every page — do not introduce ad-hoc `max-w-*` container divs
- Use `RANavBar` (from `src/lib/components/RANavBar.tsx`) via the RA layout — do not add navigation manually to individual RA pages

### API calls
- **All** API calls go through typed wrapper functions in `src/lib/api/`
- Never call `fetch` directly from a component or page file
- Wrapper functions handle headers (including auth tokens) and type the response

### Caching (Vercel + Upstash)

- Caching is implemented only in **Next.js Route Handlers** under `src/app/api/` (server-side only).
- RA-only cached endpoints must **verify Supabase JWTs** before returning cached data (no auth bypass).
- Cache is strictly for **read** performance; all canonical validation/scoring and all DB writes remain in FastAPI on Render.
- Cache keys must use a clear prefix (e.g. `ww:`) and be versioned (e.g. `...:v1`) to allow safe invalidation on schema changes.
- Cached values must not include direct identifiers (participants are anonymous) and must not include any secrets.
- JWT verification in Route Handlers uses `jose`: ES256 via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) as primary; HS256 with `SUPABASE_JWT_SECRET` as fallback.
- Redis client (`@upstash/redis`) is instantiated only when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set; handlers degrade gracefully without them.
- Redis writes should be awaited in Route Handlers; fire-and-forget writes can be dropped in serverless runtimes.
- Route Handler calls from Vercel to Render should use explicit request timeouts (current standard: 15s per backend fetch) so UI paths fail fast instead of hanging on backend stalls.
- For cached endpoints, `mode=live` should attempt a stale-cache fallback when backend fetches fail, and expose cache-state diagnostics via `x-ww-cache` response headers.
- Current cache keys:
  - `ww:ra:dashboard:v1` (TTL 6 hours) — summary + today weather bundle
  - `ww:ra:weather:range:v1:<date_from>:<date_to>` (TTL 24 hours) — weather-only trend bundle

### Styling
- Tailwind utility classes only
- Do not write custom CSS unless Tailwind cannot express the required style
- UI visuals (tokens, typography, spacing, component feel) must follow `docs/styleguide.md`
- For shadcn component installation/usage patterns, follow `docs/shadcn.md`
- Reference UIs are for direction only; do not clone non-required components verbatim

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
| `ALLOWED_ORIGINS`    | Comma-separated CORS allowed origins for FastAPI (backend). Defaults to localhost dev origins when unset. Set to Vercel URL(s) in production. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (frontend auth; only if auth enabled) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (frontend auth; only if auth enabled) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (server-side only; provided by Vercel integration or set for local dev). |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token (server-side only; provided by Vercel integration or set for local dev). |
| `DAYLIGHT_START_LOCAL_TIME` | Local clock time `HH:MM` used to compute `participants.daylight_exposure_minutes` (default `06:00` in `America/Vancouver`). |
| `WEATHER_INGEST_SHARED_SECRETS` | Comma-separated shared secrets accepted by `POST /weather/ingest/ubc-eos` (GitHub Actions path). |
| `WEATHER_INGEST_COOLDOWN_SECONDS` | Cooldown window (seconds) for per-station ingestion (default 600). |

---

## Weather Ingestion (Planned)

> Canonical feature spec: `docs/WEATHER_INGESTION.md`

Rules:
- Weather ingestion is **day-level** (local day `America/Vancouver`), not hourly-series.
- Use `study_days` as the relational day key for both `sessions` and `weather_daily`.
- The ingest endpoint must enforce:
  - per-station cooldown (default 10 minutes)
  - per-station advisory lock to prevent concurrent runs
  - dual auth: LabMember JWT or GitHub Actions shared secret
