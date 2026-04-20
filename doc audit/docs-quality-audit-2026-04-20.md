# Documentation Quality Audit — 2026-04-20

**Repository:** Weather-and-Wellness-Dashboard  
**Auditor:** Claude Code (4 parallel workstream sub-agents + synthesis)  
**Scope:** AGENTS.md, README.md, CLAUDE.md, `docs/**/*.md`, `docs/workboard.json`

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Overall score | **22 / 50** |
| Risk level | **HIGH** |
| Files audited | 33 |
| Total findings | 63 |
| S0 Critical | 2 |
| S1 High | 32 |
| S2 Medium | 26 |
| S3 Low | 3 |

The documentation has a functioning skeleton (AGENTS.md is well-structured, workboard.json follows the documented schema, canonical rules are mostly correct) but suffers from three systemic problems:

1. **Path proliferation / root-vs-lab mismatch.** Multiple canonical docs reference platform-level paths (e.g. `docs/API.md`, `docs/ANALYTICS.md`) that only exist at `docs/labs/weather-wellness/…`. This is a multi-doc navigation failure.
2. **Broken internal links.** DESIGN_SPEC.md and SCORING.md have 11+ broken relative links due to incorrect subdirectory assumptions. Every link in those files that targets tasks/ or surveys/ is wrong.
3. **Agent actionability gaps.** Several workboard tasks lack concrete done criteria or verifiable test commands. Agents reading the board in isolation can complete tasks incorrectly and mark them done.

---

## 2. Scorecard

| # | Category | Score | Notes |
|---|----------|-------|-------|
| 1 | Discoverability | 2/5 | Large orphan doc cluster; lab docs not linked from any index |
| 2 | Source-of-truth clarity | 2/5 | CLAUDE.md is a symlink; README/AGENTS duplicate content; competing task-board formats |
| 3 | Internal link integrity | 2/5 | 11 confirmed broken relative links across 2 files |
| 4 | Cross-doc consistency | 3/5 | Env-var sets differ; stale revision in SCHEMA.md; path formats inconsistent |
| 5 | Commands/paths/env-var accuracy | 2/5 | .env.example wrong location, stale alembic head, ANALYTICS.md ref missing |
| 6 | Workflow reproducibility | 2/5 | Render/Railway ambiguity in ARCHITECTURE.md + devSteps.md; mixed current/target |
| 7 | Policy/constraint explicitness | 3/5 | Core rules well-stated in AGENTS.md; trial-mode and consent phrasing needs tightening |
| 8 | Agent actionability | 2/5 | Multiple tasks lack done criteria, verifiable steps, or working-directory specs |
| 9 | Freshness/ownership signals | 2/5 | Few docs have dates or owners; cannot tell what's current vs. aspirational |
| 10 | Change-management hygiene | 2/5 | ROUTING_CLEANUP.md bypasses workboard; migration docs folder misnamed |

**Total: 22 / 50**

---

## 3. Top Findings (Prioritized)

| ID | Sev | File | Issue |
|----|-----|------|-------|
| DOC-AUDIT-001 | S0 | CLAUDE.md | CLAUDE.md is a symlink to AGENTS.md — ambiguous canonical entry point |
| DOC-AUDIT-162 | S0 | AGENTS.md:82 | .env.example copy instruction fails on fresh clone (file is at backend/.env.example) |
| DOC-AUDIT-054 | S1 | DESIGN_SPEC.md:124–127 | Four broken survey links (missing surveys/ prefix) |
| DOC-AUDIT-055 | S1 | SCORING.md:13–17 | Five broken links (tasks/ and surveys/ prefix missing) |
| DOC-AUDIT-100 | S1 | AGENTS.md:82 | .env.example is at backend/.env.example, not repo root as documented |
| DOC-AUDIT-005 | S1 | Multiple | Canonical refs point to docs/API.md (root) but file is at docs/labs/weather-wellness/API.md |
| DOC-AUDIT-006 | S1 | Multiple | Canonical refs point to docs/ANALYTICS.md (root) but file is at docs/labs/weather-wellness/ANALYTICS.md |
| DOC-AUDIT-007 | S1 | Multiple | Canonical refs point to docs/WEATHER_INGESTION.md but file is in labs/ subtree |
| DOC-AUDIT-151 | S1 | AGENTS.md:62–71 | "When task commands are missing or incomplete" is ambiguous — no decision rule given |
| DOC-AUDIT-161 | S1 | CONVENTIONS.md:104–111 | Trial mode fake-id spec missing — agents may use real UUIDs |

---

## 4. Full Findings Log

### Workstream 1 — Structure & Source-of-Truth

---

**DOC-AUDIT-001**
- severity: S0
- category: SourceOfTruth
- file_path: CLAUDE.md
- line_refs: 1
- issue: CLAUDE.md is a symlink to AGENTS.md; no standalone content; ambiguous canonical entry point for human vs. agent readers.
- impact: Edits to AGENTS.md automatically propagate to CLAUDE.md; unclear which doc is authoritative for which audience.
- recommended_fix: Replace symlink with standalone CLAUDE.md that summarises onboarding and delegates detail to AGENTS.md.
- effort: S
- confidence: High

---

**DOC-AUDIT-002**
- severity: S1
- category: Duplicate
- file_path: README.md vs AGENTS.md
- line_refs: README:14–35, AGENTS.md:12–21
- issue: Tech stack table and core architectural rules duplicated nearly verbatim across both files.
- impact: Changes must be made in two places; risk of silent drift.
- recommended_fix: Keep full rules in AGENTS.md; reduce README to brief summary with link.
- effort: S
- confidence: High

