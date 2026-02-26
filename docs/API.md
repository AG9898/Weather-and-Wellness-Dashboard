# API.md — Backend API Reference

> Living document. Backend tasks write endpoint definitions here on completion.
> Frontend tasks read it to know exact request/response shapes.
>
> Status values: `planned` = not implemented or reopened after audit | `implemented` = endpoint live and verified
>
> When implementing an endpoint: change status to `implemented`, fill in the full schema,
> and add a "Verified:" note if a frontend task confirmed the contract.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:8000` |
| Production  | `https://weather-and-wellness-dashboard.onrender.com` |

---

## Authentication

- **RA endpoints:** If Supabase Auth is enabled, `Authorization: Bearer <supabase-jwt>` header required
- **Participant endpoints:** No auth. Validated by `session_id` existence + `status == "active"`
- **Dev stub:** During T06–T17, auth returns a hardcoded LabMember. Replace when JWT validation is enabled.

---

## Endpoint Index

| Method | Path | Auth | Status | Implemented by |
|--------|------|------|--------|----------------|
| GET    | /dashboard/summary | RA | implemented | T20 |
| POST   | /participants | RA | implemented | T07 |
| GET    | /participants | RA | implemented | T07 |
| GET    | /participants/{uuid} | RA | implemented | T07 |
| GET    | /sessions | RA | implemented | T21 |
| POST   | /sessions | RA | implemented | T08 |
| POST   | /sessions/start | RA | planned | T41 |
| GET    | /sessions/{session_id} | None | implemented | T08 |
| PATCH  | /sessions/{session_id}/status | RA (created/active), None (complete) | implemented | T08 |
| POST   | /digitspan/runs | None (active session) | implemented | T09 |
| POST   | /surveys/uls8 | None (active session) | implemented | T10 |
| POST   | /surveys/cesd10 | None (active session) | implemented | T10 |
| POST   | /surveys/gad7 | None (active session) | implemented | T10 |
| POST   | /surveys/cogfunc8a | None (active session) | implemented | T10 |
| POST   | /weather/ingest/ubc-eos | RA or shared secret | implemented | T30 |
| GET    | /weather/daily | RA | implemented | T31 |

---

## Dashboard

### GET /dashboard/summary
- **Auth:** RA required
- **Status:** implemented (T20)
- **Response:**
  ```json
  {
    "total_participants": "integer",
    "sessions_created": "integer",
    "sessions_active": "integer",
    "sessions_complete": "integer",
    "sessions_created_last_7_days": "integer",
    "sessions_completed_last_7_days": "integer"
  }
  ```
- **Notes:** All counts reflect current DB state. `sessions_created_last_7_days` counts sessions whose `created_at` is within 7 days of the request. `sessions_completed_last_7_days` counts sessions whose `completed_at` is within 7 days of the request. Returns 401 if auth token is missing or invalid.

---

## Participants

- **Audit note:** T07 endpoints were reopened on 2026-02-20 due to incomplete/invalid implementation.
- **Phase 2 note (planned):** Participants are anonymous. `first_name` / `last_name` will be removed from the schema and API responses in T40.

### POST /participants
- **Auth:** RA required
- **Status:** implemented (T07)
- **Request body:**
  ```json
  { "first_name": "string", "last_name": "string" }
  ```
- **Response:**
  ```json
  {
    "participant_uuid": "uuid",
    "participant_number": "integer",
    "first_name": "string",
    "last_name": "string",
    "created_at": "datetime"
  }
  ```
- **Notes:** `participant_number` is auto-assigned by server; never supplied by client. Implementation reopened after audit on 2026-02-20.

---

### GET /participants
- **Auth:** RA required
- **Status:** implemented (T07)
- **Response:** Array of ParticipantResponse objects, ordered by `participant_number` ascending.

---

### GET /participants/{uuid}
- **Auth:** RA required
- **Status:** implemented (T07)
- **Response:** Single ParticipantResponse | 404 if UUID unknown.

---

## Sessions

- **Audit note:** T08 endpoints were reopened on 2026-02-20 due to incomplete/invalid implementation.

