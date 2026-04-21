# Doc Cleanup Action Plan — 2026-04-20

Derived from `docs-quality-audit-2026-04-20.md`. Each task below is a discrete agent pass.
Tasks are ordered by blast radius and dependency (structural fixes first, content fixes second,
new-file creation last). An agent should complete a task fully — including any cross-file updates
it requires — before marking it done.

---

## [DONE] TASK-01 — Fix root entry-point hierarchy (README.md + CLAUDE.md symlink note)

**Why grouped:** README.md duplicates content from AGENTS.md and needs trimming. The CLAUDE.md
symlink is intentional and should stay — the Claude CLI auto-injects CLAUDE.md on startup, so
it must contain the full operational context, not a pointer. The fix is clarifying the
relationship in both files, not changing the symlink.

**Findings addressed:** DOC-001, DOC-002, DOC-003, DOC-022

**Note on DOC-001:** The audit flagged the CLAUDE.md symlink as S0, but replacing it with a thin
summary file would be counterproductive. Claude CLI injects CLAUDE.md at startup — a 30-line
pointer doc would leave agents context-starved from the first message. CLAUDE.md and AGENTS.md
should have identical content; the symlink is the correct mechanism for that. The only fix
needed is making the relationship explicit.

**Actions:**

1. At the top of `AGENTS.md`, add a one-line comment (HTML comment so it doesn't render):
   `<!-- CLAUDE.md is a symlink to this file. Claude CLI injects it on startup; AGENTS.md is the canonical source. Edit AGENTS.md only. -->`

2. Trim `README.md` so it no longer duplicates the tech-stack table or core architectural rules
   that appear in AGENTS.md. README should cover: what the platform does, who uses it, and
   a pointer to AGENTS.md as the source of all operational documentation. Keep the quick-start
   commands if they are accurate; remove any section that is already covered in AGENTS.md.

3. In README.md, add an explicit entry-point note:
   "Agents and contributors: start with `AGENTS.md` (auto-loaded as `CLAUDE.md` by the Claude
   CLI) for all operational detail."

**Files to edit:** `AGENTS.md`, `README.md`
**Files NOT to change:** `CLAUDE.md` (symlink is correct as-is)

---

## [DONE] TASK-02 — Fix all broken relative links in DESIGN_SPEC.md + SCORING.md

**Why grouped:** Both files live in the same directory and share the same class of bug — wrong
relative path prefixes. Fixing them in a single pass avoids revisiting the same directory twice.

**Findings addressed:** DOC-050, DOC-051, DOC-052, DOC-053, DOC-054, DOC-055

**Actions:**

In `docs/labs/weather-wellness/DESIGN_SPEC.md`:
- Line 3: `styleguide.md` → `../../styleguide.md`
- Line 3: `animejs.md` → `../../animejs.md`
- Line 60: `MISOKINESIA.md` → `tasks/MISOKINESIA.md`
- Line 92: `DIGITSPAN.md` → `tasks/DIGITSPAN.md`
- Lines 124–127: `ULS8.md`, `CESD10.md`, `GAD7.md`, `COGFUNC8A.md` → `surveys/ULS8.md`,
  `surveys/CESD10.md`, `surveys/GAD7.md`, `surveys/COGFUNC8A.md`

In `docs/labs/weather-wellness/SCORING.md`:
- Line 13: `DIGITSPAN.md` → `tasks/DIGITSPAN.md`
- Lines 14–17: same four survey links → add `surveys/` prefix to each

After fixing, verify all targets exist on disk before considering the task done.

**Files to edit:** `docs/labs/weather-wellness/DESIGN_SPEC.md`, `docs/labs/weather-wellness/SCORING.md`

---

## [DONE] TASK-03 — Fix stale alembic head revision + PYTHONPATH clarity

**Why grouped:** Two files share the same stale revision string, and the adjacent PYTHONPATH
ambiguity lives in the same devSteps.md section. One agent, one focused pass on version accuracy.

