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
| GET    | /dashboard/summary/range | RA | implemented | T58 |
| GET    | /dashboard/participants-per-day | RA | implemented | T58 |
| POST   | /participants | RA | implemented | T07 |
| GET    | /participants | RA | implemented | T07 |
| GET    | /participants/{uuid} | RA | implemented | T07 |
| GET    | /sessions | RA | implemented | T21 |
| POST   | /sessions | RA | implemented | T08 |
| POST   | /sessions/start | RA | implemented | T36, T51a |
| GET    | /sessions/{session_id} | None | implemented | T08 |
| PATCH  | /sessions/{session_id}/status | RA (created/active), None (complete) | implemented | T08 |
| POST   | /digitspan/runs | None (active session) | implemented | T09 |
| POST   | /surveys/uls8 | None (active session) | implemented | T10 |
| POST   | /surveys/cesd10 | None (active session) | implemented | T10 |
| POST   | /surveys/gad7 | None (active session) | implemented | T10 |
| POST   | /surveys/cogfunc8a | None (active session) | implemented | T10 |
| POST   | /weather/ingest/ubc-eos | RA or shared secret | implemented | T30 |
| GET    | /weather/daily | RA | implemented | T31 |
| POST   | /admin/import/preview | RA | implemented | T48 |
| POST   | /admin/import/commit | RA | implemented | T48, T55 |
| GET    | /admin/export.xlsx | RA | implemented | T49 |
| GET    | /admin/export.zip | RA | implemented | T49 |
| POST   | /admin/backfill/legacy-weather | RA | implemented | T56 |

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

### GET /dashboard/summary/range
- **Auth:** RA required
- **Status:** implemented (T58)
- **Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `date_from` | date `YYYY-MM-DD` | Inclusive start (interpreted as `created_at` / `completed_at` window bounds) |
| `date_to` | date `YYYY-MM-DD` | Inclusive end |

- **Response:**
  ```json
  {
    "date_from": "YYYY-MM-DD",
    "date_to": "YYYY-MM-DD",
    "sessions_created": "integer",
    "sessions_completed": "integer",
    "participants_completed": "integer"
  }
  ```
- **Notes:**
  - `sessions_created` counts sessions where `created_at` is within `[date_from, date_to]` (inclusive bounds).
  - `sessions_completed` counts sessions where `completed_at` is within `[date_from, date_to]` (inclusive bounds).
  - `participants_completed` counts distinct participants among sessions completed within the selected range.
  - Date bounds are interpreted in the study timezone (`America/Vancouver`) using inclusive local-day windows.
  - This endpoint supports the Phase 3 dashboard date-range filter without changing the existing `/dashboard/summary` response contract.

---

### GET /dashboard/participants-per-day
- **Auth:** RA required
- **Status:** implemented (T58)
- **Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `start` | date `YYYY-MM-DD` | Inclusive start local date (`America/Vancouver`) |
| `end` | date `YYYY-MM-DD` | Inclusive end local date (`America/Vancouver`) |

- **Response:**
  ```json
  {
    "items": [
      {
        "date_local": "YYYY-MM-DD",
        "sessions_completed": "integer",
        "participants_completed": "integer"
      }
    ]
  }
  ```
- **Notes:**
  - Aggregation is by `study_days.date_local` (America/Vancouver).
  - Intended for dashboard graphing and filtered analytics UI; this does not expose participant identifiers.

---

## Participants

- **Audit note:** T07 endpoints were reopened on 2026-02-20 due to incomplete/invalid implementation.
- **T35 (2026-02-27):** Participants are anonymous. `first_name` and `last_name` have been removed from the schema and API. Only `participant_number` is the human-facing identifier.
- **Phase 3 (T47, applied):** `participants` now stores demographic/exposure attributes (age_band, gender, origin, origin_other_text, commute_method, commute_method_other_text, time_outside, daylight_exposure_minutes). These are set via the start-session demographics form and via admin import; there is no participant-facing API for them. `participants.daylight_exposure_minutes` is computed using `compute_daylight_exposure_minutes()` in `backend/app/config.py` (RESOLVED-12, T47a).

