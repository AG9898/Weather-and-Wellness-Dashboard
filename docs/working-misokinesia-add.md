# Working Misokinesia Add

> Working planning snapshot for the misokinesia module. This document records the
> current direction and draft defaults so the feature can be resumed later without
> re-deciding the basics.
>
> Status: implementation-ready. Key decisions resolved March 2026 (see Resolved Decisions
> section below). Auth and role edge cases are intentionally deferred for a later pass.

---

## Resolved Decisions

These items were open during initial planning and are now resolved (March 2026):

| Decision | Resolution |
|---|---|
| Number of clips | ~29 videos, ~15 seconds each, longest 33 seconds |
| Clip order | All 29 shown to every participant in a fixed sort_order sequence |
| Post-clip questionnaire | Same fixed question set after every clip (explicit columns in trial_responses) |
| Participant type | Fully anonymous — no demographics collected |
| Participant numbering | Independent SERIAL (`misokinesia_participant_number`) in `misokinesia_participants`; starts from 1, independent of main study participant_number |
| Session flow | RA navigates to dedicated /misokinesia page via dock → clicks "Start Misokinesia Session" → backend creates anonymous participant + session → app navigates to participant task page (same device, no external URL or handoff) |
| Video implementation | Blank placeholder component during development; replaced by real mp4 files when available |
| Video hosting | Supabase Storage, **public bucket** (`misokinesia-stimuli`), raw CDN URLs — no signing, no expiry |
| Table naming | `misokinesia_participants` (not `misokinesia_runs`) for per-session execution data |
| Response submission | Per-trial: submit after each clip's questionnaire, before next clip loads |
| Undo | Deferred — undo-last-session extension to misokinesia rows is a later pass |

---

## Purpose

Add a participant-facing misokinesia task to the existing web app where a participant:

1. watches all ~29 short video clips (each ~15 seconds, fixed order) embedded in the webapp
2. answers a fixed set of survey-style questions after each clip
3. stores all results under the existing participant/session model (anonymous, no demographics)

---

## Current Decisions

These are the current working decisions and should be treated as the default direction unless
explicitly changed later.

- Keep the feature inside the current stack: Next.js frontend, FastAPI backend, Supabase Postgres.
- Do not use PsychoPy as the primary runtime for this module.
- Follow the existing participant/session model: all stored rows must link to both
  `participant_uuid` and `session_id`.
- Follow the existing architecture rule of client playback with server-owned assignment,
  validation, and persistence.
- Do not store video binaries in Postgres.
- Do not store video files in the repo or on the Render filesystem.
- Do not proxy video bytes through FastAPI on Render.
- Use one task-start or manifest request, then fetch video files directly from storage/CDN.
- Avoid one backend round-trip per clip.
- Preload the next clip while the participant is answering the current clip's questions.
- Keep frontend API access behind typed wrappers; do not introduce direct component-level `fetch`
  calls as the main integration path.

---

## Recommended Architecture

### Overall Shape

The misokinesia module should behave like a new participant task domain rather than a special
case inside the existing survey tables.

- Frontend owns playback and participant interaction flow.
- Backend owns:
  - run creation or assignment
  - clip manifest delivery
  - response validation
  - persistence of all trial results
- Storage/CDN serves the actual video files directly to the browser.

This keeps the control plane separate from the media-delivery plane.

### Why This Shape

The current app already suffers from noticeable cold-start cost when a request needs a live
Render backend read. The correct mitigation for this feature is not to move away from the
current stack entirely, but to ensure that Render is used for small control requests rather
than for streaming the stimulus files themselves.

This means:

- Render cold start may affect the initial manifest request.
- Render cold start should not affect each individual video fetch.
- Video delivery speed should depend mostly on storage/CDN behavior, not backend wake-up time.

### Storage Direction

Current default recommendation:

- store videos in object storage, not in the database
- use Supabase Storage as the first-choice default because it fits the existing platform
- fetch video assets directly from storage/CDN URLs

If later study/security requirements allow public read access for stimuli, public CDN-style
delivery will be simpler and faster. If stimuli must remain non-public, return short-lived
signed URLs in the manifest response.

---

## Participant Flow

1. RA navigates to `/misokinesia` (dedicated RA page, accessible from the floating dock on all RA pages)
2. RA clicks "Start Misokinesia Session" — backend atomically creates anonymous participant +
   session + misokinesia_participants row, returns manifest
