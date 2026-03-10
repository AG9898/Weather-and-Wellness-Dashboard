# ANALYTICS.md - Planned Statistical Analytics Specification

> Canonical source for dashboard statistical analysis requirements derived from
> `reference/Weather_MLM.R`. This document defines the planned Python-side
> analytics layer only. It does not change survey scoring formulas or storage
> semantics already defined in `docs/SCORING.md`.

---

## Status

- **Implementation status:** planned
- **Source reference:** `reference/Weather_MLM.R`
- **Scope:** analysis dataset construction, mixed-effects model definitions, KPI
  serialization, snapshot/cache behavior
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
  latest stored analytics snapshot by default and support explicit recompute for
  filters/admin use.
- **Explainable KPIs.** Dashboard analytics should surface model cards with
  coefficients, confidence intervals, p-values, and convergence/warning state.
- **Keep chart semantics separate.** Weather time-series charts and
  model-effect plots should be linked by shared filters and interaction state,
  not overlaid into one ambiguous chart.

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
- `date_bin` is derived after date filtering by ordering unique
  `study_days.date_local` values ascending and assigning `1..N`.
- Do not persist z-scored columns or `date_bin` in the transactional schema.
- If a selected window has zero variance for a required predictor or outcome,
  return a structured analytics warning and skip model fitting for that outcome.

---

## Planned Model Definitions

Python v1 should reproduce the inferential intent of the R script with two
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

### Dataset metadata

Analytics responses should also include:

- requested date range
- included session count
- excluded row count
- excluded-row reasons summary
- native vs imported row counts
- snapshot freshness metadata

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
- Link the two through shared date filters and selected analytics state.

### Planned linked surfaces

1. **Weather chart**
   - remains a date-based view of temperature, precipitation, and sunlight
   - continues to use the dashboard weather range filters
2. **Model cards**
   - summarize term-level effects from the fitted models
   - selecting a card or term should update the analysis plot
3. **Effect plot card**
   - renders a separate chart for the selected outcome/predictor term
   - can show scatter data, fitted line, and confidence band if supported by the
     serialized payload

### Shared state

These surfaces should share:

- date range
- snapshot/live analytics state
- selected outcome model
- selected effect term

### Weather-to-analysis visual linking

To preserve the usefulness of the weather chart without mixing incompatible
axes, the dashboard may add lightweight weather-chart annotations that still
live in time space, for example:

- analysis window highlights
- badges or labels showing which predictor is currently selected in the effect plot
- subtle markers for dates included/excluded in the active analysis window

Do not place partial residual points or predictor-vs-residual regression lines
on the date-based weather chart.

---

## Snapshot And Recompute Strategy

The dashboard should use a hybrid analytics flow:

- serve the latest durable analytics snapshot by default
- permit explicit live recompute for date filters or admin/debug use
- keep serving the prior snapshot while recompute is in progress
- replace the stored snapshot only after a successful recompute

Redis may cache snapshot reads, but Redis should not be the sole source of truth
for analytics results. Durable snapshot state belongs in Postgres.

---

## Planned API Shape

The analytics endpoint is planned and not yet implemented:

### `GET /dashboard/analytics`

Query parameters:

- `date_from=YYYY-MM-DD`
- `date_to=YYYY-MM-DD`
- `mode=snapshot|live`

Planned high-level response shape:

```json
{
  "status": "ready | stale | recomputing | insufficient_data | failed",
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

## Open Implementation Notes

- The R script includes some inconsistent plotting code that references objects
  not defined in the final mixed-model section. Treat the formulas above as the
  authoritative v1 parity target, not every plotting line.
- If future analysis requires exact parity with `lme4`, reassess the Python-only
  implementation choice before changing backend contracts.
- Partial-residual or other effect plots are planned as a separate linked
  analysis surface after the initial model-card KPI layer is in place.