**Findings addressed:** DOC-102, DOC-105, DOC-107

**Actions:**

1. In `docs/SCHEMA.md` line 19: update the `alembic current -v` expected output to reflect the
   actual current head `20260407_000001`. Add a comment reminding editors to keep this in sync
   after each migration.

2. In `docs/SCHEMA.md` Migration History table: add the missing `20260228_000008` (T47a) timezone
   correction migration entry.

3. In `docs/devSteps.md`: update any stale alembic head revision string to match `20260407_000001`.

4. In `docs/devSteps.md` and `docs/TESTING.md`: add a one-line clarification that `PYTHONPATH=.`
   is only needed for `pytest` invocations, not for `alembic` commands. Place it adjacent to the
   first occurrence of each command type.

**Files to edit:** `docs/SCHEMA.md`, `docs/devSteps.md`, `docs/TESTING.md`

---

## [DONE] TASK-04 — Fix AGENTS.md setup/workflow accuracy

**Why grouped:** All three issues are in or directly adjacent to the same "Dev Workflow" section
of AGENTS.md. Single agent, surgical edits, no risk of touching unrelated content.

**Findings addressed:** DOC-100, DOC-106, DOC-151, DOC-156, DOC-162

**Actions:**

1. Line 82 (`.env.example` copy): change instruction to
   `Copy backend/.env.example → backend/.env`. Add a follow-up line:
   "If `backend/.env.example` is missing, derive required variables from the Railway Setup
   section in `docs/ARCHITECTURE.md`."

2. Line 40 (`.codex/skills/` mention): update to note that skills are symlinked from
   `.agents/skills/`; the canonical implementations live there.

3. Lines 62–71 (task command fallback): replace the current vague prose with an explicit
   decision rule:
   - If `commands` array is empty or absent → add unit tests for changed modules + build check.
   - If `commands` exist but omit a coverage type clearly required by the changed code
     (e.g. a new API endpoint with no route test) → add only that missing coverage.
   - Never run the full test suite as a substitute for targeted coverage.

4. Add one sentence to the Dev Workflow section: "All backend commands must be run from the repo
   root using the `cd backend && PYTHONPATH=.` prefix pattern shown above."

**Files to edit:** `AGENTS.md`

---

## [DONE] TASK-05 — Resolve canonical path mismatches (root-level doc references)

**Why grouped:** Four separate canonical docs point to root-level paths that don't exist; the
fix is the same mechanical operation repeated four times. Grouping avoids four separate agents
each touching ARCHITECTURE.md and DECISIONS.md.

**Findings addressed:** DOC-005, DOC-006, DOC-007, DOC-008

**Decision on approach:** Create thin stub files at the root paths rather than updating every
inbound reference. Stubs are forward-compatible (new docs that reference the root path will
still work) and keep blast radius small.

**Actions:**

Create the following four stub files. Each stub should contain: a one-line description of what
the doc covers, the actual path where the full doc lives, and a markdown link to it.

- `docs/API.md` → stubs to `docs/labs/weather-wellness/API.md`
- `docs/ANALYTICS.md` → stubs to `docs/labs/weather-wellness/ANALYTICS.md`
- `docs/WEATHER_INGESTION.md` → stubs to `docs/labs/weather-wellness/WEATHER_INGESTION.md`
- `docs/MISOKINESIA.md` → stubs to `docs/labs/weather-wellness/tasks/MISOKINESIA.md`

Stub format (example):
```markdown
# API Reference

Platform API reference. The current implementation covers the weather-wellness lab.

→ Full doc: [docs/labs/weather-wellness/API.md](labs/weather-wellness/API.md)
```

Also update `docs/DECISIONS.md` RESOLVED-18 (line ~396) to use the full path
`docs/labs/weather-wellness/tasks/MISOKINESIA.md` rather than `docs/MISOKINESIA.md`, since that
entry pre-dates the stub.

