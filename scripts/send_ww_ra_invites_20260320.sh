#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$ROOT_DIR/backend/.venv/bin/python"
INVITE_SCRIPT="$ROOT_DIR/backend/admin_cli/invite_user.py"
LOG_DIR="$ROOT_DIR/logs"
LOG_FILE="$LOG_DIR/send_ww_ra_invites_20260320.log"

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

invite() {
  local name="$1"
  local email="$2"

  log "Inviting $name <$email> as role=ra lab_name=ww"
  "$PYTHON_BIN" "$INVITE_SCRIPT" --email "$email" --role ra --lab-name ww
}

log "Starting scheduled WW RA invite batch"
invite "Melanie" "mbutt@psych.ubc.ca"
invite "Daniela" "danipasq@student.ubc.ca"
invite "Ni" "ni.an@ubc.ca"
invite "Alannah" "alannahw@psych.ubc.ca"
log "Finished scheduled WW RA invite batch"
