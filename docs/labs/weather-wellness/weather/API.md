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
| Production  | `https://backend-production-5809.up.railway.app` |

---

## Authentication

- **RA endpoints:** `Authorization: Bearer <supabase-jwt>` required. JWT is validated by FastAPI; `role` and `lab_name` are extracted from `app_metadata`.
- **Admin endpoints:** Same JWT requirement, plus `role == 'admin'`; non-admin JWTs return HTTP 403.
- **Participant endpoints:** No auth. Validated by `session_id` existence + `status == "active"`.
- **Roles:** `admin` (full access) and `ra` (RA; dashboard access only). Lab membership is tracked via `lab_name` (e.g. `ww` for Weather-Wellness + Misokinesia). Default role when `app_metadata` is absent: `ra`.

## Trial Run Mode (No-write Rehearsal)

- WW and Misokinesia expose separate "Run Short Trial" and "Run Full Trial" controls for RA-facing rehearsal.
- Canonical trial-mode behavior (fake ID format, consent rules, and module boundaries) is documented in `docs/TRIAL_MODE.md`.
- In trial mode, frontend uses fake ids and local simulated submit success transitions.
- WW trial mode is frontend-only and must not call `/sessions/start`, survey submit endpoints, `/digitspan/runs`, `/stroop/runs`, `/card-sorting/runs`, or session-complete writes.
- Misokinesia trial mode may call read-only clip-manifest endpoints, but must not call `/misokinesia/start`, `/misokinesia/participants/{id}/responses`, `/misokinesia/participants/{id}/mkaq`, `/misokinesia/participants/{id}/gad7`, `/misokinesia/participants/{id}/maq`, or `/misokinesia/participants/{id}/end-of-task`.
- The `Trial Run` watermark is shown on WW participant pages only and must be excluded from `/misokinesia/[id]` even when `TRIAL_RUN_MODE` is active.
- Two misokinesia trial modes exist: **Short Trial** (5 clips, MkAQ/MAQ q1–q10 only) and **Full Trial** (all clips, all items). Both present all three post-video surveys in a locally generated randomised order. Neither writes any rows. This does not change production storage or scoring contracts.
- Trial mode must not create or update database rows.

---

## Routing Surfaces

- This document is the canonical reference for **FastAPI endpoints on the Railway backend** only.
- Same-origin Next.js Route Handlers under `/api/ra/*` are a separate routing layer on Vercel. Their topology and cache behavior are documented in `docs/ARCHITECTURE.md`.
- The single dashboard routing inventory and deprecation map lives in `docs/ARCHITECTURE.md` under `Canonical Dashboard Routing Inventory`.
- Archived reliability fix playbook: `docs/ROUTING_CLEANUP.md` (historical context only, not an active task board). Current canonical behavior is documented in `docs/ARCHITECTURE.md` and this API reference.
- Frontend topology regressions are guarded by `frontend/src/app/api/ra/route-topology.test.ts`; do not reintroduce removed paths such as `/api/ra/dashboard/range` without first updating the routing inventory and regression coverage.
- Current dashboard-related same-origin Route Handlers are:
  - `GET /api/ra/dashboard/study-window` — latest study-day metadata for dashboard range anchoring
  - `GET /api/ra/dashboard?mode=cached|live` — cached/live weather bundle for default dashboard reads
  - `GET /api/ra/weather/range?mode=cached|live&date_from&date_to` — cached/live weather chart bundle
  - `GET /api/ra/dashboard/analytics?mode=snapshot|live&date_from&date_to` — snapshot/live analytics bundle
- Base URLs in the next section apply to the FastAPI backend only; they do not describe same-origin Vercel Route Handlers.

---

## Endpoint Index

| Method | Path | Auth | Status | Implemented by |
|--------|------|------|--------|----------------|
| GET    | /dashboard/study-window | RA | implemented | T121 |
| GET    | /dashboard/analytics | RA | implemented | T88 |
| POST   | /chat | RA | implemented | T1818 |
| POST   | /participants | RA | implemented | T07 |
| GET    | /participants | RA | implemented | T07 |
| GET    | /participants/{uuid} | RA | implemented | T07 |
| GET    | /sessions | RA | implemented | T21 |
| POST   | /sessions | RA | implemented | T08 |
| POST   | /sessions/start | RA | implemented | T36, T51a |
| GET    | /sessions/last-native | RA | implemented | T97 |
| DELETE | /sessions/last-native | RA | implemented | T97 |
| GET    | /sessions/{session_id} | None | implemented | T08 |
| GET    | /sessions/{session_id}/cognitive-battery | None (active session) | implemented | T207 |
| PATCH  | /sessions/{session_id}/status | RA (created/active), None (complete) | implemented | T08 |
| POST   | /digitspan/runs | None (active session) | implemented | T09 |
| POST   | /stroop/runs | None (active session) | implemented | T208 |
| POST   | /card-sorting/runs | None (active session) | implemented | T209 |
| POST   | /surveys/uls8 | None (active session) | implemented | T10 |
| POST   | /surveys/cesd10 | None (active session) | implemented | T10 |
| POST   | /surveys/gad7 | None (active session) | implemented | T10 |
| POST   | /surveys/cogfunc8a | None (active session) | implemented | T10 |
| POST   | /weather/ingest/ubc-eos | RA or shared secret | implemented | T30 |
| GET    | /weather/daily | RA | implemented | T31 |
| POST   | /weather/backfill/historical | RA | implemented | T66 |
| POST   | /admin/import/preview | Admin | implemented | T48, T100 |
| POST   | /admin/import/commit | Admin | implemented | T48, T55, T100 |
| GET    | /admin/export.xlsx | Admin | implemented | T49, T100 |
| GET    | /admin/export.zip | Admin | implemented | T49, T100 |
| POST   | /admin/backfill/legacy-weather | Admin | implemented | T56, T100 |
| GET    | /admin/users | Admin | implemented | T153 |
| POST   | /admin/users/invitations | Admin | implemented | T153 |
| POST   | /admin/users/invitations/{invitation_id}/resend | Admin | implemented | T153 |
| POST   | /admin/users/invitations/{invitation_id}/revoke | Admin | implemented | T153 |
| PATCH  | /admin/users/{user_id} | Admin | implemented | T153 |
| POST   | /admin/users/{user_id}/revoke-access | Admin | implemented | T153 |
| POST   | /auth/invitations/accept | None (invite token) | implemented | T153 |
| POST   | /misokinesia/start | RA | implemented | T106 |
| GET    | /misokinesia/trial-manifest | RA | implemented | T143 |
| POST   | /misokinesia/participants/{participant_id}/responses | None | implemented | T107 |
| POST   | /misokinesia/participants/{participant_id}/mkaq | None | implemented | T146 |
| POST   | /misokinesia/participants/{participant_id}/gad7 | None | implemented | T169 |
| POST   | /misokinesia/participants/{participant_id}/maq | None | implemented | T169 |
| PATCH  | /misokinesia/participants/{participant_id}/end-of-task | None | implemented | T107 |