### POST /participants
- **Auth:** RA required
- **Status:** implemented (T07, updated T35)
- **Request body:** Empty object `{}`
- **Response:**
  ```json
  {
    "participant_uuid": "uuid",
    "participant_number": "integer",
    "created_at": "datetime"
  }
  ```
- **Notes:** `participant_number` is auto-assigned by server; never supplied by client. No name fields accepted or returned.

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
- **Status:** implemented (T51a)
- **Request body:**
  ```json
  {
    "age_band": "string",
    "gender": "string",
    "origin": "string",
    "origin_other_text": "string | null",
    "commute_method": "string",
    "commute_method_other_text": "string | null",
    "time_outside": "string"
  }
  ```
- **Preset options (validated server-side):**
  - `age_band`: `"Under 18"`, `"18-24"`, `"25-31"`, `"32-38"`, `">38"`
  - `gender`: `"Woman"`, `"Man"`, `"Non-binary"`, `"Prefer not to say"`
  - `origin`: `"Home"`, `"Work"`, `"Class"`, `"Library"`, `"Gym/Recreation Center"`, `"Other"`
  - `commute_method`: `"Walk"`, `"Transit"`, `"Car"`, `"Bike/Scooter"`, `"Other"`
  - `time_outside`: `"Never (0-30 minutes)"`, `"Rarely (31 minutes- 60 minutes)"`, `"Sometimes (61 minutes - 90 minutes)"`, `"Often (over 90 minutes)"`
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
- **Notes:** Supervised one-click start. Creates an anonymous participant (with demographics) and an active session atomically (single transaction via `flush` + `commit`), then returns the first survey path. Session is immediately `active` so participant submissions are accepted on arrival.
  - All demographic fields are required. If `origin` or `commute_method` is `"Other"`, the corresponding `*_other_text` field is required; otherwise it is optional/ignored.
  - `participants.daylight_exposure_minutes` is computed at request time as minutes since `DAYLIGHT_START_LOCAL_TIME` (default `06:00` local, timezone `America/Vancouver`) using `compute_daylight_exposure_minutes()` from `backend/app/config.py`.
  - `start_path` is always `/session/<session_id>/uls8`. Consent is collected at `(ra)/new-session` before session creation; there is no `/consent` page within the session flow.
  - No consent record is stored in Supabase (UI-only gating).
  - Demographics are stored on `participants` only (never on `sessions`).

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
| `start` | date `YYYY-MM-DD` | — | Start local date (`America/Vancouver`) |
| `end` | date `YYYY-MM-DD` | — | End local date (`America/Vancouver`) |
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
        "current_precip_today_mm": "number | null",
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
  - `date_local` is the analytic join key (study day in `America/Vancouver`). Metadata timestamps like `updated_at` / `current_observed_at` must not be used for day linking.
- **Phase 4 (T58, implemented):** `current_precip_today_mm` is now included in each `WeatherDailyItem` for dashboard graph tooltip use.
- **Verified:** 2026-02-26 — returned 1 item with `current_temp_c`, `forecast_periods`, and `latest_run` from live DB.

---

## Admin Data (Phase 3)

> These endpoints are RA-only and are intended for internal lab administration. They are not participant-facing.
> Imports must be preview-first (no writes on preview), then explicit commit.
>
> Legacy reference file: `reference/data_full_1-230.xlsx` (single-sheet workbook).
> Expected header columns (exact, case-insensitive, whitespace-trimmed):
> `participant ID`, `date`, `age`, `gender`, `origin`, `commute_method`, `time_outside`, `precipitation`,
> `temperature`, `daytime`, `anxiety`, `loneliness`, `depression`, `digit_span_score`, `self_report`.