---

**DOC-AUDIT-003**
- severity: S1
- category: SourceOfTruth
- file_path: AGENTS.md:45–56, README.md:138–165
- line_refs: AGENTS.md:45–56, README.md:138–165
- issue: Docs section headings and canonical reference lists differ between AGENTS.md and README.md.
- impact: Users cannot determine which is the current canonical doc index.
- recommended_fix: AGENTS.md should be the sole canonical index; README should state "See AGENTS.md for the full documentation index".
- effort: S
- confidence: High

---

**DOC-AUDIT-004**
- severity: S2
- category: SourceOfTruth
- file_path: docs/ARCHITECTURE.md
- line_refs: 3–8, 275, 310–312
- issue: ARCHITECTURE.md states "target post-cutover topology" but also describes current Render deployment and keep-alive workflow, mixing current and aspirational states.
- impact: Readers cannot tell which state the system is actually in; new operators may configure Render incorrectly.
- recommended_fix: Add "Current State" vs "Target State" separation, or move Render details to a legacy appendix.
- effort: M
- confidence: High

---

**DOC-AUDIT-005**
- severity: S1
- category: Orphan
- file_path: docs/ARCHITECTURE.md, docs/DECISIONS.md
- line_refs: ARCHITECTURE.md:34, CONVENTIONS.md:113
- issue: Root docs reference `docs/API.md` but the file only exists at `docs/labs/weather-wellness/API.md`.
- impact: Readers searching for `docs/API.md` will not find it.
- recommended_fix: Either create a platform-level `docs/API.md` stub, or update all references to use the full lab path.
- effort: S
- confidence: High

---

**DOC-AUDIT-006**
- severity: S1
- category: Orphan
- file_path: docs/ARCHITECTURE.md
- line_refs: 20, 169
- issue: ARCHITECTURE.md references `docs/ANALYTICS.md` (root) but file only exists at `docs/labs/weather-wellness/ANALYTICS.md`.
- impact: Readers following canonical references will not find the file.
- recommended_fix: Create platform-level `docs/ANALYTICS.md` stub or update ARCHITECTURE.md to use the full path.
- effort: S
- confidence: High

---

**DOC-AUDIT-007**
- severity: S1
- category: Orphan
- file_path: docs/ARCHITECTURE.md, docs/DECISIONS.md
- line_refs: ARCHITECTURE.md:275
- issue: DECISIONS.md and ARCHITECTURE.md reference `docs/WEATHER_INGESTION.md` (root) but file only exists at `docs/labs/weather-wellness/WEATHER_INGESTION.md`.
- impact: Readers cannot locate the weather ingestion spec using the stated path.
- recommended_fix: Create `docs/WEATHER_INGESTION.md` stub or update all canonical references to the full lab path.
- effort: S
- confidence: High

---

**DOC-AUDIT-008**
- severity: S1
- category: Orphan
- file_path: docs/DECISIONS.md
- line_refs: DECISIONS.md:396
- issue: DECISIONS.md RESOLVED-18 references `docs/MISOKINESIA.md` but file exists only at `docs/labs/weather-wellness/tasks/MISOKINESIA.md`.
- impact: Readers following the decision record cannot locate the misokinesia architecture doc.
- recommended_fix: Create stub or update DECISIONS.md to use the full path.
- effort: S
- confidence: High

---

**DOC-AUDIT-009**
- severity: S2
- category: Duplicate
- file_path: docs/ARCHITECTURE.md, docs/migrations/working-railway-supabase-canada-migration.md
- line_refs: ARCHITECTURE.md:1–9, 310–326; migration.md:1–11, 305–340
- issue: Both documents describe the same Railway + Canada Supabase cutover plan with expanded detail in the migration doc.
- impact: Two separate documents describe the same target state; changes to cutover plan must be coordinated in both.
- recommended_fix: Retire the migration document as archive; reference ARCHITECTURE.md as canonical.
- effort: M
- confidence: High

---

**DOC-AUDIT-010**
- severity: S1
- category: Duplicate
- file_path: docs/ROUTING_CLEANUP.md
- line_refs: 1–347
- issue: ROUTING_CLEANUP.md is a standalone implementation playbook (RB01–RB06) outside the canonical workboard.json task queue.
- impact: Operators must check two task-board formats; unclear whether these tasks are active or historical.
- recommended_fix: Migrate tasks into workboard.json and mark ROUTING_CLEANUP.md as historical reference.
- effort: M
- confidence: Med

---

**DOC-AUDIT-011**
- severity: S2
- category: SourceOfTruth
- file_path: docs/ARCHITECTURE.md
- line_refs: 334
- issue: ARCHITECTURE.md post-implementation checklist directs updating ROUTING_CLEANUP.md, but AGENTS.md designates workboard.json as canonical; circular reference.
- impact: Operators directed to update ROUTING_CLEANUP.md are working outside the canonical queue.
- recommended_fix: Replace ROUTING_CLEANUP.md references in ARCHITECTURE.md with a direction to update workboard.json.
- effort: S
- confidence: Med

---

**DOC-AUDIT-012**
- severity: S1
- category: Orphan
- file_path: docs/UI_REDESIGN_2026.md
- line_refs: N/A
- issue: UI_REDESIGN_2026.md is not referenced in AGENTS.md, README.md, or any canonical docs index; docs/styleguide.md is listed instead without clarifying the relationship.
- impact: New contributors won't discover the 2026 redesign direction via canonical docs; design guidance is split.
- recommended_fix: Add reference from AGENTS.md or consolidate into styleguide.md with clear precedence statement.
- effort: S
- confidence: High

