"""Parity fixtures verifying the Python analytics pipeline matches the reference R workflow.

These tests map directly to the R script (reference/Weather_MLM.R) to catch regressions
in formula structure, variable naming, standardization rules, and included-row logic.
"""

from __future__ import annotations

import uuid
from dataclasses import replace
from datetime import date, datetime, timezone

from app.analytics.constants import (
    ANALYTICS_MIXED_MODEL_FORMULAS,
    ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD,
)
from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.modeling import (
    _build_outcome_frame,
    _z_score_outcome_frame,
    fit_analytics_models,
)


# ---------------------------------------------------------------------------
# R-script reference values
# (from reference/Weather_MLM.R, lmer() calls)
# ---------------------------------------------------------------------------

# The R formulas use these exact standardized predictor and outcome names.
_R_DIGIT_SPAN_FORMULA_TERMS = frozenset(
    [
        "digit_span_z",
        "temperature_z",
        "precipitation_z",
        "depression_z",
        "precipitation_z:depression_z",
        "daylight_z",
        "daylight_z:depression_z",
        "loneliness_z",
        "precipitation_z:loneliness_z",
        "anxiety_z",
    ]
)

_R_SELF_REPORT_FORMULA_TERMS = frozenset(
    [
        "self_report_z",
        "temperature_z",
        "precipitation_z",
        "depression_z",
        "precipitation_z:depression_z",
        "daylight_z",
        "daylight_z:depression_z",
        "loneliness_z",
        "precipitation_z:loneliness_z",
        "anxiety_z",
    ]
)

# The R script uses these raw (un-standardized) field names.
_R_RAW_FIELD_NAMES = frozenset(
    [
        "temperature",
        "precipitation",
        "daylight_hours",
        "anxiety",
        "depression",
        "loneliness",
        "self_report",
        "digit_span_score",
    ]
)


def _make_row(
    *,
    day: int,
    rep: int,
    digit_span_score: int | None = None,  # None → derived from index
    self_report: float | None = None,  # None → derived from index
) -> AnalyticsDatasetRow:
    """Build a synthetic complete-case row aligned with R-script field names.

    Default outcomes are derived deterministically from day/rep so the dataset
    has genuine variance in all predictors and outcomes, matching how R would
    receive a real ww_data frame.
    """
    index = (day - 1) * 3 + rep
    derived_digit_span = 6 + (index % 7) + day  # range ~7–22
    derived_self_report = 2.0 + (index % 5) * 0.6 + day * 0.1  # range ~2–7
    return AnalyticsDatasetRow(
        session_id=uuid.uuid5(uuid.NAMESPACE_URL, f"parity-session-{day}-{rep}"),
        participant_uuid=uuid.uuid5(uuid.NAMESPACE_URL, f"parity-participant-{day}-{rep}"),
        date_local=date(2026, 3, day),
        date_bin=day,
        # raw fields must use the same names the R script assigns to ww_data columns
        temperature=5.0 + day * 0.5 + rep * 0.1,
        precipitation=(day % 4) * 0.8 + rep * 0.2,
        daylight_hours=7.0 + day * 0.3 + rep * 0.05,
        anxiety=3.0 + ((day * 2 + rep) % 5) * 0.4,
        depression=2.0 + ((day + rep * 3) % 7) * 0.3,
        loneliness=1.5 + ((day * 3 + rep) % 6) * 0.2,
        self_report=self_report if self_report is not None else derived_self_report,
        digit_span_score=digit_span_score if digit_span_score is not None else derived_digit_span,
        imported_fields=(),
    )


def _build_parity_dataset(
    *,
    digit_span_score: int | None = None,
    self_report: float | None = None,
) -> AnalyticsDatasetBuildResult:
    """Build a synthetic dataset using the same field names as the R ww_data frame."""
    rows = tuple(
        _make_row(day=day, rep=rep, digit_span_score=digit_span_score, self_report=self_report)
        for day in range(1, 9)
        for rep in range(3)
    )
    return AnalyticsDatasetBuildResult(
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 8),
        generated_at=datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
        rows=rows,
        excluded_rows=(),
    )


