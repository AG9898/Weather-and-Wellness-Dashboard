#!/usr/bin/env bash
set -euo pipefail

WORKBOARD_JSON="docs/workboard.json"
MAX_ITERS="${MAX_ITERS:-200}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5}"
CODEX_PROFILE="${CODEX_PROFILE:-}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }
}

need_cmd jq
need_cmd codex
need_cmd base64
need_cmd paste
need_cmd sed
need_cmd date

ensure_workboard() {
  if [[ ! -f "$WORKBOARD_JSON" ]]; then
    echo "Missing workboard file: $WORKBOARD_JSON" >&2
    exit 1
  fi
}

validate_workboard() {
  jq -e '
    type == "object" and
    (.tasks | type == "array")
  ' "$WORKBOARD_JSON" >/dev/null
}

next_task_b64() {
  jq -r '
    . as $root
    | (reduce $root.tasks[] as $task ({}; .[$task.id] = ($task.status // "missing"))) as $statuses
    | $root.tasks
    | [
        .[]
        | select(.status == "todo")
        | select((.depends_on // [] | all(.[]; $statuses[.] == "done")))
      ][0]
    | if . == null then "" else @base64 end
  ' "$WORKBOARD_JSON"
}

set_task_status() {
  local task_id="$1"
  local status="$2"
  local tmp_file
  tmp_file="$(mktemp)"
  jq --arg id "$task_id" --arg s "$status" '
    (.tasks[] | select(.id == $id) | .status) = $s
  ' "$WORKBOARD_JSON" > "$tmp_file"
  mv "$tmp_file" "$WORKBOARD_JSON"
}

echo "=== Starting Ralph Loop (terminal-only) ==="
ensure_workboard
validate_workboard
iter=0

while (( iter < MAX_ITERS )); do
  iter=$((iter + 1))
  echo ""
  echo "-------------------------------"
  echo "Iteration $iter"
  echo "-------------------------------"

  task_b64="$(next_task_b64)"
  if [[ -z "$task_b64" ]]; then
    echo "No ready todo task found. Exiting."
    break
  fi

  task_json="$(printf '%s' "$task_b64" | base64 -d)"
  task_id="$(printf '%s' "$task_json" | jq -r '.id')"
  task_title="$(printf '%s' "$task_json" | jq -r '.title')"

  echo "Running task: $task_id - $task_title"

  set_task_status "$task_id" "in_progress"

  docs_list="$(printf '%s' "$task_json" | jq -r '.docs[]?' | paste -sd ', ' -)"
  files_list="$(printf '%s' "$task_json" | jq -r '.files[]?' | paste -sd ', ' -)"
  criteria="$(printf '%s' "$task_json" | jq -r '.acceptance_criteria[]?' | sed 's/^/- /')"

  prompt=$(cat <<EOF
You are a Codex implementation instance for one workboard task.

Task ID: $task_id
Task Title: $task_title

Strict workflow:
1) Read AGENTS.md and docs/workboard.json.
2) Read all task docs: $docs_list
3) Inspect all task-owned files first: $files_list
4) Implement this task end-to-end in code.
5) Verify acceptance criteria:
$criteria
6) Update any additional docs needed to keep the repo consistent.
7) Mark task as "done" in docs/workboard.json when complete.
8) Return a concise final summary with:
-   Files changed
-   Acceptance criteria verification
-   Docs updated
-   Remaining risks/blockers (if any)

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

  new_status="$(jq -r --arg id "$task_id" '.tasks[] | select(.id == $id) | .status' "$WORKBOARD_JSON")"

  echo "Workboard status after run: $new_status"

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