---

## Dashboard

> The dashboard router serves analytics plus the study-window metadata read.
> Shipped operational dashboard reads still use the weather router primitive
> documented under `GET /weather/daily`.
> Statistical dashboard KPIs derived from `reference/Weather_MLM.R` are defined
> in `docs/labs/weather-wellness/weather/ANALYTICS.md`.

## RA Data Chatbot

> Platform boundary: `docs/AI_CHAT.md`. Same-origin topology:
> `docs/ARCHITECTURE.md`.

### POST /chat
- **Auth:** RA required
- **Status:** implemented (T1818; authenticated no-op route, data tools not attached)
- **Classification:** internal-only backend chat coordinator
- **Current same-origin caller:** planned `POST /api/ra/chat`
- **Purpose:** Accept authenticated RA chat requests through the backend
  coordinator. Until approved read-only data tools are attached, the route
  returns a typed unavailable response and does not query lab data or call an
  ungrounded data assistant.
- **Request:** `RAChatRequest`

```json
{
  "message": "Summarize anxiety scores for March and format it like a short report.",
  "conversation_id": "uuid | null",
  "history": [
    {
      "role": "user | assistant",
      "content": "prior message text"
    }
  ],
  "scope": {
    "date_from": "YYYY-MM-DD | null",
    "date_to": "YYYY-MM-DD | null",
    "study_slug": "string | null"
  }
}
```

- **Validation:**
  - Request bodies reject unknown fields such as raw `sql` or `table_names`.
  - `message` is required, trimmed, and capped at 2,000 characters.
  - `history` is capped at 20 prior turns; each prior turn is capped at 4,000
    characters and must use `role="user"` or `role="assistant"`.
  - `scope.date_from` must not be after `scope.date_to`.
  - `scope.study_slug` accepts lowercase slugs only (`a-z`, `0-9`, `-`) and is
    capped at 64 characters.

- **Response:** `RAChatResponse`

```json
{
  "conversation_id": "uuid",
  "message": "formatted assistant response text",
  "model": "configured-openrouter-model | tool-unavailable",
  "tool_results": [
    {
      "tool_name": "dashboard_analytics_summary",
      "summary": "short user-safe description of the scoped data used"
    }
  ],
  "blocked_reason": "string | null"
}
```

- **Allowed data tools:**
  - dashboard analytics summaries for bounded date ranges
  - study-window and session-count summaries
  - anonymous participant/session lookup by participant number or bounded filters
  - survey and digit span score summaries
  - weather/study-day summaries
  - report formatter over already retrieved scoped results
  - privacy-preserving public web research search/fetch for literature-backed
    context, source links, and citations
- **Behavior:**
  - Validates the JWT with `get_current_lab_member` and uses the resolved
    `role` and `lab_name` for every data tool.
  - Does not expose database credentials, Supabase service keys, raw JWTs, or
    direct SQL execution to OpenRouter.
  - Does not accept arbitrary SQL or raw table-name instructions; those requests
    return `blocked_reason="disallowed_data_access_request"`.
  - Until approved data tools are attached, returns
    `blocked_reason="data_tools_unavailable"`, `model="tool-unavailable"`, and
    an empty `tool_results` array.
  - Sends only bounded scoped tool results to OpenRouter.
  - Does not send participant rows, participant/session identifiers, private
    lab-sensitive content, credentials, JWTs, or raw database output to public
    web search providers.
  - Allows aggregate/statistical summaries and anonymous participant/session
    rows when scoped to the user's lab.
  - May produce opinions, interpretations, recommendations, and clean
    report-style on-screen text when grounded in scoped backend results,
    documented scoring/analysis rules, or cited public research sources.
  - Does not write data, start sessions, import files, create downloadable
    exports, or return unbounded table dumps.
  - Returns a user-safe unavailable response when required OpenRouter privacy
    controls or provider routing constraints cannot be satisfied.

### GET /dashboard/study-window
- **Auth:** RA required
- **Status:** implemented (T121)
- **Classification:** internal-only backend metadata primitive
- **Current same-origin caller:** `GET /api/ra/dashboard/study-window`
- **Purpose:** Return the latest available `study_days.date_local` so the dashboard can anchor range presets to actual study activity instead of wall-clock today.
- **Response:** `LatestStudyDayResponse`

```json
{
  "latest_study_day": "YYYY-MM-DD | null"
}
```

- **Behavior:**
  - Returns the maximum available `study_days.date_local` when at least one row exists.
  - Returns `null` when no `study_days` rows exist yet.
  - The dashboard page reads this metadata once on mount and uses it to anchor `WeatherUnifiedCard` preset end dates and custom max-date limits; weather interactions no longer drive analytics range changes.

---

### GET /dashboard/analytics
- **Auth:** RA required
- **Status:** implemented (T88)
- **Classification:** internal-only backend primitive
- **Current same-origin caller:** `GET /api/ra/dashboard/analytics?mode=snapshot|live&date_from&date_to`
- **Canonical spec:** `docs/labs/weather-wellness/weather/ANALYTICS.md`
- **Purpose:** Return model-based dashboard KPIs computed from the backend DB rather than hard-coded statistical outputs.
- **Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `date_from` | date `YYYY-MM-DD` | Inclusive local start date (`America/Vancouver`) |
| `date_to` | date `YYYY-MM-DD` | Inclusive local end date (`America/Vancouver`) |
| `mode` | string | `snapshot` (default) or `live` |

- **Response:** `DashboardAnalyticsResponse`

