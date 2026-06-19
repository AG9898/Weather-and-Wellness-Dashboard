# DECISIONS.md — Architectural Decisions Log

> **Open decisions:** Do not resolve without explicit instruction from the project owner.
> To resolve: move the block to the Resolved section, fill in `Resolved` and `Why`, and
> update any affected docs (SCORING.md, SCHEMA.md, etc.).
>
> **Adding a new decision:** Copy the template below and assign the next OPEN-XX number.

---

## Open Decisions

### OPEN-05 — Multi-Lab Schema Scoping

**Question:** How should the database schema isolate data between labs and studies?

**Context:** The platform is expanding from a single study (Weather & Wellness) to multiple
labs and studies. Auth already carries `app_metadata.lab` (slug) and `app_metadata.role`.
The planned model adds `labs` and `studies` tables as FKs on `participants` and `sessions`,
but the exact isolation strategy is not yet finalized.

**Options under consideration:**
1. **Row-level isolation** — single schema, `study_id` FK on all data tables, enforced at app layer via `get_current_lab_member`. Simple to implement; row-level security (RLS) in Postgres/Supabase could reinforce it.
2. **Schema-level isolation** — each lab gets its own Postgres schema (e.g. `weather_wellness.*`). Stronger isolation; more complex migrations and connection management.
3. **Separate deployments** — each lab is a fully independent deploy. Maximum isolation; highest operational overhead.

**Blocking:** First new lab requirements must be confirmed before resolving.

**See also:** `docs/MULTI_LAB.md` for the full open questions list.

---

*(OPEN-02 moved to Resolved section — see RESOLVED-04)*

---

*(OPEN-03 moved to Resolved section — see RESOLVED-05)*

---

*(OPEN-04 moved to Resolved section — see RESOLVED-06)*

---

### OPEN-02 — Misokinesia Auth & Stimulus Management Roles

**Why it matters:** Governs who can upload/replace video stimuli, manage test sets, and launch the module. Affects endpoint auth, admin UI scope, and whether non-admin RAs can configure the task.

**Options considered:**
- Admin-only for all stimulus management; RAs can only launch sessions.
- All lab members can manage stimuli within their lab scope.
- Separate stimulus-admin role.

**Current default:** Assume management endpoints are admin-only (`Depends(get_current_admin)`). Participant task endpoints follow the existing participant session-validation model (no JWT, validated by participant row existence). Stimulus seeding via one-time seed script only.

**Blocks / affects:** Future stimulus upload/management endpoints; admin export coverage for misokinesia tables; undo-last-session extension to misokinesia rows.

---

## Resolved Decisions

### RESOLVED-20 — LLM Data Access Is Backend-Mediated and Read-Only

**Resolved:** 2026-06-19

**Decision:** The planned RA data chatbot may use OpenRouter for model access,
but the model must not receive database credentials, Supabase service keys, or
direct Supabase access. The chatbot will retrieve research data only through
FastAPI-approved, read-only tools that authenticate the RA with
`get_current_lab_member`, apply lab/study scope on the server, and send bounded
tool results to the model.

**Why:** This gives RAs a useful natural-language analysis surface while
preserving the platform's existing lab isolation model and avoiding a broad DB
migration for the first version. It also keeps model privacy, provider routing,
and OpenRouter configuration as operational controls rather than schema-level
authorization mechanisms.

**Constraints chosen:**
- All authenticated `ra` and `admin` users may use the feature.
- Data access includes aggregate/statistical summaries and anonymous
  participant/session-level reads when scoped to the user's lab.
- The chatbot is read-only: no imports, exports, downloads, scoring writes,
  session starts, or arbitrary SQL.
- OpenRouter model/provider selection is env-configured. Privacy controls such
  as provider training opt-out, disabled logging, provider allowlists, and ZDR
  routing are required where available.
- The feature does not resolve OPEN-05 and must remain compatible with the
  eventual multi-lab schema isolation decision.

