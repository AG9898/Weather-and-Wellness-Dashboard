from __future__ import annotations

from datetime import date, datetime, timezone

from app.analytics.constants import (
    ANALYTICS_MIXED_MODEL_FORMULAS,
    ANALYTICS_MODEL_VERSION,
    ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD,
    ANALYTICS_RESPONSE_VERSION,
)
from app.schemas.analytics import (
    AnalyticsDatasetMetadataResponse,
    AnalyticsEffectCardResponse,
    AnalyticsExclusionReasonResponse,
    AnalyticsModelSummaryResponse,
    AnalyticsSnapshotMetadataResponse,
    AnalyticsVisualizationsResponse,
    AnalyticsWeatherAnnotationsResponse,
    DashboardAnalyticsResponse,
)


def test_analytics_constants_define_v1_contract() -> None:
    assert ANALYTICS_RESPONSE_VERSION == "dashboard-analytics-v1"
    assert ANALYTICS_MODEL_VERSION == "weather-mlm-v1"
    assert ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD == "date_bin"
    assert set(ANALYTICS_MIXED_MODEL_FORMULAS) == {"digit_span", "self_report"}


def test_dashboard_analytics_response_serializes_scaffolded_payload() -> None:
    generated_at = datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc)

    response = DashboardAnalyticsResponse(
        status="ready",
        snapshot=AnalyticsSnapshotMetadataResponse(generated_at=generated_at),
        dataset=AnalyticsDatasetMetadataResponse(
            date_from=date(2026, 1, 1),
            date_to=date(2026, 1, 31),
            included_sessions=24,
            included_days=18,
            native_rows=20,
            imported_rows=4,
            excluded_rows=3,
            exclusion_reasons=[
                AnalyticsExclusionReasonResponse(
                    reason="missing_predictor",
                    count=2,
                ),
                AnalyticsExclusionReasonResponse(
                    reason="missing_outcome",
                    count=1,
                ),
            ],
            generated_at=generated_at,
        ),
        models=[
            AnalyticsModelSummaryResponse(
                outcome="digit_span",
                formula=ANALYTICS_MIXED_MODEL_FORMULAS["digit_span"],
                sample_size=24,
                day_count=18,
                converged=True,
                generated_at=generated_at,
                effects=[
                    AnalyticsEffectCardResponse(
                        term="temperature_z",
                        predictor="temperature_z",
                        is_interaction=False,
                        coefficient=0.21,
                        standard_error=0.08,
                        statistic=2.62,
                        p_value=0.012,
                        ci_95_low=0.05,
                        ci_95_high=0.37,
                        direction="positive",
                        significant=True,
                    )
                ],
            )
        ],
        visualizations=AnalyticsVisualizationsResponse(
            default_selected_term="temperature_z",
            weather_annotations=AnalyticsWeatherAnnotationsResponse(
                selected_term="temperature_z",
                date_from=date(2026, 1, 1),
                date_to=date(2026, 1, 31),
                included_dates=[date(2026, 1, 2)],
                excluded_dates=[date(2026, 1, 3)],
            ),
        ),
    )

    payload = response.model_dump(mode="json")

    assert payload["response_version"] == ANALYTICS_RESPONSE_VERSION
    assert payload["snapshot"]["model_version"] == ANALYTICS_MODEL_VERSION
    assert payload["models"][0]["grouping_field"] == ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD
    assert payload["models"][0]["effects"][0]["direction"] == "positive"
    assert payload["dataset"]["exclusion_reasons"][0]["reason"] == "missing_predictor"