```json
{
  "status": "ready | stale | recomputing | insufficient_data | failed",
  "response_version": "dashboard-analytics-v2",
  "snapshot": {
    "mode": "snapshot | live",
    "response_version": "dashboard-analytics-v2",
    "model_version": "weather-mlm-v2",
    "generated_at": "datetime",
    "is_stale": "boolean",
    "recompute_started_at": "datetime | null",
    "recompute_finished_at": "datetime | null"
  },
  "dataset": {
    "date_from": "YYYY-MM-DD",
    "date_to": "YYYY-MM-DD",
    "included_sessions": "integer",
    "included_days": "integer",
    "native_rows": "integer",
    "imported_rows": "integer",
    "excluded_rows": "integer",
    "exclusion_reasons": [
      {
        "reason": "string",
        "count": "integer"
      }
    ],
    "generated_at": "datetime"
  },
  "models": [
    {
      "outcome": "digit_span | self_report",
      "formula": "string",
      "grouping_field": "date_bin",
      "sample_size": "integer",
      "day_count": "integer",
      "converged": "boolean",
      "warnings": ["string"],
      "model_version": "weather-mlm-v2",
      "generated_at": "datetime",
      "effects": [
        {
          "term": "string",
          "predictor": "string",
          "is_interaction": "boolean",
          "coefficient": "number",
          "standard_error": "number",
          "statistic": "number",
          "p_value": "number",
          "ci_95_low": "number",
          "ci_95_high": "number",
          "direction": "positive | negative | neutral",
          "significant": "boolean"
        }
      ]
    }
  ],
  "temperature_summary": {
    "windows": [
      {
        "window_key": "overall | fall_winter | spring_summer",
        "date_from": "YYYY-MM-DD | null",
        "date_to": "YYYY-MM-DD | null",
        "day_count": "integer",
        "participant_count": "integer",
        "mean_temperature_c": "number | null",
        "sd_temperature_c": "number | null",
        "cold_threshold_temperature_c": "number | null",
        "hot_threshold_temperature_c": "number | null",
        "threshold_method": "\"window_day_zscore_v1\"",
        "threshold_z_cutoff": "number",
        "frequency_bins": [
          {
            "bin_start_c": "number",
            "bin_end_c": "number",
            "day_count": "integer"
          }
        ],
        "cold_group": {
          "day_count": "integer",
          "participant_count": "integer",
          "participant_ids": ["string"],
          "dates": ["YYYY-MM-DD"],
          "days": [
            {
              "date_local": "YYYY-MM-DD",
              "temperature_c": "number",
              "temperature_z": "number",
              "participant_ids": ["string"],
              "participant_count": "integer"
            }
          ]
        },
        "hot_group": {
          "day_count": "integer",
          "participant_count": "integer",
          "participant_ids": ["string"],
          "dates": ["YYYY-MM-DD"],
          "days": [
            {
              "date_local": "YYYY-MM-DD",
              "temperature_c": "number",
              "temperature_z": "number",
              "participant_ids": ["string"],
              "participant_count": "integer"
            }
          ]
        }
      }
    ]
  },
  "visualizations": "object | null"
}
```

- **Response sections:**
  - `status` for snapshot/recompute state
  - `response_version` and `snapshot` freshness/version metadata
  - `dataset` metadata (included sessions/days, native/imported counts, generation time)
  - `models[]` for outcome-level mixed-model summaries
  - `models[].effects[]` for model-card terms (coefficient, standard error, p-value, 95% CI, direction, significance)
  - `temperature_summary.windows[]` for day-level temperature frequency bins plus `hot` / `cold` groups over the requested range and seasonal subsets
  - `visualizations.effect_plots[]` for separate linked analysis charts
  - `visualizations.weather_annotations` for lightweight date-based metadata only
- **Notes:**
  - This endpoint surfaces the mixed-effects analysis derived from `reference/Weather_MLM.R` using the backend dataset/modeling/snapshot pipeline implemented in T83–T88.
  - The v2 analytics contract changes weather standardization semantics: `temperature`, `precipitation`, and `daylight_hours` are standardized across unique `date_local` values in the complete-case model sample, then mapped back to participant rows for mixed-model fitting.
  - Participant-level predictors and outcomes (`anxiety`, `depression`, `loneliness`, `self_report`, `digit_span_score`) remain standardized across participant rows in the complete-case model sample.
  - `temperature_summary` is descriptive and day-level. It does not alter the model formulas or the participant-row sample used by the mixed models.
  - The three temperature-summary windows are `overall` (requested range), `fall_winter` (`Sep 22` through `Mar 21`, inclusive), and `spring_summer` (`Mar 22` through `Sep 21`, inclusive), with the seasonal windows clipped to the requested range.
  - `hot_group` means `temperature_z > 2`; `cold_group` means `temperature_z < -2`; both are computed within each summary window from unique daily temperatures only.
  - `cold_threshold_temperature_c` and `hot_threshold_temperature_c` are the descriptive temperature cutoffs implied by the same window-specific day-level z-score rule: `mean_temperature_c ± (2 * sd_temperature_c)`.
  - `threshold_method="window_day_zscore_v1"` and `threshold_z_cutoff=2` document that the displayed threshold overlay is descriptive only and matches the current extreme-day grouping rule.
  - Threshold temperatures are `null` when a window has fewer than 2 unique study days or zero day-level temperature variance.
  - Date bounds are validated as inclusive study-local days in `America/Vancouver`; `date_from > date_to` returns `422`.
  - `mode=snapshot` reads the durable Postgres snapshot for the exact requested range and returns `404` when no snapshot exists yet. The shipped dashboard treats that `404` as a snapshot-miss empty state and does not auto-trigger `mode=live`.
  - `mode=live` now requests a background recompute and returns immediately with the current typed analytics payload for the range. When a prior snapshot exists, the payload will typically be `status="recomputing"` with the last successful snapshot kept visible until the background run finishes.
  - The shipped dashboard uses `mode=live` only for explicit RA actions such as manual analytics refresh.
  - Live recompute calls are tagged with the authenticated LabMember UUID in `analytics_runs.triggered_by_lab_member_id`.
  - The dashboard anchor date comes from `latest_study_day = MAX(study_days.date_local)`. After historical weather backfill this can extend beyond the latest completed participant session date; in that case the selected analytics window may end later than the effective MLM sample, and the models still fit only the participant rows that actually exist in the requested range.
  - Existing scoring logic and stored score semantics remain unchanged.
  - RC08 added partial `sessions` indexes for the canonical analytics dataset source query and rewrote that source query to select candidate complete sessions via unioned `study_days.date_local` and `sessions.completed_at` range paths instead of a single cross-table `OR`.
  - Query-plan verification on 2026-03-13 confirmed the `completed_at` range branch uses `ix_sessions_complete_completed_at`; the `study_day` branch continues to use `uq_study_days_date_local` and is currently a justified sequential scan on `sessions` because the live table is still very small.
  - **T92 (implemented):** `visualizations` is now populated on `ready` responses. `visualizations.effect_plots[]` contains partial-residual plots for all non-interaction main effect terms (temperature, precipitation, daylight, depression, loneliness, anxiety) for each fitted outcome. `visualizations.weather_annotations` is always date-range metadata only and must not be used to draw predictor-vs-residual lines on the weather chart.
  - `visualizations.default_selected_term` is the first main effect term present in the fitted models (typically `temperature_z`).
  - Effect plot `points[]` carry `x` (predictor z-score), `y` (partial residual = model residual + term contribution), and `date_local` for optional annotation linkage. `fitted_line[]` carries `x`/`y` points spanning the predictor range at `coef * x`.
  - Snapshot persistence stores the full visualization payload including effect plots and weather annotations.
  - Shared analytics version/config constants now use `ANALYTICS_RESPONSE_VERSION="dashboard-analytics-v2"` and `ANALYTICS_MODEL_VERSION="weather-mlm-v2"` so old snapshots and same-origin caches are not reused.
  - `temperature_summary` is a day-level descriptive payload populated by the backend summary engine and preserved through snapshot/live responses.
  - The planned standalone temperature-summary chart is a single Highcharts histogram for the active summary window, with mean and threshold overlays drawn from these temperature-summary fields rather than from the mixed-model visualization payload.
  - Planned next extension: each `temperature_summary.windows[].frequency_bins[]` item will add `participant_sessions[]` entries carrying `participant_uuid`, RA-facing `participant_number`, `session_id`, and `date_local` so the histogram can drive participant-session hover drilldown without changing the existing day-count bin semantics.
  - Planned next extension: the RA dashboard will use a same-origin participant read wrapper to fetch demographics for a clicked participant and render them in a pinned side panel next to the histogram. The first version is demographics-only and does not include test timing or score detail.
  - The shipped dashboard keeps weather and analytics filter state independent and does not depend on `visualizations.weather_annotations` for weather-chart overlays, even though the field remains serialized for compatibility.
  - Browser-owned reads should use the same-origin analytics handler documented in `docs/ARCHITECTURE.md`; do not add direct component calls to this backend endpoint.