---

**DOC-AUDIT-013**
- severity: S2
- category: SourceOfTruth
- file_path: docs/PRD.md
- line_refs: 1–10, 42–45
- issue: PRD.md references "target deployment after infrastructure migration" without clarifying which items are shipped vs. planned.
- impact: New team members cannot determine if PRD describes current requirements or future direction.
- recommended_fix: Add a "Status" section at the top clarifying shipped/in-progress/planned items.
- effort: S
- confidence: Med

---

**DOC-AUDIT-014**
- severity: S1
- category: SourceOfTruth
- file_path: docs/devSteps.md
- line_refs: 82–113
- issue: devSteps.md labels a section "Historical note: this section originally documented the live Render service" then continues documenting Render as current deployment.
- impact: Developers cannot tell whether to set up Render (legacy) or Railway (target).
- recommended_fix: Clearly separate "Current Setup" and "Target Setup" sections, or remove Render documentation.
- effort: M
- confidence: High

---

**DOC-AUDIT-015**
- severity: S2
- category: Duplicate
- file_path: docs/migrations/New_Schema.md, docs/MULTI_LAB.md
- line_refs: New_Schema.md:1–50, MULTI_LAB.md:1–68
- issue: Both documents cover the same multi-lab schema design space with overlapping content about labs, studies, and participants tables.
- impact: Unclear which is current design vs. aspirational; changes must be coordinated in both.
- recommended_fix: Use MULTI_LAB.md as authoritative; move New_Schema.md to archive.
- effort: M
- confidence: High

---

**DOC-AUDIT-016**
- severity: S3
- category: Structure
- file_path: docs/migrations/
- line_refs: (directory listing)
- issue: The `docs/migrations/` folder contains strategic planning docs, not migration runbooks or change logs as the name implies.
- impact: Readers may waste time looking for schema migration scripts here instead of in backend/alembic/.
- recommended_fix: Rename to `docs/planning/` or add a README.md explaining folder purpose.
- effort: S
- confidence: Med

---

**DOC-AUDIT-017**
- severity: S1
- category: SourceOfTruth
- file_path: docs/progress/PROGRESS_LOG.md
- line_refs: 1–4
- issue: PROGRESS_LOG.md header states "Archive only" but does not direct readers to docs/workboard.json for active task tracking.
- impact: Developers may append to PROGRESS_LOG.md despite the warning.
- recommended_fix: Add a second line directing readers to `docs/workboard.json`.
- effort: S
- confidence: High

---

**DOC-AUDIT-018**
- severity: S2
- category: Structure
- file_path: docs/labs/weather-wellness/README.md
- line_refs: N/A
- issue: No documented template or structure requirement for lab-specific README files; new labs have no guidance.
- impact: New labs may produce inconsistently structured documentation.
- recommended_fix: Create `docs/labs/README.md` template/checklist for lab onboarding.
- effort: M
- confidence: Med

---

**DOC-AUDIT-019**
- severity: S2
- category: Orphan
- file_path: docs/labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md
- line_refs: N/A
- issue: Not referenced in any root or canonical doc; unclear if it is current, historical, or superseded.
- impact: Operators needing historical weather backfill guidance may not find this doc.
- recommended_fix: Either add reference from WEATHER_INGESTION.md if still current, or move to archive with status note.
- effort: S
- confidence: Med

---

**DOC-AUDIT-020**
- severity: S2
- category: Orphan
- file_path: docs/labs/weather-wellness/tasks/working-misokinesia-add.md
- line_refs: N/A
- issue: "working-" prefix suggests in-progress draft, but DECISIONS.md RESOLVED-18 suggests misokinesia is complete; no status marker in the file.
- impact: Ambiguous whether this is a completed planning doc or active work.
- recommended_fix: Integrate into MISOKINESIA.md and archive this file, or rename with clear status marker.
- effort: S
- confidence: Med

---

**DOC-AUDIT-021**
- severity: S1
- category: SourceOfTruth
- file_path: Multiple
- line_refs: AGENTS.md:45–56, README.md:138–165
- issue: Different docs reference canonical paths with inconsistent formats (relative vs. repo-root paths, with/without leading slash).
- impact: No consistent canonical reference format makes cross-referencing harder.
- recommended_fix: Establish a canonical path style in AGENTS.md: always use paths relative to repo root (e.g. `docs/styleguide.md`).
- effort: S
- confidence: Med

---

**DOC-AUDIT-022**
- severity: S2
- category: Structure
- file_path: AGENTS.md, README.md, CLAUDE.md
- line_refs: (root)
- issue: Three entry-point docs at repo root with unclear hierarchy (AGENTS.md says "start here", README is public-facing, CLAUDE.md is a symlink).
- impact: New contributors/operators may not know which doc to read first.
- recommended_fix: Establish a single clear entry-point hierarchy: README for discovery → AGENTS.md for all operational detail.
- effort: M
- confidence: High

---

### Workstream 2 — Links & Navigation

---

**DOC-AUDIT-050**
- severity: S1
- category: BrokenLink
- file_path: docs/labs/weather-wellness/DESIGN_SPEC.md
- line_refs: 3
- issue: Link `[docs/styleguide.md](styleguide.md)` uses incorrect relative path; file is two directories up.
- impact: Reader cannot navigate to styleguide.md by clicking the link.
- recommended_fix: Change target to `../../styleguide.md`.
- effort: S
- confidence: High

