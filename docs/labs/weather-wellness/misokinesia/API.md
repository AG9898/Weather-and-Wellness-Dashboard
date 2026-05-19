# API.md — Misokinesia Backend API Reference

> This document covers Misokinesia-specific endpoints only.
> For Weather-Wellness dashboard, participant, session, survey, weather, admin, and auth
> endpoints see [`docs/labs/weather-wellness/weather/API.md`](../weather/API.md).

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:8000` |
| Production  | `https://backend-production-5809.up.railway.app` |

---

## Authentication

- **RA endpoints:** `Authorization: Bearer <supabase-jwt>` required. JWT is validated by FastAPI; `role` and `lab_name` are extracted from `app_metadata`.
- **Participant endpoints:** No auth. Validated by `misokinesia_participant_id` existence.
- **Roles:** `admin` (full access) and `ra` (RA; dashboard access only). Lab membership is tracked via `lab_name` (e.g. `ww` for Weather-Wellness + Misokinesia). Default role when `app_metadata` is absent: `ra`.

## Trial Run Mode (No-write Rehearsal)

- Misokinesia exposes **"Run Short Trial"** (5 clips, MkAQ/MAQ q1–q10 only) and **"Run Full Trial"** (all clips, all items) controls.
- Canonical trial-mode behavior (fake ID format, consent rules, and module boundaries) is documented in `docs/TRIAL_MODE.md`.
- Misokinesia trial mode may call read-only clip-manifest endpoints, but must not call `/misokinesia/start`, `/misokinesia/participants/{id}/responses`, `/misokinesia/participants/{id}/mkaq`, `/misokinesia/participants/{id}/gad7`, `/misokinesia/participants/{id}/maq`, or `/misokinesia/participants/{id}/end-of-task`.
- Two misokinesia trial modes exist: **Short Trial** (5 clips, MkAQ/MAQ q1–q10 only) and **Full Trial** (all clips, all items). Both present all three post-video surveys in a locally generated randomised order. Neither writes any rows.
- The `Trial Run` watermark must be excluded from `/misokinesia/[id]` even when `TRIAL_RUN_MODE` is active.
- Trial mode must not create or update database rows.

---

## Endpoint Index

| Method | Path | Auth | Status | Implemented by |
|--------|------|------|--------|----------------|
| POST   | /misokinesia/start | RA | implemented | T106 |
| GET    | /misokinesia/trial-manifest | RA | implemented | T143, T172 |
| POST   | /misokinesia/participants/{participant_id}/responses | None | implemented | T107 |
| POST   | /misokinesia/participants/{participant_id}/mkaq | None | implemented | T146 |
| POST   | /misokinesia/participants/{participant_id}/gad7 | None | implemented | T169 |
| POST   | /misokinesia/participants/{participant_id}/maq | None | implemented | T169 |
| PATCH  | /misokinesia/participants/{participant_id}/end-of-task | None | implemented | T107 |

---

## Misokinesia

> Router prefix: `/misokinesia`. Implemented in `backend/app/routers/misokinesia.py`.
> Participant-facing endpoints (T107) are no-auth; the start endpoint requires RA auth.

### POST /misokinesia/start
- **Auth:** RA required
- **Status:** implemented (T106)
- **Request body:** none
- **Response (HTTP 201):** `MisokinesiaManifestResponse`
  ```json
  {
    "misokinesia_participant_id": "uuid",
    "misokinesia_participant_number": "integer",
    "session_id": "uuid",
    "post_survey_order": "mkaq,gad7,maq",
    "clips": [
      {
        "stimulus_id": "uuid",
        "public_url": "string",
        "sort_order": "integer",
        "duration_ms": "integer"
      }
    ]
  }
  ```
