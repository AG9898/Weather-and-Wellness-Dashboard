# MISOKINESIA.md — Misokinesia Video Task

> Canonical spec for the Misokinesia module. For endpoint contracts see `docs/API.md`. For schema see `docs/SCHEMA.md`. For auth/stimulus management decisions see `docs/DECISIONS.md` (OPEN-02).

---

## Purpose

The Misokinesia module presents a participant with 29 short video clips (each approximately 15 seconds, longest 33 seconds) in a randomized per-session order. After each clip the participant answers a 4-question per-clip questionnaire. After all 29 clips are complete, the participant answers a 3-item end-of-task questionnaire. All results are stored anonymously — no demographics are collected — linked to a dedicated `misokinesia_participants` row that references a standard `participants` UUID and `session_id`.

---

## Participant Flow

1. RA navigates to `/misokinesia` via the floating dock and clicks "Start Misokinesia Session".
2. Backend atomically creates an anonymous `participants` row, an `active` session, and a `misokinesia_participants` row, then returns the full clip manifest (all 29 URLs).
3. App navigates to `/misokinesia/[misokinesia_participant_id]` on the same device (no login required).
4. Participant sees intro screen and clicks to begin.
5. For each of 29 clips (session-randomized playback order):
   - Video clip plays.
   - Per-clip questionnaire (4 questions) is shown after the clip.
   - Frontend submits `POST /misokinesia/participants/{id}/responses`.
   - When `is_complete: true` is returned (29th submission), backend has set `completed_at` server-side.
6. Frontend transitions to the end-of-task questionnaire (not directly to completion).
7. Participant completes the end-of-task form; frontend submits `PATCH /misokinesia/participants/{id}/end-of-task`.
8. Frontend calls `PATCH /sessions/{session_id}/status` with `status='complete'` (reuses existing endpoint, same pattern as digitspan).
9. Completion screen shown; RA clicks "Return to Dashboard".

State machine: `intro → playing → questionnaire → (loop × 29) → end_of_task → complete`

## RA Flow

Navigate to `/misokinesia` via the floating dock present on all RA pages. Click "Start Misokinesia Session". The backend creates the anonymous participant and session and returns the manifest. The app navigates to `/misokinesia/[id]` on the same device — no external URL or participant handoff.

---

## Data Model

Four new tables added by migration `20260317_000001`. No changes to the existing `sessions` or `participants` tables beyond inserting anonymous rows via `POST /misokinesia/start`.

| Table | Purpose | Key columns |
|---|---|---|
| `misokinesia_test_sets` | Reusable stimulus configuration / study version | `test_set_id` (UUID PK), `name`, `version`, `active` |
| `misokinesia_stimuli` | Clip metadata; no video bytes in DB | `stimulus_id` (UUID PK), `test_set_id` (FK), `storage_path`, `sort_order`, `duration_ms`, `active` |
| `misokinesia_participants` | One row per participant task execution; holds progress state and end-of-task responses | `misokinesia_participant_id` (UUID PK), `session_id` (FK), `participant_uuid` (FK), `test_set_id` (FK), `misokinesia_participant_number` (SERIAL), `completed_at` (nullable), end-of-task columns |
| `misokinesia_trial_responses` | One row per clip per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `stimulus_id` (FK), `display_order`, `q1`–`q4` (SMALLINT), UNIQUE (`misokinesia_participant_id`, `stimulus_id`) |

See `docs/SCHEMA.md` — "Phase 4 Additions — Misokinesia Module" for the full column list.

---

## API Surface

Router prefix: `/misokinesia`. Implemented in `backend/app/routers/misokinesia.py`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/misokinesia/start` | RA required | Creates anonymous participant + session + misokinesia_participants row; returns the full 29-clip manifest in a randomized playback order |
| `POST` | `/misokinesia/participants/{participant_id}/responses` | None (participant-facing) | Submits one per-clip questionnaire; sets `completed_at` server-side on final submission; returns `is_complete` flag |
| `PATCH` | `/misokinesia/participants/{participant_id}/end-of-task` | None (participant-facing) | Writes the 4 end-of-task fields to `misokinesia_participants`; returns 409 if `completed_at` is null |

See `docs/API.md` — "Misokinesia" section for full request/response schemas and error codes.

---

## Per-clip Questionnaire

4 questions shown after every clip. All items are integer 1–5 (1 = Strongly Disagree, 5 = Strongly Agree).

| Column | Question |
|---|---|
| `q1` | I find this video unpleasant |
| `q2` | I felt physical discomfort during the video |
| `q3` | I felt upset during the video |
| `q4` | I wanted to stop the video early / or close my eyes |

---

## End-of-task Questionnaire

Three items shown once after all 29 per-clip questionnaires are complete, before the completion screen. Stored as columns on `misokinesia_participants`.

| Column | Type | Question / Notes |
|---|---|---|
| `end_fidgeting_text` | TEXT | "Please list any fidgeting stimuli that you are bothered by that did not show up in the task" (free text, optional) |
| `end_emotions_text` | TEXT | "Please list any emotional responses that you felt during the videos that were not asked in the questionnaire" (free text, optional) |
| `stronger_responses` | BOOLEAN | "Did viewing the videos create stronger responses over time?" — No (false) / Yes (true), optional |
| `stronger_responses_timing` | VARCHAR | If `stronger_responses` is true: one of `"Immediately"`, `"After 5 seconds"`, `"After 10 seconds"`, `"At the end of the video"`; otherwise null. Setting this when `stronger_responses` is false returns 422. |

All fields are optional (null accepted). `PATCH /end-of-task` returns 409 if `completed_at` is null (per-clip responses not yet finished).

---

## Architecture Notes

- **Videos served from Supabase Storage public CDN.** Bucket: `misokinesia-stimuli`. URL format: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`. No signing, no expiry. Never proxied through FastAPI.
- **Manifest-first pattern.** All 29 clip URLs are returned in a single `POST /misokinesia/start` response in the randomized order used for that participant. The frontend plays clips directly from those URLs; no per-clip backend round-trip for media.
- **`completed_at` set server-side.** On each `POST /responses` call the backend counts submitted responses for the participant; when all stimuli are answered it sets `misokinesia_participants.completed_at` automatically and returns `is_complete: true`.
- **Independent participant numbering.** `misokinesia_participant_number` is assigned by a dedicated PostgreSQL SERIAL sequence and starts from 1, independent of `participants.participant_number`.
- **Stimuli seeded via seed script.** No admin upload endpoint exists yet; stimulus rows are inserted manually or via a seed script.

---

## Deferred / Open

- Auth and stimulus management rules (who can upload or replace video clips, whether stimulus management is admin-only, whether non-admin RAs can configure or launch the module) are tracked in `docs/DECISIONS.md` OPEN-02.
- Undo-last-session extension to cover `misokinesia_participants` and `misokinesia_trial_responses` rows is deferred.
- Admin export / data-download surface for the misokinesia tables is deferred.