### POST /admin/import/preview
- **Auth:** RA required
- **Status:** implemented (T48)
- **Request:** `multipart/form-data` with a single file field `file` (`.csv` or `.xlsx`)
- **Response (preview summary):**
  ```json
  {
    "file_type": "csv | xlsx",
    "rows_total": "integer",
    "participants_create": "integer",
    "participants_update": "integer",
    "sessions_create": "integer",
    "sessions_update": "integer",
    "errors": [
      {
        "row": "integer",
        "field": "string | null",
        "message": "string"
      }
    ],
    "warnings": [
      {
        "row": "integer",
        "field": "string | null",
        "message": "string"
      }
    ]
  }
  ```
- **Notes:**
  - No DB writes are performed.
  - Preview counts are computed using upsert rules (participants by `participant_number`, sessions by the 1:1 workflow expectation).
  - Parsing rules (applies to preview and commit):
    - `participant ID` → integer `participant_number` (required).
    - `date` → Excel date serial → `date_local` (required). Convert via Excel base date `1899-12-30` with integer days. `date_local` is interpreted in the study timezone (`America/Vancouver`).
    - `daytime` → imported **session start time-of-day** (optional) used only to compute `participants.daylight_exposure_minutes`:
      - Accept either Excel time fraction (`0.0–1.0`) meaning fraction of a day, or `HH:MM` / `HH:MM:SS` strings.
      - Parse to a local clock time (`session_start_local_time`).
      - Compute `daylight_exposure_minutes = max(0, minutes_between(DAYLIGHT_START_LOCAL_TIME, session_start_local_time))`.
    - String demographic fields are whitespace-trimmed and normalized to a canonical label set where obvious variants exist
      (e.g. `"Man "` → `"Man"`, `"Nonbinary person"` → `"Non-binary"`).
    - If `origin` / `commute_method` is an “Other” category and includes a free-text detail, store it in `origin_other_text` / `commute_method_other_text` (length-limited; avoid PII).
    - All numeric measures (`precipitation`, `temperature`, `anxiety`, `loneliness`, `depression`, `self_report`) parse as floats; blanks become nulls.
      - Note: `anxiety`, `loneliness`, and `depression` are legacy aggregate values (often fractional), not raw item-level responses.
    - `digit_span_score` parses as integer; blank becomes null.
      - Note: legacy `digit_span_score` ranges 0–14 and is treated as a Digit Span run outcome (total correct), not max span.
  - Storage mapping (commit):
    - Participant demographics are stored on `participants` (nullable columns planned in T47).
    - Imported aggregates are stored in `imported_session_measures` (applied in T47) with a full `source_row_json` audit payload.

**Phase 4 (T55, implemented):** commit also upserts “imported” rows into:
- `digitspan_runs` — `data_source='imported'`, `total_correct` = legacy `digit_span_score` (0–14); `max_span` remains null; no trials reconstructed.
- `survey_uls8` — `data_source='imported'`, `legacy_mean_1_4` = legacy `loneliness` mean; raw `r*` and computed columns remain null.
- `survey_cesd10` — `data_source='imported'`, `legacy_mean_1_4` = legacy `depression` mean; raw `r*` and computed columns remain null.
- `survey_gad7` — `data_source='imported'`, `legacy_mean_1_4` = legacy `anxiety` mean; if anxiety is an exact integer 0–21, `total_score` and `severity_band` are also set; otherwise only `legacy_mean_1_4` is stored.
- Re-import is idempotent: updates imported rows, never overwrites native rows (`data_source='native'` rows are guarded in the upsert WHERE clause).

### POST /admin/import/commit
- **Auth:** RA required
- **Status:** implemented (T48)
- **Request:** `multipart/form-data` with a single file field `file` (`.csv` or `.xlsx`)
- **Response (commit summary):**
  ```json
  {
    "rows_total": "integer",
    "participants_created": "integer",
    "participants_updated": "integer",
    "sessions_created": "integer",
    "sessions_updated": "integer"
  }
  ```
