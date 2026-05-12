---
name: ralphloop
description: Use this skill when the user explicitly asks for an autonomous delegated loop that repeatedly runs a repo-local skill or prompt against docs/workboard.json, with the current Codex agent acting as the monitor and spawned worker agents doing the implementation work.
---

# Ralph Loop

You are the monitoring agent. Your job is orchestration and gating. Do not implement the task yourself.

Use this skill only when the user explicitly asks for delegated looping or sub-agent execution.

## Inputs

Parse two inputs from the user's invocation:

- `TASK`: either a skill name such as `start-task` or a quoted free-form prompt
- `THRESHOLD`: either `iterations:N` or `tasks:N`

If either input is missing or malformed, stop and print:

```text
ERROR: Usage is $ralphloop <skill-or-prompt> <threshold>
Examples:
  $ralphloop start-task iterations:3
  $ralphloop start-task tasks:2
  $ralphloop "audit the repo for stale docs" iterations:1
```

## Setup

Track:

- `ITER = 0`
- `BASELINE_DONE` when using `tasks:N`

If `THRESHOLD` is `tasks:N`, capture the baseline with the current workboard:

```bash
jq '[.tasks[] | select(.status == "done")] | length' docs/workboard.json
```

If `TASK` looks like a skill name, confirm the skill exists at one of:

- `.codex/skills/<TASK>/SKILL.md`
- `$HOME/.codex/skills/<TASK>/SKILL.md`

If it does not exist, stop with a clear error.

## Cycle

Before each cycle:

- For `iterations:N`, stop when `ITER >= N`
- For `tasks:N`, re-check the done count and stop when `(current_done - BASELINE_DONE) >= N`

If the threshold is reached, print the final summary and stop.

## Worker Launch

Spawn one fresh subagent per cycle.

Before spawning the worker, record `CYCLE_BASE_HEAD` with:

```bash
git rev-parse HEAD
```

- Use `spawn_agent`
- Prefer `agent_type: "worker"`
- Prefer `fork_context: false`
- Tell the worker it is not alone in the repo and must not revert others' edits
- Tell the worker to do at most one task or one prompt cycle, then stop
- Tell the worker to update any required docs before considering the cycle complete
- Tell the worker to run the required validation for that cycle
- Tell the worker to create exactly one local git commit for a successful cycle
- Tell the worker not to push unless the user explicitly asked for publishing in the current invocation

### Worker prompt when `TASK` is a skill name

Tell the worker:

1. Use the named skill in this repo.
2. Follow the skill fully.
3. Update any required docs before considering the cycle complete.
4. Run the required tests or checks for the cycle.
5. If the cycle succeeds, run `git status --short`, stage only the completed cycle's intended changes, and create exactly one local git commit before stopping.
6. Do not commit on `FAILURE` or `BLOCKED`.
7. Do not push unless publishing was explicitly requested in the user's current invocation.
8. Stop after one task or one bounded cycle.
9. End with this exact trailer as the last thing in the final message:

```text
RALPH-SUMMARY-START
STATUS: SUCCESS|FAILURE|BLOCKED
TASK_ID: <task id or n/a>
TASK_TITLE: <task title or one-line summary>
DOCS: UPDATED|N/A|MISSING (<brief detail>)
TESTS: PASS|FAIL|SKIP (<brief detail>)
FILES_CHANGED: <comma-separated paths, max 5>
COMMITTED: YES|NO (<commit sha and subject, or reason>)
PUSHED: YES|NO (<reason>)
FAILURE_REASON: <reason or none>
RALPH-SUMMARY-END
```

### Worker prompt when `TASK` is a free-form prompt

Pass the prompt directly with the same restrictions and the same `RALPH-SUMMARY` trailer.

## Result Handling

Wait for the worker to finish with `wait_agent`, then parse only the `RALPH-SUMMARY` block from the worker's final message.

If the summary block is missing, treat that cycle as failure.

If the cycle reports `SUCCESS` but `COMMITTED` is not `YES`, treat that cycle as failure.

If the cycle reports `SUCCESS` but `git rev-list --count "$CYCLE_BASE_HEAD..HEAD"` is not exactly `1`, treat that cycle as failure.

If the cycle reports `SUCCESS` but the done count did not increase for a `start-task` style run, treat that cycle as blocked and stop.

Close completed workers when they are no longer needed.

## Final Summary

Report:

- cycles completed
- tasks completed relative to baseline when using `tasks:N`
- threshold and whether it was reached
- whether the loop stopped because of `FAILURE` or `BLOCKED`

## Loop rules

- Treat `docs/workboard.json` as canonical.
- You are the orchestrator, not the implementer.
- Keep the loop JSON-native; do not extract board data from markdown.
- Fail fast if the workboard is missing, invalid, or lacks actionable tasks.
- Require exactly one local git commit from the worker for each successful cycle.
- Never discard changes automatically with destructive git commands.
- Never run extra cycles after the threshold is met.