**Files to create:** `docs/API.md`, `docs/ANALYTICS.md`, `docs/WEATHER_INGESTION.md`,
`docs/MISOKINESIA.md`
**Files to edit:** `docs/DECISIONS.md`

---

## [DONE] TASK-06 — Create docs/ENV_VARS.md (NEW FILE) and de-duplicate env var docs

**Why a new file:** Env var documentation currently appears in four separate files with
contradictions (SUPABASE_JWT_SECRET conditional vs. unconditional; SUPABASE_ANON_KEY missing
from ARCHITECTURE.md). A single authoritative table eliminates drift and gives agents one place
to look. All four source files then become thin cross-references.

**Findings addressed:** DOC-101, DOC-104

**Actions:**

1. Create `docs/ENV_VARS.md`. The file should contain:
   - A table with columns: Variable, Required, Default, Description, Where set.
   - Cover all variables from AGENTS.md, CONVENTIONS.md, ARCHITECTURE.md, devSteps.md:
     `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`,
     and any others found in `.env.example`.
   - For `SUPABASE_JWT_SECRET`: document it as conditional — required only when HS256 fallback
     JWT verification is enabled. Cross-reference ARCHITECTURE.md auth topology section.
   - Add a one-line note on JWT verification modes (ES256/JWKS primary, HS256 fallback) with a
     pointer to ARCHITECTURE.md for the full auth topology.

2. In AGENTS.md Dev Workflow section: replace the inline env var list with
   "See `docs/ENV_VARS.md` for the full variable reference."

3. In CONVENTIONS.md env var section (lines ~207–217): replace inline descriptions with a
   pointer to `docs/ENV_VARS.md`.

4. In ARCHITECTURE.md and devSteps.md: replace any inline env var tables/lists with a pointer
   to `docs/ENV_VARS.md`.

**Files to create:** `docs/ENV_VARS.md`
**Files to edit:** `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/devSteps.md`

---

## Routing Baseline (Applies To TASK-07+)

The doc system has moved to an index-first model:

- `docs/INDEX.md` is the canonical routing map.
- Root routing stubs (`docs/API.md`, `docs/ANALYTICS.md`, `docs/WEATHER_INGESTION.md`,
  `docs/MISOKINESIA.md`) were intentionally removed.
- Canonical references should use real doc locations (for current lab scope, usually
  `docs/labs/weather-wellness/...`).
- Any remaining task that creates, renames, moves, or deletes docs must update
  `docs/INDEX.md` in the same commit, plus the nearest parent index where relevant.

---

## [DONE] TASK-07 — Create docs/TRIAL_MODE.md (NEW FILE) and align trial-mode rules across docs

**Why a new file:** Trial-mode behaviour is currently split between CONVENTIONS.md (fake-id
format, watermark) and API.md (trial-run mode section), with contradictions and gaps. Agents
implementing any trial-mode feature read partial specs and produce inconsistent results. A
single canonical file eliminates the contradiction and gives agents a focused, unambiguous
reference.

**Findings addressed:** DOC-155, DOC-161, DOC-165, DOC-170

**Actions:**

1. Create `docs/TRIAL_MODE.md`. The file should specify:
   - **Fake ID format:** `trial-` prefix followed by a local sequence number (e.g. `trial-1`,
     `trial-2`). Never use UUID v4 in trial mode. Store in session/local storage only. Never
     write trial IDs to the database.
   - **Watermark visibility:** Trial Run watermark is shown on WW participant pages only.
     Explicitly excluded from the Misokinesia participant task (`/misokinesia/[id]`) even when
     `TRIAL_RUN_MODE` is active.
   - **Module placement:** Trial-mode pure functions (including `getTrialRunWatermarkLabel`) live
     in `src/lib/trial-mode.ts`. UI rendering (watermark component) is a separate component.
     Neither module should have side effects or async logic.
   - **Consent:** Consent gating is UI-only. The consent screen gates the participant flow before
     navigation to the first survey but does not write a database row. Trial mode does not bypass
     or alter consent gating logic.

