# Working Misokinesia Add

> Working planning snapshot for a future misokinesia module. This document records the
> current direction and draft defaults so the feature can be resumed later without
> re-deciding the basics.
>
> Status: planning only. Auth and role behavior specific to this module are intentionally
> deferred for a later pass.

---

## Purpose

Add a participant-facing misokinesia task to the existing web app where a participant:

1. watches a short sequence of videos (roughly 5 to 10 clips, each about 5 to 8 seconds)
2. answers short survey-style questions after each clip
3. stores all results under the existing participant/session model

This is a working spec, not an implementation-ready contract. It captures:

- decisions already made
- draft architecture and data model defaults
- open questions to revisit later

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

## Draft Participant Flow

The intended participant flow is currently:

1. participant reaches the misokinesia module in the existing session flow
2. frontend requests a run or manifest from the backend
3. backend validates the session and returns:
   - assigned clip order
   - clip metadata
   - storage URLs or signed URLs
   - questionnaire metadata if needed
4. frontend plays one clip at a time
5. frontend collects survey-style responses after each clip
6. frontend submits each trial response or a controlled batch to the backend
7. backend stores all rows under the current session and participant
8. frontend marks the misokinesia run complete and continues to the next step

Working default:

- prefer a dedicated task page/module with internal state rather than many route transitions
  between clips
- prefer one manifest fetch for the full clip sequence rather than a fetch per clip

---

## Draft Data Model

These table names and shapes are draft defaults only. They should be finalized when the
feature moves into implementation.

### `misokinesia_test_sets`

Purpose:

- represent a reusable configured stimulus set or study version

Likely fields:

- `test_set_id`
- `name`
- `version`
- `description`
- `active`
- `created_at`

### `misokinesia_stimuli`

Purpose:

- represent each clip and its storage metadata

Likely fields:

- `stimulus_id`
- `test_set_id`
- `storage_path`
- `duration_ms`
- `mime_type`
- `checksum`
- `sort_order`
- optional condition/tag fields
- `active`
- `created_at`

Storage note:

- store only metadata and object location here
- do not store the binary video in the DB

### `misokinesia_runs`

Purpose:

- represent one session-scoped execution of the task

Likely fields:

- `run_id`
- `session_id`
- `participant_uuid`
- `test_set_id`
- `started_at`
- `completed_at`
- optional randomized ordering seed or stored assignment metadata
- `created_at`

### `misokinesia_trial_responses`

Purpose:

- store one response row per shown stimulus

Likely fields:

- `response_id`
- `run_id`
- `session_id`
- `participant_uuid`
- `stimulus_id`
- `display_order`
- watched/completed flags
- response latency or timing metadata as needed
- response data
- `created_at`

Questionnaire storage default:

- if the post-video questionnaire is stable and known, use explicit response columns
- if the questionnaire is likely to change often, use a versioned JSON response shape instead

Current working default:

- prefer explicit fixed columns if the instrument is stable, because that matches the rest of
  the project's schema style and keeps validation clearer

---

## Draft API Surface

These endpoint shapes are candidates only. Final contracts should be documented in `docs/API.md`
when implementation begins.

### RA/Admin-Oriented Endpoints

Potential responsibilities:

- upload/manage stimuli
- manage test sets
- inspect available clips and metadata

These are intentionally left high-level for now because feature-specific auth and media
management roles are not finalized.

### Participant Endpoints

Current candidate flow:

- run start / manifest endpoint
- trial response submission endpoint
- run completion endpoint

The backend should validate that:

- the session exists
- the session is in the expected participant-ready state
- submitted `stimulus_id` values belong to the assigned run
- duplicate or tampered submissions are rejected cleanly

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

If clips are not sensitive:

- public CDN-style access is the simplest and fastest option

If clips are not meant to be public:

- return short-lived signed URLs from the backend
- still return them in one manifest response instead of one URL request per clip

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

These are not resolved yet and should remain open.

- Final auth and role rules for stimulus upload, management, and launch.
- Whether stimuli are public assets or private signed assets.
- Whether the post-video questionnaire is fixed or configurable.
- Whether responses are submitted one trial at a time or in small batches.
- Whether playback telemetry beyond completion/latency is needed.
- Whether this module appears once in the session flow or becomes a versioned reusable study
  instrument with multiple variants.
- How admin export surfaces should include the new misokinesia tables.
- How undo-last-session should clean up misokinesia rows once the feature exists.

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

## Resume Checklist

When planning resumes, the next pass should answer these in order:

1. finalize misokinesia-specific auth and role behavior
2. finalize whether stimuli are public or signed/private
3. finalize the post-video questionnaire shape
4. finalize table schema and API contracts
5. plan frontend flow placement and export/undo implications