**Verified same-origin dashboard metadata route:**
- `GET /api/ra/dashboard/study-window` is a same-origin RA-only metadata read used only to anchor dashboard preset ranges.
- Response shape:
  ```json
  {
    "latest_study_day": "YYYY-MM-DD | null"
  }
  ```
- `latest_study_day` reflects the maximum available `study_days.date_local` for the current lab/study scope.
- If no `study_days` rows exist yet, it returns `null`.

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
- **Admin safety feature (T97, implemented):** `GET /sessions/last-native` previews the undo candidate; `DELETE /sessions/last-native` removes the most recently created native session only.

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

### GET /sessions/last-native
- **Auth:** RA required
- **Status:** implemented (T97)
- **Purpose:** Return metadata for the most recently created native session (undo candidate preview).
- **Response:**
  ```json
  {
    "session_id": "uuid",
    "participant_uuid": "uuid",
    "participant_number": "integer",
    "status": "created | active | complete",
    "created_at": "datetime"
  }
  ```
- **Notes:** Returns 404 when no eligible native session exists. Imported legacy sessions are never returned.

---

### DELETE /sessions/last-native
- **Auth:** RA required
- **Status:** implemented (T97)
- **Purpose:** Undo the most recently created native session for supervised-lab correction/testing cleanup.
- **Request body:**
  ```json
  {
    "confirm": true,
    "reason": "string"
  }
  ```
- **Response:**
  ```json
  {
    "deleted_session_id": "uuid",
    "deleted_participant_uuid": "uuid",
    "deleted_participant_number": "integer",
    "session_status_at_delete": "created | active | complete",
    "participant_deleted": "boolean"
  }
  ```
- **Rules:**
  - Deletes only the most recently created **native** session in the database.
  - Imported legacy sessions are never eligible.
  - If a newer session exists, older sessions cannot be deleted through this endpoint.
  - Deletes related survey rows, digit span rows, and the session row transactionally.
  - Deletes the participant row only if that participant has no other sessions.
  - Never deletes or mutates `weather_daily` / `weather_ingest_runs`.
  - Always writes an append-only admin audit row with who deleted the session and why.
- **Notes:**
  - This is intentionally narrower than a generic delete-session API.
  - This endpoint is meant for supervised correction / pipeline testing cleanup, not historical data management.

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
  - `POST /sessions/start` stores a per-session randomized `cognitive_task_order` containing exactly `digitspan`, `stroop`, and `card_sorting`, plus the hidden `card_sorting_rule_order`.
  - The hidden card sorting rule order always starts with `color`, contains `color`, `shape`, and `number` twice each, avoids adjacent duplicate dimensions, and excludes the predictable `color -> shape -> number -> color -> shape -> number` sequence.
  - No consent record is stored in Supabase (UI-only gating).
  - Demographics are stored on `participants` only (never on `sessions`).
  - Trial mode bypasses this endpoint entirely.

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
  - Trial mode bypasses this endpoint and performs no server-side scoring/write.
  - Cognitive-battery routing (T210, implemented): after the run is accepted, the frontend reads the stored per-session order from `GET /sessions/{session_id}/cognitive-battery` and routes to the next task in that order via the helpers in `frontend/src/lib/trial-mode.ts` (`nextCognitiveTaskPath`, `isLastCognitiveTask`). Digit Span no longer always marks the session complete; it only `PATCH`es `/sessions/{id}/status` to `complete` when it is the final task in the assigned order. CogFunc routes to the manifest's first task (`firstCognitiveTaskPath`) rather than hardcoding Digit Span. Trial mode generates and persists an equivalent local order (`getOrCreateTrialCognitiveTaskOrder`) and performs no backend writes.

---

## Cognitive Battery Manifest