2. In `docs/INDEX.md`: add `docs/TRIAL_MODE.md` to the Platform Docs table.

3. In `docs/CONVENTIONS.md` (lines ~104–111 and ~63–66): replace inline trial-mode prose with
   a pointer to `docs/TRIAL_MODE.md`. Keep only a one-line summary + link.

4. In `docs/labs/weather-wellness/API.md` TRIAL_RUN_MODE section (line ~159): add a pointer to
   `docs/TRIAL_MODE.md` and add the explicit watermark exclusion rule for `/misokinesia/[id]`.

**Files to create:** `docs/TRIAL_MODE.md`
**Files to edit:** `docs/INDEX.md`, `docs/CONVENTIONS.md`, `docs/labs/weather-wellness/API.md`

---

## [DONE] TASK-08 — Enforce task quality standards in the start-task skill

**Why redirected from workboard.json:** The affected workboard tasks (T115, T128, T130, T132,
T134, T136, T142, T143) are already complete — there is no value in back-filling their entries.
The right fix is upstream: enforce these standards in the `start-task` skill so that every
future task benefits automatically, rather than patching individual completed entries.

**Findings addressed:** DOC-150, DOC-153, DOC-154, DOC-156, DOC-158, DOC-163, DOC-164, DOC-166, DOC-169

**Actions:**

Read the current `start-task` skill implementation at `.agents/skills/start-task` before making
any edits, to understand the existing structure and hook points.

Add or extend a **pre-execution checklist** section in the skill that enforces the following
before the agent begins implementing a task:

1. **Working directory:** All backend commands must be prefixed `cd backend &&`. All backend
   pytest calls must include `PYTHONPATH=.`. If a task's `commands` array omits these, the
   skill should inject them rather than running the commands as written.

2. **Done criteria completeness:** If `acceptance_criteria` is absent or contains only
   narrative prose with no verifiable step, the skill must pause and surface the gap to the
   user before proceeding — do not silently proceed with partial criteria.

3. **Test output format:** If a task's acceptance criteria reference a dry-run or output check
   but do not specify format (JSON, plaintext, etc.), the skill must ask the user to clarify
   before running.

4. **Seed idempotency:** If a task involves a seed or fixture script, the skill must confirm
   (via code inspection or task notes) whether the script is idempotent before running it twice.

5. **Test fixture coverage:** If a task's done criteria include edge-case verification (null
   thresholds, empty sets, zero-variance inputs), the skill must confirm a corresponding fixture
   exists or create one before marking tests as passing.

6. **Storybook tasks:** Done = Storybook builds without errors + all variant states render
   without console errors. The skill must run `cd frontend && npm run build-storybook` and
   check for errors before marking a Storybook task done. Manual review gates are noted but
   do not block marking done.

7. **Full regression suites:** If a task references "the full regression suite", the skill must
   enumerate the actual test files from the repo (glob `test_*.py` in the relevant directory)
   rather than accepting a vague description as done criteria.

8. **Documentation routing integrity:** If a task creates, renames, moves, or deletes files
   under `docs/`, the skill must require updates to `docs/INDEX.md` and verify that canonical
   references point to real paths (not removed root stubs).

**Both skill files must be updated independently.** `.codex/skills/start-task` and
`.agents/skills/start-task` are not symlinked — they integrate differently but serve the same
functional role. Read both files before editing so the additions fit each one's existing
structure. Apply equivalent logic to both; do not assume identical wording is always correct
if the surrounding structure differs.

**Files to edit:** `.agents/skills/start-task`, `.codex/skills/start-task`

---

## [DONE] TASK-09 — Separate current vs. target state in ARCHITECTURE.md and devSteps.md