### GET /sessions
- **Auth:** RA required
- **Status:** implemented (T21)
- **Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | 1 | Page number (1-based) |
| `page_size` | integer 1–100 | 20 | Items per page |
| `status` | string (optional) | — | Filter by status: `created` \| `active` \| `complete` |
| `participant_number` | integer ≥ 1 (optional) | — | Filter by participant number |
| `date_from` | date `YYYY-MM-DD` (optional) | — | Sessions created on or after this date |
| `date_to` | date `YYYY-MM-DD` (optional) | — | Sessions created on or before this date (inclusive end of day) |

- **Response:**
  ```json
  {
    "items": [
      {
        "session_id": "uuid",
        "participant_uuid": "uuid",
        "participant_number": "integer",
        "status": "created | active | complete",
        "created_at": "datetime",
        "completed_at": "datetime | null"
      }
    ],
    "total": "integer",
    "page": "integer",
    "page_size": "integer",
    "pages": "integer"
  }
  ```
- **Notes:**
  - Results are ordered by `created_at` DESC (newest first).
  - Invalid `status` value returns 422 with descriptive message.
  - `date_from` > `date_to` returns 422.
  - `participant_number` is included in each item (joined from participants table).

---

### POST /sessions
- **Auth:** RA required
- **Status:** implemented (T08)
- **Request body:**
  ```json
  { "participant_uuid": "uuid" }
  ```
- **Response:**
  ```json
  {
    "session_id": "uuid",
    "participant_uuid": "uuid",
    "status": "created",
    "created_at": "datetime",
    "completed_at": null
  }
  ```
- **Notes:** Returns 404 if `participant_uuid` not found.

---

### GET /sessions/{session_id}
- **Auth:** None (unauthenticated — participant page polls this)
- **Status:** implemented (T08)
- **Response:** SessionResponse with current `status` field.

---

### PATCH /sessions/{session_id}/status
- **Auth:** 
  - RA required for `"created"` and `"active"` updates
  - No auth required for participant-driven `"complete"` update from an active session
- **Status:** implemented (T08)
- **Request body:**
  ```json
  { "status": "created | active | complete" }
  ```
- **Response:** Updated SessionResponse | 422 if status value invalid.

---

### POST /sessions/start
- **Auth:** RA required
- **Status:** planned (T41)
- **Request body:** Empty object
  ```json
  {}
  ```
- **Response:**
  ```json
  {
    "participant_uuid": "uuid",
    "participant_number": "integer",
    "session_id": "uuid",
    "status": "active",
    "created_at": "datetime",
    "completed_at": null,
    "start_path": "/session/<session_id>/uls8"
  }
  ```
- **Notes:** One-click flow for supervised sessions. Creates an anonymous participant and an active session atomically, then returns a start path for the participant flow.

---

## Digit Span

### POST /digitspan/runs
- **Auth:** None (active session validated)
- **Status:** implemented (T09)
- **Request body:**
  ```json
  {
    "session_id": "uuid",
    "trials": [
      {
        "trial_number": "integer",
        "span_length": "integer",
        "sequence_shown": "string",
        "sequence_entered": "string",
        "correct": "boolean"
      }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "run_id": "uuid",
    "total_correct": "integer",
    "max_span": "integer"
  }
  ```
- **Notes:** Returns 400/409 if session is not in `"active"` status. Expects exactly 14 trials.

---

## Surveys

### POST /surveys/uls8
- **Auth:** None (active session validated)
- **Status:** implemented (T10)
- **Request body:**
  ```json
  { "session_id": "uuid", "r1": 1, "r2": 1, "r3": 1, "r4": 1, "r5": 1, "r6": 1, "r7": 1, "r8": 1 }
  ```
- **Response:**
  ```json
  { "response_id": "uuid", "computed_mean": "decimal", "score_0_100": "decimal" }
  ```

---

### POST /surveys/cesd10
- **Auth:** None (active session validated)
- **Status:** implemented (T10)
- **Request body:** `{ "session_id": "uuid", "r1"–"r10": 0–3 each }`
- **Response:** `{ "response_id": "uuid", "total_score": integer }`

---

### POST /surveys/gad7
- **Auth:** None (active session validated)
- **Status:** implemented (T10)
- **Request body:** `{ "session_id": "uuid", "r1"–"r7": 0–3 each }`
- **Response:** `{ "response_id": "uuid", "total_score": integer, "severity_band": "string" }`

---

### POST /surveys/cogfunc8a
- **Auth:** None (active session validated)
- **Status:** implemented (T10)
- **Request body:** `{ "session_id": "uuid", "r1"–"r8": 1–5 each }`
- **Response:** `{ "response_id": "uuid", "total_sum": integer, "mean_score": "decimal" }`