# ---------------------------------------------------------------------------
# Formula parity: Python formula strings must reproduce R lmer() structure
# ---------------------------------------------------------------------------


def test_digit_span_formula_contains_all_r_script_terms() -> None:
    """Python formula for digit_span reproduces the R lmer() fixed-effect structure."""
    formula = ANALYTICS_MIXED_MODEL_FORMULAS["digit_span"]
    # All terms from the R script must appear in the Python formula.
    assert "digit_span_z" in formula
    assert "temperature_z" in formula
    assert "precipitation_z" in formula
    assert "depression_z" in formula
    assert "precipitation_z * depression_z" in formula or "precipitation_z*depression_z" in formula
    assert "daylight_z" in formula
    assert "daylight_z * depression_z" in formula or "daylight_z*depression_z" in formula
    assert "loneliness_z" in formula
    assert "precipitation_z * loneliness_z" in formula or "precipitation_z*loneliness_z" in formula
    assert "anxiety_z" in formula
    assert "(1 | date_bin)" in formula or "(1|date_bin)" in formula


def test_self_report_formula_contains_all_r_script_terms() -> None:
    """Python formula for self_report reproduces the R lmer() fixed-effect structure."""
    formula = ANALYTICS_MIXED_MODEL_FORMULAS["self_report"]
    assert "self_report_z" in formula
    assert "temperature_z" in formula
    assert "precipitation_z" in formula
    assert "depression_z" in formula
    assert "precipitation_z * depression_z" in formula or "precipitation_z*depression_z" in formula
    assert "daylight_z" in formula
    assert "daylight_z * depression_z" in formula or "daylight_z*depression_z" in formula
    assert "loneliness_z" in formula
    assert "precipitation_z * loneliness_z" in formula or "precipitation_z*loneliness_z" in formula
    assert "anxiety_z" in formula
    assert "(1 | date_bin)" in formula or "(1|date_bin)" in formula


def test_random_effect_grouping_field_matches_r_date_bin() -> None:
    """R script groups by date_bin; Python must use the same grouping field name."""
    assert ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD == "date_bin"


# ---------------------------------------------------------------------------
# Field-name parity: dataset row fields must match R ww_data column names
# ---------------------------------------------------------------------------


def test_dataset_row_field_names_match_r_ww_data_columns() -> None:
    """AnalyticsDatasetRow uses the same raw field names as the R ww_data frame."""
    row = _make_row(day=1, rep=0)
    # Access each raw field — if any name drifts from the R convention these will error.
    _ = row.temperature
    _ = row.precipitation
    _ = row.daylight_hours
    _ = row.anxiety
    _ = row.depression
    _ = row.loneliness
    _ = row.self_report
    _ = row.digit_span_score
    # And date grouping field
    _ = row.date_bin


# ---------------------------------------------------------------------------
# Standardization parity: z-score naming must match R's scale() output names
# ---------------------------------------------------------------------------


def test_z_scored_frame_uses_r_naming_convention_for_predictors() -> None:
    """After z-scoring, columns must carry the _z suffix matching R's mutate() names."""
    dataset = _build_parity_dataset()
    frame = _build_outcome_frame("digit_span", dataset.rows)
    z_frame, warnings = _z_score_outcome_frame("digit_span", frame)

    assert warnings == [], f"unexpected z-score warnings: {warnings}"
    # These must match R's: scale(temperature) → temperature_z, etc.
    expected_z_columns = {
        "temperature_z",
        "precipitation_z",
        "daylight_z",
        "depression_z",
        "loneliness_z",
        "anxiety_z",
        "digit_span_z",
    }
    for col in expected_z_columns:
        assert col in z_frame.columns, f"z-scored column '{col}' missing from frame"