**Why grouped:** Both files interleave Render (legacy) and Railway (target) deployment details
without labelling them, creating the same reader confusion. Fixing them independently risks
introducing new inconsistencies between the two; fixing together ensures the "current" and
"target" framing is consistent.

**Findings addressed:** DOC-004, DOC-009, DOC-014

**Actions:**

1. In `docs/ARCHITECTURE.md`:
   - Add a callout at the top of the deployment section clearly marking "Current State" (Render)
     vs. "Target State" (Railway + Canada Supabase).
   - Move Render-specific details (keep-alive workflow, Render service config) into a clearly
     labelled "Legacy / Current Deployment" subsection.
   - In the post-implementation checklist (line ~334): replace the reference to
     `ROUTING_CLEANUP.md` with a direction to update `docs/workboard.json`.

2. In `docs/devSteps.md`:
   - Remove or fully archive the section labelled "Historical note: this section originally
     documented the live Render service" that continues documenting Render as current.
   - Add a clear "Current Setup" heading for the Railway path and "Legacy Reference" heading for
     any Render notes kept for continuity.

3. In `docs/migrations/working-railway-supabase-canada-migration.md`:
   - Add a header note: "This document is a planning archive. Canonical deployment topology is
     documented in `docs/ARCHITECTURE.md`." No other content changes needed.

4. If any deployment/planning doc status labels or paths change, update `docs/INDEX.md` so the
   routing map reflects the same current-vs-archive split.

**Files to edit:** `docs/ARCHITECTURE.md`, `docs/devSteps.md`,
`docs/migrations/working-railway-supabase-canada-migration.md`, `docs/INDEX.md` (if needed)

---

## [DONE] TASK-10 — Validate index-first routing chain for lab docs

**Why grouped:** The current system routes through `docs/INDEX.md` first, then into lab hubs,
then leaf docs. This task verifies and completes that chain so nested docs are discoverable
without adding root-level stubs.

**Findings addressed:** DOC-012, DOC-056, DOC-057, DOC-058, DOC-059, DOC-060, DOC-061, DOC-062

**Actions:**

1. In `docs/INDEX.md`: ensure Weather & Wellness routing includes:
   - `docs/labs/weather-wellness/README.md`
   - `API.md`, `ANALYTICS.md`, `SCORING.md`, `WEATHER_INGESTION.md`,
     `HISTORICAL_WEATHER_BACKFILL.md`, `DESIGN_SPEC.md`
   - Add `docs/UI_REDESIGN_2026.md` to Platform Docs with a brief note of scope.

2. In `docs/labs/weather-wellness/README.md`: ensure the lab documentation section links to the
   core lab docs and includes explicit leaf links for surveys and tasks.

3. In `AGENTS.md` Docs section: add `docs/UI_REDESIGN_2026.md` as a listed UI reference, with a
   note clarifying relationship to `docs/styleguide.md` (2026 direction vs. current
   implementation guidance).

4. In `docs/labs/weather-wellness/WEATHER_INGESTION.md`: ensure there is a "See also" link to
   `HISTORICAL_WEATHER_BACKFILL.md`.

5. Confirm root entry docs keep the index-first pattern: `README.md` and `AGENTS.md` should
   point to `docs/INDEX.md` as the router (avoid duplicating large lab link lists there).

**Files to edit:** `docs/INDEX.md`, `docs/labs/weather-wellness/README.md`, `AGENTS.md`,
`README.md`, `docs/labs/weather-wellness/WEATHER_INGESTION.md`

---

## [DONE] TASK-11 — Archive legacy docs and scrub active references

**Why archive (current system):** The repo now explicitly keeps archive/history docs (for example
`docs/progress/PROGRESS_LOG.md` as archive-only) while routing active work through canonical
docs and `docs/workboard.json`. The fix is to prevent archived docs from being treated as current
source-of-truth, not blanket-delete all historical files.

