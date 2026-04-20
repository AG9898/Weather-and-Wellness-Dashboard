---
name: ralph-freeprompt
description: Use this skill to run a delegated free-prompt loop — repeatedly spawns fresh claude CLI sub-processes to execute an arbitrary prompt, and stops at a defined iteration count. No workboard dependency. Invoke as: /ralph-freeprompt "<prompt>" iterations:N. Example: "/ralph-freeprompt \"tackle the next item in doc audit/doc-cleanup-action-plan.md\" iterations:6".
version: 1.0.0
---

# Ralph Free-Prompt Loop — Autonomous Iteration Monitor

You are now the **monitoring agent**. Your only roles are: prompt validation, loop orchestration, quality gating, and version control. You never do implementation work yourself.

Each iteration you fire a completely fresh `claude -p` subprocess via the Bash tool. That process runs the task, exits, and is gone. You read only the compact `RALPH-SUMMARY` block from its stdout. This keeps your context window clean across many iterations.

---

## Parameter extraction

From the user's invocation, extract:

- **`PROMPT`** — quoted free-form text string describing the work each worker should perform
- **`THRESHOLD`** — second argument, must be `iterations:N` where N is a positive integer (maximum cycles to run)

If either is missing or malformed, print:
```
ERROR: Usage is /ralph-freeprompt "<prompt>" iterations:N
  Example:
    /ralph-freeprompt "tackle the next item in doc audit/doc-cleanup-action-plan.md" iterations:6
```
Then stop.

---

## Phase 0 — Prompt analysis and adjustment

Before spawning any worker, analyse `PROMPT` for iterative suitability. This is a reasoning
step performed by you, the orchestrator — no worker is spawned yet.

**Check for these problems:**

1. **Single-shot phrasing** — prompt uses language like "summarise", "list all", "generate a
   report", or "give me X" that implies one-time output, not a repeatable cycle.
2. **No completion signal** — prompt gives a worker no way to indicate per-cycle progress
   (no mention of marking items done, committing, advancing a cursor, or writing a checkpoint).
3. **Unbounded scope** — prompt says "do everything" or "fix all X" with no unit of work
   per cycle, leaving each worker's scope undefined.
4. **Stateless but stateful intent** — prompt references a file or list but does not tell the
   worker how to avoid repeating work already done by a prior cycle.

**If any problem is found**, rewrite the prompt to fix it, then print:
```
PROMPT ADJUSTED
Original: <original prompt>
Issue:    <one-line explanation>
Adjusted: <rewritten prompt>
Proceeding with adjusted prompt.
```
Use the adjusted prompt for all worker cycles. Never use the original after adjustment.

**Adjustment rules (apply only what is needed — do not over-specify):**
- Add "mark this item done with a `[DONE]` prefix once complete" if no completion signal exists.
- Add "do exactly one item per cycle, then stop" if scope is unbounded.
- Add "check for prior `[DONE]` markers before selecting your item" if state tracking is missing.
- Do not change the intent or target — only add iterability scaffolding.

**If the prompt is suitable as-is:** proceed silently with no output.

Store the final prompt (original or adjusted) as `EFFECTIVE_PROMPT`.

---

## Phase 1 — Initialize

Track these values throughout the loop:
- `ITER = 0` — cycles attempted so far

Print the loop header:
```
╔══════════════════════════════════════════════════════════╗
║  RALPH FREE-PROMPT LOOP STARTED                          ║
╠══════════════════════════════════════════════════════════╣
║  Prompt:    <first 60 chars of EFFECTIVE_PROMPT>...      ║
║  Threshold: iterations:<N>                               ║
╚══════════════════════════════════════════════════════════╝
```

---

## Phase 2 — Threshold check

Before every cycle, verify the stop condition is not yet met:

- If `ITER >= N`, jump to Phase 5.

If threshold not met, proceed to Phase 3.

---

## Phase 3 — Build and fire the sub-agent

### Step 3a — Write the prompt file

```bash
PROMPT_FILE=$(mktemp /tmp/ralph_fp_prompt_XXXXXX.txt)
cat > "$PROMPT_FILE" << 'PROMPTEOF'
Do NOT run `git commit` or `git push`. The monitoring agent owns all version control.

<INSERT EFFECTIVE_PROMPT HERE>

CRITICAL: After finishing (regardless of outcome), output a RALPH-SUMMARY block as the
absolute last thing in your response. The monitoring agent parses only this block.

RALPH-SUMMARY-START
STATUS: SUCCESS|FAILURE|BLOCKED
TASK_TITLE: <brief one-line description of what was done this cycle>
TESTS: PASS|FAIL|SKIP|N/A (<command run and its result, or reason for skip>)
FILES_CHANGED: <comma-separated list of changed files, max 5>
COMMIT_MSG: <one-line commit message ≤72 chars, or n/a if nothing committed>
FAILURE_REASON: <explain if STATUS=FAILURE or BLOCKED; else write none>
RALPH-SUMMARY-END

STATUS definitions:
- SUCCESS: work for this cycle is complete and correct
- FAILURE: unable to complete the work (error, broken tests, unresolvable blocker)
- BLOCKED: nothing to do this cycle (e.g. all items already marked done, no eligible work found)
PROMPTEOF
echo "$PROMPT_FILE"
```

Replace `<INSERT EFFECTIVE_PROMPT HERE>` with the literal text of `EFFECTIVE_PROMPT` before writing.

### Step 3b — Launch the sub-agent process

