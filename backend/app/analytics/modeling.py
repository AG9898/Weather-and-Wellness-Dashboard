"""Mixed-model fitting service for dashboard analytics."""

from __future__ import annotations

import math
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from app.analytics.constants import (
    ANALYTICS_MIXED_MODEL_FORMULAS,
    ANALYTICS_MODEL_VERSION,
)
from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.schemas.analytics import (
    AnalyticsDatasetMetadataResponse,
    AnalyticsEffectCardResponse,
    AnalyticsExclusionReasonResponse,
    AnalyticsModelSummaryResponse,
    AnalyticsStatus,
)

AnalyticsOutcomeName = Literal["digit_span", "self_report"]

_FIXED_EFFECT_FORMULAS: dict[AnalyticsOutcomeName, str] = {
    "digit_span": (
        "digit_span_z ~ temperature_z + precipitation_z * depression_z + "
        "daylight_z * depression_z + precipitation_z * loneliness_z + anxiety_z"
    ),
    "self_report": (
        "self_report_z ~ temperature_z + precipitation_z * depression_z + "
        "daylight_z * depression_z + precipitation_z * loneliness_z + anxiety_z"
    ),
}

_OUTCOME_SOURCE_FIELDS: dict[AnalyticsOutcomeName, str] = {
    "digit_span": "digit_span_score",
    "self_report": "self_report",
}

_OUTCOME_Z_FIELDS: dict[AnalyticsOutcomeName, str] = {
    "digit_span": "digit_span_z",
    "self_report": "self_report_z",
}

_COMMON_Z_FIELDS: tuple[tuple[str, str], ...] = (
    ("temperature", "temperature_z"),
    ("precipitation", "precipitation_z"),
    ("daylight_hours", "daylight_z"),
    ("depression", "depression_z"),
    ("loneliness", "loneliness_z"),
    ("anxiety", "anxiety_z"),
)

_EFFECT_TERM_ORDER: tuple[str, ...] = (
    "temperature_z",
    "precipitation_z",
    "depression_z",
    "precipitation_z:depression_z",
    "daylight_z",
    "daylight_z:depression_z",
    "loneliness_z",
    "precipitation_z:loneliness_z",
    "anxiety_z",
)

_FIT_METHODS: tuple[str, ...] = ("lbfgs", "powell")
_SIGNIFICANCE_P_VALUE = 0.05


@dataclass(frozen=True)
class AnalyticsModelingResult:
    """Serialized mixed-model output plus typed status/warnings."""

    status: AnalyticsStatus
    generated_at: datetime
    dataset: AnalyticsDatasetMetadataResponse
    models: tuple[AnalyticsModelSummaryResponse, ...]
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True)
class _OutcomeModelResult:
    summary: AnalyticsModelSummaryResponse | None
    warnings: tuple[str, ...] = ()
    failed: bool = False


def build_analytics_dataset_metadata(
    dataset_result: AnalyticsDatasetBuildResult,
) -> AnalyticsDatasetMetadataResponse:
    """Serialize canonical dataset counts into the dashboard contract."""

    return AnalyticsDatasetMetadataResponse(
        date_from=dataset_result.date_from,
        date_to=dataset_result.date_to,
        included_sessions=dataset_result.included_sessions,
        included_days=dataset_result.included_days,
        native_rows=dataset_result.native_rows,
        imported_rows=dataset_result.imported_rows,
        excluded_rows=dataset_result.excluded_count,
        exclusion_reasons=[
            AnalyticsExclusionReasonResponse(reason=item.reason, count=item.count)
            for item in dataset_result.exclusion_reasons
        ],
        generated_at=dataset_result.generated_at,
    )


