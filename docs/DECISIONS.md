# DECISIONS.md — Active Decision Register

> **Open decisions:** Do not resolve without explicit instruction from the project owner.
> To resolve: move the open block into the resolved index below, record the date,
> add or update canonical docs, and move the full historical body to
> `docs/decisions/ARCHIVE.md`.
>
> **Resolved history:** Full resolved decision bodies live in
> `docs/decisions/ARCHIVE.md`. This file keeps only active open decisions and a
> compact routing index for decisions agents still need to know about.
>
> **Adding a new decision:** Copy the template below and assign the next unused
> OPEN-XX number from this active register, not from archived historical IDs.

---

## Open Decisions

### OPEN-05 — Multi-Lab Schema Scoping

**Question:** How should the database schema isolate data between labs and studies?

**Current default:** Treat row-level isolation as the working model until the
project owner resolves this. Every data-writing endpoint must still resolve lab
scope from auth and reject cross-lab writes.

**Options under consideration:**

1. **Row-level isolation** — single schema, `study_id` FK on all data tables,
   enforced at the app layer via `get_current_lab_member`; RLS could reinforce it.
2. **Schema-level isolation** — each lab gets its own Postgres schema, with
   stronger isolation and more migration/connection complexity.
3. **Separate deployments** — maximum isolation with the highest operational overhead.

**Blocking:** First new lab requirements must be confirmed before resolving.

**Canonical docs:** `docs/MULTI_LAB.md`, `docs/SCHEMA.md`, component schema docs
under `docs/labs/<lab>/<component>/SCHEMA.md`.

---

### OPEN-02 — Misokinesia Auth & Stimulus Management Roles

**Question:** Who can upload/replace video stimuli, manage test sets, and launch
Misokinesia sessions?

**Current default:** Management endpoints are admin-only
(`Depends(get_current_admin)`); RAs can launch sessions. Participant task
endpoints use participant/session validation without JWT. Stimulus seeding is a
one-time seed-script path only.

**Options under consideration:**

1. Admin-only stimulus management; RAs can only launch sessions.
2. All lab members can manage stimuli within their lab scope.
3. A separate stimulus-admin role.

**Blocks / affects:** Future stimulus upload/management endpoints, admin export
coverage for Misokinesia tables, and any undo-last-session extension to
Misokinesia rows.

**Canonical docs:** `docs/labs/weather-wellness/misokinesia/API.md`,
`docs/labs/weather-wellness/misokinesia/MISOKINESIA.md`,
`docs/labs/weather-wellness/misokinesia/SCHEMA.md`.

---

## Current Resolved Decisions

These are the resolved decisions agents are most likely to need while changing
current behavior. Full historical bodies are archived in
`docs/decisions/ARCHIVE.md`.

