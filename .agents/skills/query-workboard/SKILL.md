---
name: query-workboard
description: Query docs/workboard.json for the next actionable WW Webapp task. Use when you need to inspect the active queue, find the first eligible todo item, or read task metadata without touching archived progress logs.
---

# Query Workboard

Use this skill when the task source of truth is `docs/workboard.json`.

## Workflow

1. Read `docs/workboard.json`.
2. Treat `tasks[]` as the only active queue.
3. Select the first task with `status == "todo"` whose `depends_on` tasks are all `done`.
4. Return the task `id`, `title`, `summary`, `description`, `files`, `docs`, `acceptance_criteria`, and `notes`.
5. If the board is missing or malformed, report that directly and stop.

## Query rules

- Prefer `jq` for selection and filtering.
- Treat missing or empty `depends_on` as no dependency gate.
- Do not read archived progress logs unless the user explicitly asks for history.
- Keep output terse and machine-friendly.
