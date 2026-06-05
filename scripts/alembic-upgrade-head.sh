#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "${ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

if [ -z "${DATABASE_MIGRATION_URL:-}" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_MIGRATION_URL or DATABASE_URL is required." >&2
    exit 1
  fi

  if [[ "${DATABASE_URL}" == *":6543/"* || "${DATABASE_URL}" == *":6543?"* ]]; then
    echo "ERROR: DATABASE_URL appears to use the Supabase transaction pooler on port 6543." >&2
    echo "Set DATABASE_MIGRATION_URL to the Supabase session pooler or direct DB URL before running Alembic." >&2
    exit 1
  fi
fi

PYTHON_BIN="${ROOT}/backend/.venv/bin/python"
if [ ! -x "${PYTHON_BIN}" ]; then
  PYTHON_BIN="python"
fi

cd "${ROOT}/backend"
PYTHONPATH=. "${PYTHON_BIN}" -m alembic upgrade head
PYTHONPATH=. "${PYTHON_BIN}" -m alembic current