### GET /sessions/{session_id}/cognitive-battery
- **Auth:** None (active session validated)
- **Status:** implemented (T207)
- **Purpose:** Return the stored cognitive task order and task manifest data needed for the post-survey battery.
- **Response:**
  ```json
  {
    "session_id": "uuid",
    "task_order": ["stroop", "digitspan", "card_sorting"],
    "card_sorting_rule_order": ["color", "number", "shape", "color", "shape", "number"]
  }
  ```
- **Notes:** Returns `404` for unknown sessions and `409` unless the session is currently `active` with a valid stored manifest.
  - The card sorting rule order is hidden task state. It may be needed by the client to provide immediate correct/incorrect feedback, but it must never be displayed in participant-facing UI.
  - The task order is assigned once at `POST /sessions/start` and remains stable across refreshes and task transitions.

---

## Stroop

Canonical task spec: [STROOP.md](STROOP.md)

### POST /stroop/runs
- **Auth:** None (active session validated)
- **Status:** implemented (T208)
- **Request body:**
  ```json
  {
    "session_id": "uuid",
    "trials": [
      {
        "trial_number": 1,
        "condition": "congruent",
        "word": "RED",
        "ink_color": "red",
        "response_key": "r",
        "response_color": "red",
        "reaction_time_ms": 742,
        "timed_out": false
      }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "run_id": "uuid",
    "total_trials": 80,
    "correct_trials": 72,
    "error_trials": 6,
    "timeout_trials": 2,
    "overall_accuracy": 0.9,
    "congruent_accuracy": 0.95,
    "incongruent_accuracy": 0.85,
    "mean_rt_congruent_ms": 650,
    "mean_rt_incongruent_ms": 780,
    "stroop_interference_ms": 130
  }
  ```
- **Notes:** Backend recomputes correctness and all summary metrics before persistence (`app/scoring/stroop.py`); the client-submitted `correct` field is never trusted. T206 added the `stroop_runs` and `stroop_trials` persistence tables and T208 implemented the router/scoring layer. A trial is scored correct only when it did not time out and its normalized (trimmed, lowercased) `response_color` equals the normalized `ink_color`. Condition RT means are computed over correct, non-timeout trials only; `stroop_interference_ms` is null whenever either condition mean is null. Errors: `404` (session not found), `409` (session not active, or a Stroop run already exists for the session), `422` (invalid trial payload — unknown `condition`, duplicate `trial_number`, a non-timeout trial missing `response_color`, or a timed-out trial carrying `reaction_time_ms`). Trial mode bypasses this endpoint and performs no server-side scoring/write.
- **Frontend (T211):** The participant page `frontend/src/app/session/[session_id]/stroop/page.tsx` captures raw client-side RT and trial data and submits via the typed `apiPost<StroopRunResponse>("/stroop/runs", …)` wrapper (`StroopRunResponse` in `frontend/src/lib/api/index.ts`). Production runs 80 balanced scored trials; trial mode runs 12 and performs a local simulated submit. See [STROOP.md](STROOP.md) for the full UI flow.

---

## Card Sorting

Canonical task spec: [CARD_SORTING.md](CARD_SORTING.md)

### POST /card-sorting/runs
- **Auth:** None (active session validated)
- **Status:** implemented (T209)
- **Request body:**
  ```json
  {
    "session_id": "uuid",
    "trials": [
      {
        "trial_number": 1,
        "card_color": "red",
        "card_shape": "triangle",
        "card_number": 2,
        "selected_reference_index": 3,
        "reaction_time_ms": 2310
      }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "run_id": "uuid",
    "total_trials": 64,
    "categories_completed": 4,
    "total_correct": 45,
    "total_errors": 19,
    "perseverative_responses": 7,
    "perseverative_errors": 6,
    "nonperseverative_errors": 13,
    "trials_to_first_category": 14,
    "failure_to_maintain_set_count": 1
  }
  ```
- **Notes:** Backend reads the stored hidden `card_sorting_rule_order` for the session and recomputes correctness, streaks, category shifts, and all summary metrics before persistence (`app/scoring/card_sorting.py`); the client choice is never trusted for correctness. T206 added the `card_sorting_runs` and `card_sorting_trials` persistence tables; T209 implemented the router/scoring layer.
  - **Reference cards (fixed):** index `1 = red/triangle/1`, `2 = green/star/2`, `3 = yellow/cross/3`, `4 = blue/circle/4`. Each dimension value maps to exactly one reference index, so the response card's value on the active rule dimension determines the single correct `selected_reference_index`. A trial is correct when `selected_reference_index` equals that index.
  - **Shift behavior:** the active rule advances to the next `card_sorting_rule_order` entry on the trial after exactly 10 consecutive correct responses; a single error resets the streak to 0. After the sixth category the final rule stays active through card 64 and `categories_completed` stays capped at 6. The task never stops before card 64.
  - **Perseverative scoring:** a response is perseverative when it matches the previous (pre-shift) rule's correct reference while the previous rule differs from the now-active rule; a perseverative response that is incorrect under the active rule is a `perseverative_error`. `nonperseverative_errors` are incorrect responses that are not perseverative. `failure_to_maintain_set_count` increments on an error made after 5–9 consecutive correct responses.
  - **Errors:** `404` (session not found), `409` (session not active, no stored rule order, or a card sorting run already exists for the session), `422` (a card attribute value is not one of the four reference cards, or the stored rule order contains an unknown dimension). Pydantic enforces 1–64 trials, `trial_number` 1–64, and `selected_reference_index` 1–4.
  - Trial mode bypasses this endpoint and performs no server-side scoring/write.
- **Frontend (T212):** The participant page `frontend/src/app/session/[session_id]/card_sorting/page.tsx` presents instructions, the four fixed reference cards, one response card at a time, immediate correct/incorrect feedback, and the 64-card production flow. It captures card attributes, the selected reference index, client-side reaction time, and trial number, then submits via the typed `submitCardSortingRun(sessionId, trials)` wrapper (`CardSortingRunResponse` / `CardSortingTrialInput` in `frontend/src/lib/api/index.ts`). The page reads the hidden `card_sorting_rule_order` from `GET /sessions/{session_id}/cognitive-battery` only to drive immediate feedback and never displays the active rule, rule order, streak count, categories completed, or any recurring-pattern hint. Production runs 64 scored cards; trial mode runs a shortened 8-card set with a local simulated submit (no `/card-sorting/runs` call) and routes to the next battery task via `nextCognitiveTaskPath`. The participant route segment is `card_sorting` (underscore), matching `cognitiveTaskRouteSegment`. See [CARD_SORTING.md](CARD_SORTING.md) for the full UI flow.

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
- **Request body:** `{ "session_id": "uuid", "r1"–"r10": 1–4 each }`
- **Response:** `{ "response_id": "uuid", "total_score": integer }`

