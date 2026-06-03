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
| GET    | /misokinesia/dashboard | RA | implemented | T195 |
| GET    | /misokinesia/video-scores | RA | implemented | T196 |
| PATCH  | /misokinesia/participants/{participant_id}/demographics | None | planned replacement | T184 → Miso demographics v2 |
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
  - Atomically creates an anonymous `participants` row, an `active` session, and a `misokinesia_participants` row.
  - `misokinesia_participant_number` is assigned by a dedicated PostgreSQL SERIAL sequence (independent of `participants.participant_number`).
  - Assigns a random permutation of `["mkaq", "gad7", "maq"]` as `post_survey_order`, persists it on `misokinesia_participants`, and returns it in the response so the frontend can present the three post-video surveys in the assigned order.
  - Resolves the single active `misokinesia_test_sets` row; returns 404 if none found.
  - `clips` contains all active stimuli for the test set (25 after 2026-05 decommission), in a randomized per-participant order.
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

### GET /misokinesia/dashboard
- **Auth:** RA required
- **Status:** implemented (T195)
- **Request body:** none
- **Response (HTTP 200):** `MisoDashboardResponse`
  ```json
  {
    "active_stimuli_count": 25,
    "recent_sessions": [
      {
        "misokinesia_participant_number": 12,
        "started_at": "2026-05-20T16:00:00Z",
        "completed_at": null,
        "age": 24,
        "sex": "Female",
        "residence_status": "Student Visa",
        "avg_clip_score": 15.5
      }
    ]
  }
  ```
- **Notes:**
  - RA-only summary endpoint for the misokinesia operations page.
  - `active_stimuli_count` counts active `misokinesia_stimuli` rows in the active test set.
  - `recent_sessions` returns up to 10 `misokinesia_participants` rows ordered by `started_at DESC`.
  - Planned demographics summary fields are `age`, `sex`, and `residence_status`, passed through from `misokinesia_participants`. They are nullable for legacy rows and participants who have not reached demographics.
  - `avg_clip_score` is the mean of `q1 + q2 + q3 + q4` across that participant's per-clip response rows. It is `null` when the participant has not submitted any clip responses.
  - The backend computes the dashboard with one aggregate query and does not issue per-participant response lookups.
  - Unauthenticated requests return 401.

### PATCH /misokinesia/participants/{participant_id}/demographics
- **Auth:** None (participant-facing)
- **Status:** planned replacement for T184 sourced from `reference/labs/Misokinesia/Demographics copy2.docx`
- **Request body:** `MisoDemographicsCreate`
  ```json
  {
    "age": 24,
    "sex": "Female",
    "gender_identity": "string",
    "years_lived_canada": 6,
    "residence_status": "Student Visa",
    "residence_status_other_text": null,
    "student_type": "International",
    "total_years_education": 16,
    "cumulative_gpa": 4.0,
    "majors_text": "Psychology",
    "highest_education_completed": "Bachelors degree",
    "ethnicity": ["Korean"],
    "ethnicity_other_text": null,
    "native_language": "Korean",
    "english_fluency": "Agree",
    "fluent_languages": ["Korean"],
    "fluent_languages_other_text": null,
    "english_speaking_frequency": "Often",
    "non_english_schooling": true,
    "instruction_languages": ["Korean"],
    "instruction_languages_other_text": null,
    "diagnosed_disorders": ["N/A"],
    "diagnosed_disorders_other_text": null,
    "adhd_diagnosis": false,
    "adhd_medication": "No",
    "avid_videogamer": true,
    "video_game_hours_per_week": 8,
    "prescription_stimulants": false,
    "regular_substances": ["Caffeinated Stimulants (coffee, energy drinks, etc.)"],
    "regular_substances_other_text": null,
    "relationship_status": "Single",
    "relationship_status_other_text": null,
    "occupational_status": "Student",
    "occupational_status_other_text": null
  }
  ```
- **Response (HTTP 200):** `MisoDemographicsResponse`
  ```json
  { "misokinesia_participant_id": "uuid" }
  ```