def fit_analytics_models(
    dataset_result: AnalyticsDatasetBuildResult,
    *,
    generated_at: datetime | None = None,
) -> AnalyticsModelingResult:
    """Fit the planned dashboard mixed models for the active dataset window."""

    fit_generated_at = generated_at or datetime.now(timezone.utc)
    dataset_metadata = build_analytics_dataset_metadata(dataset_result)
    rows = dataset_result.rows
    if not rows:
        return AnalyticsModelingResult(
            status="insufficient_data",
            generated_at=fit_generated_at,
            dataset=dataset_metadata,
            models=(),
            warnings=("No canonical analytics rows are available for the requested window.",),
        )

    model_results: list[AnalyticsModelSummaryResponse] = []
    warnings_out: list[str] = []
    had_failure = False

    for outcome in ("digit_span", "self_report"):
        model_result = _fit_outcome_model(
            outcome,
            rows=rows,
            generated_at=fit_generated_at,
        )
        warnings_out.extend(model_result.warnings)
        if model_result.summary is not None:
            model_results.append(model_result.summary)
        had_failure = had_failure or model_result.failed

    if had_failure:
        status: AnalyticsStatus = "failed"
    elif model_results:
        status = "ready"
    else:
        status = "insufficient_data"

    return AnalyticsModelingResult(
        status=status,
        generated_at=fit_generated_at,
        dataset=dataset_metadata,
        models=tuple(model_results),
        warnings=tuple(_dedupe_messages(warnings_out)),
    )


def _fit_outcome_model(
    outcome: AnalyticsOutcomeName,
    *,
    rows: tuple[AnalyticsDatasetRow, ...],
    generated_at: datetime,
) -> _OutcomeModelResult:
    outcome_frame = _build_outcome_frame(outcome, rows)
    if outcome_frame.empty:
        return _OutcomeModelResult(
            summary=None,
            warnings=(
                f"{outcome} model skipped: no rows include the required outcome in the requested window.",
            ),
        )

    if outcome_frame["date_bin"].nunique() < 2:
        return _OutcomeModelResult(
            summary=None,
            warnings=(
                f"{outcome} model skipped: at least 2 distinct study days are required for mixed-model fitting.",
            ),
        )

    z_scored_frame, z_score_warnings = _z_score_outcome_frame(outcome, outcome_frame)
    if z_score_warnings:
        return _OutcomeModelResult(summary=None, warnings=tuple(z_score_warnings))

    try:
        model = smf.mixedlm(
            _FIXED_EFFECT_FORMULAS[outcome],
            z_scored_frame,
            groups=z_scored_frame["date_bin"],
        )
        if np.linalg.matrix_rank(model.exog) < model.exog.shape[1]:
            return _OutcomeModelResult(
                summary=None,
                warnings=(
                    f"{outcome} model skipped: the fixed-effects design matrix is rank deficient for the requested window.",
                ),
            )
        fit_result, fit_warnings = _fit_mixed_model(model, outcome=outcome)
        summary = _serialize_model_summary(
            outcome,
            fit_result=fit_result,
            sample_size=len(z_scored_frame.index),
            day_count=int(z_scored_frame["date_bin"].nunique()),
            generated_at=generated_at,
            warnings_in=fit_warnings,
        )
    except Exception as exc:  # pragma: no cover - defensive path
        return _OutcomeModelResult(
            summary=None,
            warnings=(f"{outcome} model failed: {exc}",),
            failed=True,
        )

    return _OutcomeModelResult(summary=summary, warnings=())


def _build_outcome_frame(
    outcome: AnalyticsOutcomeName,
    rows: tuple[AnalyticsDatasetRow, ...],
) -> pd.DataFrame:
    source_field = _OUTCOME_SOURCE_FIELDS[outcome]
    frame_rows = [
        {
            "date_bin": row.date_bin,
            "temperature": row.temperature,
            "precipitation": row.precipitation,
            "daylight_hours": row.daylight_hours,
            "depression": row.depression,
            "loneliness": row.loneliness,
            "anxiety": row.anxiety,
            source_field: getattr(row, source_field),
        }
        for row in rows
        if getattr(row, source_field) is not None
    ]
    return pd.DataFrame(frame_rows)


def _z_score_outcome_frame(
    outcome: AnalyticsOutcomeName,
    frame: pd.DataFrame,
) -> tuple[pd.DataFrame, list[str]]:
    z_frame = frame.copy()
    warnings_out: list[str] = []
    z_fields = list(_COMMON_Z_FIELDS)
    z_fields.append((_OUTCOME_SOURCE_FIELDS[outcome], _OUTCOME_Z_FIELDS[outcome]))

    for source_field, z_field in z_fields:
        series = z_frame[source_field].astype(float)
        standard_deviation = float(series.std(ddof=1))
        if len(series.index) < 2 or not math.isfinite(standard_deviation) or standard_deviation <= 0.0:
            warnings_out.append(
                f"{outcome} model skipped: {source_field} has zero variance within the requested analysis window."
            )
            continue

        mean_value = float(series.mean())
        z_frame[z_field] = (series - mean_value) / standard_deviation

    return z_frame, warnings_out


