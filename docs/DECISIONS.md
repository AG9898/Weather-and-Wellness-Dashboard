# DECISIONS.md — Architectural Decisions Log

> **Open decisions:** Do not resolve without explicit instruction from the project owner.
> To resolve: move the block to the Resolved section, fill in `Resolved` and `Why`, and
> update any affected docs (SCORING.md, SCHEMA.md, etc.).
>
> **Adding a new decision:** Copy the template below and assign the next OPEN-XX number.

---

## Open Decisions

### OPEN-01 — Monorepo vs. Split Repositories

**Why it matters:** Governs CI configuration, deployment pipeline, versioning strategy,
and whether a shared types package makes sense. Affects all path references in code.

**Options considered:**
- **Monorepo** (frontend/ + backend/ in one repo): simpler for a small lab team, shared kanban, single PR for full-stack changes. Currently assumed.
- **Split repos**: cleaner separation, independent deploy pipelines, but more overhead for a 2-person team.

**Current default:** Proceed with monorepo layout. Use `frontend/` and `backend/` prefixes in all path references. Do not flatten both source trees into the root.

**Blocks / affects:** T01 and all tasks with path references.

---

*(OPEN-02 moved to Resolved section — see RESOLVED-04)*

---

*(OPEN-03 moved to Resolved section — see RESOLVED-05)*

---

*(OPEN-04 moved to Resolved section — see RESOLVED-06)*

---

## Resolved Decisions

### RESOLVED-01 — Database Platform: Supabase

**Resolved:** Pre-project (before T01)

**Decision:** Supabase is the managed database platform for Phase 1. Supabase Auth is optional.

**Why:** Supabase bundles three required capabilities:
1. Managed PostgreSQL — same semantics as Neon or self-hosted; Alembic/SQLAlchemy unchanged
2. Optional Supabase Auth — when enabled, RA login uses Supabase JWTs validated by FastAPI
3. Supabase Studio — lab team reads all stored results directly via the web UI

Neon would be preferred if DB branching were a priority and a separate auth solution existed. For this project, a single managed platform with optional auth is the right tradeoff.

**Affects:** All DB and auth tasks; T02 (Supabase connection), T06/T18 (auth pattern).

---

### RESOLVED-02 — No CSV Export in Phase 1

**Resolved:** Pre-project (before T01)

**Decision:** No CSV export feature will be built in Phase 1.

**Why:** Supabase Studio provides sufficient data access for the lab team. A CSV export
endpoint and UI add scope and complexity without clear benefit at this stage. Can be
revisited in Phase 2 if lab workflows require it.

**Affects:** No export endpoint or UI tasks. All data stays in the Supabase DB.

---

### RESOLVED-03 — Server-side Scoring, Client-side Timing

**Resolved:** Pre-project (before T01)

**Decision:** Client (Next.js) handles digit presentation timing only. All scoring computed server-side (FastAPI). Final scores never computed on the client.

**Why:** Server-side scoring ensures a single authoritative implementation, enables unit testing in isolation, and prevents score manipulation. Client-side timing is necessary because digit presentation must be precise (1000ms/digit) without a round-trip per digit.

**Affects:** T09 (digit span scoring), T10 (survey scoring), T14–T16 (frontend timing logic).

---

### RESOLVED-04 — CogFunc 8a Exact Likert Range (was OPEN-02)

**Resolved:** 2026-02-18

**Decision:** CogFunc 8a uses a **1–5 scale**: Never (1) / Rarely (2) / Sometimes (3) / Often (4) / Very Often (5). Raw values 1–5 are stored in the database. Computed scores use PROMIS-standard reverse scoring (`6 - raw`) so higher = better cognitive function.

**Why:** Confirmed from the lab's instrument form (Cognitive Function.pdf, UBC H24-03749 v1.2). The lab form uses straight 1–5 with "Right now..." framing. The official PROMIS form (PROMIS_SF_v2.0-Cognitive_Function_8a_1-23-2020.pdf) uses reverse scoring (Never=5, Very Often=1). Resolution: store raw 1-5, reverse for computed scores to match official PROMIS scoring direction.

**Affects:** T05 (SMALLINT range 1-5), T10 (scoring module), T16 (frontend screen). See docs/COGFUNC8A.md for full specification. Updated docs/SCHEMA.md and docs/SCORING.md.

---

### RESOLVED-05 — CES-D 10 Reverse-Score Items (was OPEN-03)

