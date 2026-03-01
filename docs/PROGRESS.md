# PROGRESS.md — Project Progress Log

> Read this at the start of every Ralph session to orient on current project state.
> Never delete rows or entries — this is an append-only historical record.

---

## Current State

| Field              | Value                  |
|--------------------|------------------------|
| Phase              | 4 (in progress)        |
| Tasks completed    | 4 / 11                 |
| Remaining queue    | T58–T64                |
| Tasks in progress  | 0                      |
| Last updated       | 2026-03-01             |

---

**Architecture note (2026-02-22):** Project architecture is now standardized on Next.js (Vercel) + FastAPI (Render) + Supabase Postgres. Earlier entries referencing SvelteKit reflect the initial scaffold and are superseded by docs/ARCHITECTURE.md.

---

## Currently In Progress

_No tasks in progress._

<!-- Ralph: replace the content of this section (not the header) each time a task
     transitions to in_progress or done. Format:
     "**Txx — Title** (started YYYY-MM-DD)" or "_No tasks in progress._" -->

---

## T57 — Backend: one-off Phase 4 backfill for already-imported sessions (completed 2026-03-01)

**Acceptance criteria met:**

- `backend/app/scripts/phase4_backfill.py` created as an idempotent standalone script runnable via `python -m app.scripts.phase4_backfill [--dry-run]`.
- Script loads all `imported_session_measures` rows, batch-queries which canonical table rows already exist, then upserts `digitspan_runs`, `survey_uls8`, `survey_cesd10`, and `survey_gad7` with `data_source='imported'` and the legacy-value columns populated — matching the same logic used by `commit_import` in T55.
- GAD-7: if `anxiety_mean` is an exact integer 0–21, `total_score` and `severity_band` are also set; otherwise only `legacy_mean_1_4` is stored.
- Idempotent: all canonical-table upserts use `ON CONFLICT (session_id) DO UPDATE WHERE data_source='imported'`; the DB-level guard prevents overwriting native rows. Re-running reports 0 creates and N updates per table.
- `sessions.study_day_id` is fixed for any session where it is null: derived from `sessions.completed_at` in America/Vancouver, using get-or-create on `study_days`.
- After canonical upserts are committed, the script calls `run_legacy_weather_backfill()` (T56 service) for a unified, idempotent weather backfill pass.
- `--dry-run` flag prints per-table create/update/skip counts and the study_day_id fix count without writing any data.
- Logs structured `INFO` output: session count found, commit confirmation, and a final summary table with per-category counts.
- `backend/app/scripts/__init__.py` created to enable `python -m app.scripts.phase4_backfill` module invocation.
- `docs/devSteps.md` Phase 4 runbook updated to mark the steps as executable.

---

## T56 — Backend: legacy weather backfill (completed 2026-03-01)

**Acceptance criteria met:**

- `POST /admin/backfill/legacy-weather` (RA-protected) implemented in `backend/app/routers/admin.py`; service logic in `backend/app/services/weather_backfill_service.py`.
- Backfill groups `imported_session_measures` by `study_days.date_local` (America/Vancouver), computing mean `temperature_c` and `precipitation_mm` per day. Supports 1:M day↔session relationship via aggregate.
- Only `current_temp_c` and `current_precip_today_mm` are populated in `weather_daily`; all other fields are null (JSONB NOT-NULL columns set to `[]`/`{}`).
- One `weather_ingest_runs` audit row per backfilled day: `parser_version="legacy-import-v1"`, `requested_via="legacy_backfill"`. `date_local` on the run row matches the backfilled day, preserving the analytic join key.
- Existing `weather_daily` rows are never overwritten (`on_conflict_do_nothing` guard).
- Idempotent: second call returns `days_backfilled=0, days_skipped=109`.
- Verified: 109 days backfilled from reference XLSX. 2 existing UBC-ingest rows untouched.

---

## T55 — Backend: import commit writes remapped legacy rows (completed 2026-03-01)

**Acceptance criteria met:**