- **Notes:**
  - Atomically creates an anonymous `participants` row (no demographics), an `active` session, and a `misokinesia_participants` row.
  - `misokinesia_participant_number` is assigned by a dedicated PostgreSQL SERIAL sequence (independent of `participants.participant_number`).
  - Assigns a random permutation of `["mkaq", "gad7", "maq"]` as `post_survey_order`, persists it on `misokinesia_participants`, and returns it in the response so the frontend can present the three post-video surveys in the assigned order.
  - Resolves the single active `misokinesia_test_sets` row; returns 404 if none found.
  - `clips` contains all 29 active stimuli for the test set, but the response order is randomized per participant session.
  - Each clip's `sort_order` still reflects the canonical seeded stimulus order stored in `misokinesia_stimuli`.
  - `public_url` format: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`.
  - Unauthenticated requests return 401.
  - Trial mode bypasses this write endpoint and uses `GET /misokinesia/trial-manifest` for read-only clip metadata.

### GET /misokinesia/trial-manifest
- **Auth:** RA required
- **Status:** implemented (T143); `?full=true` full-trial mode implemented (T172)
- **Routing inventory note (T143):** This endpoint should also appear in the routing inventory in `docs/ARCHITECTURE.md`. Known gap as of 2026-04-21: that inventory does not yet list `/misokinesia/trial-manifest`.
- **Query params:** `full` (boolean, optional, default `false`) — when `true`, returns all active stimuli instead of a 5-clip sample
- **Request body:** none
- **Response (HTTP 200):** `MisokinesiaTrialManifestResponse`
  ```json
  {
    "post_survey_order": "gad7,maq,mkaq",
    "clips": [
      {
        "stimulus_id": "uuid",
        "public_url": "string",
        "sort_order": "integer",
        "duration_ms": "integer"
      }
    ]
  }
  ```
- **Notes:**
  - Read-only rehearsal endpoint for both trial modes; it must not create or update rows.
  - Resolves the single active `misokinesia_test_sets` row; returns 404 if none found.
  - Without `?full=true`: samples exactly 5 active stimuli in a randomized order (short trial).
  - With `?full=true`: returns all active stimuli in a randomized order — same count and ordering logic as production `POST /misokinesia/start` but without any DB writes (full trial).
  - Returns a randomly generated `post_survey_order` (not persisted) so either trial mode can drive the three post-video surveys in a randomised sequence.
  - `public_url` format: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`.
  - The frontend combines these read-only clips with fake trial ids and performs local-only simulated completions.
  - If fewer than 5 active stimuli exist (short trial only), return a clear non-2xx error rather than silently shortening the trial.
  - Unauthenticated requests return 401.

### POST /misokinesia/participants/{participant_id}/responses
- **Auth:** None (participant-facing)
- **Status:** implemented (T107)
- **Request body:** `MisokinesiaTrialResponseCreate`
  ```json
  {
    "stimulus_id": "uuid",
    "display_order": "integer (≥1)",
    "q1": "integer (1–5)",
    "q2": "integer (1–5)",
    "q3": "integer (1–5)",
    "q4": "integer (1–5)"
  }
  ```
- **Response (HTTP 201):** `MisokinesiaTrialResponseResponse`
  ```json
  {
    "response_id": "uuid",
    "session_id": "uuid",
    "is_complete": "boolean",
    "created_at": "datetime"
  }
  ```
- **Notes:**
  - No auth required.
  - Returns 404 if `participant_id` not found.
  - Returns 409 if a response for this `(participant_id, stimulus_id)` pair already exists (UNIQUE constraint violation).
  - Returns 409 if all stimuli are already answered (`completed_at` is set).
  - Returns 422 if `stimulus_id` does not belong to the participant's assigned test set.
  - Returns 422 if any `qN` value is outside 1–5.
  - After the final response, `misokinesia_participants.completed_at` is set server-side automatically.
  - `is_complete: true` signals to the frontend to transition to the end-of-task state.
  - `session_id` is included so the frontend can call `PATCH /sessions/{session_id}/status` after the end-of-task step.
  - Trial mode bypasses this endpoint and performs local-only progression.

---

### POST /misokinesia/participants/{participant_id}/mkaq
- **Auth:** None (participant-facing)
- **Status:** implemented (T146)
- **Request body:** `MisokinesiaAqCreate`
  ```json
  {
    "q1": "integer (0-3)",
    "q2": "integer (0-3)",
    "q3": "integer (0-3)",
    "q4": "integer (0-3)",
    "q5": "integer (0-3)",
    "q6": "integer (0-3)",
    "q7": "integer (0-3)",
    "q8": "integer (0-3)",
    "q9": "integer (0-3)",
    "q10": "integer (0-3)",
    "q11": "integer (0-3)",
    "q12": "integer (0-3)",
    "q13": "integer (0-3)",
    "q14": "integer (0-3)",
    "q15": "integer (0-3)",
    "q16": "integer (0-3)",
    "q17": "integer (0-3)",
    "q18": "integer (0-3)",
    "q19": "integer (0-3)",
    "q20": "integer (0-3)",
    "q21": "integer (0-3)"
  }
  ```
- **Response (HTTP 201):** `MisokinesiaAqResponse`
  ```json
  {
    "response_id": "uuid",
    "misokinesia_participant_id": "uuid",
    "session_id": "uuid",
    "total_score": "integer (0-63)",
    "created_at": "datetime"
  }
  ```
- **Notes:**
  - No auth required.
  - Returns 404 if `participant_id` not found.
  - Returns 409 until all per-clip responses are submitted (`completed_at` set) — MkAQ is always post-video.
  - Returns 409 if this participant already has an MkAQ response.
  - Returns 500 for unexpected non-duplicate DB integrity failures during persistence.
  - Returns 422 if any `qN` value is outside 0-3 or if any item is missing.
  - `total_score` is computed server-side as the direct sum of `q1` through `q21`.
  - Production MkAQ UI pane grouping is frontend-only; the endpoint still receives one complete `q1` through `q21` payload.
  - Trial mode bypasses this endpoint and performs local-only progression with the shortened `q1` through `q10` rehearsal set.

