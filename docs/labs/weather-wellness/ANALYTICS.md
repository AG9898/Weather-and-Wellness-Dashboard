# ANALYTICS.md - Planned Statistical Analytics Specification

> Canonical source for dashboard statistical analysis requirements derived from
> `reference/Weather_MLM.R`. This document defines the planned Python-side
> analytics layer only. It does not change survey scoring formulas or storage
> semantics already defined in `docs/SCORING.md`.

---

## Status

- **Implementation status:** partially implemented
- **Implemented through:** T83-T92 and T118 (response schema, durable storage, canonical dataset builder, mixed-model fitting, snapshot orchestration, backend API endpoint, effect-plot and weather-annotation serialization, temperature-summary engine)
- **Still pending:** end-to-end analytics/dashboard verification tasks and any later live snapshot/route wiring polish; the dashboard filter split gives analytics its own independent range controls anchored to the latest study day and the weather chart is no longer linked to analytics annotations.
- **Source reference:** `reference/Weather_MLM.R`
- **Scope:** analysis dataset construction, mixed-effects model definitions, KPI
  serialization, day-level temperature summaries, snapshot/cache behavior
- **Non-scope:** changing instrument scoring, changing the existing study schema,
  recreating the R script's manual Excel workflow

---

## Purpose

The reference R script contains two different concerns:

- **Legacy workbook preparation and score cleaning**
- **Statistical analysis for weather and cognition outcomes**

The app already covers the scoring side conceptually:

- native survey submissions are scored server-side in FastAPI
- imported legacy rows preserve aggregate values in canonical tables and
  `imported_session_measures`

The missing product layer is the **dashboard analytics pipeline** that computes
model-based KPIs from backend database values instead of hard-coded numbers or
one-off R outputs.

---

## What The R Script Currently Does

### 1. Legacy ETL / manual score cleaning

The early sections of `reference/Weather_MLM.R`:

- read a Qualtrics Excel export from a desktop path
- split selected columns into demographics / ULS / CES-D / GAD / cognitive files
- coerce response strings like `"3 Sometimes"` to numeric values
- reverse-score selected items for ULS and CES-D
- write cleaned score workbooks back to disk

These steps are a **manual legacy workflow**, not a target architecture for the
web app. The web app should continue to use the existing backend scoring logic
and import mapping rules documented elsewhere.

### 2. Analysis dataset construction

The later section of the R script builds an analysis table with:

- participant/session-level cognition and mood outcomes
- daily weather measures
- a derived `date_bin` grouping field
- standardized (`z`) versions of predictors and outcomes

### 3. Mixed-effects modeling

The script fits two linear mixed models with a random intercept by day:

1. `digit_span_z ~ temperature_z + precipitation_z*depression_z + daylight_z*depression_z + precipitation_z*loneliness_z + anxiety_z + (1 | date_bin)`
2. `self_report_z ~ temperature_z + precipitation_z*depression_z + daylight_z*depression_z + precipitation_z*loneliness_z + anxiety_z + (1 | date_bin)`

It then produces partial-residual plots for selected predictors.

---

## Analytics Design Principles

- **Scoring stays unchanged.** Existing survey and digit span scoring formulas
  remain exactly as documented in `docs/SCORING.md` and the per-instrument docs.
- **No manual Excel pipeline in production.** Analytics must be derived from the
  backend database, not desktop file paths or hard-coded column positions.
- **One canonical analysis dataset.** Native and imported rows must be mapped to
  the same logical analysis fields before model fitting.
- **Durable snapshots, optional live recompute.** The dashboard should read the
  latest stored analytics snapshot by default, treat snapshot misses as an
  empty-state outcome, and support explicit recompute for filters/admin use.
- **Explainable KPIs.** Dashboard analytics should surface model cards with
  coefficients, confidence intervals, p-values, and convergence/warning state.
- **Day-level weather weighting.** Weather predictors are day-level variables and
  must be standardized across unique study days, not over-weighted by dates that
  happen to have more participant rows.
- **Workbook as acceptance oracle only.** `reference/data_full_1-230.xlsx` is
  the current validation oracle for Weather & Wellness outputs, but it is not a
  production analytics input. Runtime analytics stay database-backed.
