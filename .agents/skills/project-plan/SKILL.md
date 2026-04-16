---
name: project-plan
description: "Use this skill when the user has a new feature idea, product change, integration question, refactor proposal, or wants to understand how a proposed change should fit into this repo. This skill runs a planning-first workflow: read AGENTS.md, infer the minimum relevant docs, gather targeted context, ask at least one clarification question, draft a terminal-only documentation proposal, and after the direction is accepted, produce workboard-compatible implementation tasks with dependencies and subtasks when needed."
---

# Project Plan

Use this skill for proposal shaping, documentation planning, and implementation breakdown in Weather-and-Wellness-Dashboard. Do not jump into implementation unless the user explicitly switches from planning to execution.

## Workflow

1. Read `AGENTS.md` first.
2. Infer the minimum relevant docs from the proposal. Use [references/doc-routing.md](references/doc-routing.md).
3. Gather context surgically:
   - Prefer headings, targeted searches, and specific sections over opening full docs.
   - Do not read unrelated docs just because they exist.
   - Do not read the full `docs/workboard.json` unless the user explicitly asks for that file to be changed.
4. Restate the proposal in repo terms and identify likely affected surfaces.
5. Ask at least one clarification question before presenting any proposal. Ask more questions if scope, rollout, or behavior is still ambiguous.
6. Draft a terminal-only documentation proposal. This proposal is for doc changes only, not code changes.
7. Revise the proposal with the user until the documentation direction is accepted.
8. Once the documentation direction is accepted:
   - update the relevant docs if the user has asked for execution
   - then create workboard-compatible implementation tasks using [references/workboard-format.md](references/workboard-format.md)

## Proposal Output

When drafting the documentation proposal in the terminal, keep it compact and use this structure:

- Title
- Why this change exists
- Docs to update
- Proposed changes by doc
- Open questions or assumptions
- Acceptance conditions

The proposal should describe how the docs should change, not how the implementation should be coded line by line.

## Clarification Rules

- Ask at least one real question tied to scope, UX, data shape, rollout, or constraints.
- Prefer concise questions with concrete tradeoffs.
- Ask additional questions when lab isolation, auth boundaries, or schema impact is unclear.

## Task Breakdown Rules

After the documentation direction is accepted and applied, produce tasks that other agents can pick up without making product decisions.

- Match the existing workboard shape and naming style.
- Split tasks by subsystem or responsibility, not by arbitrary file count.
- Create subtasks only when they reduce ambiguity or let work proceed in parallel.
- Use `depends_on` and `blocked_by` to show ordering explicitly.
- Keep acceptance criteria behavioral and testable.
- Prefer work items that map cleanly to one primary surface such as API, schema, backend logic, UI, data ingestion, or docs.
- Do not mutate `docs/workboard.json` unless the user explicitly asks to write tasks there.

## Context Discipline

The context window is a shared budget. Keep this skill lean:

- Keep `AGENTS.md` as the dispatcher, not as a document to summarize repeatedly.
- Load only the docs implied by the proposal.
- Use targeted reads before full reads.
- Keep the first output to a documentation proposal only.
- Defer workboard task generation until after the documentation direction is settled.

## Constraints

- Treat this as a planning-first skill. It approximates plan mode, but it does not itself change the system's collaboration mode.
- Do not implement code during the initial proposal phase.
- Do not mutate `docs/workboard.json` unless the user explicitly asks to write tasks there.
