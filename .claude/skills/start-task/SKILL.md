---
name: start-task
description: Start the next WW Webapp task from docs/workboard.json, read its docs and owned files, implement it, run this repo's actual validation steps, update authoritative docs, and mark it done. Use when the user wants to continue work from the current board.
---

# Start Task

Use this skill when implementing the next active task in WW Webapp.

## Workflow

1. Read `AGENTS.md`, then query `docs/workboard.json` and identify the next actionable task.
2. Read every path in the task `docs` array before editing code.
3. Inspect every path in the task `files` array before changing implementation.
4. Treat task `commands[]` as the preferred verification list for that task. Run them unless a command is clearly impossible in the current environment; if skipped, state why.
5. If `commands[]` is empty or incomplete, choose the smallest correct repo-native validation based on the surface changed:
   - backend changes: run targeted tests from `backend/tests/` with `cd backend && PYTHONPATH=. .venv/bin/pytest ...`
   - frontend changes: run `cd frontend && npm test`
   - broader frontend route/config/build changes: add `cd frontend && npm run build` when type/build coverage matters
6. Implement the task with the smallest correct change set.
7. Verify every acceptance criterion explicitly against code and command results.
8. Update any authoritative docs required to keep repo guidance accurate. Prefer canonical docs in `docs/` root or `docs/labs/<lab>/`; do not append to archived progress history.
9. Set the task `status` to `done` in `docs/workboard.json` only after verification passes.
10. Create exactly one local git commit for the completed task. Stage only the task's intended code, docs, tests, and `docs/workboard.json` changes. Do not push unless the user explicitly asked for publishing.

## Guardrails

- Do not use markdown kanban files as the task source.
- Do not skip dependency checks.
- Use the lean workboard schema that exists in this repo: `tasks[]` with `docs`, `files`, `commands`, and `acceptance_criteria`.
- Keep the work scoped to one task unless the board explicitly says otherwise.
- Treat `docs/progress/PROGRESS_LOG.md` as archive history, not active instructions.
- Do not invent `read_docs`, `updates_docs`, or append-only progress steps from older repo setups.
- Keep validation aligned to this repo's actual tools: backend `.venv` + `pytest`, frontend `npm test`, and optionally `npm run build` when needed.
- Prefer existing repo patterns over new abstractions unless the task requires them.
- A completed task must end with exactly one local git commit. Do not commit on failure or when blocked.
- Do not add Claude, Anthropic, or any AI assistant as a co-author, co-committer, co-contributor, or trailer in the commit message.