- **Notes:**
  - Writes must be transactional: if any row fails validation, the commit fails cleanly (no partial import).
  - Imports create or update a complete session per participant and store legacy aggregate values without attempting to reconstruct raw survey item rows.
  - Upsert rules (decision-complete for T48):
    - Participant upsert key: `participant_number` (`participants.participant_number`).
    - Participant demographics overwrite policy: import values overwrite existing stored demographics for the participant (import is authoritative for that participant_id).
    - Session upsert rule: each participant must have **0 or 1** sessions in the DB:
      - 0 sessions → create a new session.
      - 1 session → update that session (only if it contains no native survey/digit span rows; otherwise fail validation).
      - >1 sessions → fail validation (ambiguous).
      - Note: the DB does not enforce a 1:1 participant↔session constraint; this is an application/workflow rule to avoid ambiguous imports.
    - Imported sessions are always written as `status="complete"` and must set `study_day_id` based on the imported `date_local`.
    - Imported session timestamps: `created_at` and `completed_at` are derived from the imported `date_local` only (legacy `daytime` does not affect session timestamps). Anchor to `12:00` local in `America/Vancouver` and store UTC timestamps.

### GET /admin/export.xlsx
- **Auth:** RA required
- **Status:** implemented (T49)
- **Response:** XLSX workbook download — README sheet + one sheet per DB table
- **Headers:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="Weather and wellness - YYYY-MM-DD.xlsx"`
- **Notes:**
  - Sheet order: README, participants, sessions, survey_uls8, survey_cesd10, survey_gad7, survey_cogfunc8a, digitspan_runs, digitspan_trials, study_days, weather_ingest_runs, weather_daily, imported_session_measures.
  - The README sheet describes all tables, join keys, and value conventions.
  - All join keys (`participant_uuid`, `session_id`, `study_day_id`, `run_id`, `source_run_id`) are present on every relevant sheet.
  - UUIDs and timestamps are ISO strings. JSONB columns are JSON strings.
  - Date in filename is today in the study timezone (`America/Vancouver`).

### POST /admin/backfill/legacy-weather
- **Auth:** RA required
- **Status:** implemented (T56)
- **Request body:** none
- **Response:**
  ```json
  {
    "days_backfilled": "integer",
    "days_skipped": "integer"
  }
  ```
- **Notes:**
  - For each study day that has imported session data (via `imported_session_measures`) but no existing `weather_daily` row for station 3510, inserts a partial row with only `current_temp_c` and `current_precip_today_mm` (means across all imported sessions for that day). All other weather fields remain null.
  - Writes one `weather_ingest_runs` audit row per backfilled day with `parser_version="legacy-import-v1"` and `requested_via="legacy_backfill"`.
  - `days_skipped` counts dates that already had a `weather_daily` row — those are never touched.
  - Idempotent: safe to call multiple times.
- **Verified:** 2026-03-01 — backfilled 109 days from reference XLSX data; second call returned `days_backfilled=0, days_skipped=109`.

---

### GET /admin/export.zip
- **Auth:** RA required
- **Status:** implemented (T49)
- **Response:** ZIP download containing one CSV per DB table
- **Headers:**
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="Weather and wellness - YYYY-MM-DD.zip"`
- **Notes:**
  - ZIP contains 12 CSVs: `participants.csv`, `sessions.csv`, `survey_uls8.csv`, `survey_cesd10.csv`, `survey_gad7.csv`, `survey_cogfunc8a.csv`, `digitspan_runs.csv`, `digitspan_trials.csv`, `study_days.csv`, `weather_ingest_runs.csv`, `weather_daily.csv`, `imported_session_measures.csv`.
  - Each CSV has a header row and is schema-faithful with all join keys.
  - All values follow the same conversion rules as the XLSX export.

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