**Affects:** `docs/AI_CHAT.md`, `docs/ARCHITECTURE.md`,
`docs/ENV_VARS.md`, `docs/MULTI_LAB.md`,
`docs/labs/weather-wellness/weather/API.md`,
`docs/labs/weather-wellness/weather/DESIGN_SPEC.md`.

### RESOLVED-01 — Database Platform: Supabase

**Resolved:** Pre-project (before T01)

**Decision:** Supabase is the managed database platform for Phase 1. Supabase Auth is optional.

**Why:** Supabase bundles three required capabilities:
1. Managed PostgreSQL — same semantics as other hosted Postgres options; Alembic/SQLAlchemy unchanged
2. Optional Supabase Auth — when enabled, RA login uses Supabase JWTs validated by FastAPI
3. Supabase Studio — lab team reads all stored results directly via the web UI

For this project, a single managed platform with optional auth is the right tradeoff.

**Affects:** All DB and auth tasks; T02 (Supabase connection), T06/T18 (auth pattern).

---

### RESOLVED-02 — No CSV Export in Phase 1

**Resolved:** Pre-project (before T01)

**Decision:** No CSV export feature will be built in Phase 1.

**Why:** Supabase Studio provides sufficient data access for the lab team. A CSV export
endpoint and UI add scope and complexity without clear benefit at this stage. Can be
revisited in Phase 2 if lab workflows require it.

**Superseded:** Phase 3 explicitly adds RA-only export endpoints and an admin Export UI (see **RESOLVED-11**).
This decision remains true for **Phase 1** scope only.

**Affects:** Phase 1 has no export endpoint or UI tasks. Data stays in the Supabase DB; Phase 3 adds controlled admin exports.

---

### RESOLVED-11 — Admin Import/Export (CSV/XLSX) Allowed in Phase 3

**Resolved:** 2026-02-28

**Decision:** An RA-only **Import/Export** feature is allowed in Phase 3, including:
- Import of legacy study data from CSV/XLSX into Supabase via FastAPI (controlled write path).
- Export of current DB data for lab use as **XLSX** (workbook) and **CSV** (zipped, one CSV per table).

**Why:** Phase 3 requires a practical migration path from existing data (reference XLSX) and a low-friction
admin download workflow. This remains internal-only, RA-authenticated, and does not create any participant-facing
data export surface. PII rules still apply (participants are anonymous; do not introduce names/signatures).

**Affects:** Phase 3 tasks that add admin endpoints/UI and DB mapping tables. Update `AGENTS.md`, `docs/labs/weather-wellness/weather/API.md`,
`docs/SCHEMA.md`, `docs/DESIGN_SPEC.md`, and `docs/devSteps.md` before implementation.

---

### RESOLVED-12 — Study Timezone + Daylight Exposure Rule (Phase 3)

**Resolved:** 2026-02-28

**Decision:**
- The study's day-level semantics use timezone `America/Vancouver` for:
  - `study_days.date_local`
  - session → study day linking (`sessions.study_day_id`)
  - weather_daily day linking (`weather_daily.study_day_id`)
  - dashboard date-range filtering
- Participant daylight exposure (`participants.daylight_exposure_minutes`) is computed as minutes since the local "daylight start" time:
  - `daylight_exposure_minutes = max(0, minutes_between(DAYLIGHT_START_LOCAL_TIME, session_start_local_time))`
  - Default `DAYLIGHT_START_LOCAL_TIME` is `06:00` in `America/Vancouver` and must be configurable.

**Why:** Day-level analyses and UI filtering should match a single local day boundary. Daylight exposure is a derived participant attribute based on the session start time relative to a fixed local "daylight start".

**Affects:** docs/labs/weather-wellness/weather/WEATHER_INGESTION.md, docs/SCHEMA.md, docs/labs/weather-wellness/weather/API.md, docs/DESIGN_SPEC.md, backend weather/session day-linking logic, Phase 3 import/start-session implementations.

---