3. App navigates to `/misokinesia/{misokinesia_participant_id}` (participant task page, outside
   RA auth group — no login required, same device)
4. Participant sees intro screen, clicks to begin
5. For each of 29 clips (fixed order):
   a. Video clip plays (placeholder during development; real mp4 when available)
   b. Per-clip questionnaire shown after clip (4 questions, 1–5 scale — see Per-clip questionnaire below)
   c. Frontend submits `POST /misokinesia/participants/{id}/responses` — response includes
      `is_complete: true` on the 29th submission, at which point backend auto-sets
      `misokinesia_participants.completed_at`
6. After the 29th per-clip questionnaire is submitted, the frontend transitions to the
   **end-of-task questionnaire** state (NOT directly to complete) — see End-of-task questionnaire below
7. Participant completes the end-of-task form; frontend submits
   `PATCH /misokinesia/participants/{id}/end-of-task`
8. After successful end-of-task submission, frontend calls existing
   `PATCH /sessions/{session_id}/status` with status='complete' (same pattern as digitspan)
9. Completion screen shown — RA clicks "Return to Dashboard"

Working defaults:
- single-page state machine for the task (no URL transitions between clips)
- one manifest fetch on task page load (all 29 clip URLs in one response)

---

## Per-clip Questionnaire

4 questions shown after every clip (same question set each time). All items are integer 1–5
(1 = Strongly Disagree, 5 = Strongly Agree):

| Column | Question |
|--------|----------|
| q1 | I find this video unpleasant |
| q2 | I felt physical discomfort during the video |
| q3 | I felt upset during the video |
| q4 | I wanted to stop the video early / or close my eyes |

Submitted via `POST /misokinesia/participants/{id}/responses` (no auth — participant-facing).

---

## End-of-task Questionnaire

**Added post-T103 planning (confirmed in T104).** The original kanban tasks T105–T114 were
written before this was resolved and do not mention it. All agents working on T105–T114 must
account for this.

Three questions shown **once** after all 29 per-clip questionnaires are complete, before the
completion screen. Stored on `misokinesia_participants` (4 nullable columns added in T104
migration).

| Column | Type | Question / Notes |
|--------|------|-----------------|
| `end_fidgeting_text` | TEXT | "Please list any fidgeting stimuli that you are bothered by that did not show up in the task" (free text) |
| `end_emotions_text` | TEXT | "Please list any emotional responses that you felt during the videos that were not asked in the questionnaire" (free text) |
| `stronger_responses` | BOOLEAN | "Did viewing the videos create stronger responses over time?" — No (false) / Yes (true) |
| `stronger_responses_timing` | VARCHAR | If `stronger_responses` is true: one of "Immediately", "After 5 seconds", "After 10 seconds", "At the end of the video"; otherwise null |

### New backend endpoint required (T107)

`PATCH /misokinesia/participants/{participant_id}/end-of-task` — participant-facing, no auth.
Validates that `misokinesia_participants.completed_at` is set (i.e. all 29 per-clip responses
have been submitted) before accepting the end-of-task payload. On success, writes the 4 fields
to the `misokinesia_participants` row and returns HTTP 200 with the updated participant record.
If `completed_at` is null (clips not yet finished), return HTTP 409.

### New Pydantic schemas required (T105)

- `MisokinesiaEndOfTaskCreate`: `end_fidgeting_text: str | None`, `end_emotions_text: str | None`,
  `stronger_responses: bool | None`, `stronger_responses_timing: str | None` with validation
  that `stronger_responses_timing` is only set when `stronger_responses` is `True`.
- `MisokinesiaEndOfTaskResponse`: the updated `misokinesia_participant_id`, plus the 4
  end-of-task fields, returned after successful PATCH.

### New frontend API wrapper required (T109)

`submitMisokinesiaEndOfTask(participantId: string, payload: MisokinesiaEndOfTaskPayload) → Promise<MisokinesiaEndOfTaskResult>`

Types needed:
- `MisokinesiaEndOfTaskPayload`: `{ end_fidgeting_text?: string, end_emotions_text?: string, stronger_responses?: boolean, stronger_responses_timing?: string }`
- `MisokinesiaEndOfTaskResult`: `{ misokinesia_participant_id: string }` (minimal — enough for the frontend to proceed)