---

### PATCH /misokinesia/participants/{participant_id}/end-of-task
- **Auth:** None (participant-facing)
- **Status:** implemented (T107)
- **Request body:** `MisokinesiaEndOfTaskCreate`
  ```json
  {
    "end_fidgeting_text": "string | null",
    "end_emotions_text": "string | null",
    "stronger_responses": "boolean | null",
    "stronger_responses_timing": "string | null"
  }
  ```
  - `stronger_responses_timing` must be one of: `"Immediately"`, `"After 5 seconds"`, `"After 10 seconds"`, `"At the end of the video"`.
  - `stronger_responses_timing` may only be set when `stronger_responses` is `true`; otherwise returns 422.
  - All fields are optional (null accepted).
- **Response (HTTP 200):** `MisokinesiaEndOfTaskResponse`
  ```json
  {
    "misokinesia_participant_id": "uuid",
    "end_fidgeting_text": "string | null",
    "end_emotions_text": "string | null",
    "stronger_responses": "boolean | null",
    "stronger_responses_timing": "string | null"
  }
  ```
- **Notes:**
  - No auth required.
  - Returns 404 if `participant_id` not found.
  - Returns 409 if `misokinesia_participants.completed_at` is null (not all per-clip responses submitted yet).
  - Returns 409 until all three post-video surveys are submitted: MkAQ, GAD-7, and MAQ rows must all exist.
  - After success, frontend calls `PATCH /sessions/{session_id}/status` with `status='complete'`.
  - Trial mode bypasses this endpoint and performs no backend writes.

---

### POST /misokinesia/participants/{participant_id}/gad7
- **Auth:** None (participant-facing)
- **Status:** implemented (T169)
- **Request body:** `MisoGAD7Create`
  ```json
  {
    "r1": "integer (1–4)",
    "r2": "integer (1–4)",
    "r3": "integer (1–4)",
    "r4": "integer (1–4)",
    "r5": "integer (1–4)",
    "r6": "integer (1–4)",
    "r7": "integer (1–4)"
  }
  ```
- **Response (HTTP 201):** `MisoGAD7Response`
  ```json
  {
    "response_id": "uuid",
    "total_score": "integer (0-21)",
    "severity_band": "string"
  }
  ```
- **Notes:**
  - No auth required.
  - Writes to `misokinesia_gad7_responses` (isolated from weather-wellness `survey_gad7`).
  - Returns 404 if `participant_id` not found.
  - Returns 409 until `completed_at` is set (clips must be finished before any post-video survey).
  - Returns 409 if this participant already has a GAD-7 response.
  - Returns 422 if any `rN` value is outside 1–4.
  - Scoring reuses `backend/app/scoring/gad7.py::score_gad7()`: converts 1–4 → 0–3 per item, sums to `total_score` (0–21), assigns `severity_band` (`"minimal"` 0–4, `"mild"` 5–9, `"moderate"` 10–14, `"severe"` 15–21).
  - Trial mode bypasses this endpoint and performs local-only progression.

---

### POST /misokinesia/participants/{participant_id}/maq
- **Auth:** None (participant-facing)
- **Status:** implemented (T169)
- **Request body:** `MisoMAQCreate`
  ```json
  {
    "q1": "integer (0-3)",
    "q2": "integer (0-3)",
    "...": "...",
    "q21": "integer (0-3)"
  }
  ```
- **Response (HTTP 201):** `MisoMAQResponse`
  ```json
  {
    "response_id": "uuid",
    "total_score": "integer (0-63)"
  }
  ```
- **Notes:**
  - No auth required.
  - Writes to `misokinesia_maq_responses`.
  - Returns 404 if `participant_id` not found.
  - Returns 409 until `completed_at` is set (clips must be finished before any post-video survey).
  - Returns 409 if this participant already has a MAQ response.
  - Returns 422 if any `qN` value is outside 0–3 or if any item is missing.
  - `total_score` is computed server-side as the direct sum of `q1` through `q21` (range 0–63).
  - Production MAQ UI pane grouping (q1–q7, q8–q14, q15–q21) is frontend-only; one complete payload is submitted.
  - Trial mode bypasses this endpoint and performs local-only progression with the shortened `q1` through `q10` rehearsal set.

---

## Error Response Format

> The platform-wide error format, CORS configuration, and HTTP status code reference are
> documented in [`docs/labs/weather-wellness/weather/API.md`](../weather/API.md#error-response-format).

All error responses (4xx and 5xx) use a consistent JSON body:

```json
{ "detail": "<string or array>" }
```

- For `HTTPException` errors: `detail` is a string.
- For `RequestValidationError` (422): `detail` is an array of Pydantic validation error objects.
- For unhandled server errors (500): `detail` is `"Internal server error"`. Full error is logged server-side with method, path, and exception type.