### RESOLVED-14 — Phase 4 Legacy Remapping Schema Pattern (T54)

**Resolved:** 2026-03-01

**Decision:** Store imported legacy aggregate values in the canonical outcome tables (`digitspan_runs`, `survey_uls8`, `survey_cesd10`, `survey_gad7`) using the following schema additions:
- `data_source VARCHAR(16) DEFAULT 'native'` — distinguishes native app submissions from imported rows.
- UNIQUE constraint on `session_id` per table — enforces the 1:1 session↔outcome row invariant at DB level.
- Raw item columns (`r1…rN`) and canonical computed scores made nullable — imported rows cannot supply raw items; native submissions are still validated via Pydantic (unchanged).
- Dedicated legacy columns (`legacy_mean_1_4`, `legacy_total_score`) — store imported aggregate values without overloading or conflicting with canonical computed fields.
- `digitspan_runs.max_span` made nullable — imported data has `total_correct` (from `digit_span_score`) but not `max_span`.

**Why:** The alternative — storing imported data only in `imported_session_measures` — would exclude it from analysis queries and exports that join canonical tables. Adding `data_source` and legacy columns preserves both native and imported rows in the same table while making the distinction explicit and queryable. The `imported_session_measures` table remains the full audit trail via `source_row_json`.

**Affects:** `docs/SCHEMA.md`, `docs/labs/weather-wellness/weather/API.md`, `backend/app/models/digitspan.py`, `backend/app/models/surveys.py`, migration `20260301_000010`.

---

### RESOLVED-13 — Start Session Requires Demographics (Phase 3)

**Resolved:** 2026-02-28

**Decision:** The RA "Start New Entry" flow requires selecting participant demographics (preset options) before creating a participant+session. Values are stored on `participants` only:
- `age_band`, `gender`, `origin`, `commute_method`, `time_outside`
- If `origin` or `commute_method` is `"Other"`, store the free-text detail in a dedicated `*_other_text` column (length-limited; UI warns against PII).

**Why:** Demographics are required for the experiment but must remain participant-anonymous. Collecting them at session start makes the workflow consistent and removes the need for separate participant-edit screens.

**Affects:** docs/DESIGN_SPEC.md, docs/labs/weather-wellness/weather/API.md (`POST /sessions/start`), docs/SCHEMA.md (`participants` columns), frontend dashboard start flow.

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

**Superseded:** RESOLVED-16 changes the current backend host from Render to Railway and the
current Supabase project to Canada Central.

**Why:** This split cleanly separates UI, API, and data layers; keeps deployment straightforward for a small lab team; and preserves server-side canonical scoring while using managed Postgres.

**Affects:** docs/ARCHITECTURE.md (canonical), docs/CONVENTIONS.md, docs/labs/weather-wellness/weather/API.md, docs/devSteps.md.

---

### RESOLVED-16 — Infrastructure Cutover Target: Railway + Canada-Region Supabase

**Resolved:** 2026-03-24

**Decision:** The infrastructure migration target is:
1. **Frontend:** Vercel
2. **Backend:** Railway (Hobby plan) instead of Render
3. **Database + Auth:** a new Supabase project in `ca-central-1`

This supersedes the **hosting target** from RESOLVED-06 while keeping Supabase as the managed
platform chosen in RESOLVED-01.

**Current status:** Completed on 2026-05-19. The live stack is Vercel frontend,
Railway FastAPI backend, and the Canada Central Supabase project.

**Why:** Railway removes the Render cold-start problem on write paths, and Supabase's Canada
Central region satisfies the current database residency requirement without introducing a second
managed platform for auth and data access. The migration is project-level for Supabase, so the
new project requires recreated auth/project settings and updated env vars across backend,
frontend, and admin tooling.

**Affects:** `docs/ARCHITECTURE.md`, `docs/PRD.md`, `AGENTS.md`, `README.md`, migration runbooks,
and any operator env-var checklists referencing Render or the old Supabase project.