def test_z_scored_self_report_frame_uses_r_naming_convention() -> None:
    """self_report model z-scored frame must carry self_report_z, matching R convention."""
    dataset = _build_parity_dataset()
    frame = _build_outcome_frame("self_report", dataset.rows)
    z_frame, warnings = _z_score_outcome_frame("self_report", frame)

    assert warnings == [], f"unexpected z-score warnings: {warnings}"
    assert "self_report_z" in z_frame.columns
    # Not digit_span_z — correct outcome column only
    assert "digit_span_z" not in z_frame.columns


# ---------------------------------------------------------------------------
# Inclusion parity: complete-case logic must match R's implicit NA filtering
# ---------------------------------------------------------------------------


def test_digit_span_frame_excludes_rows_without_digit_span_outcome() -> None:
    """R drops rows with NA digit_span_score before fitting; Python must do the same."""
    dataset = _build_parity_dataset()
    rows = list(dataset.rows)
    # Mark two rows as missing digit_span
    rows[0] = replace(rows[0], digit_span_score=None)
    rows[3] = replace(rows[3], digit_span_score=None)

    frame = _build_outcome_frame("digit_span", tuple(rows))
    assert len(frame.index) == len(rows) - 2


def test_self_report_frame_excludes_rows_without_self_report_outcome() -> None:
    """R drops rows with NA self_report before fitting; Python must do the same."""
    dataset = _build_parity_dataset()
    rows = list(dataset.rows)
    rows[1] = replace(rows[1], self_report=None)
    rows[5] = replace(rows[5], self_report=None)

    frame = _build_outcome_frame("self_report", tuple(rows))
    assert len(frame.index) == len(rows) - 2


def test_outcome_frames_are_independent_complete_case_samples() -> None:
    """Each model uses its own complete-case sample, not the intersection.

    The R script fits separate models on the full available data per outcome,
    not on rows where both outcomes are non-null simultaneously.
    """
    dataset = _build_parity_dataset()
    rows = list(dataset.rows)
    rows[0] = replace(rows[0], digit_span_score=None)
    rows[1] = replace(rows[1], self_report=None)

    digit_frame = _build_outcome_frame("digit_span", tuple(rows))
    self_frame = _build_outcome_frame("self_report", tuple(rows))

    # digit_frame loses row[0], self_frame loses row[1]: neither loses both
    assert len(digit_frame.index) == len(rows) - 1
    assert len(self_frame.index) == len(rows) - 1


# ---------------------------------------------------------------------------
# Full-pipeline parity fixture: fitted model terms match R lmer() summary terms
# ---------------------------------------------------------------------------


def test_fitted_model_terms_match_r_lmer_summary_terms() -> None:
    """Fitted model effects must include the same terms produced by R lmer() summary.

    This is the primary end-to-end parity fixture: verifying that the serialized
    effect output uses the same term names the R script reports in summary(digit_span_mlm)
    and summary(self_report_mlm).
    """
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.status == "ready"
    summaries = {model.outcome: model for model in result.models}
    assert set(summaries.keys()) == {"digit_span", "self_report"}

    for outcome, r_terms in [
        ("digit_span", _R_DIGIT_SPAN_FORMULA_TERMS - {"digit_span_z"}),
        ("self_report", _R_SELF_REPORT_FORMULA_TERMS - {"self_report_z"}),
    ]:
        fitted_terms = {effect.term for effect in summaries[outcome].effects}
        # All non-outcome R terms (excluding the intercept which R and statsmodels
        # handle differently) must appear in the Python model output.
        expected_fixed_terms = r_terms - {"Intercept"}
        missing = expected_fixed_terms - fitted_terms
        assert not missing, (
            f"{outcome}: Python model is missing R-script terms: {missing}. "
            f"Fitted terms: {fitted_terms}"
        )


