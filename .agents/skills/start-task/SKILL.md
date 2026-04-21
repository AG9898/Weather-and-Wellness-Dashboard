---
name: start-task
description: Start the next WW Webapp task from docs/workboard.json, read its docs and owned files, implement it, run this repo’s actual validation steps, update authoritative docs, and mark it done. Use when the user wants to continue work from the current board.
---

# Start Task

Use this skill when implementing the next active task in WW Webapp.

## Workflow

1. Read `AGENTS.md`, then query `docs/workboard.json` and identify the next actionable task.
2. Read every path in the task `docs` array before editing code.
3. Inspect every path in the task `files` array before changing implementation.
4. Run the pre-execution checklist before implementing:
   - **Working directory + command normalization:** backend commands must start with `cd backend &&`; backend `pytest` must include `PYTHONPATH=.`. If task `commands[]` omits either requirement, inject them before execution.
   - **Done criteria completeness:** if `acceptance_criteria` is missing or only narrative (no verifiable step), pause and surface the gap to the user before proceeding.
   - **Output-format clarity:** if done criteria require a dry-run or output check but do not specify output format (for example JSON vs plaintext), ask the user to clarify before running.
   - **Seed idempotency:** for seed/fixture tasks, confirm idempotency via code inspection or task notes before running the same seed flow twice.
   - **Fixture coverage for edge cases:** if done criteria mention edge cases (for example null thresholds, empty sets, zero-variance inputs), verify a matching fixture exists or create one before marking tests as passing.
   - **Storybook done gate:** for Storybook tasks, done means `cd frontend && npm run build-storybook` succeeds and all required variant states render without console errors. Manual review gates may be noted but do not block done state.
   - **Full regression precision:** if a task says "full regression suite", enumerate concrete files from repo globs (`test_*.py`) in the relevant scope instead of accepting vague wording.
   - **Docs routing integrity:** if docs files are created/renamed/moved/deleted, require `docs/INDEX.md` updates and verify canonical references point to real paths (never removed root stubs).
5. Treat task `commands[]` as the preferred verification list for that task. Run them unless a command is clearly impossible in the current environment; if skipped, state why.
6. If `commands[]` is empty or incomplete, choose the smallest correct repo-native validation based on the surface changed:
   - backend changes: run targeted tests from `backend/tests/` with `cd backend && PYTHONPATH=. .venv/bin/pytest ...`
   - frontend changes: run `cd frontend && npm test`
   - broader frontend route/config/build changes: add `cd frontend && npm run build` when type/build coverage matters
7. Implement the task with the smallest correct change set.
8. Verify every acceptance criterion explicitly against code and command results.
9. Update any authoritative docs required to keep repo guidance accurate. Prefer canonical docs in `docs/` root or `docs/labs/<lab>/`; do not append to archived progress history.
10. Set the task `status` to `done` in `docs/workboard.json` only after verification passes.

## Guardrails

- Do not use markdown kanban files as the task source.
- Do not skip dependency checks.
- Use the lean workboard schema that exists in this repo: `tasks[]` with `docs`, `files`, `commands`, and `acceptance_criteria`.
- Keep the work scoped to one task unless the board explicitly says otherwise.
- Treat `docs/progress/PROGRESS_LOG.md` as archive history, not active instructions.
- Do not invent `read_docs`, `updates_docs`, or append-only progress steps from older repo setups.
- Keep validation aligned to this repo’s actual tools: backend `.venv` + `pytest`, frontend `npm test`, and optionally `npm run build` when needed.
- Prefer existing repo patterns over new abstractions unless the task requires them.
- For backend command execution, normalize command prefixes (`cd backend &&`) and backend `pytest` env (`PYTHONPATH=.`) even when task commands omit them.