---

### POST /surveys/gad7
- **Auth:** None (active session validated)
- **Status:** implemented (T10)
- **Request body:** `{ "session_id": "uuid", "r1"–"r7": 1–4 each }`
- **Response:** `{ "response_id": "uuid", "total_score": integer, "severity_band": "string" }`

---

### POST /surveys/cogfunc8a
- **Auth:** None (active session validated)
- **Status:** implemented (T10)
- **Request body:** `{ "session_id": "uuid", "r1"–"r8": 1–5 each }`
- **Response:** `{ "response_id": "uuid", "total_sum": integer, "mean_score": "decimal" }`

> Trial mode note for surveys: all four survey submit endpoints are bypassed during WW Short Trial and Full Trial; routing advances via local simulated success only.

---

## Weather

> Canonical feature spec: `docs/labs/weather-wellness/weather/WEATHER_INGESTION.md`

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
- **Classification:** internal-only backend primitive for dashboard/weather reads
- **Current same-origin callers:** `GET /api/ra/dashboard?mode=live`, `GET /api/ra/weather/range?mode=live&date_from&date_to`
- **Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `start` | date `YYYY-MM-DD` | — | Start local date (`America/Vancouver`) |
| `end` | date `YYYY-MM-DD` | — | End local date (`America/Vancouver`) |
| `station_id` | integer | 3510 | Station id (currently only 3510 supported) |
| `include_forecast_periods` | boolean | `true` | When `false`, returns an empty `forecast_periods` array for each day to reduce payload size |
| `include_latest_run` | boolean | `true` | When `false`, skips the latest-ingest metadata query to reduce read latency |

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
  - No fixed max range cap (supports multi-year study windows); very large ranges may be slower.
  - `items` ordered by `date_local` ASC. Empty array if no data for the range.
  - `latest_run` is the most recent ingest run for the station regardless of date range when `include_latest_run=true`; otherwise the response returns `latest_run: null`.
  - `latest_run.parse_status` values: `success | partial | fail`.
  - `date_local` is the analytic join key (study day in `America/Vancouver`). Metadata timestamps like `updated_at` / `current_observed_at` must not be used for day linking.
  - Router validation/auth stays in `backend/app/routers/weather.py`; the query/aggregation logic for this read path lives in `backend/app/services/weather_read_service.py`.
  - The default dashboard live bundle currently uses `include_forecast_periods=false`; the range-chart live path uses both `include_forecast_periods=false` and `include_latest_run=false`.
  - The same-origin callers and their canonical/transitional status are tracked in `docs/ARCHITECTURE.md`.
- **Phase 4 (T58, implemented):** `current_precip_today_mm` is now included in each `WeatherDailyItem` for dashboard graph tooltip use.
- **Verified:** 2026-02-26 — returned 1 item with `current_temp_c`, `forecast_periods`, and `latest_run` from live DB.

---

## Admin Data (Phase 3)

> These endpoints are admin-only and are intended for internal lab administration. They are not participant-facing.
> Imports must be preview-first (no writes on preview), then explicit commit.
>
> Authoritative legacy reference file: `reference/data_complete.xlsx` (single-sheet workbook).
> Historical predecessor: `reference/data_full_1-230.xlsx`.
> Expected header columns (exact, case-insensitive, whitespace-trimmed):
> `participant ID`, `date`, `age`, `gender`, `origin`, `commute_method`, `time_outside`, `precipitation`,
> `temperature`, `daytime`, `anxiety`, `loneliness`, `depression`, `digit_span_score`, `self_report`.

## Admin User Management (implemented, T153)

> Supabase Auth remains the login/session/JWT provider. These endpoints provide
> app-owned invite and user management on top of Supabase Auth. Admin endpoints
> require `role == 'admin'`; non-admin RAs receive 403. Invite acceptance is
> public but requires a valid app-owned invite token.

### GET /admin/users
- **Auth:** Admin required
- **Status:** implemented (T153)
- **Purpose:** Return Supabase Auth users relevant to RA/admin access plus pending/revoked/expired app-owned invitations.
- **Response:** `AdminUsersResponse`

```json
{
  "users": [
    {
      "id": "supabase-auth-user-id",
      "email": "admin@example.com",
      "role": "admin | ra",
      "lab_name": "ww",
      "is_banned": false,
      "created_at": "datetime string from Supabase Auth",
      "last_sign_in_at": "datetime string from Supabase Auth | null"
    }
  ],
  "invitations": [
    {
      "invitation_id": "uuid",
      "email": "ra@example.com",
      "role": "admin | ra",
      "lab_name": "ww",
      "status": "pending | accepted | revoked",
      "expires_at": "datetime",
      "accepted_at": "datetime | null",
      "revoked_at": "datetime | null",
      "revoked_by_lab_member_id": "uuid | null",
      "created_by_lab_member_id": "uuid",
      "supabase_user_id": "uuid | null",
      "last_sent_at": "datetime | null",
      "send_count": "integer",
      "provider_message_id": "string | null",
      "created_at": "datetime",
      "updated_at": "datetime"
    }
  ]
}
```

- **Behavior:**
  - Includes email, Supabase Auth user id, role, `lab_name`, confirmed/sign-in timestamps where available, access status, and current invitation state.
  - Does not expose service-role keys, invite token hashes, or raw invite tokens.
  - Returns 500 with a user-safe message if the Supabase Admin API environment is not configured.

### POST /admin/users/invitations
- **Auth:** Admin required
- **Status:** implemented (T153)
- **Purpose:** Create a 7-day app-owned invitation and send a custom invite email.
- **Request:** `CreateUserInvitationRequest`

```json
{
  "email": "ra@example.com",
  "role": "admin | ra",
  "lab_name": "ww"
}
```

- **Response:** `AdminInvitationResponse`; same shape as invitation entries in `GET /admin/users`.
- **Behavior:**
  - Stores only a hash of the invite token.
  - Sends email through the configured provider (`INVITE_EMAIL_PROVIDER`, default `resend`).
  - Email body content is rendered from `backend/app/services/email_templates/admin_invite.html` with `backend/app/services/email_templates/admin_invite.txt` as the plain-text fallback.
  - Invite URL format: `{SITE_URL}/set-password?invite=<token>`.
  - Returns 409 when an unexpired pending invite already exists for the same email.
  - Retires expired pending invites for the same email before creating a fresh pending invite.