def _fit_mixed_model(model: object, *, outcome: AnalyticsOutcomeName) -> tuple[object, tuple[str, ...]]:
    warnings_out: list[str] = []
    last_error: Exception | None = None

    for method in _FIT_METHODS:
        with warnings.catch_warnings(record=True) as captured_warnings:
            warnings.simplefilter("always")
            try:
                fit_result = model.fit(
                    reml=True,
                    method=method,
                    maxiter=200,
                    disp=False,
                )
            except Exception as exc:  # pragma: no cover - depends on optimizer internals
                last_error = exc
                warnings_out.append(
                    f"{outcome} model optimizer {method} failed: {exc}"
                )
                continue

        warnings_out.extend(
            str(item.message).strip()
            for item in captured_warnings
            if str(item.message).strip()
        )
        if method != _FIT_METHODS[0]:
            warnings_out.append(f"{outcome} model converged after retrying with optimizer {method}.")
        return fit_result, tuple(_dedupe_messages(warnings_out))

    if last_error is None:  # pragma: no cover - defensive path
        raise RuntimeError(f"{outcome} model failed before an optimizer error was captured.")
    raise last_error


def _serialize_model_summary(
    outcome: AnalyticsOutcomeName,
    *,
    fit_result: object,
    sample_size: int,
    day_count: int,
    generated_at: datetime,
    warnings_in: tuple[str, ...],
) -> AnalyticsModelSummaryResponse:
    warnings_out = list(warnings_in)
    converged = bool(getattr(fit_result, "converged", False))
    if not converged:
        warnings_out.append(f"{outcome} model did not converge.")

    fixed_effects = getattr(fit_result, "fe_params")
    term_names = [term for term in _EFFECT_TERM_ORDER if term in fixed_effects.index]
    confidence_intervals = fit_result.conf_int(alpha=0.05)

    effect_cards: list[AnalyticsEffectCardResponse] = []
    for term in term_names:
        coefficient = _finite_value(float(fixed_effects[term]), outcome=outcome, term=term)
        standard_error = _finite_value(float(fit_result.bse_fe[term]), outcome=outcome, term=term)
        statistic = _finite_value(float(fit_result.tvalues[term]), outcome=outcome, term=term)
        p_value = _finite_value(float(fit_result.pvalues[term]), outcome=outcome, term=term)
        ci_low, ci_high = confidence_intervals.loc[term]
        ci_95_low = _finite_value(float(ci_low), outcome=outcome, term=term)
        ci_95_high = _finite_value(float(ci_high), outcome=outcome, term=term)

        effect_cards.append(
            AnalyticsEffectCardResponse(
                term=term,
                predictor=term.replace(":", " x "),
                is_interaction=":" in term,
                coefficient=coefficient,
                standard_error=standard_error,
                statistic=statistic,
                p_value=p_value,
                ci_95_low=ci_95_low,
                ci_95_high=ci_95_high,
                direction=_coefficient_direction(coefficient),
                significant=p_value < _SIGNIFICANCE_P_VALUE,
            )
        )

    return AnalyticsModelSummaryResponse(
        outcome=outcome,
        formula=ANALYTICS_MIXED_MODEL_FORMULAS[outcome],
        sample_size=sample_size,
        day_count=day_count,
        converged=converged,
        warnings=_dedupe_messages(warnings_out),
        model_version=ANALYTICS_MODEL_VERSION,
        generated_at=generated_at,
        effects=effect_cards,
    )


def _coefficient_direction(coefficient: float) -> Literal["positive", "negative", "neutral"]:
    if coefficient > 0:
        return "positive"
    if coefficient < 0:
        return "negative"
    return "neutral"


def _finite_value(value: float, *, outcome: AnalyticsOutcomeName, term: str) -> float:
    if not math.isfinite(value):
        raise ValueError(f"{outcome} model produced a non-finite estimate for {term}.")
    return value


def _dedupe_messages(messages: list[str]) -> list[str]:
    seen: set[str] = set()
    deduped: list[str] = []
    for message in messages:
        if message not in seen:
            deduped.append(message)
            seen.add(message)
    return deduped


__all__ = [
    "AnalyticsModelingResult",
    "build_analytics_dataset_metadata",
    "fit_analytics_models",
]
