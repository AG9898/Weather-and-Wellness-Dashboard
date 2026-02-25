#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
ENV_FILE="$ROOT_DIR/.env"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
HOST="${HOST:-127.0.0.1}"

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  echo "Missing backend virtualenv at backend/.venv"
  echo "Run: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing root .env file at $ENV_FILE"
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Missing frontend node_modules"
  echo "Run: cd frontend && npm install"
  exit 1
fi

cleanup() {
  set +e
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

(
  cd "$BACKEND_DIR"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  PYTHONPATH=. .venv/bin/uvicorn app.main:app --host "$HOST" --port "$BACKEND_PORT" --reload 2>&1 \
    | sed 's/^/[backend] /'
) &
BACKEND_PID=$!

(
  cd "$FRONTEND_DIR"
  npm run dev -- --hostname "$HOST" --port "$FRONTEND_PORT" 2>&1 \
    | sed 's/^/[frontend] /'
) &
FRONTEND_PID=$!

echo "Started backend (pid $BACKEND_PID) on http://$HOST:$BACKEND_PORT"
echo "Started frontend (pid $FRONTEND_PID) on http://$HOST:$FRONTEND_PORT"
echo "Press Ctrl+C to stop both."

wait -n "$BACKEND_PID" "$FRONTEND_PID"
