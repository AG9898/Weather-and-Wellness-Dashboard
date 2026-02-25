# Architecture & Deployment

> Canonical source for hosting, tiers, and environment boundaries. Other docs should link
> here instead of restating architecture details.

---

## Summary

- **Three-tier web app**: Next.js frontend → FastAPI backend → Supabase Postgres
- **Frontend (Vercel)**: Next.js (TypeScript + Tailwind) for UI only. No FastAPI on Vercel.
- **Backend (Render)**: Long-lived FastAPI service. All scoring, validation, and DB writes live here.
  - Hosted URL: `https://weather-and-wellness-dashboard.onrender.com`
- **Database (Supabase)**: Managed Postgres. Lab reads data via Supabase Studio.

---

## Auth (Optional)

- If Supabase Auth is enabled, Next.js obtains a JWT and sends
  `Authorization: Bearer <JWT>` to FastAPI.
- FastAPI validates JWTs using `SUPABASE_JWT_SECRET`.
- Participant endpoints remain unauthenticated and are validated by `session_id` + status.

---

## CORS

- Allowed origins are configured via the `ALLOWED_ORIGINS` env var (comma-separated list).
- When `ALLOWED_ORIGINS` is unset, the backend defaults to localhost dev origins only.
- In production (Render), set `ALLOWED_ORIGINS` to the Vercel frontend URL(s).
- No wildcard (`*`) origins are used — least-privilege policy.

---

## Migrations

- **Alembic only** for schema changes.
- **Run as a deploy step / one-off command**, not on every app startup.

---

## Render Setup

- Service is live at `https://weather-and-wellness-dashboard.onrender.com`.
- Health check path: `/health` → returns `{"status":"ok"}`.
- Local backend tasks in Phase 1 (DB wiring, models, migrations, stub auth) do not require Render.

### Required Render Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Always | Supabase pooler URL; include `ssl=require` |
| `ALLOWED_ORIGINS` | Always | Comma-separated Vercel frontend URL(s) for CORS |
| `SUPABASE_JWT_SECRET` | When RA JWT auth enabled | Used by FastAPI to validate Supabase JWTs |
| `SUPABASE_URL` | When backend uses Supabase SDK | Supabase project URL |
| `SUPABASE_ANON_KEY` | When backend uses Supabase SDK | Supabase anonymous key |

> Do not commit secret values to the repo. Set them only in Render service environment settings.

---

## Data Model and Access

- All results are linked by `participant_uuid` and `session_id`.
- Names are stored only in `participants`; never in result rows.
- Schema details live in `docs/SCHEMA.md`.
