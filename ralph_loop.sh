#!/usr/bin/env bash
set -euo pipefail

KANBAN_MD="docs/kanban.md"
MAX_ITERS="${MAX_ITERS:-200}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5}"
CODEX_PROFILE="${CODEX_PROFILE:-}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

need_cmd jq
need_cmd awk
need_cmd codex
need_cmd base64
need_cmd paste
need_cmd sed
need_cmd date

extract_kanban_json() {
  awk '
    BEGIN { in_json=0 }
    /^```json[[:space:]]*$/ { in_json=1; next }
    /^```[[:space:]]*$/ && in_json { in_json=0; exit }
    in_json { print }
  ' "$KANBAN_MD"
}

write_kanban_json_back() {
  local json_file="$1"
  awk -v new_json="$json_file" '
    BEGIN {
      while ((getline line < new_json) > 0) {
        j[++n] = line
      }
      in_json = 0
    }
    /^```json[[:space:]]*$/ {
      print
      for (i = 1; i <= n; i++) print j[i]
      in_json = 1
      next
    }
    in_json && /^```[[:space:]]*$/ {
      in_json = 0
      print
      next
    }
    !in_json { print }
  ' "$KANBAN_MD" > "${KANBAN_MD}.tmp"
  mv "${KANBAN_MD}.tmp" "$KANBAN_MD"
}

next_task_b64() {
  local json_file="$1"
  jq -r '
    .tasks as $all
    | [
        .tasks[]
        | select(.status == "todo")
        | select((.depends_on | all(. as $d | ($all[] | select(.id == $d) | .status) == "done")))
      ][0]
    | if . == null then "" else @base64 end
  ' "$json_file"
}

set_task_status() {
  local json_file="$1"
  local task_id="$2"
  local status="$3"
  jq --arg id "$task_id" --arg s "$status" '
    (.tasks[] | select(.id == $id) | .status) = $s
  ' "$json_file" > "${json_file}.tmp"
  mv "${json_file}.tmp" "$json_file"
}

echo "=== Starting Ralph Loop (terminal-only) ==="
iter=0

while (( iter < MAX_ITERS )); do
  iter=$((iter + 1))
  echo ""
  echo "-------------------------------"
  echo "Iteration $iter"
  echo "-------------------------------"

  tmp_json="$(mktemp)"
  extract_kanban_json > "$tmp_json"

  task_b64="$(next_task_b64 "$tmp_json")"
  if [[ -z "$task_b64" ]]; then
    echo "No ready todo task found. Exiting."
    rm -f "$tmp_json"
    break
  fi

  task_json="$(printf '%s' "$task_b64" | base64 -d)"
  task_id="$(printf '%s' "$task_json" | jq -r '.id')"
  task_title="$(printf '%s' "$task_json" | jq -r '.title')"

  echo "Running task: $task_id - $task_title"

  set_task_status "$tmp_json" "$task_id" "in_progress"
  write_kanban_json_back "$tmp_json"

  read_docs="$(printf '%s' "$task_json" | jq -r '.read_docs[]?' | paste -sd ', ' -)"
  update_docs="$(printf '%s' "$task_json" | jq -r '.updates_docs[]?' | paste -sd ', ' -)"
  criteria="$(printf '%s' "$task_json" | jq -r '.acceptance_criteria[]?' | sed 's/^/- /')"

  prompt=$(cat <<EOF
You are a Codex implementation instance for one kanban task.

Task ID: $task_id
Task Title: $task_title

Strict workflow:
1) Read AGENTS.md, docs/PROGRESS.md, docs/kanban.md.
2) Read all task read_docs: $read_docs
3) Implement this task end-to-end in code.
4) Verify acceptance criteria:
$criteria
5) Update every path in updates_docs: $update_docs
6) Keep documentation consistent.
7) Mark task as "done" in docs/kanban.md when complete.
8) Append proper entry to docs/PROGRESS.md.
9) Return a concise final summary with:
   - Files changed
   - Acceptance criteria verification
   - Docs updated
   - Remaining risks/blockers (if any)

Emit clear step-by-step progress messages.
EOF
)

  profile_args=()
  if [[ -n "$CODEX_PROFILE" ]]; then
    profile_args+=(--profile "$CODEX_PROFILE")
  fi

  set +e
  echo "$prompt" | codex exec \
    "${profile_args[@]}" \
    -c "model=$CODEX_MODEL" \
    -c "permissions.sandbox_mode=workspace-write" \
    -c "permissions.approval_policy=on-failure" \
    -
  codex_exit=$?
  set -e

  echo ""
  echo "Codex exit code: $codex_exit"

  extract_kanban_json > "$tmp_json"
  new_status="$(jq -r --arg id "$task_id" '.tasks[] | select(.id == $id) | .status' "$tmp_json")"
  rm -f "$tmp_json"

  echo "Kanban status after run: $new_status"

  if [[ "$codex_exit" -ne 0 ]]; then
    echo "Stopping: Codex exited non-zero."
    break
  fi

  if [[ "$new_status" != "done" ]]; then
    echo "Stopping: Task not marked done."
    break
  fi
done

echo ""
echo "=== Loop Finished ==="