- Import commit upserts `digitspan_runs` with `data_source='imported'` and `total_correct` from legacy `digit_span_score` (0–14); `max_span` remains null. 199 rows populated from 207-row reference XLSX.
- Import commit upserts survey rows with `data_source='imported'` and `legacy_mean_1_4` populated: `survey_uls8` (205 rows), `survey_cesd10` (206 rows), `survey_gad7` (205 rows).
- GAD-7: if legacy `anxiety` is an exact integer 0–21, `total_score` and `severity_band` are set (132/205 rows had deterministic mappings). Otherwise only `legacy_mean_1_4` is stored.
- Re-import is idempotent: second commit ran cleanly — 207 updated, 0 errors; no duplication. `_get_sessions_with_native_rows` updated to filter by `data_source='native'` so sessions with only imported rows allow re-import. `on_conflict_do_update WHERE data_source='imported'` guards against overwriting native rows at DB level.
- Implemented in `backend/app/services/import_service.py`: `_gad7_severity_from_total` helper, updated `_get_sessions_with_native_rows`, and four canonical upsert blocks in `commit_import`.
- Verified against `reference/data_full_1-230.xlsx` (207 rows, 0 errors).

---

## T54 — DB schema: Phase 4 legacy import remapping (completed 2026-03-01)

**Acceptance criteria met:**

- Alembic migration `20260301_000010` adds `data_source VARCHAR(16) DEFAULT 'native' NOT NULL` to `survey_uls8`, `survey_cesd10`, `survey_gad7`, and `digitspan_runs`.
- Legacy-mean columns added: `survey_uls8.legacy_mean_1_4`, `survey_cesd10.legacy_mean_1_4`, `survey_gad7.legacy_mean_1_4` (all NUMERIC NULLABLE). Legacy-total added: `survey_gad7.legacy_total_score` (SMALLINT NULLABLE).
- UNIQUE constraint on `session_id` added to all four tables (`uq_digitspan_runs_session_id`, `uq_survey_uls8_session_id`, `uq_survey_cesd10_session_id`, `uq_survey_gad7_session_id`).
- `digitspan_runs.max_span` made nullable; raw `r*` columns and computed score columns in the three survey tables made nullable to accommodate imported rows that lack item-level data.
- Existing native rows are unaffected: they receive `data_source='native'` via the column default and all previously-NOT-NULL columns already have data. Native submissions continue to be validated via Pydantic (unchanged).
- SQLAlchemy models updated: `digitspan.py`, `surveys.py` — `Optional` typing added for nullable columns, `UniqueConstraint` added via `__table_args__`.
- Docs updated: `SCHEMA.md` (table definitions + migration history), `API.md` (Phase 4 note), `PROGRESS.md`, `DECISIONS.md`.
- Migration structure verified: revision chain correct (`20260228_000009` → `20260301_000010`); model assertions pass.
- **Run `alembic upgrade head` to apply migration to Supabase.**

---

## T52 — Frontend: consent gating page (completed 2026-02-28, revised ×2 2026-02-28)

**Acceptance criteria met:**

- Participant consent page created at `frontend/src/app/session/[session_id]/consent/page.tsx`.
- Displays the official lab consent form (`reference/Consent Form 2.pdf`) via a full-height `<iframe>` (file copied to `frontend/public/consent-form.pdf` for static serving). No text replication in code.
- Two explicit action buttons replace the earlier checkbox design:
  - **"I Consent"** — routes to `/session/<session_id>/uls8`, beginning the data-collection phase.
  - **"I Do Not Consent"** — routes to `/dashboard`, returning the RA to the home screen.
- No API call at consent step; no DB record written (UI-only gating).
- Page is client-only (`"use client"`); uses `useRouter` from Next.js; no bare `fetch`.
- **Second revision (routing restructure):** Consent now happens *before* session creation.
  - Created `frontend/src/app/(ra)/new-session/page.tsx` — two-step RA-protected page: Step 1 = consent PDF iframe + "I Consent"/"I Do Not Consent"; Step 2 = demographics form + "Back"/"Start Session".
  - "I Do Not Consent" → `/dashboard` (no participant/session created).
  - "I Consent" → shows demographics form; on submit → `POST /sessions/start` → navigates to `result.start_path`.
  - `(ra)/dashboard/page.tsx` simplified: "Start New Entry" now routes to `/new-session`; demographics dialog and all related state removed.
  - `session/[session_id]/consent/page.tsx` deleted (consent no longer lives within the session flow).
  - Backend `start_path` updated: `POST /sessions/start` now returns `/session/<session_id>/uls8` (not `/consent`).
  - `tsc --noEmit` passes with zero errors.
  - `API.md`, `DESIGN_SPEC.md` updated to reflect new flow order and removed `/consent` route.