---

### RESOLVED-07 — Weather Ingestion Scheduler: GitHub Actions Only

**Resolved:** 2026-02-26

**Decision:** Daily UBC EOS weather ingestion will be scheduled via **GitHub Actions only** in Phase 2.
Supabase `pg_cron` is explicitly excluded for now.

**Why:** Keeps scheduling simple and portable, avoids database-side cron complexity, and fits free-tier
constraints while preserving idempotent ingestion behavior.

**Affects:** docs/labs/weather-wellness/weather/WEATHER_INGESTION.md, docs/ARCHITECTURE.md, docs/labs/weather-wellness/weather/API.md.

---

### RESOLVED-08 — Day Linking via `study_days` Dimension

**Resolved:** 2026-02-26

**Decision:** Add a `study_days` dimension table keyed by `date_local` (`America/Vancouver`) and link:
- `sessions.study_day_id -> study_days.study_day_id`
- `weather_daily.study_day_id -> study_days.study_day_id`

**Why:** Maximizes relational consistency for day-level analyses and avoids fragile computed-date joins
while keeping sessions linkable even if weather ingestion is missing for a day.

**Affects:** docs/labs/weather-wellness/weather/WEATHER_INGESTION.md, docs/SCHEMA.md.

---

### RESOLVED-09 — Anonymous Participants (No Names Stored)

**Resolved:** 2026-02-26

**Decision:** Participants are anonymous. The database will not store `first_name` / `last_name` or other direct identifiers. The only human-facing identifier is `participant_number` (Participant ID); `participant_uuid` remains an internal stable key.

**Why:** Reduces PII handling burden and aligns the app with anonymity requirements while keeping relational integrity via UUID keys.

**Affects:** docs/PRD.md, docs/SCHEMA.md, docs/labs/weather-wellness/weather/API.md, docs/DESIGN_SPEC.md.

---

### RESOLVED-10 — Test Flow Order: Surveys First, Digit Span Last

**Resolved:** 2026-02-26

**Decision:** The participant task order is: 4 surveys (ULS-8 → CES-D 10 → GAD-7 → CogFunc 8a) followed by Digit Span, then completion.

**Superseded by:** RESOLVED-20.

**Why:** Matches the desired supervised lab workflow and enables a single one-click launch into Survey 1 without intermediate digit span instructions.

**Affects:** docs/DESIGN_SPEC.md, docs/labs/weather-wellness/weather/API.md.

---

### RESOLVED-20 — Surveys First, Randomized Cognitive Battery After Surveys

**Resolved:** 2026-06-14

**Decision:** Weather-Wellness sessions keep the four surveys first and fixed:
ULS-8 → CES-D 10 → GAD-7 → CogFunc 8a. After surveys, each participant session
receives a randomized cognitive task battery containing Backward Digit Span,
Stroop, and WCST-64-inspired card sorting. The assigned task order is stored per
session for later review and order-aware export.

Card sorting follows the 64-card, 10-consecutive-correct shift mechanics, but
the category schedule must not be a predictable recurring
`color → shape → number` repeat. The hidden per-session rule order starts with
color, includes color/shape/number twice across six possible category blocks,
does not repeat the same dimension in adjacent blocks, and is stored for audit.
The participant-facing UI never reveals rule names, rule order, streaks, or
category-count progress.

WW Trial Run now has Short Trial and Full Trial variants with a trial-only
section jumper, matching the Misokinesia rehearsal pattern. Trial mode remains
no-write.

**Why:** The lab needs Stroop and card sorting in addition to Digit Span, while
preserving survey order and recording task-order assignment for later review.
The card sorting task should preserve WCST-style category-learning mechanics
without exposing a learnable recurring rule sequence.

**Affects:** docs/labs/weather-wellness/weather/DESIGN_SPEC.md,
docs/labs/weather-wellness/weather/API.md,
docs/labs/weather-wellness/weather/SCORING.md,
docs/labs/weather-wellness/weather/DIGITSPAN.md,
docs/labs/weather-wellness/weather/STROOP.md,
docs/labs/weather-wellness/weather/CARD_SORTING.md, docs/TRIAL_MODE.md,
docs/SCHEMA.md.

