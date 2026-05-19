# Workboard Task Format

When breaking accepted documentation direction into implementation work, target the existing `docs/workboard.json` task shape in this repo.

## Required Fields

Each task must include:

- `id`
- `title`
- `description`
- `status`
- `priority`
- `group_id`
- `depends_on`
- `blocked_by`
- `acceptance_criteria`
- `docs`
- `files`
- `commands`

## Formatting Guidance

- Use the current ID style visible in the target workboard (e.g. `T166`, `T167`).
- Keep `group_id` aligned to existing project groups in `docs/workboard.json`.
- Default new tasks to `status: "todo"` unless the user asks for another state.
- Use allowed priorities only: `critical`, `high`, `medium`, `low`.
- Write `title` as a concise action-oriented summary.
- Write `description` as one implementation-ready paragraph with clear boundaries.
- Make `acceptance_criteria` a short list of observable outcomes.
- Use `depends_on` for prerequisite task IDs (array of strings).
- Use `blocked_by` for external blockers or unresolved decisions (array of strings, empty if none).
- Keep `docs` limited to canonical docs that must stay synchronized (array of paths).
- Keep `files` limited to likely primary implementation paths (array of paths).
- Keep `commands` to the minimum verification checklist for the task (array of shell commands).

## Decomposition Rules

- Split tasks when work crosses distinct surfaces such as schema/migrations, FastAPI endpoints, RA UI, participant UI, docs, or tests.
- Keep each task focused on one behavioral outcome.
- Create subtasks only when they reduce ambiguity or enable independent execution.
- Prefer explicit dependency edges over large umbrella tasks.
- Avoid bundling unrelated docs and code changes into one task unless unavoidable.
- Every schema change must pair with an Alembic migration in its own task or the same task if inseparable.
