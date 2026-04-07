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
    AnalyticsTemperatureSummaryDayResponse,
    AnalyticsTemperatureSummaryFrequencyBinResponse,
    AnalyticsTemperatureSummaryGroupResponse,
    AnalyticsTemperatureSummaryResponse,
    AnalyticsTemperatureSummaryWindowResponse,
    AnalyticsSnapshotMetadataResponse,
    AnalyticsVisualizationsResponse,
    AnalyticsWeatherAnnotationsResponse,
    DashboardAnalyticsResponse,
)


def test_analytics_constants_define_v2_contract() -> None:
    assert ANALYTICS_RESPONSE_VERSION == "dashboard-analytics-v2"
    assert ANALYTICS_MODEL_VERSION == "weather-mlm-v2"
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
        temperature_summary=AnalyticsTemperatureSummaryResponse(
            windows=[
                AnalyticsTemperatureSummaryWindowResponse(
                    window_key="overall",
                    date_from=date(2026, 1, 1),
                    date_to=date(2026, 1, 31),
                    day_count=2,
                    participant_count=4,
                    mean_temperature_c=4.5,
                    sd_temperature_c=1.25,
                    cold_threshold_temperature_c=2.0,
                    hot_threshold_temperature_c=7.0,
                    threshold_method="window_day_zscore_v1",
                    threshold_z_cutoff=2,
                    frequency_bins=[
                        AnalyticsTemperatureSummaryFrequencyBinResponse(
                            bin_start_c=4.0,
                            bin_end_c=5.0,
                            day_count=1,
                        )
                    ],
                    cold_group=AnalyticsTemperatureSummaryGroupResponse(
                        day_count=1,
                        participant_count=2,
                        participant_ids=["p-1", "p-2"],
                        dates=[date(2026, 1, 2)],
                        days=[
                            AnalyticsTemperatureSummaryDayResponse(
                                date_local=date(2026, 1, 2),
                                temperature_c=3.2,
                                temperature_z=-2.4,
                                participant_ids=["p-1", "p-2"],
                                participant_count=2,
                            )
                        ],
                    ),
                    hot_group=AnalyticsTemperatureSummaryGroupResponse(
                        day_count=1,
                        participant_count=2,
                        participant_ids=["p-3", "p-4"],
                        dates=[date(2026, 1, 30)],
                        days=[
                            AnalyticsTemperatureSummaryDayResponse(
                                date_local=date(2026, 1, 30),
                                temperature_c=6.4,
                                temperature_z=2.6,
                                participant_ids=["p-3", "p-4"],
                                participant_count=2,
                            )
                        ],
                    ),
                )
            ]
        ),
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
    assert payload["temperature_summary"]["windows"][0]["window_key"] == "overall"
    assert payload["temperature_summary"]["windows"][0]["cold_threshold_temperature_c"] == 2.0
    assert payload["temperature_summary"]["windows"][0]["hot_threshold_temperature_c"] == 7.0
    assert payload["temperature_summary"]["windows"][0]["threshold_method"] == "window_day_zscore_v1"
    assert payload["temperature_summary"]["windows"][0]["threshold_z_cutoff"] == 2
    assert payload["temperature_summary"]["windows"][0]["cold_group"]["participant_ids"] == [
        "p-1",
        "p-2",
    ]
    assert payload["dataset"]["exclusion_reasons"][0]["reason"] == "missing_predictor"