```bash
RESULT_FILE=$(mktemp /tmp/ralph_fp_result_XXXXXX.json)
claude -p "$(cat "$PROMPT_FILE")" \
  --dangerously-skip-permissions \
  --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
  --max-turns 50 \
  --output-format json \
  > "$RESULT_FILE" 2>/tmp/ralph_fp_stderr_$$.txt
echo "Exit code: $?"
```

Wait for the command to complete. The process will exit on its own.

### Step 3c — Extract the RALPH-SUMMARY

```bash
AGENT_TEXT=$(jq -r '.result // empty' "$RESULT_FILE")

SUMMARY=$(echo "$AGENT_TEXT" | awk '/RALPH-SUMMARY-START/{f=1; next} /RALPH-SUMMARY-END/{f=0} f{print}')

STATUS=$(echo "$SUMMARY" | grep '^STATUS:' | awk '{print $2}' | tr -d '[:space:]')
TASK_TITLE=$(echo "$SUMMARY" | grep '^TASK_TITLE:' | cut -d' ' -f2- | xargs)
TESTS=$(echo "$SUMMARY" | grep '^TESTS:' | cut -d' ' -f2- | xargs)
COMMIT_MSG=$(echo "$SUMMARY" | grep '^COMMIT_MSG:' | cut -d' ' -f2- | xargs)
FAILURE_REASON=$(echo "$SUMMARY" | grep '^FAILURE_REASON:' | cut -d' ' -f2- | xargs)

echo "STATUS=$STATUS"
echo "TASK_TITLE=$TASK_TITLE"

rm -f "$PROMPT_FILE" "$RESULT_FILE" /tmp/ralph_fp_stderr_$$.txt
```

If `STATUS` is empty (RALPH-SUMMARY block not found), treat as `FAILURE` with
`FAILURE_REASON="Sub-agent did not produce a RALPH-SUMMARY block"`.

Increment `ITER` regardless of STATUS.

---

## Phase 4 — Evaluate and act

Branch on the value of `STATUS`:

---

### Branch: SUCCESS

1. Commit:
   ```bash
   git add -A
   git commit -m "$COMMIT_MSG"
   ```
   Skip commit if `COMMIT_MSG` is `n/a` or empty.

2. Push:
   ```bash
   git push origin HEAD
   ```
   If this fails, treat as FAILURE: write the failure report (see below) with the push error
   as `FAILURE_REASON`, then stop.

3. Print cycle result:
   ```
   ✓ Cycle <ITER>/<N> — <TASK_TITLE>
     Tests: <TESTS>
     Committed: <COMMIT_MSG>
   ```

4. Return to Phase 2.

---

### Branch: FAILURE

1. Do not commit or push.

2. Discard all uncommitted changes:
   ```bash
   git checkout -- .
   git clean -fd
   ```

3. Write the failure report — create `docs/ralph-freeprompt-failure.md`:
   ```markdown
   # Ralph Free-Prompt Loop Failure Report

   - **Timestamp:** <current UTC time>
   - **Cycle:** <ITER>/<N>
   - **Task title:** <TASK_TITLE>
   - **Tests:** <TESTS>
   - **Failure reason:** <FAILURE_REASON>
   - **Prompt used:** <EFFECTIVE_PROMPT>
   ```

4. Print:
   ```
   ✗ Cycle <ITER>/<N> FAILED — <FAILURE_REASON>
     Loop halted. Failure report: docs/ralph-freeprompt-failure.md
   ```

5. **Stop. Do not continue the loop.**

---

### Branch: BLOCKED

No eligible work was found this cycle. Stop gracefully.

Print:
```
⊘ Cycle <ITER>/<N> — BLOCKED (<FAILURE_REASON>)
  Stopping early — worker found nothing to do.
```

Jump to Phase 5.

---

## Phase 5 — Loop complete

Print the appropriate final summary:

**Threshold reached:**
```
╔══════════════════════════════════════════════════════════╗
║  RALPH FREE-PROMPT LOOP COMPLETE                         ║
╠══════════════════════════════════════════════════════════╣
║  Cycles completed:  <ITER>                               ║
║  Threshold:         iterations:<N> — REACHED             ║
║  All changes committed and pushed to origin.             ║
╚══════════════════════════════════════════════════════════╝
```

**Stopped by FAILURE:**
```
╔══════════════════════════════════════════════════════════╗
║  RALPH FREE-PROMPT LOOP HALTED                           ║
╠══════════════════════════════════════════════════════════╣
║  Cycles completed:  <ITER - 1> successful                ║
║  Stopped on cycle:  <ITER> (FAILURE)                     ║
║  See: docs/ralph-freeprompt-failure.md                   ║
╚══════════════════════════════════════════════════════════╝
```

**Stopped by BLOCKED:**
```
╔══════════════════════════════════════════════════════════╗
║  RALPH FREE-PROMPT LOOP HALTED                           ║
╠══════════════════════════════════════════════════════════╣
║  Cycles completed:  <ITER - 1> successful                ║
║  Stopped on cycle:  <ITER> (BLOCKED — nothing to do)     ║
╚══════════════════════════════════════════════════════════╝
```

---

## Guardrails

- **You are the monitor. Never implement.** If you find yourself writing code or editing source files, stop — you are out of role.
- **Never commit if STATUS == FAILURE.** The quality gate is absolute.
- **Never read sub-agent output beyond the RALPH-SUMMARY block.** Full transcripts exhaust context over many iterations.
- **Never run extra cycles past threshold.** Hard stop when reached.
- **One `git push` per successful cycle.** Never batch.
- **Temp files are ephemeral.** Always `rm -f` prompt and result temp files after each cycle.
- **If `claude` binary is not found**, check that `~/.cargo/bin` or the install path is in `$PATH`, print an error, and stop.
