# Architecture & Deployment

> Canonical source for hosting, tiers, and environment boundaries. Other docs should link
> here instead of restating architecture details.

---

## Summary

- **Three-tier web app**: Next.js frontend → FastAPI backend → Supabase Postgres
- **Frontend (Vercel)**: Next.js (TypeScript + Tailwind) for UI only. No FastAPI on Vercel.
- **Backend (Render)**: Long-lived FastAPI service. All scoring, validation, and DB writes live here.
- **Database (Supabase)**: Managed Postgres. Lab reads data via Supabase Studio.

---

## Auth (Optional)

- If Supabase Auth is enabled, Next.js obtains a JWT and sends
  `Authorization: Bearer <JWT>` to FastAPI.
- FastAPI validates JWTs using `SUPABASE_JWT_SECRET`.
- Participant endpoints remain unauthenticated and are validated by `session_id` + status.

---

## Migrations

- **Alembic only** for schema changes.
- **Run as a deploy step / one-off command**, not on every app startup.

---

## Render Setup Timing

- Local backend tasks in Phase 1 (DB wiring, models, migrations, stub auth) do not require Render.
- Render is required when you deploy the FastAPI service for hosted access.
- Minimum backend env var at deploy time is `DATABASE_URL`; auth-related vars are only required when JWT auth is enabled.

---

## Data Model and Access

- All results are linked by `participant_uuid` and `session_id`.
- Names are stored only in `participants`; never in result rows.
- Schema details live in `docs/SCHEMA.md`.
