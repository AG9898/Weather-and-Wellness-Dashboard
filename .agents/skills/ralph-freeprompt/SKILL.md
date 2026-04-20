---
name: ralph-freeprompt
description: Use this skill when the user explicitly asks for an autonomous delegated loop that repeatedly runs a free-form prompt against a target (file, task list, or any prompt-driven series), with the current agent acting as the monitor and spawned worker agents doing the implementation work. No workboard dependency.
---

# Ralph Free-Prompt Loop

You are the monitoring agent. Your job is orchestration, prompt validation, and gating. Do not implement the task yourself.

Use this skill only when the user explicitly asks for delegated looping or sub-agent execution with a free-form prompt.

## Inputs

Parse two inputs from the user's invocation:

- `PROMPT`: a quoted free-form text string describing the work each worker should perform
- `THRESHOLD`: must be `iterations:N` where N is a positive integer

If either input is missing or malformed, stop and print:

```text
ERROR: Usage is /ralph-freeprompt "<prompt>" iterations:N
Example:
  /ralph-freeprompt "tackle the next item in doc audit/doc-cleanup-action-plan.md" iterations:6
```

## Phase 0 — Prompt analysis and adjustment

Before spawning any worker, analyse `PROMPT` for iterative suitability.

**Check for:**

1. **Single-shot phrasing** — language like "summarise", "list all", "generate a report", "give me X" that implies one-time output.
2. **No completion signal** — no mention of marking items done, committing, or advancing a cursor between cycles.
3. **Unbounded scope** — "do everything" or "fix all X" with no unit of work per cycle.
4. **Stateless but stateful intent** — references a file or list but does not tell the worker how to avoid repeating prior work.

**If any issue is found**, rewrite the prompt to fix it, then print:

```
PROMPT ADJUSTED
Original: <original prompt>
Issue:    <one-line explanation>
Adjusted: <rewritten prompt>
Proceeding with adjusted prompt.
```

**Adjustment rules:**
- Add "mark this item done with a `[DONE]` prefix once complete" if no completion signal exists.
- Add "do exactly one item per cycle, then stop" if scope is unbounded.
- Add "check for prior `[DONE]` markers before selecting your item" if state tracking is missing.
- Do not change the intent or target — only add iterability scaffolding.

**If the prompt is suitable as-is:** proceed silently.

Store the final prompt as `EFFECTIVE_PROMPT`. Track `ITER = 0`.

## Setup

Print the loop header:
```
╔══════════════════════════════════════════════════════════╗
║  RALPH FREE-PROMPT LOOP STARTED                          ║
╠══════════════════════════════════════════════════════════╣
║  Prompt:    <first 60 chars of EFFECTIVE_PROMPT>...      ║
║  Threshold: iterations:<N>                               ║
╚══════════════════════════════════════════════════════════╝
```

## Cycle

Before each cycle:

- If `ITER >= N`, print the final summary and stop.

## Worker Launch

Spawn one fresh subagent per cycle.

- Use `spawn_agent`
- Prefer `agent_type: "worker"`
- Prefer `fork_context: false`
- Tell the worker it is not alone in the repo and must not revert others' edits
- Tell the worker to do exactly one unit of work described by `EFFECTIVE_PROMPT`, then stop
- Tell the worker to update any required docs before considering the cycle complete
- Tell the worker to run any required validation for that cycle
- Do not require commit or push unless the user explicitly asked for it in `EFFECTIVE_PROMPT`

### Worker prompt

Tell the worker:

1. Do exactly one unit of work as described: `<EFFECTIVE_PROMPT>`
2. Do not revert or undo work committed in prior cycles.
3. Mark the completed item with `[DONE]` (or as the prompt specifies) before stopping.
4. Update any required documentation.
5. Run any required tests or checks.
6. Stop after one bounded unit of work.
7. End with this exact trailer as the last thing in the final message:

```text
RALPH-SUMMARY-START
STATUS: SUCCESS|FAILURE|BLOCKED
TASK_TITLE: <brief one-line description of what was done this cycle>
TESTS: PASS|FAIL|SKIP|N/A (<command run and its result>)
FILES_CHANGED: <comma-separated paths, max 5>
COMMIT_MSG: <one-line commit message ≤72 chars, or n/a>
FAILURE_REASON: <reason if STATUS=FAILURE or BLOCKED; else write none>
RALPH-SUMMARY-END
```

STATUS definitions:
- SUCCESS: work complete and correct
- FAILURE: unable to complete the task
- BLOCKED: nothing to do this cycle (all items already done or no eligible work found)

## Result Handling

Wait for the worker to finish with `wait_agent`, then parse only the `RALPH-SUMMARY` block.

If the summary block is missing, treat that cycle as FAILURE with reason "Sub-agent did not produce a RALPH-SUMMARY block".

Increment `ITER` after each cycle regardless of STATUS.

### SUCCESS

1. Commit and push if `COMMIT_MSG` is not `n/a`:
   ```bash
   git add -A && git commit -m "$COMMIT_MSG" && git push origin HEAD
   ```
2. Print:
   ```
   ✓ Cycle <ITER>/<N> — <TASK_TITLE>
     Tests: <TESTS>
   ```
3. Return to Cycle check.

### FAILURE

1. Do not commit. Discard uncommitted changes:
   ```bash
   git checkout -- . && git clean -fd
   ```
2. Write failure report to `docs/ralph-freeprompt-failure.md` using the Write tool.
3. Print:
   ```
   ✗ Cycle <ITER>/<N> FAILED — <FAILURE_REASON>
     Loop halted. See docs/ralph-freeprompt-failure.md
   ```
4. **Stop.**

### BLOCKED

Print:
```
⊘ Cycle <ITER>/<N> — BLOCKED (<FAILURE_REASON>)
  Stopping early — worker found nothing to do.
```
Stop and print the final summary.

## Final Summary

```
╔══════════════════════════════════════════════════════════╗
║  RALPH FREE-PROMPT LOOP COMPLETE                         ║
╠══════════════════════════════════════════════════════════╣
║  Cycles completed:  <ITER>                               ║
║  Threshold:         iterations:<N> — <REACHED|STOPPED>   ║
╚══════════════════════════════════════════════════════════╝
```

## Loop rules

- You are the orchestrator, not the implementer.
- Never commit if STATUS == FAILURE.
- Never read sub-agent output beyond the RALPH-SUMMARY block.
- Never run extra cycles after the threshold is met.
- Never discard changes automatically with destructive git commands except in the FAILURE branch.
- Close completed workers when they are no longer needed.