---

### RESOLVED-16 — RA Undo Last Session Uses Hard Delete + Audit Log

**Resolved:** 2026-03-09

**Decision:** Add an RA-only **Undo Last Session** capability that can remove only
the most recently created **native** session, with a confirmation step and an
append-only audit record. This feature uses transactional hard deletion of the
session-domain rows plus optional participant deletion when that participant has
no other sessions. It does **not** use soft-delete semantics.

**Why:** The operational need is narrowly scoped: remove accidental supervised
test runs or obvious bad entries without introducing broad edit/delete tooling.
Soft delete would require every dashboard query, export, import conflict check,
and analytics dataset query to learn a new "deleted" filter, creating a large
correctness surface for little benefit.

**Constraints chosen:**
- RA-only
- latest native session only
- not available for imported legacy sessions
- weather tables are never touched
- deletion is transactional and audit-logged

**Affects:** docs/labs/weather-wellness/weather/API.md, docs/SCHEMA.md, docs/DESIGN_SPEC.md,
docs/ARCHITECTURE.md.

---

### RESOLVED-15 — Invite-Only Auth + Role/Lab Scoping via Supabase `app_metadata`

**Resolved:** 2026-03-07

**Decision:** Auth hardening will be implemented entirely within the existing
Supabase Auth stack using three mechanisms:

1. **Invite-only access:** Public sign-ups are disabled in the Supabase Auth
dashboard (`Authentication > Providers > Email > Disable "Allow new users to
sign up"`). Only users explicitly invited by an admin can authenticate.

2. **Role-based permissions via `app_metadata`:** Each RA user is assigned a
role stored in Supabase's `app_metadata` field (admin-only writable; cannot be
modified by users). Role is embedded in the JWT and validated by FastAPI:
   - `admin`: Full access to dashboard, Import/Export, and admin endpoints.
   - `ra`: Dashboard access only; Import/Export and admin endpoints return 403.

3. **Lab scoping via `app_metadata`:** Each RA user is assigned a `lab_name`
value stored alongside role in `app_metadata`. One RA belongs to exactly one
lab. Lab name gates page-level access: certain pages are visible only to users
whose `lab_name` matches. Admins bypass all lab restrictions. The system is
designed to support about five labs; specific lab names are set at invite time.

**Implementation pattern:**
- `app_metadata` is set only via the Supabase admin API (service role key),
never exposed to the frontend.
- FastAPI `LabMember` gains `role: str` and `lab_name: str`, extracted from JWT
claims.
- New FastAPI dependency `get_current_admin` enforces `role == 'admin'`; it
replaces `get_current_lab_member` on admin-only routes.
- A `backend/scripts/invite_user.py` CLI script handles user invitations with
role and `lab_name` assignment.
- Frontend reads `app_metadata` from the Supabase session to gate UI links and
page access.

**Why not alternatives:**
- Auth0/Clerk: overkill for a small internal lab tool and adds cost.
- Google OAuth domain restriction: viable only if the lab standardizes on
Google Workspace and adds OAuth complexity.
- Custom users/roles table: redundant because Supabase Auth already manages
secure user metadata.

**Affects:** `backend/app/auth.py`, `backend/app/routers/admin.py`,
`backend/scripts/invite_user.py`, `frontend/src/lib/components/RANavBar.tsx`,
`frontend/src/app/(ra)/layout.tsx`, `docs/ARCHITECTURE.md`.

---

### RESOLVED-19 — App-Owned Admin Invites on Supabase Auth

**Resolved:** 2026-05-12

**Decision:** Keep Supabase Auth as the authentication/session/JWT provider, but
replace Supabase's built-in invite email flow as the primary onboarding
mechanism with an app-owned invitation layer and admin-only user management UI.

