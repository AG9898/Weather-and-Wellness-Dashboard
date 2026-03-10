"""Regression tests for the dashboard analytics mixed-model service."""

from __future__ import annotations

import math
import uuid
from dataclasses import replace
from datetime import date, datetime, timezone
from unittest.mock import patch

from app.analytics.constants import ANALYTICS_MIXED_MODEL_FORMULAS
from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.modeling import (
    _build_outcome_frame,
    _z_score_outcome_frame,
    fit_analytics_models,
)


def _build_dataset_result(
    *,
    constant_temperature: bool = False,
    constant_digit_span: bool = False,
) -> AnalyticsDatasetBuildResult:
    rows: list[AnalyticsDatasetRow] = []
    for day in range(1, 9):
        for rep in range(3):
            index = (day - 1) * 3 + rep
            temperature = 9.0 if constant_temperature else 5.5 + (day * 0.7) + (rep * 0.15)
            precipitation = (day % 4) * 0.8 + rep * 0.2 + (index % 3) * 0.05
            daylight_hours = 7.0 + day * 0.45 + rep * 0.12
            depression = 2.0 + ((index * 2) % 7) * 0.55 + day * 0.04
            loneliness = 1.4 + ((index * 3) % 5) * 0.35 + rep * 0.08
            anxiety = 3.2 + ((index * 5) % 6) * 0.42 + day * 0.03
            day_effect = {1: -0.35, 2: -0.2, 3: 0.1, 4: 0.25, 5: -0.05, 6: 0.28, 7: -0.12, 8: 0.18}[day]

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
                    digit_span_score=12 if constant_digit_span else int(round(digit_span_base)),
                    imported_fields=("self_report",) if index % 6 == 0 else (),
                )
            )

    return AnalyticsDatasetBuildResult(
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 8),
        generated_at=datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
        rows=tuple(rows),
        excluded_rows=(),
    )


def test_fit_analytics_models_returns_ready_summaries_for_both_outcomes() -> None:
    dataset_result = _build_dataset_result()
    generated_at = datetime(2026, 3, 10, 19, 0, tzinfo=timezone.utc)

    result = fit_analytics_models(dataset_result, generated_at=generated_at)

    assert result.status == "ready"
    assert result.dataset.included_sessions == 24
    assert result.dataset.included_days == 8
    assert result.dataset.imported_rows == 4
    assert len(result.models) == 2

    summaries = {model.outcome: model for model in result.models}
    digit_span_model = summaries["digit_span"]
    self_report_model = summaries["self_report"]

    assert digit_span_model.formula == ANALYTICS_MIXED_MODEL_FORMULAS["digit_span"]
    assert self_report_model.formula == ANALYTICS_MIXED_MODEL_FORMULAS["self_report"]
    assert digit_span_model.sample_size == 24
    assert self_report_model.sample_size == 24
    assert digit_span_model.day_count == 8
    assert digit_span_model.generated_at == generated_at

    digit_span_terms = {effect.term for effect in digit_span_model.effects}
    self_report_terms = {effect.term for effect in self_report_model.effects}
    assert "temperature_z" in digit_span_terms
    assert "precipitation_z:depression_z" in digit_span_terms
    assert "daylight_z:depression_z" in self_report_terms

    temperature_effect = next(
        effect for effect in digit_span_model.effects if effect.term == "temperature_z"
    )
    assert math.isfinite(temperature_effect.coefficient)
    assert math.isfinite(temperature_effect.standard_error)
    assert math.isfinite(temperature_effect.p_value)
    assert temperature_effect.direction in {"positive", "negative", "neutral"}


def test_fit_analytics_models_returns_insufficient_data_for_zero_variance_predictor() -> None:
    dataset_result = _build_dataset_result(constant_temperature=True)

    result = fit_analytics_models(dataset_result)

    assert result.status == "insufficient_data"
    assert result.models == ()
    assert any("temperature has zero variance" in warning for warning in result.warnings)


def test_fit_analytics_models_keeps_ready_status_when_one_outcome_is_skipped() -> None:
    dataset_result = _build_dataset_result(constant_digit_span=True)

    result = fit_analytics_models(dataset_result)

    assert result.status == "ready"
    assert len(result.models) == 1
    assert result.models[0].outcome == "self_report"
    assert any("digit_span_score has zero variance" in warning for warning in result.warnings)


def test_z_scoring_uses_each_outcome_complete_case_sample() -> None:
    rows = list(_build_dataset_result().rows)
    rows[0] = replace(rows[0], digit_span_score=None)
    rows[1] = replace(rows[1], self_report=None)

    digit_frame = _build_outcome_frame("digit_span", tuple(rows))
    digit_z_frame, digit_warnings = _z_score_outcome_frame("digit_span", digit_frame)
    self_report_frame = _build_outcome_frame("self_report", tuple(rows))
    self_report_z_frame, self_report_warnings = _z_score_outcome_frame(
        "self_report",
        self_report_frame,
    )

    assert digit_warnings == []
    assert self_report_warnings == []
    assert len(digit_z_frame.index) == 23
    assert len(self_report_z_frame.index) == 23
    assert digit_z_frame.iloc[0]["temperature_z"] != self_report_z_frame.iloc[0]["temperature_z"]


def test_mixed_model_fit_uses_reml_for_final_estimation() -> None:
    dataset_result = _build_dataset_result()

    fit_calls: list[dict[str, object]] = []

    class _FakeResult:
        converged = True

        def __init__(self) -> None:
            import pandas as pd

            index = [
                "Intercept",
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
            values = [0.0, 0.1, 0.02, -0.03, 0.04, -0.01, -0.02, 0.03, 0.01, 0.02]
            self.fe_params = pd.Series(values, index=index)
            self.bse_fe = pd.Series([0.1] * len(index), index=index)
            self.tvalues = pd.Series([1.0] * len(index), index=index)
            self.pvalues = pd.Series([0.5] * len(index), index=index)
            self._conf_int = pd.DataFrame(
                {0: [-0.2] * len(index), 1: [0.2] * len(index)},
                index=index,
            )

        def conf_int(self, alpha: float = 0.05):  # noqa: ANN001
            return self._conf_int

    class _FakeModel:
        def __init__(self) -> None:
            import numpy as np

            self.exog = np.eye(9)

        def fit(self, **kwargs: object) -> _FakeResult:
            fit_calls.append(kwargs)
            return _FakeResult()

    with patch("app.analytics.modeling.smf.mixedlm", return_value=_FakeModel()):
        result = fit_analytics_models(dataset_result)

    assert result.status == "ready"
    assert len(fit_calls) == 2
    assert all(call["reml"] is True for call in fit_calls)
