# Workboard Task Format

When breaking accepted documentation direction into implementation work, target the existing `docs/workboard.json` task shape used in this repo.

## Required Fields

Each task should include:

- `id`
- `group_id`
- `title`
- `status`
- `priority`
- `type`
- `summary`
- `description`
- `acceptance_criteria`
- `depends_on`
- `blocked_by`
- `files`
- `docs`
- `notes`
- `commands`
- `estimate`

## Formatting Guidance

- Use the current ID style `T###` (for example `T124`).
- Keep `group_id` aligned to the initiative/workstream naming style already in the board (uppercase snake case).
- Default new tasks to `status: "todo"` unless the user asks for another state.
- Keep `priority` consistent with board conventions (`high` or `medium`).
- Keep `type` aligned to intent; current tasks are primarily `implementation`.
- Write `title` as a concise subsystem-prefixed action.
- Write `summary` as one sentence describing user-visible or system-level outcome.
- Write `description` as one detailed implementation-ready paragraph with clear boundaries.
- Make `acceptance_criteria` a short list of observable outcomes.
- Use `depends_on` for prerequisite task IDs.
- Use `blocked_by` when external decisions or dependencies block start.
- Keep `files` limited to primary implementation paths expected to change.
- Keep `docs` limited to docs that must stay synchronized with the work.
- Keep `notes` concise; include assumptions, rollout caveats, or external setup details.
- Include `commands` with the minimal repo-native verification checklist for the task.
- Use `estimate` as relative size (`S`, `M`, or current board convention).

## Decomposition Rules

- Split tasks when work crosses subsystems with different ownership (schema/API/backend/frontend/docs).
- Keep doc-only updates bundled unless splitting enables parallel work.
- Create subtasks only when they reduce ambiguity or allow independent execution.
- Prefer explicit dependency edges over oversized umbrella tasks.
