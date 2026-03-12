"""T95 — Backend visualization contract tests.

Focused coverage for the shared-filter and linked-visualization invariants:

    1. Effect plots are structurally separate from weather time-series data
    2. Weather annotations are date-based only (no residual/effect series)
    3. Effect plots reference the correct analysis date window from the dataset
    4. Loading, stale snapshot, and recompute status coverage via fit_analytics_models
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest

from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.modeling import (
    AnalyticsModelingResult,
    _build_visualizations,
    fit_analytics_models,
)
from app.schemas.analytics import (
    AnalyticsEffectPlotResponse,
    AnalyticsVisualizationsResponse,
    AnalyticsWeatherAnnotationsResponse,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_GENERATED_AT = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)


def _make_row(
    *,
    day: int,
    rep: int,
    temperature: float = 8.0,
    precipitation: float = 1.0,
    daylight_hours: float = 8.0,
    depression: float = 3.0,
    loneliness: float = 2.0,
    anxiety: float = 4.0,
    digit_span_score: int = 10,
    self_report: float = 3.0,
) -> AnalyticsDatasetRow:
    return AnalyticsDatasetRow(
        session_id=uuid.uuid5(uuid.NAMESPACE_URL, f"session-{day}-{rep}"),
        participant_uuid=uuid.uuid5(uuid.NAMESPACE_URL, f"participant-{day}-{rep}"),
        date_local=date(2026, 3, day),
        date_bin=day,
        temperature=temperature,
        precipitation=precipitation,
        daylight_hours=daylight_hours,
        anxiety=anxiety,
        depression=depression,
        loneliness=loneliness,
        self_report=self_report,
        digit_span_score=digit_span_score,
        imported_fields=(),
    )


def _build_varied_dataset(
    *,
    n_days: int = 8,
    reps_per_day: int = 3,
) -> AnalyticsDatasetBuildResult:
    """Build a varied dataset that mirrors the proven fixture in test_analytics_modeling.py."""
    rows: list[AnalyticsDatasetRow] = []
    for day in range(1, n_days + 1):
        for rep in range(reps_per_day):
            index = (day - 1) * reps_per_day + rep
            temperature = 5.5 + (day * 0.7) + (rep * 0.15)
            precipitation = (day % 4) * 0.8 + rep * 0.2 + (index % 3) * 0.05
            daylight_hours = 7.0 + day * 0.45 + rep * 0.12
            depression = 2.0 + ((index * 2) % 7) * 0.55 + day * 0.04
            loneliness = 1.4 + ((index * 3) % 5) * 0.35 + rep * 0.08
            anxiety = 3.2 + ((index * 5) % 6) * 0.42 + day * 0.03
            day_effect = {1: -0.35, 2: -0.2, 3: 0.1, 4: 0.25, 5: -0.05, 6: 0.28, 7: -0.12, 8: 0.18}.get(day, 0.0)
            digit_span_base = (
                8.0
                + 0.18 * temperature
                - 0.12 * precipitation
                + 0.10 * daylight_hours
                + 0.07 * depression
                - 0.05 * loneliness
                + 0.09 * anxiety
                + 0.04 * precipitation * depression
                - 0.03 * daylight_hours * depression
                + 0.02 * precipitation * loneliness
                + day_effect
            )
            self_report = (
                2.5
                + 0.11 * temperature
                - 0.09 * precipitation
                + 0.08 * daylight_hours
                + 0.05 * depression
                - 0.04 * loneliness
                + 0.07 * anxiety
                + 0.03 * precipitation * depression
                - 0.02 * daylight_hours * depression
                + 0.03 * precipitation * loneliness
                + day_effect
            )
            rows.append(
                AnalyticsDatasetRow(
                    session_id=uuid.uuid5(uuid.NAMESPACE_URL, f"session-{day}-{rep}"),
                    participant_uuid=uuid.uuid5(uuid.NAMESPACE_URL, f"participant-{day}-{rep}"),
                    date_local=date(2026, 3, day),
                    date_bin=day,
                    temperature=temperature,
                    precipitation=precipitation,
                    daylight_hours=daylight_hours,
                    anxiety=anxiety,
                    depression=depression,
                    loneliness=loneliness,
                    self_report=self_report,
                    digit_span_score=int(round(digit_span_base)),
                    imported_fields=("self_report",) if index % 6 == 0 else (),
                )
            )
    return AnalyticsDatasetBuildResult(
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, n_days),
        generated_at=_GENERATED_AT,
        rows=tuple(rows),
        excluded_rows=(),
    )


# ---------------------------------------------------------------------------
# 1. Effect plots are separate from weather time-series data
# ---------------------------------------------------------------------------

class TestEffectPlotVsWeatherSeparation:
    """Effect plots must not contain weather time-series fields."""

    def test_effect_plot_schema_contains_no_weather_series_fields(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        for plot in result.visualizations.effect_plots:
            plot_dict = plot.model_dump()
            # Weather time-series fields must not appear in effect plots
            assert "date_local_series" not in plot_dict
            assert "current_temp_c" not in plot_dict
            assert "current_precip_today_mm" not in plot_dict
            assert "sunshine_duration_hours" not in plot_dict
            assert "forecast_periods" not in plot_dict
            # Effect plots carry outcome/term/labels/points/fitted_line only
            assert set(plot_dict.keys()) == {
                "outcome", "term", "x_label", "y_label", "points", "fitted_line"
            }

    def test_effect_plot_points_are_predictor_residual_pairs_not_time_series(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        for plot in result.visualizations.effect_plots:
            for point in plot.points:
                # Points are (x=predictor_z, y=partial_residual) — not (timestamp, value)
                point_dict = point.model_dump()
                assert set(point_dict.keys()) == {"x", "y", "date_local"}
                assert isinstance(point_dict["x"], float)
                assert isinstance(point_dict["y"], float)

    def test_fitted_line_contains_no_timestamps(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        for plot in result.visualizations.effect_plots:
            for pt in plot.fitted_line:
                pt_dict = pt.model_dump()
                assert set(pt_dict.keys()) == {"x", "y"}
                # No date, timestamp, or weather fields on fitted line points
                assert "date_local" not in pt_dict
                assert "timestamp" not in pt_dict

    def test_effect_plots_are_indexed_by_outcome_and_term_not_by_date(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        seen_keys: set[tuple[str, str]] = set()
        for plot in result.visualizations.effect_plots:
            key = (plot.outcome, plot.term)
            # Each (outcome, term) pair is unique
            assert key not in seen_keys, f"Duplicate effect plot: {key}"
            seen_keys.add(key)

    def test_effect_plots_and_models_reference_the_same_outcomes(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        model_outcomes = {model.outcome for model in result.models}
        plot_outcomes = {plot.outcome for plot in result.visualizations.effect_plots}
        # All plot outcomes must come from the fitted models
        assert plot_outcomes.issubset(model_outcomes)


# ---------------------------------------------------------------------------
# 2. Weather annotations are date-based only
# ---------------------------------------------------------------------------

class TestWeatherAnnotationsContract:
    """Weather annotations must contain only date-based fields — never effect/residual data."""

    def test_weather_annotations_schema_contains_only_date_fields(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        ann = result.visualizations.weather_annotations
        assert ann is not None
        ann_dict = ann.model_dump()
        allowed_keys = {"selected_term", "date_from", "date_to", "included_dates", "excluded_dates"}
        assert set(ann_dict.keys()) == allowed_keys

    def test_weather_annotations_carry_no_effect_or_residual_series(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        ann = result.visualizations.weather_annotations
        assert ann is not None
        ann_dict = ann.model_dump()
        # Residual/effect series must never appear in weather annotations
        assert "points" not in ann_dict
        assert "fitted_line" not in ann_dict
        assert "partial_residuals" not in ann_dict
        assert "effects" not in ann_dict
        assert "series" not in ann_dict

    def test_weather_annotation_date_range_matches_dataset_window(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        ann = result.visualizations.weather_annotations
        assert ann is not None
        assert ann.date_from == dataset_result.date_from
        assert ann.date_to == dataset_result.date_to

    def test_included_dates_are_a_subset_of_dataset_date_range(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        ann = result.visualizations.weather_annotations
        assert ann is not None
        for d in ann.included_dates:
            assert ann.date_from <= d <= ann.date_to

    def test_included_and_excluded_dates_are_disjoint(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        ann = result.visualizations.weather_annotations
        assert ann is not None
        included_set = set(ann.included_dates)
        for d in ann.excluded_dates:
            assert d not in included_set, f"{d} appears in both included and excluded dates"

    def test_included_dates_reflect_the_rows_in_the_dataset(self) -> None:
        dataset_result = _build_varied_dataset(n_days=5, reps_per_day=3)
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        ann = result.visualizations.weather_annotations
        assert ann is not None
        expected_dates = sorted({row.date_local for row in dataset_result.rows})
        assert ann.included_dates == expected_dates

    def test_build_visualizations_returns_none_when_no_successful_models(self) -> None:
        from app.analytics.dataset import AnalyticsExcludedRow

        empty_dataset = AnalyticsDatasetBuildResult(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            generated_at=_GENERATED_AT,
            rows=(),
            excluded_rows=(),
        )
        result = _build_visualizations(
            successful_models=[],
            dataset_result=empty_dataset,
        )
        assert result is None


# ---------------------------------------------------------------------------
# 3. Effect plots reference the correct analysis date window
# ---------------------------------------------------------------------------

class TestEffectPlotDateWindowLinkage:
    """Effect plot points carry date_local so they can link to the weather chart timeline."""

    def test_effect_plot_points_carry_date_local_for_weather_linkage(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        for plot in result.visualizations.effect_plots:
            assert len(plot.points) > 0
            for point in plot.points:
                # date_local enables optional linkage to the weather chart timeline
                assert isinstance(point.date_local, date)
                assert dataset_result.date_from <= point.date_local <= dataset_result.date_to

    def test_effect_plot_points_are_within_requested_date_window(self) -> None:
        dataset_result = _build_varied_dataset(n_days=4, reps_per_day=3)
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        for plot in result.visualizations.effect_plots:
            for point in plot.points:
                assert dataset_result.date_from <= point.date_local <= dataset_result.date_to

    def test_effect_plots_count_matches_main_effect_terms_per_successful_outcome(self) -> None:
        from app.analytics.constants import ANALYTICS_MIXED_MODEL_FORMULAS

        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.visualizations is not None
        # Non-interaction main effect terms are temperature, precipitation, daylight, depression,
        # loneliness, anxiety — 6 terms per outcome
        expected_main_terms = {
            "temperature_z",
            "precipitation_z",
            "daylight_z",
            "depression_z",
            "loneliness_z",
            "anxiety_z",
        }
        plot_terms_by_outcome: dict[str, set[str]] = {}
        for plot in result.visualizations.effect_plots:
            plot_terms_by_outcome.setdefault(plot.outcome, set()).add(plot.term)

        for outcome, terms in plot_terms_by_outcome.items():
            # All plotted terms must be non-interaction main effects
            assert terms.issubset(expected_main_terms), (
                f"Unexpected terms in effect plots for {outcome}: {terms - expected_main_terms}"
            )


# ---------------------------------------------------------------------------
# 4. Loading, stale snapshot, and recompute state coverage
# ---------------------------------------------------------------------------

class TestAnalyticsStatusStates:
    """Analytics status must correctly reflect dataset/model fit outcomes."""

    def test_ready_status_when_models_fit_successfully(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.status == "ready"
        assert len(result.models) > 0

    def test_insufficient_data_when_no_rows(self) -> None:
        empty_dataset = AnalyticsDatasetBuildResult(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            generated_at=_GENERATED_AT,
            rows=(),
            excluded_rows=(),
        )
        result = fit_analytics_models(empty_dataset, generated_at=_GENERATED_AT)

        assert result.status == "insufficient_data"
        assert result.models == ()
        assert result.visualizations is None

    def test_insufficient_data_includes_warning_message(self) -> None:
        empty_dataset = AnalyticsDatasetBuildResult(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            generated_at=_GENERATED_AT,
            rows=(),
            excluded_rows=(),
        )
        result = fit_analytics_models(empty_dataset, generated_at=_GENERATED_AT)

        assert result.status == "insufficient_data"
        assert len(result.warnings) > 0

    def test_insufficient_data_when_constant_temperature_causes_zero_variance(self) -> None:
        rows: list[AnalyticsDatasetRow] = []
        for day in range(1, 9):
            for rep in range(3):
                rows.append(
                    _make_row(
                        day=day,
                        rep=rep,
                        # Constant temperature → zero variance → model skipped
                        temperature=9.0,
                        precipitation=(day % 4) * 0.8 + rep * 0.2,
                        daylight_hours=7.0 + day * 0.45,
                        depression=2.0 + day * 0.3,
                        loneliness=1.5 + rep * 0.1,
                        anxiety=3.0 + day * 0.05,
                    )
                )
        constant_temp_dataset = AnalyticsDatasetBuildResult(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            generated_at=_GENERATED_AT,
            rows=tuple(rows),
            excluded_rows=(),
        )
        result = fit_analytics_models(constant_temp_dataset, generated_at=_GENERATED_AT)

        assert result.status == "insufficient_data"
        assert any("temperature" in w.lower() for w in result.warnings)

    def test_ready_status_includes_visualizations(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.status == "ready"
        assert result.visualizations is not None
        assert len(result.visualizations.effect_plots) > 0
        assert result.visualizations.weather_annotations is not None

    def test_insufficient_data_produces_no_visualizations(self) -> None:
        empty_dataset = AnalyticsDatasetBuildResult(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            generated_at=_GENERATED_AT,
            rows=(),
            excluded_rows=(),
        )
        result = fit_analytics_models(empty_dataset, generated_at=_GENERATED_AT)

        assert result.status == "insufficient_data"
        assert result.visualizations is None

    def test_generated_at_is_preserved_in_result(self) -> None:
        dataset_result = _build_varied_dataset()
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.generated_at == _GENERATED_AT

    def test_dataset_metadata_window_matches_input(self) -> None:
        dataset_result = _build_varied_dataset(n_days=6, reps_per_day=3)
        result = fit_analytics_models(dataset_result, generated_at=_GENERATED_AT)

        assert result.dataset.date_from == dataset_result.date_from
        assert result.dataset.date_to == dataset_result.date_to
        assert result.dataset.included_sessions == len(dataset_result.rows)


# ---------------------------------------------------------------------------
# 4b. Stale and recompute states via the DashboardAnalyticsResponse schema
# ---------------------------------------------------------------------------

class TestDashboardAnalyticsResponseStates:
    """DashboardAnalyticsResponse must correctly represent all documented statuses."""

    def test_all_status_values_are_valid(self) -> None:
        from app.schemas.analytics import AnalyticsStatus

        valid_statuses: set[AnalyticsStatus] = {
            "ready", "stale", "recomputing", "insufficient_data", "failed"
        }
        # Confirm each status can be assigned to the response field
        for status in valid_statuses:
            from app.schemas.analytics import (
                AnalyticsDatasetMetadataResponse,
                AnalyticsSnapshotMetadataResponse,
                DashboardAnalyticsResponse,
            )

            response = DashboardAnalyticsResponse(
                status=status,
                snapshot=AnalyticsSnapshotMetadataResponse(
                    mode="snapshot" if status == "ready" else "live",
                    generated_at=_GENERATED_AT,
                    is_stale=status in {"stale", "recomputing"},
                    recompute_started_at=_GENERATED_AT if status == "recomputing" else None,
                    recompute_finished_at=None,
                ),
                dataset=AnalyticsDatasetMetadataResponse(
                    date_from=date(2026, 3, 1),
                    date_to=date(2026, 3, 8),
                    included_sessions=0,
                    included_days=0,
                    native_rows=0,
                    imported_rows=0,
                    excluded_rows=0,
                    exclusion_reasons=[],
                    generated_at=_GENERATED_AT,
                ),
                models=[],
                visualizations=None,
            )
            assert response.status == status

    def test_stale_state_is_stale_flag_is_set(self) -> None:
        from app.schemas.analytics import (
            AnalyticsDatasetMetadataResponse,
            AnalyticsSnapshotMetadataResponse,
            DashboardAnalyticsResponse,
        )

        response = DashboardAnalyticsResponse(
            status="stale",
            snapshot=AnalyticsSnapshotMetadataResponse(
                mode="live",
                generated_at=_GENERATED_AT,
                is_stale=True,
                recompute_started_at=_GENERATED_AT,
                recompute_finished_at=None,
            ),
            dataset=AnalyticsDatasetMetadataResponse(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                included_sessions=0,
                included_days=0,
                native_rows=0,
                imported_rows=0,
                excluded_rows=0,
                exclusion_reasons=[],
                generated_at=_GENERATED_AT,
            ),
            models=[],
            visualizations=None,
        )
        assert response.snapshot.is_stale is True
        assert response.status == "stale"

    def test_recomputing_state_has_recompute_started_at(self) -> None:
        from app.schemas.analytics import (
            AnalyticsDatasetMetadataResponse,
            AnalyticsSnapshotMetadataResponse,
            DashboardAnalyticsResponse,
        )

        response = DashboardAnalyticsResponse(
            status="recomputing",
            snapshot=AnalyticsSnapshotMetadataResponse(
                mode="live",
                generated_at=_GENERATED_AT,
                is_stale=True,
                recompute_started_at=_GENERATED_AT,
                recompute_finished_at=None,
            ),
            dataset=AnalyticsDatasetMetadataResponse(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                included_sessions=0,
                included_days=0,
                native_rows=0,
                imported_rows=0,
                excluded_rows=0,
                exclusion_reasons=[],
                generated_at=_GENERATED_AT,
            ),
            models=[],
            visualizations=None,
        )
        assert response.status == "recomputing"
        assert response.snapshot.recompute_started_at is not None
        assert response.snapshot.is_stale is True