---

## T51b — Frontend: Start New Entry demographics questionnaire (completed 2026-02-28)

**Acceptance criteria met:**

- "Start New Entry" button now opens a shadcn Dialog with a required demographics form before creating any session.
- Form fields: Age band, Gender, Coming from (origin), Commute method, Time spent outside — each with the canonical preset options from the legacy XLSX value set.
- When `origin` or `commute_method` is `"Other"`, a free-text Input appears immediately below the select, with a visible PII warning ("Do not enter names, initials, or any information that could identify the participant."). Submit is disabled until the free-text field is non-empty.
- Submit button disabled until all required fields are complete (including conditional Other text); form state fully preserved on API failure.
- On submit, calls `startSession(payload)` from `src/lib/api/index.ts` (typed wrapper, no bare fetch) with the full demographics payload; routes to `result.start_path` (i.e., `/session/<id>/consent`).
- Inline error messages on failure are non-technical (auth expiry / server error / network error).
- Added `StartSessionCreate` interface and updated `startSession(payload)` signature in `src/lib/api/index.ts`.
- Installed shadcn components: `dialog`, `select`, `label`, `input`.
- Build passes with no TypeScript errors.

---

## T51a — Backend: start session requires demographics + daylight exposure compute (completed 2026-02-28)

**Acceptance criteria met:**

- `POST /sessions/start` now requires a demographics payload: `age_band`, `gender`, `origin`, `commute_method`, `time_outside` (all required); `origin_other_text` and `commute_method_other_text` conditionally required when the corresponding field is `"Other"`.
- All fields validated server-side against canonical preset option lists (defined in `backend/app/schemas/sessions.py`). Invalid values return HTTP 422 with descriptive messages.
- If `origin` or `commute_method` is `"Other"`, the corresponding `*_other_text` field is required and must be non-empty; otherwise it is ignored.
- Demographics stored on the `participants` row only (not on `sessions`): `age_band`, `gender`, `origin`, `origin_other_text`, `commute_method`, `commute_method_other_text`, `time_outside`.
- `participants.daylight_exposure_minutes` computed at request time using `compute_daylight_exposure_minutes(datetime.now(utc))` from `backend/app/config.py` and stored on the participant row.
- `start_path` in the response is now `/session/<session_id>/consent` (was `/session/<session_id>/uls8`), consistent with the consent-gated participant flow (T52).
- `StartSessionCreate` Pydantic schema added to `backend/app/schemas/sessions.py` with a `model_validator` enforcing all preset and conditional rules.
- Verified: schema imports cleanly; validator accepts valid payloads; rejects invalid `age_band`, missing `*_other_text` when `Other` selected.
- Docs updated: `docs/API.md` (endpoint status, full request/response), `docs/DESIGN_SPEC.md` (questionnaire note), `docs/devSteps.md` (one-click flow section), `docs/PROGRESS.md`.

---

## T51 — Frontend: UI cleanup — remove /participants and /sessions, update nav (completed 2026-02-28)

**Acceptance criteria met:**

- `src/app/(ra)/participants/page.tsx` and its directory removed
- `src/app/(ra)/sessions/page.tsx` and its directory removed
- `RANavBar` now contains Dashboard + Import/Export + Sign out only; Participants and Sessions links removed
- `DESIGN_SPEC.md` updated: IA section updated to reflect final nav (no longer describes removed pages)
- `.next` build cache cleared; TypeScript strict-mode check passes with no errors

---

## T50 — Frontend: Import/Export page (completed 2026-02-28)

**Acceptance criteria met:**

- RA-only `/import-export` page created at `frontend/src/app/(ra)/import-export/page.tsx`
- Import section: drag-and-drop or click-to-browse for `.csv` / `.xlsx` files; auto-previews on file select; shows participant/session create+update counts plus row-level errors and warnings
- Errors disable the Confirm Import button with an explanatory message; warnings are shown but do not block commit
- Confirm Import triggers commit; success summary shows created/updated counts; "Import another file" resets the flow
- Export section: Export XLSX and Export CSV (zip) buttons; each shows loading state while downloading; triggers browser download with server-provided filename
- All API calls go through typed wrappers in `src/lib/api/index.ts`: `importPreview`, `importCommit`, `exportXlsx`, `exportZip` — no bare `fetch` in page component
- New types exported: `ImportRowIssue`, `ImportPreviewResponse`, `ImportCommitResponse`
- TypeScript strict-mode check passes with no errors