### New frontend component required (T111 or separate)

`MisokinesiaEndOfTaskForm` component (can be a separate file or part of the task page). Renders:
1. A free-text input for `end_fidgeting_text`
2. A free-text input for `end_emotions_text`
3. A binary Yes/No for `stronger_responses`
4. If Yes: a radio group for `stronger_responses_timing` with the 4 options above

All fields are optional (the questionnaire PDF shows them as open-ended, not required). Submit
calls `submitMisokinesiaEndOfTask()`.

### Updated state machine (T112)

The complete state sequence is:

```
intro → playing → questionnaire → (loop × 29) → end_of_task → complete
```

- After the 29th `questionnaire` onComplete (when `is_complete: true` is returned from the
  per-clip response endpoint), transition to `end_of_task` — NOT directly to `complete`.
- In `end_of_task`: render `MisokinesiaEndOfTaskForm`; on form submit call
  `submitMisokinesiaEndOfTask()`, then transition to `complete`.
- In `complete`: call `patchSessionStatus(sessionId, 'complete')`, then show the thank-you screen.

### Backend tests required (T108)

Add test cases for:
- `PATCH /end-of-task` returns 200 with valid payload when `completed_at` is set
- `PATCH /end-of-task` returns 409 when `completed_at` is null (clips not yet done)
- `stronger_responses_timing` present when `stronger_responses` is false is rejected with 422

### Frontend tests required (T114)

Add test cases for:
- `MisokinesiaEndOfTaskForm` renders all 3 question groups
- `stronger_responses_timing` options appear only when `stronger_responses` is Yes
- Submitting the form calls `submitMisokinesiaEndOfTask()` with correct payload
- Task page transitions to `end_of_task` state after the 29th per-clip questionnaire
- Task page transitions from `end_of_task` to `complete` after end-of-task form submission

---

## Data Model

Four new tables. No changes to the existing `sessions` or `participants` tables beyond creating
anonymous rows in them via a new lightweight endpoint.

### `misokinesia_test_sets`

Purpose: reusable configured stimulus set / study version.

Fields: `test_set_id` (UUID PK), `name`, `version`, `description`, `active`, `created_at`.

### `misokinesia_stimuli`

Purpose: metadata for each video clip. No video bytes stored in the DB.

Fields: `stimulus_id` (UUID PK), `test_set_id` (FK), `storage_path` (Supabase Storage object
key in public bucket `misokinesia-stimuli`), `filename`, `duration_ms`, `mime_type`, `sort_order`
(1-based fixed playback order), `active`, `created_at`.

### `misokinesia_participants`

Purpose: one row per participant's task execution. Named `misokinesia_participants` (not `runs`)
for consistency with the per-participant focus of the module.

Fields: `misokinesia_participant_id` (UUID PK), `session_id` (FK→sessions), `participant_uuid`
(FK→participants), `test_set_id` (FK), `misokinesia_participant_number` (SERIAL — independent
auto-increment starting from 1, participant-facing identifier for this module), `started_at`,
`completed_at` (nullable), `created_at`.

### `misokinesia_trial_responses`

Purpose: one row per clip per participant.