**Resolved:** 2026-02-18

**Decision:** Items **5** ("I am feeling hopeful about the future") and **8** ("I am feeling happy") are the positive-affect items requiring reverse scoring. Confirmed.

**Why:** Verified against the lab's instrument form (Mood Measures.pdf, UBC H24-03749 v1.2) and the CES-D 10 scoring reference (DDSSection2.7CESD.pdf, which identifies items e and h as positive-affect). Additionally, the lab form uses a 1–4 scale (Never/Rarely/Sometimes/Often), not the standard 0–3. Raw values 1–4 are stored; scoring converts to 0–3 (`raw - 1`) before computing totals. Positive items reverse: `4 - raw`.

**Affects:** T10 (scoring module), T15 (frontend CES-D screen). See docs/CESD10.md for full specification. Updated docs/SCHEMA.md and docs/SCORING.md.

---

### RESOLVED-06 — Architecture & Deployment (was OPEN-04)

**Resolved:** 2026-02-22

**Decision:** Deploy as a standard three-tier web app:
1. **Frontend:** Next.js (TypeScript + Tailwind UI only) on Vercel
2. **Backend:** Long-lived FastAPI service on Render (no FastAPI on Vercel)
3. **Database:** Supabase Postgres (managed)

Auth is optional. If enabled, Next.js obtains a Supabase JWT and sends `Authorization: Bearer <JWT>` to FastAPI for validation. Alembic migrations run as a deploy step/one-off command, not on every startup.

**Why:** This split cleanly separates UI, API, and data layers; keeps deployment straightforward for a small lab team; and preserves server-side canonical scoring while using managed Postgres.

**Affects:** docs/ARCHITECTURE.md (canonical), docs/CONVENTIONS.md, docs/API.md, docs/devSteps.md, docs/kanban.md.

---

### RESOLVED-07 — Weather Ingestion Scheduler: GitHub Actions Only

**Resolved:** 2026-02-26

**Decision:** Daily UBC EOS weather ingestion will be scheduled via **GitHub Actions only** in Phase 2.
Supabase `pg_cron` is explicitly excluded for now.

**Why:** Keeps scheduling simple and portable, avoids database-side cron complexity, and fits free-tier
constraints while preserving idempotent ingestion behavior.

**Affects:** docs/WEATHER_INGESTION.md, docs/ARCHITECTURE.md, docs/API.md, docs/kanban.md.

---

### RESOLVED-08 — Day Linking via `study_days` Dimension

**Resolved:** 2026-02-26

**Decision:** Add a `study_days` dimension table keyed by `date_local` (America/Edmonton) and link:
- `sessions.study_day_id -> study_days.study_day_id`
- `weather_daily.study_day_id -> study_days.study_day_id`

**Why:** Maximizes relational consistency for day-level analyses and avoids fragile computed-date joins
while keeping sessions linkable even if weather ingestion is missing for a day.

**Affects:** docs/WEATHER_INGESTION.md, docs/SCHEMA.md, docs/kanban.md.

---

### RESOLVED-09 — Anonymous Participants (No Names Stored)

**Resolved:** 2026-02-26

**Decision:** Participants are anonymous. The database will not store `first_name` / `last_name` or other direct identifiers. The only human-facing identifier is `participant_number` (Participant ID); `participant_uuid` remains an internal stable key.

**Why:** Reduces PII handling burden and aligns the app with anonymity requirements while keeping relational integrity via UUID keys.

**Affects:** docs/PRD.md, docs/SCHEMA.md, docs/API.md, docs/DESIGN_SPEC.md, docs/kanban.md.

---

### RESOLVED-10 — Test Flow Order: Surveys First, Digit Span Last

**Resolved:** 2026-02-26

**Decision:** The participant task order is: 4 surveys (ULS-8 → CES-D 10 → GAD-7 → CogFunc 8a) followed by Digit Span, then completion.

**Why:** Matches the desired supervised lab workflow and enables a single one-click launch into Survey 1 without intermediate digit span instructions.

**Affects:** docs/DESIGN_SPEC.md, docs/API.md, docs/kanban.md.

---

<!-- Template for new decisions:

### OPEN-XX — [Decision Name]

**Why it matters:** [1-2 sentences on impact]

**Options considered:**
- Option A: ...
- Option B: ...

**Current default:** [What to assume until resolved]

**Blocks / affects:** [Task IDs and/or doc files]

-->