---

## T49 — Backend: admin export XLSX + ZIP CSV (completed 2026-02-28)

**Acceptance criteria met:**

- `GET /admin/export.xlsx` implemented — returns a schema-faithful XLSX workbook; requires RA auth
- `GET /admin/export.zip` implemented — returns a ZIP with one schema-faithful CSV per table; requires RA auth
- Both endpoints implemented in `backend/app/routers/admin.py`; export logic in `backend/app/services/export_service.py`
- XLSX structure: README sheet (description, join key guide, value conventions) + 12 data sheets in logical order
- Sheet/file order: participants, sessions, survey_uls8, survey_cesd10, survey_gad7, survey_cogfunc8a, digitspan_runs, digitspan_trials, study_days, weather_ingest_runs, weather_daily, imported_session_measures
- Filename format: `"Weather and wellness - YYYY-MM-DD.xlsx"` / `".zip"` (date in `America/Vancouver`)
- All join keys present on relevant sheets: `participant_uuid`, `session_id`, `study_day_id`, `run_id`, `source_run_id`
- Value conventions: UUIDs → ISO strings; datetimes → ISO-8601 UTC strings; JSONB → JSON strings; numerics and booleans preserved as native types in XLSX
- Headers bolded and first row frozen in XLSX for usability
- No secrets exposed: export queries DB through existing SQLAlchemy session; no raw credentials in response
- Verified: XLSX produces 13 sheets with correct headers; ZIP produces 12 CSVs with correct headers (all confirmed by unit test)

---

## T48 — Backend: admin import preview/commit (completed 2026-02-28)

**Acceptance criteria met:**

- `POST /admin/import/preview` and `POST /admin/import/commit` implemented in `backend/app/routers/admin.py` — both RA-protected (`Depends(get_current_lab_member)`)
- New service module `backend/app/services/import_service.py` implements all parsing and DB logic
- New schemas in `backend/app/schemas/admin.py`: `ImportRowIssue`, `ImportPreviewResponse`, `ImportCommitResponse`
- Excel date serials converted via base date `date(1899, 12, 30) + timedelta(days=N)`; Python `datetime`/`date` objects from openpyxl accepted directly
- Daytime values accept: Python `time`/`datetime` objects, Excel fraction floats (0.0–<1.0), `HH:MM` / `HH:MM:SS` strings — used to compute `participants.daylight_exposure_minutes` via `compute_daylight_exposure_minutes()` from `app.config`
- Demographic string normalization: whitespace-trimmed; canonical age band variants (`Over 38` → `>38`), gender variants (`Nonbinary person` → `Non-binary`); `origin`/`commute_method` values starting with "Other" split into `canonical="Other"` + `*_other_text`
- Upsert rules: participant by `participant_number` (demographics overwrite); session: 0→create, 1→update (blocked if has native survey/digitspan rows), >1→error
- Imported sessions: `status="complete"`, `study_day_id` from `date_local`, timestamps anchored to 12:00 local (`America/Vancouver`) → UTC
- `imported_session_measures` upserted (keyed by `session_id`) with full `source_row_json` audit payload
- Commit is transactional (all or nothing); fails with HTTP 422 + row-level error detail if any row is invalid
- Duplicate `participant ID` within the same file detected as an error (not silently overwritten)
- Verified against `reference/data_full_1-230.xlsx`: 207 rows parsed, 0 errors, 0 warnings
- New packages added to `requirements.txt`: `openpyxl>=3.1.0`, `python-multipart>=0.0.9`

---

## T47a — Backend infra: study timezone and daylight exposure config (completed 2026-02-28)

Migration `20260228_000008` applied to Supabase (now at `head`):

