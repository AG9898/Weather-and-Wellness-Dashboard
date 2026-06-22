#!/usr/bin/env bash
# Verify the local backend venv exactly matches the pinned dependencies.
#
# CI and Railway always install fresh from these pinned files, so they cannot
# drift. A long-lived local venv CAN drift when the pins are bumped but the
# venv is never reinstalled. This check fails loudly when that happens so local
# test runs reflect what CI/prod actually install.
#
# Usage:
#   scripts/check-deps.sh           # verify only; non-zero exit on drift
#   scripts/check-deps.sh --fix     # reinstall to bring the venv back in sync
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_PY="$BACKEND_DIR/.venv/bin/python"
REQ_FILES=("$BACKEND_DIR/requirements.txt" "$BACKEND_DIR/requirements-dev.txt")

FIX=0
[[ "${1:-}" == "--fix" ]] && FIX=1

if [[ ! -x "$VENV_PY" ]]; then
  echo "✗ Missing backend venv at backend/.venv"
  echo "  Run: cd backend && python3 -m venv .venv && scripts/check-deps.sh --fix"
  exit 1
fi

reinstall() {
  echo "→ Syncing backend/.venv to pinned requirements…"
  "$VENV_PY" -m pip install --upgrade pip --quiet
  "$VENV_PY" -m pip install --quiet -r "$BACKEND_DIR/requirements.txt" -r "$BACKEND_DIR/requirements-dev.txt"
}

# Build the set of expected "name==version" pins (strip comments/blank lines/extras).
expected="$(grep -hvE '^\s*#|^\s*$' "${REQ_FILES[@]}" | sed -E 's/\[[^]]*\]//' | tr 'A-Z' 'a-z' | sort -u)"

# Build the set of installed "name==version" entries, normalised the same way.
installed="$("$VENV_PY" -m pip freeze 2>/dev/null | sed -E 's/\[[^]]*\]//' | tr 'A-Z' 'a-z' | sort -u)"

# A pin is satisfied when its exact "name==version" line is present in the freeze.
drift=()
while IFS= read -r pin; do
  [[ -z "$pin" ]] && continue
  if ! grep -qxF "$pin" <<<"$installed"; then
    drift+=("$pin")
  fi
done <<<"$expected"

if [[ ${#drift[@]} -eq 0 ]]; then
  echo "✓ backend/.venv matches pinned dependencies"
  exit 0
fi

echo "✗ backend/.venv has drifted from the pins (${#drift[@]} mismatched):"
for pin in "${drift[@]}"; do
  name="${pin%%==*}"
  have="$(grep -E "^${name}==" <<<"$installed" || echo "${name}==<missing>")"
  echo "    want ${pin}   have ${have}"
done

if [[ $FIX -eq 1 ]]; then
  reinstall
  echo "✓ Re-synced. Re-run scripts/check-deps.sh to confirm."
  exit 0
fi

echo
echo "Fix with: scripts/check-deps.sh --fix"
exit 1
