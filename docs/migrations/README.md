# Migrations Docs

This directory contains migration planning and historical archive documentation, not executable Alembic migration scripts; use `backend/alembic/` for schema migration code and apply changes through Alembic.

Infrastructure migration docs in this directory are planned/reference material unless a project owner explicitly reactivates them.

## Applying Migrations

Production migrations are applied automatically by the Production Release
workflow on a push to `main` touching `backend/**`. The head revision, the
manual fallback command, and the caveat about the deploy-before-migrate window
are documented in
[`docs/SCHEMA.md` → Applying Migrations](../SCHEMA.md#applying-migrations).
That section is the single source of truth; do not duplicate it here.

## Current Production Stack

Migration to Railway + Canadian Supabase is **complete**. Production is now:
- **Frontend:** Vercel (Next.js)
- **Backend:** Railway (FastAPI)
- **Database:** Supabase (Canadian region)