- **Keep chart semantics separate.** Weather time-series charts and
  model-effect plots must remain separate surfaces and must not be collapsed
  into one ambiguous chart or one coupled filter controller.

---

## Canonical Analysis Dataset

The Python analytics layer should build a logical dataset per selected date
range. This dataset is not yet a persisted database table.

### Required logical fields

| Logical field | Description | Native source | Imported fallback |
|---|---|---|---|
| `session_id` | Session key | `sessions.session_id` | same |
| `participant_uuid` | Participant key | `sessions.participant_uuid` | same |
| `date_local` | Study-local day | `study_days.date_local` | same |
| `date_bin` | Ordered day grouping integer for mixed model random effect | derived from filtered `date_local` values | same |
| `temperature` | Daily temperature predictor | `weather_daily.current_temp_c` | `imported_session_measures.temperature_c` |
| `precipitation` | Daily precipitation predictor | `weather_daily.current_precip_today_mm` | `imported_session_measures.precipitation_mm` |
| `daylight_hours` | Daylight predictor | `weather_daily.sunshine_duration_hours` when available | null unless a documented fallback is explicitly adopted |
| `anxiety` | Anxiety predictor | `survey_gad7.total_score` when native canonical total exists | `survey_gad7.legacy_total_score` else `survey_gad7.legacy_mean_1_4` |
| `depression` | Depression predictor | `survey_cesd10.total_score` when native canonical total exists | `survey_cesd10.legacy_mean_1_4` |
| `loneliness` | Loneliness predictor | `survey_uls8.computed_mean` | `survey_uls8.legacy_mean_1_4` |
| `self_report` | Self-reported cognition outcome | `survey_cogfunc8a.mean_score` | `survey_cogfunc8a.legacy_mean_1_5` |
| `digit_span_score` | Digit span outcome | `digitspan_runs.total_correct` | imported `digitspan_runs.total_correct` |

### Notes on source precedence

- Use **native canonical scored values first** when they exist.
- Use imported aggregate values only when no native canonical value exists for
  the same session.
- Do not fabricate raw survey item rows for imported data.
- `self_report` still uses a mixed-source rule, but imported sessions now supply
  canonical `survey_cogfunc8a` rows with `data_source='imported'` and
  `legacy_mean_1_5` rather than relying only on `imported_session_measures`.

### Inclusion rules

Only sessions that satisfy all of the following should enter a given model fit:

- `sessions.status = "complete"`
- linked `study_day_id` / `date_local` present
- required outcome present
- all predictors used by that model present

Rows excluded for missing data should be counted and reported in analytics
metadata.

---

## Standardization And Derived Fields

- Standardize continuous predictors and outcomes within the active analysis
  window using z-scores: `(value - mean) / sd`.
- Standardization is **model-sample-specific**:
  - build the complete-case estimation sample for the outcome being fit
  - then compute z-scores from that sample only
  - do not standardize predictors on rows that will later be dropped for a
    missing outcome
- Standardization is also **field-type-specific**:
  - `temperature`, `precipitation`, and `daylight_hours` are day-level weather
    predictors and must be standardized from the unique `date_local` values
    present in the complete-case sample for that outcome
  - `anxiety`, `depression`, `loneliness`, `self_report`, and
    `digit_span_score` remain participant/session-level values and are
    standardized across participant rows in the complete-case sample
- After day-level weather z-scores are computed, they are mapped back onto each
  participant row from that day before mixed-model fitting. The models remain
  participant-row based; only the weather standardization changes.
- `date_bin` is derived after date filtering by ordering unique
  `study_days.date_local` values ascending and assigning `1..N`.
- Do not persist z-scored columns or `date_bin` in the transactional schema.
- If a selected window has zero variance for a required predictor or outcome,
  return a structured analytics warning and skip model fitting for that outcome.
- If the source dataset ever contains conflicting weather values for the same
  `date_local`, surface a structured warning or failure rather than silently
  averaging them.

---

## Planned Model Definitions

The current implementation target should preserve the inferential intent of the R script with two
mixed-effects models:

### Outcome 1: Digit Span