The app stores durable invitation state in its own Postgres table and sends
custom invite emails. Invite links expire after **7 days**. Accepting an invite
creates or updates the Supabase Auth user through the service-role Admin API,
sets `app_metadata.role` and `app_metadata.lab_name`, and then lets the user
sign in through the existing Supabase Auth session flow.

**Admin user management scope:**
- Admins can list users and invitations from a front-facing admin page.
- Admins can create, edit role/lab metadata, resend invites, revoke invites,
  and revoke user access.
- "Delete" in the UI means access revocation/disablement by default, not a hard
  deletion of `auth.users`. Hard deletion remains an explicit maintenance action
  only when needed.
- Existing scripts remain useful for batch or CLI workflows, but should share
  the same backend/service behavior instead of depending on Supabase's built-in
  one-hour invite email links.

**Email provider:** Use Resend as the default transactional email provider for
custom invite emails. Keep the email sending layer provider-abstracted so the
project can switch to AWS SES later if data residency or institutional policy
requires it.

**Why:** Supabase's default Auth mailer is rate-limited and short-lived for this
use case. The current project had invite failures due to one-hour link expiry
and Supabase email limits. Owning invitation state gives admins durable,
auditable control over onboarding while keeping the existing Supabase Auth
tables, JWT validation, and role/lab claims.

**Affects:** `docs/ARCHITECTURE.md`, `docs/SCHEMA.md`,
`docs/ENV_VARS.md`, `docs/labs/weather-wellness/weather/API.md`,
`docs/labs/weather-wellness/weather/DESIGN_SPEC.md`, `backend/admin_cli/invite_user.py`,
`backend/app/auth.py`, admin routers/services, frontend RA navigation, and the
set-password route.

---

### RESOLVED-17 — Monorepo vs. Split Repositories (was OPEN-01)

**Resolved:** Pre-project (before T01)

**Decision:** Monorepo layout with `frontend/` and `backend/` subdirectories. All path references use these prefixes.

**Why:** Simpler for a small lab team — shared kanban, single PR for full-stack changes, no overhead of split deployment pipelines.

**Affects:** All tasks with path references. Routing conventions in ARCHITECTURE.md and CONVENTIONS.md.

---

### RESOLVED-18 — Misokinesia Module Core Architecture

**Resolved:** 2026-03-17

**Decision:** The Misokinesia video task module uses the following settled defaults:
- **29 video clips**, ~15 seconds each, with a stable canonical `sort_order` in storage metadata but a randomized playback order per participant session.
- **Fully anonymous participants** — no demographics collected. Independent `misokinesia_participant_number` SERIAL sequence (separate from `participants.participant_number`), starting from 1.
- **Video hosting:** Supabase Storage, public bucket (`misokinesia-stimuli`), raw CDN URLs — no signing, no expiry.
- **Table naming:** `misokinesia_participants` (not `misokinesia_runs`).
- **Per-clip questionnaire:** 4 questions (q1–q4, scale 1–5) submitted after each clip. End-of-task questionnaire (3 items stored on `misokinesia_participants`) collected once after all 29 per-clip submissions.
- **Session flow:** RA navigates to `/misokinesia` via dock → clicks "Start Misokinesia Session" → backend atomically creates anonymous participant + session + misokinesia_participants row → app navigates to `/misokinesia/[id]` participant task page (same device, no external URL handoff).
- **Response submission:** Per-trial, one POST per clip. `completed_at` set server-side automatically on final response. No client-side complete endpoint.

**Why:** Keeps video delivery on Supabase CDN (avoiding backend startup or bandwidth bottlenecks on media paths), uses existing participant/session model, and matches the existing per-instrument column schema style.

**Affects:** `docs/labs/weather-wellness/misokinesia/MISOKINESIA.md`, `docs/SCHEMA.md`, `docs/labs/weather-wellness/misokinesia/API.md`, `docs/ARCHITECTURE.md`.

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
