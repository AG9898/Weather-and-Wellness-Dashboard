# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.

---

## Current State

| Field              | Value                  |
|--------------------|------------------------|
| Phase              | 1                      |
| Tasks completed    | 0 / 18                 |
| Tasks in progress  | 0                      |
| Last updated       | —                      |

---

## Currently In Progress

_No tasks in progress. Next available task: **T01** (no dependencies)._

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

---

## Completed Tasks

| Task | Title | Completed | Notes |
|------|-------|-----------|-------|
| — | — | — | No tasks completed yet. |

<!-- Ralph: append one row per completed task. Never delete rows. -->

---

## Recent Changes

_No changes yet._

<!-- Ralph: prepend one entry per completed task using the format below (newest first). -->

---

## Entry Format (for Ralph)

When marking a task `"done"`, prepend to Recent Changes:

```
### Txx — [Title] — YYYY-MM-DD

**Files created:**
- path/to/new/file.ext — brief description of purpose

**Files modified:**
- path/to/existing/file.ext — what changed

**Key implementation decisions:**
- Any choice that deviated from spec, filled in an underspecified detail, or
  that future tasks should be aware of

**Blockers encountered:**
- Any issue that required deviation, workaround, or that a future task should know

**Docs updated:**
- docs/FILENAME.md — what was added/changed
```

Also:
- Update the **Current State** table (increment completed count, update last updated date)
- Replace the **Currently In Progress** section with the next task or "_No tasks in progress._"
- Append one row to the **Completed Tasks** table