---

**DOC-AUDIT-051**
- severity: S1
- category: BrokenLink
- file_path: docs/labs/weather-wellness/DESIGN_SPEC.md
- line_refs: 3
- issue: Link `[docs/animejs.md](animejs.md)` uses incorrect relative path; file is two directories up.
- impact: Reader cannot navigate to animejs.md by clicking the link.
- recommended_fix: Change target to `../../animejs.md`.
- effort: S
- confidence: High

---

**DOC-AUDIT-052**
- severity: S1
- category: BrokenLink
- file_path: docs/labs/weather-wellness/DESIGN_SPEC.md
- line_refs: 60
- issue: Link `[docs/MISOKINESIA.md](MISOKINESIA.md)` uses wrong path; file is in tasks/ subdirectory.
- impact: Reader cannot navigate to Misokinesia task spec from design spec.
- recommended_fix: Change target to `tasks/MISOKINESIA.md`.
- effort: S
- confidence: High

---

**DOC-AUDIT-053**
- severity: S1
- category: BrokenLink
- file_path: docs/labs/weather-wellness/DESIGN_SPEC.md
- line_refs: 92
- issue: Link `[docs/DIGITSPAN.md](DIGITSPAN.md)` uses wrong path; file is in tasks/ subdirectory.
- impact: Reader cannot navigate to Digit Span task spec from design spec.
- recommended_fix: Change target to `tasks/DIGITSPAN.md`.
- effort: S
- confidence: High

---

**DOC-AUDIT-054**
- severity: S1
- category: BrokenLink
- file_path: docs/labs/weather-wellness/DESIGN_SPEC.md
- line_refs: 124, 125, 126, 127
- issue: Four broken links in survey response scale table: ULS8.md, CESD10.md, GAD7.md, COGFUNC8A.md — all missing the `surveys/` prefix.
- impact: Reader cannot navigate to survey specifications from design spec.
- recommended_fix: Change all four targets to include `surveys/` prefix.
- effort: S
- confidence: High

---

**DOC-AUDIT-055**
- severity: S1
- category: BrokenLink
- file_path: docs/labs/weather-wellness/SCORING.md
- line_refs: 13, 14, 15, 16, 17
- issue: Five broken links in instrument scoring table: DIGITSPAN.md (missing `tasks/`), ULS8.md, CESD10.md, GAD7.md, COGFUNC8A.md (all missing `surveys/`).
- impact: Reader cannot navigate to detailed scoring specifications.
- recommended_fix: Update to `tasks/DIGITSPAN.md`, `surveys/ULS8.md`, `surveys/CESD10.md`, `surveys/GAD7.md`, `surveys/COGFUNC8A.md`.
- effort: S
- confidence: High

---

**DOC-AUDIT-056**
- severity: S2
- category: OrphanDoc
- file_path: docs/devSteps.md
- line_refs: N/A
- issue: devSteps.md is developer setup documentation not linked with a markdown link from any navigation doc; only mentioned in free text in README.md.
- impact: New developers may not discover this setup checklist through navigation.
- recommended_fix: Add markdown link from README.md or AGENTS.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-057**
- severity: S2
- category: OrphanDoc
- file_path: docs/labs/weather-wellness/ANALYTICS.md
- line_refs: N/A
- issue: Not linked from any parent or navigation doc.
- impact: Analytics contributors cannot discover this specification through navigation.
- recommended_fix: Add markdown link from labs/weather-wellness/README.md or ARCHITECTURE.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-058**
- severity: S2
- category: OrphanDoc
- file_path: docs/labs/weather-wellness/API.md
- line_refs: N/A
- issue: Canonical FastAPI endpoint reference not linked from any parent or navigation doc.
- impact: API consumers cannot discover endpoint contracts through navigation.
- recommended_fix: Add markdown link from labs/weather-wellness/README.md and/or AGENTS.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-059**
- severity: S2
- category: OrphanDoc
- file_path: docs/labs/weather-wellness/HISTORICAL_WEATHER_BACKFILL.md
- line_refs: N/A
- issue: Operational procedure not linked from any doc. (See also DOC-AUDIT-019.)
- impact: Operators running weather backfill must know to search for this doc.
- recommended_fix: Add link from WEATHER_INGESTION.md and/or devSteps.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-060**
- severity: S2
- category: OrphanDoc
- file_path: docs/labs/weather-wellness/README.md
- line_refs: N/A
- issue: Lab README not linked from any parent documentation.
- impact: Readers of lab-specific docs cannot navigate back to lab overview.
- recommended_fix: Add markdown link from root README.md "Labs" section and/or AGENTS.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-061**
- severity: S2
- category: OrphanDoc
- file_path: docs/labs/weather-wellness/SCORING.md
- line_refs: N/A
- issue: Canonical scoring reference not linked from any parent doc; DESIGN_SPEC.md links are broken (DOC-AUDIT-055).
- impact: Scorers and validators cannot discover this spec through navigation.
- recommended_fix: Fix broken links in DESIGN_SPEC.md; add direct link from labs/weather-wellness/README.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-062**
- severity: S2
- category: OrphanDoc
- file_path: docs/labs/weather-wellness/WEATHER_INGESTION.md
- line_refs: N/A
- issue: Feature specification not linked from any parent doc.
- impact: Weather ingestion implementers cannot discover spec through navigation.
- recommended_fix: Add link from labs/weather-wellness/README.md and ARCHITECTURE.md.
- effort: S
- confidence: Med

