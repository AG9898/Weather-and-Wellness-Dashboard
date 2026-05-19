# Migrations Docs

This directory contains migration planning and historical archive documentation, not executable Alembic migration scripts; use `backend/alembic/` for schema migration code and apply changes through Alembic.

Infrastructure migration docs in this directory are planned/reference material unless a project owner explicitly reactivates them.

## Current Production Stack

Migration to Railway + Canadian Supabase is **complete**. Production is now:
- **Frontend:** Vercel (Next.js)
- **Backend:** Railway (FastAPI)
- **Database:** Supabase (Canadian region)