Fields: `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK),
`participant_uuid` (FK), `stimulus_id` (FK), `display_order` (1-based), explicit fixed
questionnaire columns `q1`…`qN` (integer; exact column count and valid ranges determined from
`reference/Misokinesia Questionnaire.pdf` before the migration is written — confirm with
researcher before finalising), `completed_at` (nullable), `created_at`.

UNIQUE constraint on `(misokinesia_participant_id, stimulus_id)` prevents duplicate submissions.

Questionnaire storage: explicit fixed columns matching the rest of the project's schema style.
Column names and integer ranges must be confirmed from the questionnaire instrument before the
migration is written (see T104).

---

## API Surface

Router prefix: `/misokinesia`. Implemented in `backend/app/routers/misokinesia.py`.
Final contracts documented in `docs/API.md` when implementation is complete.

### Endpoints

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| `POST` | `/misokinesia/start` | `Depends(get_current_lab_member)` | 201 | RA-triggered. Creates anonymous participant + session + misokinesia_participants row atomically. Returns manifest with misokinesia_participant_id, misokinesia_participant_number, and all clip public URLs in sort_order. |
| `POST` | `/misokinesia/participants/{participant_id}/responses` | none (participant-facing) | 201 | Submit one trial's questionnaire answers. Validates participant row exists, stimulus belongs to the assigned test_set, no duplicate for this participant+stimulus pair. |
| `PATCH` | `/sessions/{session_id}/status` | none (existing endpoint) | 200 | **Reuse existing endpoint** to mark session complete after the final response is submitted — same pattern as digitspan. No new endpoint needed. |

`misokinesia_participants.completed_at` is set server-side when the backend detects all stimuli
in the test_set have a response row for this participant (backend computes this on each
`POST /responses` call and auto-sets `completed_at` on the final submission).
This removes the need for a separate complete endpoint entirely.

Backend validation rules for `POST /responses`:
- misokinesia_participants row exists
- stimulus_id belongs to the test_set assigned to that participant
- no duplicate (participant_id + stimulus_id) — return 409, not 500
- qN values within valid integer ranges

### Why No Separate Complete Endpoint

Digitspan does not have its own complete endpoint — the frontend calls the existing
`PATCH /sessions/{session_id}/status` after submitting the run. Misokinesia follows the same
pattern. Keeping `misokinesia_participants.completed_at` management server-side (auto-set on
final response) means the frontend only ever calls two endpoint types: `POST /start` and
`POST /responses` (×29), then the already-existing session status endpoint.

### Admin/RA Stimulus Management

Intentionally deferred. Stimuli are seeded via a seed script (see T115). Full upload/management
endpoints are a later pass once auth roles are finalized.

---

## Performance Notes

This section captures the current performance decisions because they are a major driver of the
design.

### Current Problem

- Live backend reads on Render can be slow on cold start.
- That makes repeated control-plane requests undesirable during a participant task.

### Current Conclusion

The right optimization is to keep Render off the critical media path.

Working rules:

- never stream the clip bytes through FastAPI
- use FastAPI for small manifest and write requests
- fetch media directly from storage/CDN
- issue all clip URLs up front in one manifest response when possible
- preload the next clip in the browser during questionnaire time

### Public vs. Signed Access

**Resolved:** public bucket. Clips are stored in the public `misokinesia-stimuli` Supabase
Storage bucket. URLs are raw CDN URLs with no signing and no expiry — fastest possible delivery.

---

## Auth / Role Placeholders

This section is intentionally incomplete.

Existing project auth now supports invite-only access and role/lab scoping, but the specific
misokinesia feature rules are still pending a future pass.

Questions deferred to later:

- who can upload or replace video stimuli
- whether all admins can manage all test sets
- whether non-admin RAs can launch or configure the module
- whether stimulus management should be admin-only
- whether participant media access should be public-read, signed-read, or mediated by another
  task token pattern

Current working default until revisited:

- assume management endpoints are privileged
- assume participant task endpoints follow the existing participant session-validation model

---

## Later Decisions To Revisit

These remain open and should not be assumed without a deliberate decision:

- Final auth and role rules for stimulus upload, management, and launch (who can seed/replace clips).
- Whether playback telemetry beyond completion flags is needed (e.g. did the participant skip or replay).
- Whether this module eventually becomes a versioned reusable study instrument with multiple variants.
- How admin export/data-download surfaces should include the new misokinesia tables.
- How undo-last-session should clean up misokinesia rows (currently deferred — not in scope for initial implementation).

---

## Relevant Existing Project References

Use these docs as the baseline when this work resumes:

- `docs/ARCHITECTURE.md`
  - current deployment model
  - current cache/read topology
  - Render cold-start context
- `docs/SCHEMA.md`
  - participant/session linkage rules
  - existing table conventions
- `docs/API.md`
  - current endpoint contract style
- `docs/CONVENTIONS.md`
  - backend/frontend implementation rules
- `docs/DECISIONS.md`
  - current auth, architecture, and schema decisions
- `AGENTS.md`
  - project guardrails, especially session linkage, auth adapter expectations, and storage rules

---

## Implementation Checklist

Before writing the DB migration (T104):

1. Read `reference/Misokinesia Questionnaire.pdf` to determine exact question count and response scales
2. Confirm the q1…qN column names and integer ranges with the researcher
3. Then write the migration

Remaining open items for later passes:

- finalize auth rules for stimulus management endpoints
- decide on playback telemetry requirements
- plan undo-last-session extension to cover misokinesia rows
- plan admin data export for misokinesia tables