### POST /admin/users/invitations/{invitation_id}/resend
- **Auth:** Admin required
- **Status:** implemented (T153)
- **Purpose:** Resend a custom invite email for a pending invitation.
- **Response:** `AdminInvitationResponse`.
- **Behavior:**
  - Does not resend revoked or accepted invites.
  - Rotates the raw token and token hash; previously sent links stop working.
  - Does not extend the original 7-day `expires_at`.
  - Updates `last_sent_at`, increments `send_count`, and stores the email provider message id when available.
  - Returns 404 for missing invitation ids and 409 for expired, accepted, or revoked invitations.

### POST /admin/users/invitations/{invitation_id}/revoke
- **Auth:** Admin required
- **Status:** implemented (T153)
- **Purpose:** Revoke a pending invitation before acceptance.
- **Response:** `AdminInvitationResponse`.
- **Behavior:** Sets `status="revoked"`, records `revoked_at` / `revoked_by_lab_member_id`, and prevents future acceptance.

### PATCH /admin/users/{user_id}
- **Auth:** Admin required
- **Status:** implemented (T153)
- **Purpose:** Edit an existing RA/admin user's role and lab assignment.
- **Request:** `UpdateAdminUserRequest`

```json
{
  "role": "admin | ra",
  "lab_name": "ww"
}
```

- **Response:** `AdminUserResponse`; same shape as user entries in `GET /admin/users`.
- **Behavior:**
  - Updates Supabase Auth `app_metadata.role` and `app_metadata.lab_name` via the service-role Admin API.
  - Does not accept arbitrary browser-provided metadata beyond `role` and `lab_name`.
  - Supabase Admin API failures return 502 with a user-safe message.

### POST /admin/users/{user_id}/revoke-access
- **Auth:** Admin required
- **Status:** implemented (T153)
- **Purpose:** Revoke user access without hard-deleting the Supabase Auth row.
- **Response:** `204 No Content` on success.
- **Behavior:**
  - UI "delete" maps to this access-revocation behavior.
  - Sets a long Supabase Auth ban through the service-role Admin API.
  - Returns 409 when revoking the target would remove the final active admin.
  - Hard deletion of `auth.users` is outside normal admin UI behavior.

### POST /auth/invitations/accept
- **Auth:** None; valid invite token required
- **Status:** implemented (T153)
- **Purpose:** Accept an app-owned invitation and activate the Supabase Auth account.
- **Request:** `AcceptInvitationRequest`

```json
{
  "token": "raw invite token from email link",
  "password": "new Supabase Auth password"
}
```

- **Response:** `AcceptInvitationResponse`

```json
{
  "email": "ra@example.com",
  "role": "admin | ra",
  "lab_name": "ww",
  "supabase_user_id": "uuid",
  "status": "accepted"
}
```

- **Behavior:**
  - Rejects missing or malformed request bodies with 422.
  - Rejects invalid tokens with 404, expired tokens with 410, and revoked/accepted tokens with 409.
  - Creates or updates the Supabase Auth user via service-role Admin API.
  - Sets `app_metadata.role` and `app_metadata.lab_name`.
  - Marks the invitation accepted and links `supabase_user_id`.
  - Directs the frontend to sign in normally after activation.
  - Frontend `/set-password?invite=<token>` calls this endpoint through the typed `acceptInvitation` wrapper; it no longer depends on Supabase invite hash sessions for app-owned invites.
  - Frontend maps 404/422, 410, 409, and 502 responses to user-safe invalid, expired, already accepted/revoked, and activation-failure states.
- **Verified:** T154 frontend wiring confirmed `/set-password?invite=<token>` submits the backend accept contract and then returns users to normal login.

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
    - `commute_method` may also be supplied as `commute`; both map to the same participant field.
    - String demographic fields are whitespace-trimmed and normalized to a canonical label set where obvious variants exist
      (e.g. `"Man "` → `"Man"`, `"Nonbinary person"` → `"Non-binary"`).
    - If `origin` / `commute_method` is an “Other” category and includes a free-text detail, store it in `origin_other_text` / `commute_method_other_text` (length-limited; avoid PII).
    - All numeric measures (`precipitation`, `temperature`, `anxiety`, `loneliness`, `depression`, `self_report`) parse as floats; blanks become nulls.
      - Note: `anxiety`, `loneliness`, `depression`, and `self_report` are legacy aggregate scores, not raw item-level responses.
      - `anxiety`, `loneliness`, and `depression` are derived participant-level means after instrument-specific reverse scoring / conversions have been applied where needed.
      - `self_report` is the legacy imported aggregate for the remaining survey measure, CogFunc / PROMIS Cognitive Function 8a.
    - `digit_span_score` parses as integer; blank becomes null.
      - Note: legacy `digit_span_score` is a legacy Digit Span score derived by tallying correct responses until the participant records two incorrect trials at the same span length.
      - The import stores this legacy score in `digitspan_runs.total_correct` and leaves `max_span` null because trial-level reconstruction is not possible from the workbook alone.
  - Storage mapping (commit):
    - Participant demographics are stored on `participants` (nullable columns planned in T47).
    - Imported aggregates are stored in `imported_session_measures` (applied in T47) with a full `source_row_json` audit payload.
    - Workbook-only fields that are not part of the transactional import contract
      (for example `day`, `daylight`, `age_simple`, `*_z`, `month`, `season_bin`)
      are preserved in `imported_session_measures.supplemental_attributes_json`
      when present. They are stored for reference only and do not change current analytics behavior.