```text
digit_span_z ~
  temperature_z +
  precipitation_z * depression_z +
  daylight_z * depression_z +
  precipitation_z * loneliness_z +
  anxiety_z +
  (1 | date_bin)
```

### Outcome 2: Self-Reported Cognition

```text
self_report_z ~
  temperature_z +
  precipitation_z * depression_z +
  daylight_z * depression_z +
  precipitation_z * loneliness_z +
  anxiety_z +
  (1 | date_bin)
```

### Python implementation target

- Fit with Python in the backend, not by shelling out to R.
- Preferred v1 library: `statsmodels` mixed linear model support.
- Use the same fixed/random-effects structure as the reference R analysis but
  treat the Python implementation as the normative production path.
- For the final dashboard model estimates, fit with **REML**. Reserve ML
  (`REML = FALSE`) for future fixed-effect model-comparison work if that is
  explicitly added later.
- Small numeric differences versus `lme4` are acceptable if:
  - formulas match
  - included rows match
  - standardization rules match
  - serialized effect outputs are internally consistent

---

## Dashboard KPI Contract

The primary analytics KPIs should be **model cards**, not only operational
counts.

### Model card fields

Each effect card should expose:

- outcome name
- predictor name
- whether the term is an interaction
- coefficient estimate
- standard error
- test statistic
- p-value
- 95% confidence interval
- direction (`positive`, `negative`, `neutral`)
- significance flag

### Model-level metadata

Each model summary should expose:

- formula string
- random effect grouping field (`date_bin`)
- sample size used
- day count used
- convergence flag
- warning list
- model version string
- generated timestamp

### Temperature summary metadata

Analytics responses should also expose a day-level temperature summary for the
active range. This summary is separate from the mixed-model card payloads and is
intended to answer descriptive questions about temperature frequency and extreme
days.

Each response should expose `temperature_summary.windows[]` with three fixed
windows:

- `overall` — the full requested date range
- `fall_winter` — days from `Sep 22` through `Mar 21`, inclusive, clipped to the
  requested date range
- `spring_summer` — days from `Mar 22` through `Sep 21`, inclusive, clipped to
  the requested date range

Each window should include:

- `window_key`
- effective `date_from` / `date_to`
- `day_count`
- `participant_count`
- `mean_temperature_c`
- `sd_temperature_c`
- `frequency_bins`
- `cold_group`
- `hot_group`

The dashboard renders this payload in a dedicated temperature-summary card
separate from the effect plot and weather chart. The UI exposes tabs for the
three fixed windows, a summary strip, a 1°C frequency histogram, and hot/cold
day panels.

### Dataset metadata

Analytics responses should also include:

- requested date range
- included session count
- excluded row count
- excluded-row reasons summary
- native vs imported row counts
- snapshot freshness metadata

---

## Temperature Frequency And Extreme-Day Contract

The dashboard analytics payload should include a descriptive temperature summary
that answers the lab's current analysis questions without changing the mixed
model formulas.

### Frequency vs temperature

- `Freq vs temp` is defined as a day-level histogram over unique daily
  temperatures for the active window.
- Histogram counts are by **day**, not by participant row.
- The initial summary implementation should use **1°C bins**.
- Each `frequency_bins[]` item should include:
  - `bin_start_c`
  - `bin_end_c`
  - `day_count`

### Hot and cold groups

- A day's temperature z-score is computed within its own summary window
  (`overall`, `fall_winter`, or `spring_summer`) using unique days only.
- `cold_group` contains days where `temperature_z < -2`.
- `hot_group` contains days where `temperature_z > 2`.
- The threshold is strict (`|z| > 2`), not inclusive of exactly `2`.
- Group counts should expose both:
  - number of qualifying days
  - number of participant rows that occurred on those days

Each group should include:

- `day_count`
- `participant_count`
- `participant_ids`
- `dates`
- `days[]`, where each item includes:
  - `date_local`
  - `temperature_c`
  - `temperature_z`
  - `participant_ids`
  - `participant_count`

If a window has no qualifying hot or cold days, return an empty group object
with zero counts instead of treating the window as an error.

### Current acceptance oracle (`reference/data_full_1-230.xlsx`)

The current canonical workbook is used to validate the expected outputs for this
contract. Based on the present workbook contents:

- `overall`: `cold_group.participant_count = 2`
- `overall`: `hot_group.participant_count = 2`
- `overall`: cold dates are `2025-03-04` and `2025-03-06`
- `overall`: hot dates are `2025-07-29` and `2025-08-01`
- `fall_winter`: `cold_group.participant_count = 2`
- `fall_winter`: `hot_group.participant_count = 3`
- `spring_summer`: `cold_group.participant_count = 0`
- `spring_summer`: `hot_group.participant_count = 0`

---

## Visualization Contract

The reference R script's plots are not time-series weather charts. They are
closer to adjusted effect plots using model residual-derived y-values against a
selected predictor on the x-axis.

Because of that, the dashboard should not draw those plots directly on top of
the existing weather-by-date Highcharts chart.

### Required UX structure

- Keep the existing weather chart as the **time/context view**.
- Add a separate analytics visualization surface as the **effect view**.
- Keep the analytics surface independently filterable; the weather chart should
  not be the controller for analytics date windows.

### Planned linked surfaces

1. **Weather chart**
   - remains a date-based view of temperature, precipitation, and sunlight
   - owns its own weather-range filters
2. **Model cards**
   - summarize term-level effects from the fitted models
   - selecting a card or term should update the analysis plot within the
     analytics surface
3. **Effect plot card**
   - renders a separate chart for the selected outcome/predictor term
   - can show scatter data, fitted line, and confidence band if supported by the
     serialized payload
4. **Temperature summary card**
   - stays inside the analytics surface
   - follows the analytics range rather than the weather-chart range

### Analytics surface state

The analytics surfaces should share:

- analytics date range
- snapshot/live analytics state
- selected outcome model
- selected effect term

The weather chart should keep its own separate date range and should not
implicitly change analytics snapshot queries.

### Planned dashboard revision

- Add a lightweight metadata read for `latest_study_day` so preset ranges can
  anchor to the most recent actual study date.
- Use that anchor for both weather and analytics presets, with a fallback to
  Vancouver "today" when no study days exist yet.
- Keep weather and analytics filter state independent; the weather chart should
  not render analytics-linked badges or plot bands.
- Continue to avoid placing partial residual points or
  predictor-vs-residual regression lines on the date-based weather chart.

---

## Snapshot And Recompute Strategy

The dashboard should use a hybrid analytics flow:

- serve the latest durable analytics snapshot by default
- permit explicit live recompute for date filters or admin/debug use
- keep serving the prior snapshot while recompute is in progress
- replace the stored snapshot only after a successful recompute

Redis may cache snapshot reads, but Redis should not be the sole source of truth
for analytics results. Durable snapshot state belongs in Postgres.

**Model fitting is non-blocking:** `fit_analytics_models` is a synchronous CPU-bound statsmodels call (30–90s). It runs via `asyncio.to_thread` so the uvicorn event loop stays free to serve other requests (health checks, polls, weather fetches) during model fitting.

**Staleness cutoff:** `_is_recomputing_run` treats any run that has been in `recomputing` status for more than 30 minutes as timed out. This allows the system to self-heal on the next "Refresh In Background" click without manual DB intervention (e.g. after a Render process kill or OOM).

**Startup cleanup:** On backend restart, a FastAPI lifespan hook marks any orphaned `analytics_runs` rows (`status="recomputing"`, `finished_at=NULL`, `started_at` older than 30 minutes) as `"failed"`. This clears runs that were in-flight when the previous process was killed, so they are not counted against the staleness window.

---

## Planned API Shape

The analytics endpoint is implemented with the following high-level response shape:

### `GET /dashboard/analytics`

Query parameters:

- `date_from=YYYY-MM-DD`
- `date_to=YYYY-MM-DD`
- `mode=snapshot|live`

Implemented high-level response shape:

```json
{
  "status": "ready | stale | recomputing | insufficient_data | failed",
  "response_version": "dashboard-analytics-v2",
  "dataset": {
    "date_from": "YYYY-MM-DD",
    "date_to": "YYYY-MM-DD",
    "included_sessions": 0,
    "included_days": 0,
    "native_rows": 0,
    "imported_rows": 0,
    "excluded_rows": 0,
    "generated_at": "datetime"
  },
  "models": [
    {
      "outcome": "digit_span | self_report",
      "formula": "string",
      "grouping_field": "date_bin",
      "converged": true,
      "warnings": [],
      "effects": [
        {
          "term": "temperature_z",
          "is_interaction": false,
          "coefficient": 0.0,
          "standard_error": 0.0,
          "statistic": 0.0,
          "p_value": 0.0,
          "ci_95_low": 0.0,
          "ci_95_high": 0.0,
          "direction": "positive | negative | neutral",
          "significant": true
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
        "day_count": 0,
        "participant_count": 0,
        "mean_temperature_c": 0.0,
        "sd_temperature_c": 0.0,
        "frequency_bins": [
          {
            "bin_start_c": 0.0,
            "bin_end_c": 1.0,
            "day_count": 0
          }
        ],
        "cold_group": {
          "day_count": 0,
          "participant_count": 0,
          "participant_ids": [],
          "dates": [],
          "days": []
        },
        "hot_group": {
          "day_count": 0,
          "participant_count": 0,
          "participant_ids": [],
          "dates": [],
          "days": []
        }
      }
    ]
  },
  "visualizations": {
    "default_selected_term": "temperature_z",
    "effect_plots": [
      {
        "outcome": "digit_span | self_report",
        "term": "temperature_z",
        "x_label": "Temperature (z)",
        "y_label": "Adjusted outcome",
        "points": [
          {
            "x": 0.0,
            "y": 0.0,
            "date_local": "YYYY-MM-DD"
          }
        ],
        "fitted_line": [
          {
            "x": 0.0,
            "y": 0.0
          }
        ]
      }
    ],
    "weather_annotations": {
      "selected_term": "temperature_z",
      "date_from": "YYYY-MM-DD",
      "date_to": "YYYY-MM-DD"
    }
  }
}
```

### Notes on visualization payloads

- The effect plot payload is intended for a separate analysis chart component,
  not for overlay on the weather time-series chart.
- `temperature_summary` is a descriptive day-level payload and must remain
  separate from both mixed-model cards and visualization payloads.
- `weather_annotations` should remain date-based metadata only.
- Exact plot serialization may evolve, but the separation between weather
  time-series data and model-effect plot data is part of the planned contract.

---

## Documentation Relationships

- `docs/SCORING.md`: unchanged scoring formulas
- `docs/SCHEMA.md`: current persisted schema and logical analytics-source notes
- `docs/API.md`: endpoint contract status for analytics
- `docs/ARCHITECTURE.md`: cache/snapshot/recompute architecture
- `docs/DESIGN_SPEC.md`: dashboard UX and KPI presentation

---

## Effect Plot Implementation Notes (T92)

Effect plots are computed in `backend/app/analytics/modeling.py` as partial-residual plots:

- **Approach:** For each non-interaction main effect term `t` with coefficient `β_t`, the partial residual is `residual + β_t * x_t` where `residual` is the statsmodels model residual.
- **Terms covered:** `temperature_z`, `precipitation_z`, `daylight_z`, `depression_z`, `loneliness_z`, `anxiety_z` (non-interaction terms only).
- **Fitted line:** 50 evenly spaced points spanning the predictor range; `y = β_t * x`.
- **Point annotation:** each scatter point carries `date_local` to support optional linkage to the weather chart timeline.
- **Interaction terms** (`precipitation_z:depression_z`, `daylight_z:depression_z`, `precipitation_z:loneliness_z`) are excluded from v1 effect plots; they require choosing fixed levels for the moderator variable and are reserved for a future enhancement.

## Open Implementation Notes

- The R script includes some inconsistent plotting code that references objects
  not defined in the final mixed-model section. Treat the formulas above as the
  authoritative v1 parity target, not every plotting line.
- Direct comparison against the reference R script showed two important
  interpretation choices:
  - model-specific complete-case z-scoring is statistically cleaner than
    standardizing predictors across rows later dropped for one outcome
  - REML is the preferred estimation mode for the final mixed-effects models as
    presented on the dashboard
- If future analysis requires exact parity with `lme4`, reassess the Python-only
  implementation choice before changing backend contracts.
