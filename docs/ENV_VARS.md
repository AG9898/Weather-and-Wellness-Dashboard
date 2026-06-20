# ENV_VARS.md — Canonical Environment Variable Reference

Single source of truth for environment and secret configuration across this platform.
If any other doc conflicts with this file, update that doc to point here.

**Where set:** vars are consumed at runtime by the service that needs them.
- **Root `.env`** — repo-root file for all local backend, frontend, and admin CLI dev vars. Never committed.
- **Backend runtime** — Railway service env in production.
- **Frontend runtime** — Vercel project env in production (set via Vercel Dashboard or `vercel env add`).
- `.env.example` documents the canonical local backend and frontend vars with placeholder values.

Current production uses Vercel for the frontend, Railway for the FastAPI backend, and the Canada-region Supabase project.

JWT verification note: same-origin Route Handlers use ES256/JWKS as the primary path and only fall back
to HS256 when `SUPABASE_JWT_SECRET` is set. See `docs/ARCHITECTURE.md` (Auth section) for full topology.

---

## Backend Variables (Railway / root `.env`)

| Variable | Required | Default | Description | How to obtain |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | — | Supabase PostgreSQL asyncpg connection string for app runtime (`ssl=require`). Use the transaction pooler on port `6543` for deployed/serverless-style runtime connections. | Supabase Dashboard → Project Settings → Database → Connection String (URI, Transaction pooler) |
| `DATABASE_MIGRATION_URL` | Required for migrations | — | Supabase PostgreSQL asyncpg connection string for Alembic/admin schema work (`ssl=require`). Use the session pooler on port `5432`, or the direct DB URL when IPv6/direct connectivity is available. `backend/alembic/env.py` prefers this value over `DATABASE_URL`. | Supabase Dashboard → Project Settings → Database → Connection String (URI, Session pooler or Direct connection) |
| `SUPABASE_URL` | Yes | — | Supabase project REST/Auth base URL. | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase public anon key for server-side SDK calls. | Supabase Dashboard → Project Settings → API → `anon` key |
| `SUPABASE_JWT_SECRET` | Conditional (HS256 fallback only) | — | JWT secret for HS256 fallback verification. Not required when using ES256/JWKS only. | Supabase Dashboard → Project Settings → API → JWT Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Conditional (admin/invite routes) | — | Service-role key bypasses RLS — server-only, never expose to browser. Required by admin user management and invite acceptance routes. | Supabase Dashboard → Project Settings → API → `service_role` key |
| `ALLOWED_ORIGINS` | Yes (production) | Localhost allowlist | Comma-separated CORS origin allowlist for FastAPI. Include exact Vercel Preview origins while smoke-testing the migration stack. | Set to the deployed Vercel frontend URL(s), e.g. `https://ubcpsych.com` |
| `INVITE_EMAIL_PROVIDER` | Conditional (invite email) | `resend` | Transactional email provider for app-owned admin invitations. Only `resend` is implemented. | Hardcode `resend` |
| `RESEND_API_KEY` | Conditional (`INVITE_EMAIL_PROVIDER=resend`) | — | Resend API key for sending invite emails from the backend. | [resend.com](https://resend.com) Dashboard → API Keys |
| `ADMIN_EMAIL_FROM` | Conditional (invite email) | — | Verified sender address for invite emails, e.g. `team@ubcpsych.com`. Must be verified in Resend. | Resend Dashboard → Domains (verify `ubcpsych.com`); address is `team@ubcpsych.com` |
| `SITE_URL` | Conditional (invite flow) | — | App base URL used to build invite acceptance links (`/set-password?invite=<token>`). | `https://ubcpsych.com` (production) or `http://localhost:3000` (dev) |
| `ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID` | Conditional (admin invite CLI) | — | Supabase Auth UUID recorded as `created_by_lab_member_id` when `backend/admin_cli/invite_user.py` creates app-owned invites without an interactive admin JWT. Can be overridden with `--created-by-lab-member-id`. | Use the admin Auth user UUID responsible for the batch invite run |
| `DAYLIGHT_START_LOCAL_TIME` | Optional | `06:00` | Local `HH:MM` clock time for computing `daylight_exposure_minutes` in study timezone. | Hardcode or omit to accept default |
| `WEATHER_INGEST_SHARED_SECRETS` | Conditional (weather ingest) | — | Comma-separated shared secrets for `POST /weather/ingest/ubc-eos` (supports key rotation). | Generate a random UUID per environment; store in Railway and GitHub Actions secrets |
| `WEATHER_INGEST_COOLDOWN_SECONDS` | Optional | `600` | Per-station weather ingestion cooldown window in seconds. | Hardcode or omit to accept default |
| `OPENROUTER_API_KEY` | Conditional (RA chatbot) | — | Server-only OpenRouter API key for the planned RA data chatbot. Never expose to browser code. | OpenRouter dashboard |
| `OPENROUTER_MODEL` | Conditional (RA chatbot) | — | Model slug used by the RA data chatbot. Configure at runtime so current free models can be used or replaced without code/schema changes. | OpenRouter model catalog |
| `OPENROUTER_REQUIRE_ZDR` | Optional (RA chatbot) | `true` | When enabled, chatbot requests must require Zero Data Retention/provider privacy controls where OpenRouter supports them. If the configured model cannot satisfy the requirement, chat fails closed with a generic unavailable state. | Hardcode per environment |
| `OPENROUTER_PROVIDER_ALLOWLIST` | Conditional (RA chatbot) | — | Comma-separated provider allowlist for privacy/cost routing. Required while `OPENROUTER_REQUIRE_ZDR=true`; leave unset only when ZDR is explicitly disabled for a non-production environment. | OpenRouter provider routing settings |
| `OPENROUTER_FALLBACK_MODEL` | Optional (RA chatbot) | — | Non-ZDR model slug used **only** when the primary ZDR-required request fails due to provider unavailability/upstream error (not misconfiguration). Setting it is a deliberate, owner-approved relaxation of ZDR for the fallback request to improve availability when the sole free ZDR provider (Venice) is down. Unset = no fallback (fail closed). Recommended: `nvidia/nemotron-3-super-120b-a12b:free`. See `docs/AI_CHAT.md` and `docs/DECISIONS.md`. | OpenRouter model catalog |
| `OPENROUTER_FALLBACK_PROVIDER_ALLOWLIST` | Optional (RA chatbot) | — | Optional comma-separated provider allowlist scoping the fallback model. Leave unset to let OpenRouter route the fallback freely for maximum availability. | OpenRouter provider routing settings |
| `CHAT_WEB_SEARCH_API_KEY` | Optional (RA chatbot web research) | — | Server-only API key for the privacy-sanitized web research tool. Leave unset to disable web research cleanly. Queries are sanitized before any external call and must never include participant rows, identifiers, credentials, JWTs, or sensitive lab data. | Chosen search provider dashboard |

---

## Frontend Variables (Vercel / root `.env`)

| Variable | Required | Default | Description | How to obtain |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | — | Browser-visible Supabase project URL for the frontend auth client. | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Browser-visible Supabase anon key for the frontend auth client. | Supabase Dashboard → Project Settings → API → `anon` key |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Base URL of the FastAPI backend. Frontend API wrappers prepend this to all requests. | Set to the Railway service URL in production, e.g. `https://backend-production-5809.up.railway.app`; `http://localhost:8000` for local dev |
| `KV_REST_API_URL` | Conditional (cache enabled) | — | Vercel KV / Upstash REST URL for same-origin cache helpers. | Vercel Dashboard → Storage → KV instance → env tab, or `vercel env pull` then copy into root `.env` for local use |
| `KV_REST_API_TOKEN` | Conditional (cache enabled) | — | Vercel KV / Upstash REST token (read-write) for same-origin cache helpers. | Same as `KV_REST_API_URL` source |
| `KV_REST_API_READ_ONLY_TOKEN` | Conditional (cache, read-only path) | — | Read-only variant of the KV token for public-safe cache reads. | Same as `KV_REST_API_URL` source |
| `KV_URL` | Conditional (cache enabled) | — | Redis-protocol URL alias for the Vercel KV / Upstash instance. | Same as `KV_REST_API_URL` source |
| `REDIS_URL` | Conditional (cache enabled) | — | Redis-protocol URL alias (alternative to `KV_URL`). | Same as `KV_REST_API_URL` source |
| `RESEND_API_KEY` | Conditional (frontend email routes) | — | Resend API key if any Next.js server-side route sends email directly. Same key as backend; keep in sync. | [resend.com](https://resend.com) Dashboard → API Keys |

---

## GitHub Actions Secrets

| Variable | Description | How to obtain |
|---|---|---|
| `RAILWAY_TOKEN` | Railway token used by the production release workflow to deploy the backend and run Alembic with production backend env vars. | Railway Account/Workspace token with access to project `ubcpsych`; see `docs/DEPLOYMENT.md` |
| `VERCEL_TOKEN` | Vercel token used by the production release workflow to build and deploy the frontend after backend gates pass. | Vercel Account Settings → Tokens; see `docs/DEPLOYMENT.md` |
| `WEATHER_INGEST_BASE_URL` | Backend base URL used by scheduled/manual weather ingestion workflows. | Railway service URL, e.g. `https://backend-production-5809.up.railway.app` |
| `WEATHER_INGEST_SHARED_SECRET` | Single shared secret header value sent by weather ingest workflows. Must match one value in `WEATHER_INGEST_SHARED_SECRETS` on the backend. | Copy one of the values set in the backend `WEATHER_INGEST_SHARED_SECRETS` var |

---

## Operational / Migration Variables

These are used for local agent workflows and deployment automation rather than
application request handling.

`DATABASE_MIGRATION_URL` should be set anywhere Alembic runs. Locally, keep it
in root `.env`. In production release automation, set it on the Railway backend
environment so `scripts/alembic-upgrade-head.sh` can run migrations without
using the transaction pooler.

For operational debugging, local workstations may already have the `vercel`,
`supabase`, and `railway` CLIs authenticated for this project. They are useful
for log inspection, environment checks, deployment status, and service
diagnostics when relevant, but they are not mandatory validation steps.

Admin invite migration note: `backend/admin_cli/invite_user.py` loads root `.env`
by default for local batches. For production batches, use `--use-railway-env`
to read the linked Railway backend env, or pass `--env-file <path>` for a
local migration-only env file, so invites write to the intended
`ra_invitations` table instead of whichever database root `.env` currently
targets.

---

## Quick-reference: where each var lives

| Variable | Root `.env` | Backend (Railway) | Frontend (Vercel) | GitHub Secrets |
|---|:---:|:---:|:---:|:---:|
| `DATABASE_URL` | ✓ | ✓ | | |
| `DATABASE_MIGRATION_URL` | ✓ | ✓ | | |
| `SUPABASE_URL` | ✓ | ✓ | | |
| `SUPABASE_ANON_KEY` | ✓ | ✓ | | |
| `SUPABASE_JWT_SECRET` | ✓ | ✓ | | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | | |
| `ALLOWED_ORIGINS` | | ✓ | | |
| `INVITE_EMAIL_PROVIDER` | ✓ | ✓ | | |
| `RESEND_API_KEY` | ✓ | ✓ | ✓ | |
| `ADMIN_EMAIL_FROM` | ✓ | ✓ | | |
| `SITE_URL` | ✓ | ✓ | | |
| `ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID` | ✓ | | | |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | | ✓ | |
| `NEXT_PUBLIC_API_URL` | ✓ | | ✓ | |
| `KV_REST_API_URL` | ✓ | | ✓ | |
| `KV_REST_API_TOKEN` | ✓ | | ✓ | |
| `KV_REST_API_READ_ONLY_TOKEN` | ✓ | | ✓ | |
| `KV_URL` | ✓ | | ✓ | |
| `REDIS_URL` | ✓ | | ✓ | |
| `WEATHER_INGEST_SHARED_SECRETS` | | ✓ | | |
| `WEATHER_INGEST_COOLDOWN_SECONDS` | | ✓ | | |
| `OPENROUTER_API_KEY` | ✓ | ✓ | | |
| `OPENROUTER_MODEL` | ✓ | ✓ | | |
| `OPENROUTER_REQUIRE_ZDR` | ✓ | ✓ | | |
| `OPENROUTER_PROVIDER_ALLOWLIST` | ✓ | ✓ | | |
| `OPENROUTER_FALLBACK_MODEL` | ✓ | ✓ | | |
| `OPENROUTER_FALLBACK_PROVIDER_ALLOWLIST` | ✓ | ✓ | | |
| `CHAT_WEB_SEARCH_API_KEY` | ✓ | ✓ | | |
| `RAILWAY_TOKEN` | | | | ✓ |
| `VERCEL_TOKEN` | | | | ✓ |
| `WEATHER_INGEST_BASE_URL` | | | | ✓ |
| `WEATHER_INGEST_SHARED_SECRET` | | | | ✓ |