**Findings addressed:** DOC-010, DOC-011, DOC-015, DOC-017, DOC-019, DOC-020

**Actions:**

1. Ensure archive-status headers are explicit in retained historical docs (at minimum:
   `docs/ROUTING_CLEANUP.md`, `docs/progress/PROGRESS_LOG.md`,
   `docs/labs/weather-wellness/tasks/working-misokinesia-add.md`). Each should point to the
   canonical replacement doc(s).

2. Remove or rewrite active implementation guidance that still treats archive docs as canonical.
   Keep archive references only where they are explicitly historical context.

3. In `docs/INDEX.md`, keep/archive entries clearly labelled (for example, PROGRESS_LOG as
   archive-only) and avoid routing active implementation through archive docs.

4. If any historical file is deleted or renamed during cleanup, perform a repo-wide search for
   that path and update all references in the same commit; then sync `docs/INDEX.md`.

**Files to edit:** `docs/INDEX.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`, `README.md`,
`docs/labs/weather-wellness/WEATHER_INGESTION.md`,
`docs/labs/weather-wellness/tasks/working-misokinesia-add.md`, plus any other referencing files
found during search

---

## [DONE] TASK-12 — CONVENTIONS.md + TESTING.md policy tightening

**Why grouped:** All findings are policy/constraint clarity improvements to docs that agents
read when implementing features. They share no file-structural dependencies and can be done in
one pass across two closely related files.

**Findings addressed:** DOC-152, DOC-157, DOC-167

**Actions:**

1. `docs/CONVENTIONS.md` — Auth guard section (lines ~63–66): add a pointer to the
   route-topology test file that verifies both the middleware gate and the layout gate are
   wired. Note: "Any route change that touches auth gating must include an assertion in
   `frontend/src/app/api/ra/route-topology.test.ts`."

2. `docs/CONVENTIONS.md` — Schema placement rule (lines ~40–45): extend the existing rule with:
   "Name files after the domain (e.g. `analytics.py`, `misokinesia.py`). Group all `*Create`,
   `*Response`, and `*Update` schemas for that domain in the same file. Do not split a single
   domain across multiple schema files."

3. `docs/TESTING.md` — Parity test failure section (lines ~178–194): add resolution guidance:
   "Parity failures indicate Python logic has drifted from `reference/labs/weather-wellness/`
   R scripts. Verify the formula, field names, and z-score logic against the reference R script
   before changing the Python implementation. Document intentional divergences in
   `docs/DECISIONS.md`."

4. Keep all added references on canonical paths; if this task introduces any new docs, update
   `docs/INDEX.md` in the same commit.

**Files to edit:** `docs/CONVENTIONS.md`, `docs/TESTING.md`

---

## [DONE] TASK-13 — Create docs/labs/README.md lab onboarding template (NEW FILE) + consolidate multi-lab schema docs

**Why a new file:** There is no template or checklist for new labs. Without it, new lab docs
will continue to be inconsistently structured and orphaned. Creating a template also forces the
agent to canonicalize the relationship between MULTI_LAB.md (authoritative) and New_Schema.md
(archive), which are the two most overlapping docs in the repo.

**Findings addressed:** DOC-015, DOC-018

**Actions:**

1. Create `docs/labs/README.md` as a lab onboarding template. It should document:
   - Required files for a new lab: `docs/labs/<lab-slug>/README.md`,
     `docs/labs/<lab-slug>/API.md`, `docs/labs/<lab-slug>/SCORING.md`,
     `docs/labs/<lab-slug>/DESIGN_SPEC.md`.
   - Optional files and when to create them (e.g. `ANALYTICS.md`, `WEATHER_INGESTION.md`).
   - A checklist: lab registered in `labs` table, `lab_id` scoping verified in all endpoints,
     lab referenced from `docs/INDEX.md` and the root `AGENTS.md` Docs section.
   - Pointer to `docs/MULTI_LAB.md` as the canonical data model reference.