| ID | Title | Current rule | Canonical docs |
| --- | --- | --- | --- |
| RESOLVED-20 | LLM data access is backend-mediated and read-only | RA chatbot data access goes only through authenticated FastAPI tools; no direct DB credentials, arbitrary SQL, or writes. | `docs/AI_CHAT.md`, `docs/ARCHITECTURE.md`, `docs/SCHEMA.md` |
| RESOLVED-21 | RA chatbot relaxed-privacy fallback | Optional fallback model is allowed only for availability failures; primary path stays ZDR/training opt-out. | `docs/AI_CHAT.md`, `docs/ENV_VARS.md` |
| RESOLVED-15 | Invite-only auth and role/lab scoping | Supabase Auth JWTs carry admin/RA role and lab scope in app metadata; FastAPI enforces role dependencies. | `docs/ARCHITECTURE.md`, `docs/labs/weather-wellness/weather/API.md` |
| RESOLVED-19 | App-owned admin invites | Admin invite state lives in app tables; custom invite emails replace Supabase built-in invite mail as the normal onboarding path. | `docs/ARCHITECTURE.md`, `docs/ENV_VARS.md`, `docs/SCHEMA.md` |
| RESOLVED-16 | Railway + Canada-region Supabase | Current production target is Vercel frontend, Railway backend, and Canada Central Supabase. | `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/ENV_VARS.md` |
| RESOLVED-20 (WW flow) | Surveys first, randomized cognitive battery after surveys | Weather-Wellness keeps fixed surveys first, then randomized Digit Span/Stroop/card sorting with stored order. | `docs/labs/weather-wellness/weather/DESIGN_SPEC.md`, `docs/labs/weather-wellness/weather/API.md`, `docs/labs/weather-wellness/weather/SCHEMA.md` |
| RESOLVED-18 | Misokinesia core architecture | Misokinesia uses Supabase-hosted video stimuli, anonymous task participants, per-clip responses, and same-device RA launch. | `docs/labs/weather-wellness/misokinesia/MISOKINESIA.md`, `docs/labs/weather-wellness/misokinesia/API.md`, `docs/labs/weather-wellness/misokinesia/SCHEMA.md` |
| RESOLVED-12 | Study timezone and daylight exposure | Day-level semantics use `America/Vancouver`; participant daylight exposure is computed at session start. | `docs/SCHEMA.md`, `docs/labs/weather-wellness/weather/WEATHER_INGESTION.md`, `docs/labs/weather-wellness/weather/API.md` |
| RESOLVED-09 | Anonymous participants | Do not store names or direct identifiers; use `participant_uuid` internally and `participant_number` as the human-facing ID. | `docs/PRD.md`, `docs/SCHEMA.md`, component API docs |

---

## Archived Resolved Decisions

Use the archive for historical why/how details. Prefer the canonical docs in the
current index when implementing behavior.

| ID | Title | Resolved | Canonical / archive route |
| --- | --- | --- | --- |
| RESOLVED-01 | Database Platform: Supabase | Pre-project | `docs/decisions/ARCHIVE.md`, `docs/ARCHITECTURE.md` |
| RESOLVED-02 | No CSV Export in Phase 1 | Pre-project | Superseded by RESOLVED-11; see `docs/decisions/ARCHIVE.md` |
| RESOLVED-03 | Server-side Scoring, Client-side Timing | Pre-project | `AGENTS.md`, component scoring docs |
| RESOLVED-04 | CogFunc 8a Exact Likert Range | 2026-02-18 | `docs/labs/weather-wellness/weather/COGFUNC8A.md` |
| RESOLVED-05 | CES-D 10 Reverse-Score Items | 2026-02-18 | `docs/labs/weather-wellness/weather/CESD10.md` |
| RESOLVED-06 | Architecture & Deployment | 2026-02-22 | Superseded by Railway decision; see `docs/decisions/ARCHIVE.md` |
| RESOLVED-07 | Weather Ingestion Scheduler | 2026-02-26 | `docs/labs/weather-wellness/weather/WEATHER_INGESTION.md` |
| RESOLVED-08 | Day Linking via `study_days` | 2026-02-26 | `docs/SCHEMA.md`, `docs/labs/weather-wellness/weather/SCHEMA.md` |
| RESOLVED-10 | Test Flow Order | 2026-02-26 | Superseded by randomized cognitive battery decision |
| RESOLVED-11 | Admin Import/Export Allowed | 2026-02-28 | `docs/labs/weather-wellness/weather/API.md`, `docs/devSteps.md` |
| RESOLVED-13 | Start Session Requires Demographics | 2026-02-28 | `docs/SCHEMA.md`, `docs/labs/weather-wellness/weather/API.md` |
| RESOLVED-14 | Legacy Remapping Schema Pattern | 2026-03-01 | `docs/labs/weather-wellness/weather/SCHEMA.md`, `docs/labs/weather-wellness/weather/API.md` |
| RESOLVED-16 (undo) | RA Undo Last Session | 2026-03-09 | `docs/SCHEMA.md`, `docs/labs/weather-wellness/weather/API.md` |
| RESOLVED-17 | Monorepo vs. Split Repositories | Pre-project | `docs/decisions/ARCHIVE.md` |

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
