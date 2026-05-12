# ENV_VARS.md — Canonical Environment Variable Reference

This is the single source of truth for environment and secret configuration.
If any other doc conflicts with this file, update that doc to point here.

JWT verification mode note: same-origin Route Handlers use ES256/JWKS as the
primary path and only use HS256 when `SUPABASE_JWT_SECRET` is configured. See
`docs/ARCHITECTURE.md` (Auth section) for full topology details.

| Variable | Required | Default | Description | Where set |
|---|---|---|---|---|
| `DATABASE_URL` | Yes (backend) | None | Supabase PostgreSQL connection string for backend DB access (`ssl=require` for asyncpg in this repo). | Backend runtime env (`backend/.env`, Railway) |
| `ALLOWED_ORIGINS` | Yes (backend production) | Localhost dev allowlist when unset | Comma-separated CORS allowlist for FastAPI. | Backend runtime env (`backend/.env`, Railway) |
| `SUPABASE_URL` | Conditional | None | Supabase project URL for server-side JWT/JWKS and backend SDK usage. | Backend/runtime env (`backend/.env`, Railway, Vercel server env) |
| `SUPABASE_ANON_KEY` | Conditional | None | Supabase anon/public key for server-side SDK usage when enabled. | Backend runtime env (`backend/.env`, Railway) |
| `SUPABASE_JWT_SECRET` | Conditional (HS256 fallback only) | None | Required only when HS256 fallback JWT verification is enabled. Not required for ES256/JWKS-only verification. | Backend runtime env (`backend/.env`, Railway, Vercel server env when fallback is used) |
| `SUPABASE_SERVICE_ROLE_KEY` | Conditional (admin tooling only) | None | Service-role key for admin API access (for example `backend/admin_cli/invite_user.py`). | Secure admin environment only (local protected `.env`, CI secret, Railway) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (frontend auth enabled) | None | Browser-visible Supabase URL used by frontend auth client. | Frontend env (`frontend/.env.local`, Vercel project env) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (frontend auth enabled) | None | Browser-visible Supabase anon/public key used by frontend auth client. | Frontend env (`frontend/.env.local`, Vercel project env) |
| `INVITE_EMAIL_PROVIDER` | Conditional (admin invite email enabled) | `resend` | Transactional email provider for app-owned admin invites. Supported planned values: `resend`, later `ses` if needed. | Backend runtime env (`backend/.env`, Railway) |
| `RESEND_API_KEY` | Conditional (`INVITE_EMAIL_PROVIDER=resend`) | None | Resend API key used to send custom invite emails. | Backend runtime env (`backend/.env`, Railway) |
| `ADMIN_EMAIL_FROM` | Conditional (admin invite email enabled) | None | Verified sender address for admin invite emails (for example `Weather & Wellness <invites@example.org>`). | Backend runtime env (`backend/.env`, Railway) |
| `KV_REST_API_URL` | Conditional (cache enabled) | None | Vercel KV/Upstash REST URL alias accepted by same-origin cache helpers. | Vercel server env |
| `KV_REST_API_TOKEN` | Conditional (cache enabled) | None | Vercel KV/Upstash REST token alias accepted by same-origin cache helpers. | Vercel server env |
| `UPSTASH_REDIS_REST_URL` | Conditional (cache enabled fallback) | None | Direct Upstash Redis REST URL (fallback when KV alias vars are not used). | Vercel server env (or local server env for dev) |
| `UPSTASH_REDIS_REST_TOKEN` | Conditional (cache enabled fallback) | None | Direct Upstash Redis REST token (fallback when KV alias vars are not used). | Vercel server env (or local server env for dev) |
| `DAYLIGHT_START_LOCAL_TIME` | Optional | `06:00` | Local `HH:MM` clock time used to compute `participants.daylight_exposure_minutes` in study timezone. | Backend runtime env (`backend/.env`, Railway) |
| `WEATHER_INGEST_SHARED_SECRETS` | Conditional (weather ingest auth enabled) | None | Comma-separated shared secrets accepted by `POST /weather/ingest/ubc-eos` (supports rotation). | Backend runtime env (`backend/.env`, Railway) |
| `WEATHER_INGEST_COOLDOWN_SECONDS` | Optional | `600` | Per-station weather ingestion cooldown window in seconds. | Backend runtime env (`backend/.env`, Railway) |
| `WEATHER_INGEST_BASE_URL` | Conditional (GitHub Actions weather jobs) | None | Base URL used by scheduled/manual weather ingestion workflows. | GitHub repository secret |
| `WEATHER_INGEST_SHARED_SECRET` | Conditional (GitHub Actions weather jobs) | None | Shared secret header value used by GitHub Actions weather workflows. | GitHub repository secret |
| `SITE_URL` | Conditional (admin invite flow) | None | App base URL used by invite tooling to generate password-setup links (`/set-password?invite=<token>`). | Root `.env` for admin CLI and related operational tooling; backend runtime env when invite email is sent by backend |