def test_fitted_model_grouping_field_matches_r_date_bin() -> None:
    """Each model summary must declare date_bin as the random-effect grouping field."""
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.status == "ready"
    for model in result.models:
        assert model.grouping_field == "date_bin", (
            f"{model.outcome}: grouping_field is '{model.grouping_field}', expected 'date_bin'"
        )


# ---------------------------------------------------------------------------
# Visualization payload parity: effect plots and weather annotations
# ---------------------------------------------------------------------------


def test_visualizations_populated_when_models_converge() -> None:
    """fit_analytics_models must return non-null visualizations when models converge."""
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.status == "ready"
    assert result.visualizations is not None, "visualizations must not be None for a ready result"


def test_effect_plots_cover_both_outcomes() -> None:
    """Effect plots must include entries for both digit_span and self_report outcomes."""
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.visualizations is not None
    plot_outcomes = {plot.outcome for plot in result.visualizations.effect_plots}
    assert "digit_span" in plot_outcomes, "effect_plots must include digit_span outcome"
    assert "self_report" in plot_outcomes, "effect_plots must include self_report outcome"


def test_effect_plots_distinct_from_weather_daily_series() -> None:
    """Effect plot points have x (predictor_z), y (adjusted outcome_z), date_local —
    not date-keyed time-series values, keeping them semantically separate from /weather/daily.
    """
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.visualizations is not None
    for plot in result.visualizations.effect_plots:
        assert len(plot.points) > 0, f"{plot.outcome}/{plot.term}: points must not be empty"
        assert len(plot.fitted_line) > 0, f"{plot.outcome}/{plot.term}: fitted_line must not be empty"
        # Points must have valid z-scored x values (not raw dates)
        for pt in plot.points:
            assert isinstance(pt.x, float), "effect plot x must be a float (z-scored predictor)"
            assert isinstance(pt.y, float), "effect plot y must be a float (adjusted outcome)"
            assert pt.date_local is not None, "each point must carry its study date for annotation"


def test_weather_annotations_are_date_based_metadata() -> None:
    """Weather annotations must be date-range metadata only — no predictor-vs-residual values."""
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.visualizations is not None
    ann = result.visualizations.weather_annotations
    assert ann is not None, "weather_annotations must be populated"
    assert ann.date_from == dataset.date_from
    assert ann.date_to == dataset.date_to
    # Included dates should match all study days present in the dataset rows.
    row_dates = {row.date_local for row in dataset.rows}
    assert set(ann.included_dates) == row_dates, (
        "included_dates must match unique study days from the included dataset rows"
    )


def test_default_selected_term_is_main_effect() -> None:
    """The default_selected_term must be a non-interaction main effect term."""
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.visualizations is not None
    term = result.visualizations.default_selected_term
    assert term is not None, "default_selected_term must not be None when models converge"
    assert ":" not in term, (
        f"default_selected_term '{term}' must not be an interaction term"
    )


def test_effect_plot_fitted_line_r_formula_logical_field_mapping() -> None:
    """Fitted line y-values are proportional to the term coefficient (coef * x).

    This verifies the effect plot serialization is internally consistent: the
    fitted line represents only the selected term's contribution, as documented
    in ANALYTICS.md and matching the partial-residual approach from the R script.
    """
    dataset = _build_parity_dataset()
    result = fit_analytics_models(dataset)

    assert result.visualizations is not None
    for plot in result.visualizations.effect_plots:
        if len(plot.fitted_line) < 2:
            continue
        # All y/x ratios on the fitted line must equal the same coefficient.
        ratios = [pt.y / pt.x for pt in plot.fitted_line if abs(pt.x) > 1e-9]
        if ratios:
            max_deviation = max(abs(r - ratios[0]) for r in ratios)
            assert max_deviation < 1e-4, (
                f"{plot.outcome}/{plot.term}: fitted line is not linear (max deviation {max_deviation})"
            )