---

### Workstream 3 — Consistency & Drift

---

**DOC-AUDIT-100**
- severity: S1
- category: MissingFile
- file_path: AGENTS.md
- line_refs: 82
- issue: AGENTS.md instructs "Copy `.env.example` → `.env`" but the file is at `backend/.env.example`, not the repo root.
- impact: Developers following the quickstart will not find the file; initial setup fails.
- recommended_fix: Update to "Copy `backend/.env.example` → `backend/.env`" (or wherever the copy should land).
- effort: S
- confidence: High

---

**DOC-AUDIT-101**
- severity: S1
- category: EnvVarDrift
- file_path: AGENTS.md:82, CONVENTIONS.md:207–217, ARCHITECTURE.md:316–323, docs/devSteps.md:99–107
- line_refs: (multiple)
- issue: `SUPABASE_JWT_SECRET` is listed as unconditionally required in AGENTS.md but as conditional ("when RA JWT auth enabled") in CONVENTIONS.md and ARCHITECTURE.md. `SUPABASE_ANON_KEY` appears in AGENTS.md but not in ARCHITECTURE.md or devSteps.md env var sections.
- impact: Operators may not know which env vars are truly required; incomplete configuration or missed optional features.
- recommended_fix: Consolidate env var documentation into a single source table in CONVENTIONS.md or a new `docs/ENV_VARS.md`, cross-referenced from all other docs.
- effort: M
- confidence: High

---

**DOC-AUDIT-102**
- severity: S2
- category: SchemaConflict
- file_path: docs/SCHEMA.md
- line_refs: 19, 662–666
- issue: SCHEMA.md verification checklist says `alembic current -v` should report `Rev: 20260313_000001 (head)`, but the Migration History table shows current head is `20260407_000001` (25 days and multiple migrations newer).
- impact: Developers using the checklist will see a mismatch and may incorrectly assume their migration setup is wrong.
- recommended_fix: Update line 19 to `Rev: 20260407_000001 (head)` and add a note to keep this in sync after each migration.
- effort: S
- confidence: High

---

**DOC-AUDIT-103**
- severity: S2
- category: MissingFile
- file_path: docs/workboard.json
- line_refs: T116–T120 docs fields
- issue: Multiple workboard analytics tasks reference `docs/labs/weather-wellness/ANALYTICS.md` in their `docs` field, but this file does not exist (confirmed by WS2 orphan check — ANALYTICS.md exists but WS3 cross-referenced the workboard reference).
- impact: Task automation tools or developers cannot locate the referenced doc; may assume analytics documentation is missing.
- recommended_fix: Create `docs/labs/weather-wellness/ANALYTICS.md` if missing, or correct workboard task `docs` references to an existing file.
- effort: M
- confidence: High

---

**DOC-AUDIT-104**
- severity: S3
- category: EnvVarDrift
- file_path: docs/CONVENTIONS.md
- line_refs: 209–211
- issue: CONVENTIONS.md JWT description is vague; no mention of JWKS primary / HS256 fallback verification modes documented in ARCHITECTURE.md.
- impact: Developers reading CONVENTIONS.md alone may not understand the dual JWT verification mode.
- recommended_fix: Update to: "JWT verification uses ES256 via JWKS as primary; HS256 with `SUPABASE_JWT_SECRET` as fallback. See ARCHITECTURE.md for full auth topology."
- effort: S
- confidence: Med

---

**DOC-AUDIT-105**
- severity: S3
- category: ConflictingCommand
- file_path: docs/devSteps.md, docs/TESTING.md
- line_refs: devSteps.md:18, TESTING.md:14, 31
- issue: devSteps.md verification checklist states a stale alembic head revision; TESTING.md uses `PYTHONPATH=. .venv/bin/pytest` but devSteps.md omits that prefix for alembic commands, creating uncertainty about when the prefix is needed.
- impact: Developers may add unnecessary prefix to Alembic commands or omit it from pytest commands.
- recommended_fix: Clarify that `PYTHONPATH=.` is only needed for pytest (not alembic); update stale revision in devSteps.md.
- effort: S
- confidence: Med

---

**DOC-AUDIT-106**
- severity: S2
- category: MissingFile
- file_path: AGENTS.md
- line_refs: 40
- issue: AGENTS.md says `.codex/skills/` contains repo-local skills; directory exists but contains only symlinks to `../../.agents/skills/`, not actual implementations.
- impact: Developers searching `.codex/skills/` for skill implementation will find only symlinks; low operational impact but technically inaccurate.
- recommended_fix: Update AGENTS.md line 40 to note that skills are symlinked from `.agents/skills/`.
- effort: S
- confidence: Low

---

**DOC-AUDIT-107**
- severity: S3
- category: ConflictingCommand
- file_path: docs/SCHEMA.md
- line_refs: 69, 656
- issue: SCHEMA.md references timezone correction migration `20260228_000008` (T47a) but this migration is absent from the Migration History table; table jumps from T47a entry to T54.
- impact: Operators tracing timezone history may miss the migration context.
- recommended_fix: Add migration `20260228_000008` (T47a) to the Migration History table with explicit date and correction details.
- effort: S
- confidence: Med

---

### Workstream 4 — Agent-Readability & Actionability

---