- Created `backend/app/config.py`: `STUDY_TIMEZONE = "America/Vancouver"`, `get_daylight_start_local_time()` (reads env var, default `"06:00"`), `compute_daylight_exposure_minutes(session_start)` (pure function, tested)
- Fixed `America/Edmonton` → `America/Vancouver` bug in `weather_parser.py` (`_TZ_EDMONTON` → `_TZ_VANCOUVER`), `weather.py` router (`tz_name` in study_days upsert, query descriptions), and `models/weather.py` (`StudyDay.tz_name` default and docstring)
- Data-fix migration corrected all existing `study_days` rows and the `tz_name` server_default
- Sessions router `date_from`/`date_to` filter now uses local-day boundaries in `America/Vancouver` instead of UTC midnight
- Docs updated: `SCHEMA.md`, `WEATHER_INGESTION.md`, `API.md`, `CONVENTIONS.md`, `devSteps.md`, `DECISIONS.md` (no change needed — RESOLVED-12 was already correct)

---

## T47 — DB schema: demographics columns + imported_session_measures table (completed 2026-02-28)

Migration `20260228_000007` applied to Supabase (now at `head`):

- Added 8 nullable columns to `participants`: `age_band`, `gender`, `origin`, `origin_other_text`, `commute_method`, `commute_method_other_text`, `time_outside`, `daylight_exposure_minutes`
- Created `imported_session_measures` table (PK = `session_id`; FK to `sessions` and `participants`); stores legacy aggregate measures + full `source_row_json` audit column
- SQLAlchemy models updated: `Participant` (demographics), new `ImportedSessionMeasures`
- Pydantic schemas updated: `ParticipantResponse` (demographics fields added), new `ImportedSessionMeasuresResponse`
- `SCHEMA.md` updated: planned items marked applied, migration history row added, entity diagram updated

---

## T46 — Docs/spec: Phase 3 admin import/export + UI cleanup + consent + demographics + dashboard filtering (completed 2026-02-28)

Phase 3 documentation is now decision-complete for upcoming implementation tasks:
- `docs/API.md` expanded Phase 3 admin import rules (expected headers, Excel serial/time parsing, normalization, and upsert rules) and added a planned `GET /dashboard/summary/range` contract for date-range filtering.
- `docs/DESIGN_SPEC.md` updated participant flow to include consent gating, clarified Phase 3 IA (dashboard + import/export; remove `/participants` + `/sessions`), and specified dashboard filter + weather behavior.
- `docs/SCHEMA.md` documented legacy import column→DB mappings for demographics and `imported_session_measures`.
- Runbooks/conventions updated: `docs/devSteps.md`, `docs/CONVENTIONS.md`, `docs/WEATHER_INGESTION.md`, and `AGENTS.md`.

---

## T45 — Verification: production smoke test and cold-start UX check (completed 2026-02-28)

**Verification method:** Code-level review of route handler and dashboard logic; build verification via `tsc --noEmit` + `next build`. Production e2e checklist in `docs/devSteps.md` (smoke test section) is owned by the developer post-deployment.

**Acceptance criteria — verified:**

| Criterion | Verification | Result |
|---|---|---|
| Second visit (≤5 min) renders from cache without waiting on Render | Phase 1 calls `getDashboardBundle('cached')` → route handler returns Redis bundle immediately if `ww:ra:dashboard:v1` key exists (TTL 300s). `setSummaryLoading(false)` + UI update happens before Phase 2 starts. No Render call in the cached path. | ✅ Verified by code review |
| Dashboard refreshes to live values once backend responds | Phase 2 always calls `getDashboardBundle('live')` → route handler fetches `/dashboard/summary` + `/weather/daily` from Render in parallel, writes to Redis, returns fresh bundle → dashboard updates all state. | ✅ Verified by code review |
| No unauthorized access without valid JWT (401 on missing/invalid token) | `verifySupabaseJWT()` is called on every request before any Redis read or Render fetch. Missing `Authorization` header → 401 `{"detail":"Missing Authorization header"}`. Invalid/expired token → 401 `{"detail":"Invalid or expired token"}`. No branch bypasses auth check. | ✅ Verified by code review |
| `tsc --noEmit` passes | Ran 2026-02-28 | ✅ Pass (0 errors) |
| `next build` passes | Ran 2026-02-28 | ✅ Pass — `ƒ /api/ra/dashboard` listed as dynamic route handler |

