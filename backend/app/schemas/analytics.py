from __future__ import annotations

from datetime import date, datetime
from typing import Literal, TypeAlias

from pydantic import BaseModel, Field

from app.analytics.constants import (
    ANALYTICS_DEFAULT_MODE,
    ANALYTICS_MODEL_VERSION,
    ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD,
    ANALYTICS_RESPONSE_VERSION,
)

AnalyticsDirection: TypeAlias = Literal["positive", "negative", "neutral"]
AnalyticsOutcome: TypeAlias = Literal["digit_span", "self_report"]
AnalyticsReadMode: TypeAlias = Literal["snapshot", "live"]
AnalyticsStatus: TypeAlias = Literal[
    "ready",
    "stale",
    "recomputing",
    "insufficient_data",
    "failed",
]


class AnalyticsExclusionReasonResponse(BaseModel):
    """Summary count for a dataset exclusion reason."""

    reason: str
    count: int


class AnalyticsDatasetMetadataResponse(BaseModel):
    """Dataset-level metadata for the active analytics window."""

    date_from: date
    date_to: date
    included_sessions: int
    included_days: int
    native_rows: int
    imported_rows: int
    excluded_rows: int
    exclusion_reasons: list[AnalyticsExclusionReasonResponse] = Field(default_factory=list)
    generated_at: datetime


class AnalyticsSnapshotMetadataResponse(BaseModel):
    """Snapshot/live freshness metadata attached to an analytics response."""

    mode: AnalyticsReadMode = ANALYTICS_DEFAULT_MODE
    response_version: str = ANALYTICS_RESPONSE_VERSION
    model_version: str = ANALYTICS_MODEL_VERSION
    generated_at: datetime
    is_stale: bool = False
    recompute_started_at: datetime | None = None
    recompute_finished_at: datetime | None = None


class AnalyticsEffectCardResponse(BaseModel):
    """Serialized term-level KPI card from a fitted model."""

    term: str
    predictor: str
    is_interaction: bool
    coefficient: float
    standard_error: float
    statistic: float
    p_value: float
    ci_95_low: float
    ci_95_high: float
    direction: AnalyticsDirection
    significant: bool


class AnalyticsModelSummaryResponse(BaseModel):
    """Outcome-level mixed-model summary metadata."""

    outcome: AnalyticsOutcome
    formula: str
    grouping_field: str = ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD
    sample_size: int
    day_count: int
    converged: bool
    warnings: list[str] = Field(default_factory=list)
    model_version: str = ANALYTICS_MODEL_VERSION
    generated_at: datetime
    effects: list[AnalyticsEffectCardResponse] = Field(default_factory=list)


class AnalyticsEffectPlotPointResponse(BaseModel):
    """Observed point for a separate analytics effect plot."""

    x: float
    y: float
    date_local: date


class AnalyticsFittedLinePointResponse(BaseModel):
    """Single point on a fitted line or confidence band series."""

    x: float
    y: float


class AnalyticsEffectPlotResponse(BaseModel):
    """Chart-ready effect plot payload kept separate from weather time-series data."""

    outcome: AnalyticsOutcome
    term: str
    x_label: str
    y_label: str
    points: list[AnalyticsEffectPlotPointResponse] = Field(default_factory=list)
    fitted_line: list[AnalyticsFittedLinePointResponse] = Field(default_factory=list)


class AnalyticsWeatherAnnotationsResponse(BaseModel):
    """Date-based weather-chart metadata linked to the active analysis selection."""

    selected_term: str | None = None
    date_from: date
    date_to: date
    included_dates: list[date] = Field(default_factory=list)
    excluded_dates: list[date] = Field(default_factory=list)


class AnalyticsVisualizationsResponse(BaseModel):
    """Visualization payloads for separate effect plots and weather annotations."""

    default_selected_term: str | None = None
    effect_plots: list[AnalyticsEffectPlotResponse] = Field(default_factory=list)
    weather_annotations: AnalyticsWeatherAnnotationsResponse | None = None


class DashboardAnalyticsResponse(BaseModel):
    """Planned response contract for GET /dashboard/analytics."""

    status: AnalyticsStatus
    response_version: str = ANALYTICS_RESPONSE_VERSION
    snapshot: AnalyticsSnapshotMetadataResponse
    dataset: AnalyticsDatasetMetadataResponse
    models: list[AnalyticsModelSummaryResponse] = Field(default_factory=list)
    visualizations: AnalyticsVisualizationsResponse | None = None


__all__ = [
    "AnalyticsDatasetMetadataResponse",
    "AnalyticsDirection",
    "AnalyticsEffectCardResponse",
    "AnalyticsEffectPlotPointResponse",
    "AnalyticsEffectPlotResponse",
    "AnalyticsExclusionReasonResponse",
    "AnalyticsFittedLinePointResponse",
    "AnalyticsModelSummaryResponse",
    "AnalyticsOutcome",
    "AnalyticsReadMode",
    "AnalyticsSnapshotMetadataResponse",
    "AnalyticsStatus",
    "AnalyticsVisualizationsResponse",
    "AnalyticsWeatherAnnotationsResponse",
    "DashboardAnalyticsResponse",
]