---

## Weather

> Canonical feature spec: `docs/WEATHER_INGESTION.md`

### POST /weather/ingest/ubc-eos
- **Auth:** LabMember JWT **or** GitHub Actions shared secret
- **Status:** implemented (T30)
- **Headers (one of):**
  - RA path: `Authorization: Bearer <supabase-jwt>`
  - Actions path: `X-WW-Weather-Ingest-Secret: <shared-secret>`
- **Request body:**
  ```json
  { "station_id": 3510 }
  ```
- **Response:**
  ```json
  {
    "run_id": "uuid",
    "station_id": "integer",
    "ingested_at": "datetime",
    "parse_status": "success | partial | fail",
    "parse_errors": "array",
    "upserted_days": "integer"
  }
  ```
- **Notes:**
  - Idempotent daily upsert into `weather_daily` keyed by `(station_id, study_day_id)`.
  - Enforces per-station cooldown (default 10 min; `WEATHER_INGEST_COOLDOWN_SECONDS` env var) → 429 with `Retry-After` header.
  - Per-station Postgres advisory lock prevents concurrent runs → 409 if already in progress.
  - Always writes a `weather_ingest_runs` row regardless of parse outcome.
  - Writes `weather_daily` only when `parse_status` is `success` or `partial`.
  - `study_days` row for `date_local` is get-or-created automatically.
  - Parser version: `ubc-eos-v1`. Sources: `custom.php` (current conditions) + `ubcrs_withicons/index.php` (current + 3-hour forecast periods).
  - Verified: 2026-02-26 — `parse_status: success`, `upserted_days: 1`, rows confirmed in Supabase Studio.

### GET /weather/daily
- **Auth:** RA required
- **Status:** implemented (T31)
- **Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `start` | date `YYYY-MM-DD` | — | Start local date (America/Edmonton) |
| `end` | date `YYYY-MM-DD` | — | End local date (America/Edmonton) |
| `station_id` | integer | 3510 | Station id (currently only 3510 supported) |

- **Response:**
  ```json
  {
    "items": [
      {
        "station_id": "integer",
        "study_day_id": "uuid",
        "date_local": "date",
        "source_run_id": "uuid",
        "updated_at": "datetime",
        "current_temp_c": "number | null",
        "forecast_high_c": "number | null",
        "forecast_low_c": "number | null",
        "forecast_condition_text": "string | null",
        "forecast_periods": "array"
      }
    ],
    "latest_run": {
      "run_id": "uuid",
      "ingested_at": "datetime",
      "parse_status": "success | partial | fail"
    }
  }
  ```
- **Notes:**
  - Both `start` and `end` are required. `start` > `end` returns 422.
  - Max range is 365 days; exceeding it returns 422.
  - `items` ordered by `date_local` ASC. Empty array if no data for the range.
  - `latest_run` is the most recent ingest run for the station regardless of date range; `null` if no runs exist.
  - `latest_run.parse_status` values: `success | partial | fail`.
- **Verified:** 2026-02-26 — returned 1 item with `current_temp_c`, `forecast_periods`, and `latest_run` from live DB.

---

## Error Response Format

All error responses (4xx and 5xx) use a consistent JSON body:

```json
{ "detail": "<string or array>" }
```

- For `HTTPException` errors: `detail` is a string.
- For `RequestValidationError` (422): `detail` is an array of Pydantic validation error objects.
- For unhandled server errors (500): `detail` is `"Internal server error"`. Full error is logged server-side with method, path, and exception type.

---

## CORS

Allowed origins are configured via the `ALLOWED_ORIGINS` environment variable (comma-separated). When unset, defaults to `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`, `http://127.0.0.1:3001`. Set to your Vercel frontend URL(s) in production.

---

## Error Codes Reference

| HTTP Status | Meaning | When returned |
|-------------|---------|---------------|
| 400 | Bad Request | Session not in "active" status when submitting data |
| 404 | Not Found | Unknown participant_uuid or session_id |
| 409 | Conflict | Session not in expected state for operation |
| 422 | Unprocessable Entity | Invalid status value in PATCH; malformed request body |
| 401 | Unauthorized | Missing or invalid JWT on RA endpoint |
| 500 | Internal Server Error | Unhandled exception — see server logs for details |