**Phase 4 (T55, implemented):** commit also upserts “imported” rows into:
- `digitspan_runs` — `data_source='imported'`, `total_correct` = legacy `digit_span_score`; `max_span` remains null; no trials reconstructed. This imported value is a legacy workbook score, not a native fixed-protocol `max_span`.
- `survey_uls8` — `data_source='imported'`, `legacy_mean_1_4` = legacy `loneliness` derived mean; raw `r*` and computed columns remain null.
- `survey_cesd10` — `data_source='imported'`, `legacy_mean_1_4` = legacy `depression` derived mean; raw `r*` and computed columns remain null.
- `survey_gad7` — `data_source='imported'`, `legacy_mean_1_4` = legacy `anxiety` derived mean; if anxiety is an exact integer 0–21, `total_score` and `severity_band` are also set; otherwise only `legacy_mean_1_4` is stored.
- `survey_cogfunc8a` — `data_source='imported'`, `legacy_mean_1_5` = legacy `self_report` aggregate; raw `r*` and PROMIS computed columns remain null.
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
- **Status:** implemented (T49, updated T79)
- **Response:** XLSX workbook download — README sheet + one sheet per DB table
- **Headers:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="Weather and wellness - YYYY-MM-DD.xlsx"`
- **Notes:**
  - Sheet order: README, participants, sessions, survey_uls8, survey_cesd10, survey_gad7, survey_cogfunc8a, digitspan_runs, digitspan_trials, study_days, weather_ingest_runs, weather_daily, imported_session_measures.
  - The README sheet describes all tables, join keys, and value conventions.
  - All join keys (`participant_uuid`, `session_id`, `study_day_id`, `run_id`, `source_run_id`) are present on every relevant sheet.
  - `survey_cogfunc8a` exports the live imported-row columns in schema order: `legacy_mean_1_5` and `data_source` appear after `mean_score` and before `created_at`.
  - Imported CogFunc rows therefore appear directly on the `survey_cogfunc8a` sheet with null raw/PROMIS columns plus `legacy_mean_1_5`; `imported_session_measures.self_report` remains the audit/source copy of the workbook value.
  - UUIDs and timestamps are ISO strings. JSONB columns are JSON strings.
  - Date in filename is today in the study timezone (`America/Vancouver`).

### POST /weather/backfill/historical
- **Auth:** LabMember JWT required
- **Status:** implemented (T66)
- **Request body (all fields optional):**
  ```json
  {
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "station_id": 3510
  }
  ```
  - `start_date` defaults to `2025-01-01`
  - `end_date` defaults to today (`America/Vancouver`)
  - `station_id` defaults to `3510`
- **Response:**
  ```json
  {
    "days_inserted": "integer",
    "days_enhanced": "integer",
    "days_skipped": "integer"
  }
  ```
- **Notes:**
  - Fetches daily weather from the **Open-Meteo Archive API** for UBC coordinates (`49.2606°N, 123.2460°W`). No API key required.
  - Open-Meteo is queried with `timezone=America/Vancouver`; its `daily.time` strings are therefore already local `date_local` values and require no conversion.
  - Fields retrieved: `temperature_2m_mean` → `current_temp_c`, `temperature_2m_max` → `forecast_high_c`, `temperature_2m_min` → `forecast_low_c`, `relative_humidity_2m_mean` → `current_relative_humidity_pct`, `precipitation_sum` → `current_precip_today_mm`, `sunshine_duration` (seconds ÷ 3600) → `sunshine_duration_hours`.
  - **Precedence rules (import data always wins):**
    - Date with **no existing row**: full insert of all 6 fields → counted in `days_inserted`.
    - Date with an **import-sourced row** (`parser_version="legacy-import-v1"`): updates only null fields (`current_relative_humidity_pct`, `sunshine_duration_hours`, `forecast_high_c`, `forecast_low_c`). `current_temp_c` and `current_precip_today_mm` from the import are **never overwritten** → counted in `days_enhanced`.
    - Date with a **UBC live row** (`parser_version="ubc-eos-v1"`): skipped entirely → counted in `days_skipped`.
  - Always writes one `weather_ingest_runs` audit row per affected day with `requested_via="historical_api_backfill"` and `parser_version="open-meteo-v1"`.
  - `study_days` rows are get-or-created as needed (same pattern as live ingest).
  - Idempotent: calling twice returns `days_inserted=0, days_enhanced=0, days_skipped=N`.
  - Max date range: 400 days. `start_date > end_date` returns 422.
  - See `docs/labs/weather-wellness/weather/HISTORICAL_WEATHER_BACKFILL.md` for full spec.

---

### POST /admin/backfill/legacy-weather
- **Auth:** RA required
- **Status:** implemented (T56)
- **Request body:** none
- **Response:**
  ```json
  {
    "days_inserted": "integer",
    "days_updated": "integer",
    "days_skipped": "integer"
  }
  ```
- **Notes:**
  - For each study day that has imported session data (via `imported_session_measures`), applies the documented precedence rules:
    - no existing `weather_daily` row for station 3510 → insert a partial row with only `current_temp_c` and `current_precip_today_mm` populated (mean across imported sessions for that day)
    - existing `open-meteo-v1` row → overwrite `current_temp_c` and `current_precip_today_mm` with import values while preserving humidity, sunshine, and forecast fields
    - existing `legacy-import-v1` row → no-op
    - existing `ubc-eos-v1` row → no-op
  - Writes one `weather_ingest_runs` audit row per inserted or updated day with `parser_version="legacy-import-v1"` and `requested_via="legacy_backfill"`.
  - Idempotent: safe to call multiple times.
- **Verified:** 2026-04-07 — after the authoritative `reference/data_complete.xlsx` import refresh, the legacy-weather pass overwrote 31 existing `open-meteo-v1` days with workbook temperature/precipitation values and skipped 1 `ubc-eos-v1` day. Current overwrite semantics are defined in `backend/app/services/weather_backfill_service.py`.

---

### GET /admin/export.zip
- **Auth:** RA required
- **Status:** implemented (T49, updated T79)
- **Response:** ZIP download containing one CSV per DB table
- **Headers:**
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="Weather and wellness - YYYY-MM-DD.zip"`
- **Notes:**
  - ZIP contains 12 CSVs: `participants.csv`, `sessions.csv`, `survey_uls8.csv`, `survey_cesd10.csv`, `survey_gad7.csv`, `survey_cogfunc8a.csv`, `digitspan_runs.csv`, `digitspan_trials.csv`, `study_days.csv`, `weather_ingest_runs.csv`, `weather_daily.csv`, `imported_session_measures.csv`.
  - Each CSV has a header row and is schema-faithful with all join keys.
  - `survey_cogfunc8a.csv` includes `legacy_mean_1_5` and `data_source`, so imported legacy cognition rows are visible on the canonical survey export surface instead of only in `imported_session_measures`.
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

---

> **Misokinesia endpoints** are documented separately in
> [`docs/labs/weather-wellness/misokinesia/API.md`](../misokinesia/API.md).