- **Notes:**
  - No auth required.
  - Returns 404 if `participant_id` not found.
  - The participant UI must require all visible demographics fields before submission. Database columns remain nullable for legacy rows and trial/no-write behavior.
  - Slider/input numeric ranges:
    - `age`, `years_lived_canada`, `total_years_education`, `video_game_hours_per_week`: integer `0`-`100`
    - `cumulative_gpa`: numeric `0`-`5`
  - Single-choice allowed values:
    - `sex`: `"Male"`, `"Female"`
    - `residence_status`: `"Canadian Citizenship"`, `"Permanent Resident"`, `"Student Visa"`, `"Other"`
    - `student_type`: `"Domestic"`, `"International"`
    - `highest_education_completed`: `"Elementary or middle school"`, `"High school or equivalent (e.g., GED)"`, `"College diploma"`, `"Bachelors degree"`, `"Masters degree"`, `"Doctorate degree"`
    - `english_fluency`: `"Strongly agree"`, `"Agree"`, `"Neither agree nor disagree"`, `"Disagree"`, `"Strongly disagree"`
    - `english_speaking_frequency`: `"Always"`, `"Often"`, `"Sometimes"`, `"Rarely"`, `"Never"`
    - `adhd_medication`: `"Yes"`, `"Maybe"`, `"No"`
    - `relationship_status`: `"Single"`, `"In a relationship"`, `"Married (and not separated)"`, `"Common-law"`, `"Seperated"`, `"Divorced"`, `"Widowed"`, `"Other"`, `"None of the Above"`
    - `occupational_status`: `"Employed full-time"`, `"Employed part-time"`, `"Out of work but looking for work"`, `"Out of work and not looking for work"`, `"Homemaker"`, `"Student"`, `"Military"`, `"Retired"`, `"Unable to work"`, `"Other"`, `"None of the above"`
  - Multi-select allowed values:
    - `ethnicity`: `"European Canadian"`, `"Chinese"`, `"South Asian"`, `"Filipino"`, `"Southeast Asian"`, `"Japanese"`, `"Latin American"`, `"Korean"`, `"Other"`
    - `fluent_languages`: `"French"`, `"Mandarin"`, `"Cantonese"`, `"Hindi"`, `"Punjabi"`, `"Korean"`, `"None"`, `"Other"`
    - `instruction_languages`: `"French"`, `"Mandarin"`, `"Cantonese"`, `"Hindi"`, `"Punjabi"`, `"Korean"`, `"Other"`
    - `diagnosed_disorders`: `"Neurological Disorder"`, `"Generalized Anxiety Disorder"`, `"Depression"`, `"Mood Disorder"`, `"Substance Use Disorder"`, `"Other"`, `"N/A"`
    - `regular_substances`: `"Alcohol"`, `"Cannabis"`, `"Tobacco"`, `"Vaping"`, `"Caffeinated Stimulants (coffee, energy drinks, etc.)"`, `"Other"`, `"None of the Above"`
  - Returns 422 when an `*_other_text` value is present without the matching `"Other"` selection, or when `"Other"` is selected without text.
  - Returns 422 when `instruction_languages` is present while `non_english_schooling` is not `true`.
  - Returns 422 when `video_game_hours_per_week` is present while `avid_videogamer` is not `true`.
  - `"None"`, `"N/A"`, and `"None of the Above"` are exclusive in their parent multi-select group.
  - Idempotent — can be called multiple times; later calls overwrite earlier values.
  - Trial mode must not call this endpoint; consent and demographics screens advance locally.

---

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

## RA Dashboard Endpoints

### GET /misokinesia/video-scores
- **Auth:** RA required
- **Status:** implemented (T196)
- **Request body:** none
- **Response (HTTP 200):** `MisoVideoScoresResponse`
  ```json
  {
    "top_5": [
      { "video_label": "Ankle Wagging", "avg_score": 14.2, "response_count": 43 }
    ],
    "bottom_5": [
      { "video_label": "Pen Clicking", "avg_score": 5.1, "response_count": 41 }
    ]
  }
  ```
- **Notes:**
  - Aggregates `misokinesia_trial_responses` by `stimulus_id`, joining `misokinesia_stimuli` for the filename.
  - `avg_score`: mean of `(q1 + q2 + q3 + q4)` across all production participant responses for that stimulus. Range 4–20.
  - `video_label`: derived server-side from `misokinesia_stimuli.filename` — strips the file extension, then splits camelCase into title-case words (e.g. `ankleWagging.mp4` → `Ankle Wagging`). No schema migration required.
  - `response_count`: total participant response rows for that stimulus, provided for RA context.
  - `top_5`: the 5 stimuli with the highest `avg_score`, ordered descending (highest reactivity).
  - `bottom_5`: the 5 stimuli with the lowest `avg_score`, ordered ascending (lowest reactivity).
  - Only stimuli with `active = true` are included. Trial runs never write response rows so they are naturally excluded.
  - Returns `top_5: []` and `bottom_5: []` when no response data exists yet.
  - If fewer than 5 active stimuli have responses, returns however many exist (may be fewer than 5 in each list).
  - Unauthenticated requests return 401.

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