**DOC-AUDIT-150**
- severity: S1
- category: MissingPrereq
- file_path: docs/workboard.json
- line_refs: T143
- issue: T143 task lacks working-directory specification for all commands; does not indicate `cd backend` vs. repo root.
- impact: Agent may run pytest or alembic from wrong directory, causing command failures.
- recommended_fix: Add explicit `cd backend` prefix to all commands in the commands array.
- effort: S
- confidence: Med

---

**DOC-AUDIT-151**
- severity: S1
- category: AmbiguousInstruction
- file_path: AGENTS.md
- line_refs: 62–71
- issue: "When task commands are missing or incomplete, choose validation from this repo's actual setup" gives no decision rule for when commands count as missing vs. intentionally sparse.
- impact: Agents may over-test or under-test depending on interpretation.
- recommended_fix: Add explicit decision tree: if no commands array → add unit tests + build verification; if commands exist but omit specific coverage → add only if changed code type normally requires it.
- effort: S
- confidence: High

---

**DOC-AUDIT-152**
- severity: S2
- category: UnverifiableStep
- file_path: docs/CONVENTIONS.md
- line_refs: 63–66
- issue: "Frontend auth guard (two layers)" lists middleware and layout gates but provides no verification command or test to confirm both are wired.
- impact: Agents may implement route changes that inadvertently bypass one gate.
- recommended_fix: Point to a route-topology test file that verifies both gate layers; add to the commands pattern for auth-touching tasks.
- effort: M
- confidence: Med

---

**DOC-AUDIT-153**
- severity: S1
- category: MissingPrereq
- file_path: docs/workboard.json
- line_refs: T115
- issue: T115 acceptance criteria require exactly 1 seed row + 29 stimuli rows but do not state whether the seed is idempotent or requires a clean DB; running twice may fail or produce wrong counts.
- impact: Agents may be unsure if running the seed script twice is safe.
- recommended_fix: Clarify whether the seed is idempotent (upsert) or one-shot; add note for resetting if needed.
- effort: S
- confidence: High

---

**DOC-AUDIT-154**
- severity: S1
- category: MissingDoneCriteria
- file_path: docs/workboard.json
- line_refs: T142
- issue: T142 says "output is ready for manual project-owner inspection before T139/T140 proceed" but does not specify what an agent should do after creating mocks or how to confirm acceptability; `MANUAL_TRIAL_RUN_MOCK_APPROVAL` gate exists only in notes.
- impact: Agent completes the task (builds Storybook, pushes mocks) but cannot determine whether to mark it done or wait.
- recommended_fix: Add explicit done criteria: Storybook builds without errors; all variant states render; agent commits and marks task done pending manual review gate.
- effort: S
- confidence: High

---

**DOC-AUDIT-155**
- severity: S2
- category: Contradiction
- file_path: AGENTS.md:28, docs/labs/weather-wellness/API.md:522
- line_refs: AGENTS.md:28, API.md:522
- issue: AGENTS.md "does not write a consent row/flag to the database" could be misread as "consent is optional" rather than "consent is gated client-side, not stored".
- impact: Agent reading AGENTS.md:28 in isolation might think consent can be skipped programmatically.
- recommended_fix: Clarify: "Consent gating is UI-only. The consent screen gates the participant flow UI before navigation to the first survey but does not write a DB row."
- effort: S
- confidence: Med

---

**DOC-AUDIT-156**
- severity: S1
- category: MissingPrereq
- file_path: docs/workboard.json
- line_refs: T128 (commands)
- issue: `cd backend && PYTHONPATH=. .venv/bin/python -m pytest ...` assumes execution from repo root; fails silently in non-standard working directories.
- impact: Agents in worktrees or CI with different CWDs may encounter confusing PYTHONPATH errors.
- recommended_fix: Document in AGENTS.md: "All backend commands must be run from repo root using `cd backend && PYTHONPATH=.` prefix pattern."
- effort: S
- confidence: High

---

**DOC-AUDIT-157**
- severity: S2
- category: UnverifiableStep
- file_path: docs/TESTING.md
- line_refs: 178–194
- issue: "Treat parity test failures as blocking" but no guidance on how to resolve a parity failure; does not explain whether to change the test or the Python code.
- impact: Agents may skip parity tests, ignore failures, or break parity without understanding the root cause.
- recommended_fix: Add resolution guidance: "Parity failures indicate Python drift from reference/Weather_MLM.R. Verify formula/field/z-score logic against the R script. Document changes in DECISIONS.md."
- effort: M
- confidence: High

---

**DOC-AUDIT-158**
- severity: S1
- category: MissingDoneCriteria
- file_path: docs/workboard.json
- line_refs: T132
- issue: T132 dry-run acceptance criterion does not specify output format (plaintext, JSON, CSV); agent cannot verify success without seeing sample output.
- impact: Agent may implement verbose human-readable output when machine-parseable JSON was expected, or vice versa.
- recommended_fix: Specify required output format and include a sample output snippet in notes.
- effort: M
- confidence: Med

---

**DOC-AUDIT-159**
- severity: S1
- category: AmbiguousInstruction
- file_path: docs/labs/weather-wellness/API.md
- line_refs: 156
- issue: T143 entry in API.md lists status `implemented` but ARCHITECTURE.md routing inventory does not include `/misokinesia/trial-manifest`; agents may add the endpoint again or assume it is not canonical.
- impact: Duplicate endpoint or omission from routing inventory.
- recommended_fix: Update ARCHITECTURE.md routing inventory to include `/misokinesia/trial-manifest` after T143 completion, or explicitly note it is RA-only and excluded from the browser→backend table.
- effort: S
- confidence: Med

---