2. In `docs/migrations/New_Schema.md`: add a header note:
   "Status: design archive. The canonical multi-lab schema is documented in
   `docs/MULTI_LAB.md`. This file is retained for historical context only."

3. In `docs/MULTI_LAB.md`: add a one-line note at the top confirming it is the authoritative
   multi-lab schema reference, and link to `docs/labs/README.md` for lab onboarding steps.

4. In `docs/INDEX.md`: add a Labs hub entry for `docs/labs/README.md`.

**Files to create:** `docs/labs/README.md`
**Files to edit:** `docs/migrations/New_Schema.md`, `docs/MULTI_LAB.md`, `docs/INDEX.md`

---

## [DONE] TASK-14 — Miscellaneous single-file fixes (PRD, SCHEMA, DECISIONS, working draft docs)

**Why grouped:** These are the remaining small S2/S3 findings that don't cluster naturally with
any earlier task. Grouping them avoids four tiny one-line agent passes. Each fix is
self-contained and carries no cross-doc dependency risk.

**Findings addressed:** DOC-013, DOC-016, DOC-019, DOC-020, DOC-103, DOC-159, DOC-160

**Actions:**

1. `docs/PRD.md` (lines ~1–10): add a Status callout at the top with three rows:
   Shipped / In Progress / Planned. Fill in based on workboard.json and current feature state.

2. `docs/migrations/` directory: add a `README.md` (one paragraph) explaining that this folder
   contains strategic planning and migration documents, not Alembic migration scripts. Point
   readers to `backend/alembic/` for schema migration scripts. Add this file to `docs/INDEX.md`.

3. `docs/labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md`: add a status line at the top
   clarifying whether this procedure is still active or a one-time historical operation. If
   complete, add "Status: completed — retained for reference."

4. `docs/labs/weather-wellness/tasks/working-misokinesia-add.md`: add/confirm a header note:
   "Status: completed planning archive. See `tasks/MISOKINESIA.md` for current architecture."
   If renamed, update all references and `docs/INDEX.md` in the same commit.

5. `docs/SCHEMA.md` — import normalization section (lines ~1275–1279): add a reference:
   "See `backend/app/services/import_service.py` normalization functions for the complete
   canonicalization rules including edge cases (e.g. `'Over 38'` → `'>38'`)."

6. `docs/labs/weather-wellness/API.md` (line ~156): update T143 entry to note that
   `/misokinesia/trial-manifest` should also appear in the ARCHITECTURE.md routing inventory;
   flag this as a known gap if ARCHITECTURE.md hasn't been updated post-T143.

7. `docs/workboard.json` T115/T116 docs fields: verify that the referenced
   `docs/labs/weather-wellness/ANALYTICS.md` file exists and paths do not point to removed
   root stubs.

**Files to edit:** `docs/PRD.md`, `docs/SCHEMA.md`, `docs/labs/weather-wellness/API.md`,
`docs/labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md`,
`docs/labs/weather-wellness/tasks/working-misokinesia-add.md`, `docs/workboard.json`
**Files to create:** `docs/migrations/README.md`
**Also update if needed:** `docs/INDEX.md`

---

## [DONE] TASK-15 — Add skill selection decision tree to AGENTS.md

**Why a standalone task:** This is a policy-level edit to AGENTS.md that is intentionally
isolated from TASK-04 (which also touches AGENTS.md). The decision tree requires understanding
the repo-local skill semantics and should be reviewed independently by the project owner before
it goes in, since it codifies agent behaviour that was previously implicit.

**Findings addressed:** DOC-168

**Actions:**

In `AGENTS.md`, under the "Repo-local task skills" bullet (line ~39–41), add an explicit
decision tree:

```
- To inspect the active queue without executing: use `query-workboard`.
- To implement a single task end-to-end: use `start-task`.
- To run autonomous multi-task loops (e.g. "complete the next 3 tasks"): use `ralphloop`.
- Do not invoke `ralphloop` for a single task; do not invoke `start-task` in a loop manually.
```

**Files to edit:** `AGENTS.md`

---

## [DONE] TASK-16 — Add doc-maintenance and link-integrity rules to AGENTS.md

**Why a standalone task:** This is a standing instruction to all future agents, not a one-time
fix. It belongs in AGENTS.md (and therefore CLAUDE.md by symlink) so every agent session starts
with the expectation baked in. It should be a first-class section, not buried in a bullet.

**Findings addressed:** DOC-003, DOC-021 (generalised) — and the systemic root cause behind the
entire orphan-doc and broken-link clusters found in this audit.

**Actions completed:** A top-level **Documentation Maintenance** section now exists in
`AGENTS.md` after Task Execution, including a routing-aware rule:

- create/rename/move/delete under `docs/` requires updating `docs/INDEX.md` in the same commit
- impacted parent indexes and links must be updated alongside the path change

**Files to edit:** `AGENTS.md`

---

## Summary Table

| Task | Scope | Effort | New Files? | Key Findings |
|------|-------|--------|------------|--------------|
| TASK-01 | README trim + CLAUDE.md symlink clarification (keep symlink) | S | No | DOC-001, 002, 003, 022 |
| TASK-02 | Fix 11 broken links in DESIGN_SPEC + SCORING | S | No | DOC-050–055 |
| TASK-03 | Stale alembic revisions + PYTHONPATH clarity | S | No | DOC-102, 105, 107 |
| TASK-04 | AGENTS.md setup/workflow accuracy | S | No | DOC-100, 106, 151, 156, 162 |
| TASK-05 | Canonical path migration for lab docs (no root stubs) | S | No | DOC-005, 006, 007, 008 |
| TASK-06 | Create ENV_VARS.md + de-duplicate env var docs | M | `docs/ENV_VARS.md` | DOC-101, 104 |
| TASK-07 | Create TRIAL_MODE.md + align trial-mode rules | M | `docs/TRIAL_MODE.md` | DOC-155, 161, 165, 170 |
| TASK-08 | Enforce task quality standards in start-task skill | M | No | DOC-150, 153, 154, 156, 158, 163, 164, 166, 169 |
| TASK-09 | Current vs. target state in ARCHITECTURE + devSteps | M | No | DOC-004, 009, 014 |
| TASK-10 | Validate index-first routing chain for lab docs | S | No | DOC-012, 056–062 |
| TASK-11 | Archive legacy docs + scrub active references | M | No | DOC-010, 011, 017, 019, 020 |
| TASK-12 | CONVENTIONS.md + TESTING.md policy tightening | S | No | DOC-152, 157, 167 |
| TASK-13 | Create labs/README.md template + retire New_Schema | M | `docs/labs/README.md` | DOC-018 |
| TASK-14 | Miscellaneous single-file fixes | S | `docs/migrations/README.md` | DOC-013, 016, 103, 159, 160 |
| TASK-15 | Skill selection decision tree in AGENTS.md | S | No | DOC-168 |
| TASK-16 | Add doc-maintenance + link-integrity rules to AGENTS.md (**done**) | S | No | systemic root cause |

**New files created across completed tasks:** `docs/INDEX.md`, `docs/ENV_VARS.md`

**Potential new files from remaining tasks:** `docs/TRIAL_MODE.md`, `docs/labs/README.md`,
`docs/migrations/README.md`

**Recommended execution order (remaining):** TASK-09 → TASK-10 → TASK-12 → TASK-13
→ TASK-14 → TASK-11

Routing note: all remaining tasks should preserve the index-first pattern
(`AGENTS.md`/`README.md` → `docs/INDEX.md` → lab hub/leaf docs) and must not reintroduce
root routing stubs.