**Production e2e checklist (developer-owned — run after Vercel deploy):**
See `docs/devSteps.md` → "Vercel Upstash Cache Setup → 3) Smoke test checklist" for the full list of curl/browser checks covering 401, cache hit, cache miss, and live refresh.

---

## T44 — Docs/runbook: Vercel Upstash cache setup (completed 2026-02-28)

All acceptance criteria met by work done during T41:
- `docs/devSteps.md` "Vercel Upstash Cache Setup" section covers integration steps, server-only vs `NEXT_PUBLIC_*` env vars, local dev setup, and a smoke-test checklist for cache hit/miss/live/401.
- `docs/ARCHITECTURE.md` — Vercel Cache Route Handler section added.
- `docs/CONVENTIONS.md` — caching conventions expanded (jose, Redis key versioning).

---

## T43 — Frontend: eliminate extra cold-start fetches on dashboard (WeatherCard) (completed 2026-02-28)

**Acceptance criteria met:**
- WeatherCard on-mount fetch (`getWeatherStatus`) removed entirely. Component now accepts `weather: WeatherDailyResponse | null` prop — null shows loading skeleton, data shows content. No independent backend call on mount.
- WeatherCard displays today's summary fields: `current_temp_c` (large), `forecast_high_c` / `forecast_low_c`, `forecast_condition_text`. Data sourced from `weather.items[0]`.
- Manual "Update Weather" action still works: calls `triggerWeatherIngest()`, stores result in `ingestOverride` state which overrides `latestRun` display without a full re-fetch.
- WeatherCard moved above KPI cards in the dashboard (hero → weather → KPIs → sessions).
- Dashboard passes `weather={weatherData}` where `weatherData` is set from the bundle in both Phase 1 (cached) and Phase 2 (live).
- Dashboard mount triggers exactly one live backend refresh path (through `/api/ra/dashboard?mode=live` → Vercel route handler → Render backend).
- `WeatherDailyItem` interface added to `src/lib/api/index.ts`; `WeatherDailyResponse.items` typed as `WeatherDailyItem[]`.
- `getWeatherStatus()` wrapper removed (unused after refactor).
- `tsc --noEmit` clean; `next build` passes.

---

## T42 — Frontend: typed API wrappers + RA dashboard stale-while-revalidate (completed 2026-02-28)

**Acceptance criteria met:**
- `getDashboardBundle(mode: 'cached' | 'live')` typed wrapper added to `src/lib/api/index.ts`. Calls same-origin `/api/ra/dashboard` with the Supabase JWT. No bare `fetch` from components.
- Dashboard page refactored to stale-while-revalidate: Phase 1 fetches cached bundle (shows KPIs immediately if Redis hit); Phase 2 fetches live bundle in parallel with sessions list and updates values when it arrives.
- Separate `summaryLoading` (KPI cards) and `sessionsLoading` (sessions list) states so cached KPIs show instantly while sessions continue loading.
- Error banner only displayed when no data is available at all; cached data view is never wiped by a background live-refresh failure.
- `tsc --noEmit` clean; `next build` passes.

---

## T41 — Frontend infra: Upstash Redis cache + RA JWT verification (completed 2026-02-28)

**Acceptance criteria met:**
- `GET /api/ra/dashboard?mode=cached|live` route handler created at `frontend/src/app/api/ra/dashboard/route.ts`
- JWT verification: ES256 via JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) with HS256 fallback using `SUPABASE_JWT_SECRET`. Returns 401 for missing/invalid tokens.
- `mode=cached`: checks Upstash Redis for key `ww:ra:dashboard:v1`; returns `{ cached: true, data: <bundle> }` on hit, `{ cached: false, data: null }` on miss.
- `mode=live`: fetches `/dashboard/summary` + `/weather/daily?start=today&end=today` from Render backend in parallel, writes bundle to Redis with TTL 300s, returns `{ cached: false, data: <bundle> }`.
- Redis client is created only if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (server-only vars). Gracefully degrades if absent.
- `DashboardBundle` and `DashboardRouteResponse` types added to `src/lib/api/index.ts`.
- `@upstash/redis` and `jose` npm packages installed.
- `tsc --noEmit` passes clean. `next build` succeeds; route listed as `ƒ /api/ra/dashboard`.

**Packages added:** `@upstash/redis`, `jose`

---