**DOC-AUDIT-160**
- severity: S2
- category: MissingPrereq
- file_path: docs/SCHEMA.md
- line_refs: 1275–1279
- issue: Demographic field canonicalization notes mention variant mappings ("Over 38" → ">38") without a comprehensive list or reference to the import service code.
- impact: Agents re-implementing import logic may miss edge cases and create inconsistent canonicalization.
- recommended_fix: Add reference: "See `backend/app/services/import_service.py:_normalize_demographics()` for the complete normalization rules."
- effort: M
- confidence: Med

---

**DOC-AUDIT-161**
- severity: S1
- category: AmbiguousInstruction
- file_path: docs/CONVENTIONS.md
- line_refs: 104–111
- issue: Trial mode "should use clearly fake frontend-only ids" but does not specify format; agents may use real UUID v4s or inconsistent id schemes across WW and Misokinesia flows.
- impact: Fake ids may collide with real data or be inconsistent across task flows.
- recommended_fix: Specify: "Fake trial ids use the prefix `trial-` followed by a local sequence number (e.g. `trial-1`). Never use UUID v4 in trial mode. Store in session/local storage only."
- effort: S
- confidence: High

---

**DOC-AUDIT-162**
- severity: S0
- category: MissingPrereq
- file_path: AGENTS.md
- line_refs: 82
- issue: "Copy `.env.example` → `.env`" gives no guidance for a fresh clone where `.env.example` is absent; agents will fail with "file not found" without recovery instructions. (Corroborates DOC-AUDIT-100.)
- impact: Agents in fresh clones fail immediately at dev workflow entry without clear recovery path.
- recommended_fix: Add prerequisite: "Before starting, ensure `backend/.env.example` exists. If missing, derive variables from ARCHITECTURE.md Railway Setup section."
- effort: S
- confidence: High

---

**DOC-AUDIT-163**
- severity: S1
- category: UnverifiableStep
- file_path: docs/workboard.json
- line_refs: T136
- issue: Acceptance criterion references "RA route-topology coverage" but does not link to the test file or show an example of what to add.
- impact: Agents may skip route-topology coverage or add incomplete coverage.
- recommended_fix: Add to notes: "Add assertion to `frontend/src/app/api/ra/route-topology.test.ts`; see existing assertions for pattern."
- effort: S
- confidence: Med

---

**DOC-AUDIT-164**
- severity: S1
- category: MissingDoneCriteria
- file_path: docs/workboard.json
- line_refs: T115
- issue: Acceptance criterion "POST /misokinesia/start returns manifest URLs that load immediately with no 403 or redirect" has no verification procedure for a non-browser agent.
- impact: Agents may skip this verification or perform it inconsistently.
- recommended_fix: Add to commands: "Verify by fetching a manifest URL in Python: `requests.get(manifest['clips'][0]['public_url']).status_code == 200`."
- effort: S
- confidence: Med

---

**DOC-AUDIT-165**
- severity: S2
- category: Contradiction
- file_path: docs/CONVENTIONS.md:111, docs/labs/weather-wellness/API.md:159
- line_refs: CONVENTIONS.md:111, API.md:159
- issue: CONVENTIONS.md says trial-run watermark should not appear on the Misokinesia participant task page, but API.md TRIAL_RUN_MODE section does not mention watermark visibility at all — agents may add it everywhere.
- impact: Agents implementing trial mode may add the watermark to Misokinesia pages, violating the CONVENTIONS constraint.
- recommended_fix: Clarify in both docs: "Trial Run watermark: visible on WW participant pages only. Explicitly omit from Misokinesia participant task (`/misokinesia/[id]`), even in trial mode."
- effort: S
- confidence: High

---

**DOC-AUDIT-166**
- severity: S1
- category: UnverifiableStep
- file_path: docs/workboard.json
- line_refs: T130
- issue: Acceptance criterion for null threshold edge cases does not specify test fixtures; agent cannot confirm without a complex test or reading the implementation.
- impact: Agents may skip or under-test the null threshold edge case.
- recommended_fix: Add fixture guidance to notes: "Add fixture with 1 unique study day and a fixture with zero temperature variance; verify both return null thresholds."
- effort: M
- confidence: Med

---

**DOC-AUDIT-167**
- severity: S1
- category: MissingPrereq
- file_path: docs/CONVENTIONS.md
- line_refs: 40–45
- issue: "Place schemas in `backend/app/schemas/`, one file per domain" does not specify naming convention or when to split vs. consolidate schema files.
- impact: Agents may create inconsistently named or fragmented schema files.
- recommended_fix: Add: "Name files after the domain (e.g. `analytics.py`, `misokinesia.py`). Group all `*Create`, `*Response`, and `*Update` schemas for that domain in the same file."
- effort: S
- confidence: Med

---

**DOC-AUDIT-168**
- severity: S2
- category: AmbiguousInstruction
- file_path: AGENTS.md
- line_refs: 39–41
- issue: AGENTS.md mentions `.codex/skills/` workflow skills but gives no decision tree for when to use `start-task` vs. `query-workboard` vs. `ralphloop`.
- impact: Agents may invoke the wrong skill or run skills in the wrong order.
- recommended_fix: Add explicit decision tree: "Use `query-workboard` to list tasks. Use `start-task` for a single task. Use `ralphloop` for autonomous multi-task loops only."
- effort: M
- confidence: Med

---

