# Migrations Docs

This directory contains migration planning and historical archive documentation, not executable Alembic migration scripts; use `backend/alembic/` for schema migration code and apply changes through Alembic.

Infrastructure migration docs in this directory are planned/reference material unless a project owner explicitly reactivates them.

## Pending Production Applies

Migrations that are authored and merged but not yet applied to the production
database are tracked in
[`docs/SCHEMA.md` → Pending Production Apply](../SCHEMA.md#pending-production-apply),
alongside the apply command. That table is the single source of truth; do not
duplicate it here.

## Current Production Stack

Migration to Railway + Canadian Supabase is **complete**. Production is now:
- **Frontend:** Vercel (Next.js)
- **Backend:** Railway (FastAPI)
- **Database:** Supabase (Canadian region)