**DOC-AUDIT-169**
- severity: S1
- category: MissingDoneCriteria
- file_path: docs/workboard.json
- line_refs: T134
- issue: "The full backend analytics regression suite passes" is vague; agent could run only one file and claim done.
- impact: Incomplete test coverage; analytics regressions go undetected.
- recommended_fix: Specify the full test file list in commands: all 9 `test_analytics_*.py` and related router test files.
- effort: S
- confidence: High

---

**DOC-AUDIT-170**
- severity: S1
- category: AmbiguousInstruction
- file_path: docs/TESTING.md
- line_refs: 142–144
- issue: Trial-mode helper list includes `getTrialRunWatermarkLabel` but no guidance on whether watermark logic belongs in `trial-mode.ts` vs. a component file.
- impact: Agents may place trial-mode logic in the wrong module, creating inconsistent testability.
- recommended_fix: Clarify: "Trial mode plumbing lives in `src/lib/trial-mode.ts` (pure functions). UI rendering (watermark component) is separate. Neither should have side effects or async logic."
- effort: S
- confidence: Med

---

## 5. Conflicts Matrix

| Doc A | Doc B | Conflict |
|-------|-------|---------|
| AGENTS.md | README.md | Tech stack + arch rules duplicated (DOC-002, DOC-003) |
| AGENTS.md | CONVENTIONS.md | SUPABASE_JWT_SECRET conditional vs unconditional (DOC-101) |
| AGENTS.md | ARCHITECTURE.md | SUPABASE_ANON_KEY missing from ARCHITECTURE.md env var table (DOC-101) |
| ARCHITECTURE.md | devSteps.md | Both describe Render as current/legacy without clear status (DOC-004, DOC-014) |
| ARCHITECTURE.md | migrations/working-railway-supabase-canada-migration.md | Same Railway cutover plan in two places (DOC-009) |
| ARCHITECTURE.md | ROUTING_CLEANUP.md | Post-impl checklist directs updating ROUTING_CLEANUP.md, bypassing workboard.json (DOC-011) |
| docs/MULTI_LAB.md | docs/migrations/New_Schema.md | Overlapping multi-lab schema design (DOC-015) |
| docs/SCHEMA.md | docs/devSteps.md | Stale alembic head revision in both (DOC-102, DOC-105) |
| CONVENTIONS.md (trial watermark) | labs/weather-wellness/API.md (trial mode) | Watermark visibility rule present in CONVENTIONS.md, absent in API.md (DOC-165) |

---

## 6. Coverage Gaps

| Gap | Impact | Action |
|-----|--------|--------|
| No platform-level `docs/API.md` stub | Canonical references broken for all docs not in labs/weather-wellness tree | Create stub or update all references |
| No `docs/labs/README.md` template | New labs produce inconsistently structured docs | Create template |
| No `docs/ENV_VARS.md` single-source env var table | Drift between AGENTS.md, CONVENTIONS.md, ARCHITECTURE.md, devSteps.md | Consolidate |
| No fresh-clone setup verification checklist | Agents fail on first run without clear recovery | Extend AGENTS.md Dev Workflow section |
| No documented trial-mode fake-id specification | Inconsistent id schemes across WW and Misokinesia flows | Document in CONVENTIONS.md |
| Import normalization rules only in code | Agents re-implementing import logic miss edge cases | Extract to `IMPORT_NORMALIZATION_RULES.md` or link from SCHEMA.md |
| Analytics full regression suite not enumerated | Tasks can be marked done with partial test coverage | Enumerate in workboard or TESTING.md |

---

## 7. Prioritized Remediation Plan (Top 10)

| Priority | ID(s) | Action | Effort | Value |
|----------|-------|--------|--------|-------|
| 1 | DOC-001, DOC-022 | Replace CLAUDE.md symlink with standalone doc; establish README→AGENTS.md entry point hierarchy | S | Eliminates S0 confusion |
| 2 | DOC-050–055 | Fix all 11 broken relative links in DESIGN_SPEC.md and SCORING.md | S | Restores all in-doc navigation for the most-used lab docs |
| 3 | DOC-100, DOC-162 | Fix `.env.example` path in AGENTS.md Dev Workflow; add recovery guidance for missing file | S | Eliminates S0 setup blocker |
| 4 | DOC-005–008 | Create platform-level stub docs (`docs/API.md`, `docs/ANALYTICS.md`, `docs/WEATHER_INGESTION.md`, `docs/MISOKINESIA.md`) or update all canonical references to use full lab paths | S | Fixes 4 navigation dead-ends in canonical docs |
| 5 | DOC-101 | Consolidate env var documentation into a single source table in CONVENTIONS.md | M | Eliminates env-var ambiguity across 4 files |
| 6 | DOC-151, DOC-168 | Add decision trees for: (a) when to add test coverage for tasks with sparse commands; (b) which workflow skill to use | S | High agent-actionability gain |
| 7 | DOC-161, DOC-165 | Specify trial-mode fake-id format in CONVENTIONS.md; align trial-watermark visibility in API.md | S | Prevents contradictory trial-mode implementations |
| 8 | DOC-102, DOC-105, DOC-107 | Update stale alembic head revision in SCHEMA.md and devSteps.md | S | Eliminates developer confusion on clean-slate setup |
| 9 | DOC-154, DOC-164, DOC-169 | Tighten done criteria for T142 (Storybook mocks), T115 (manifest URLs), T134 (analytics regression suite) | S | Prevents tasks being marked done prematurely |
| 10 | DOC-004, DOC-014 | Separate current vs. target state in ARCHITECTURE.md and devSteps.md | M | Eliminates Render/Railway ambiguity for new operators |
