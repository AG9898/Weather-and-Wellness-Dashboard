"""Shared analytics config and version constants for dashboard modeling."""

from __future__ import annotations

ANALYTICS_RESPONSE_VERSION = "dashboard-analytics-v1"
ANALYTICS_MODEL_VERSION = "weather-mlm-v1"
ANALYTICS_DEFAULT_MODE = "snapshot"
ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD = "date_bin"

ANALYTICS_MIXED_MODEL_FORMULAS: dict[str, str] = {
    "digit_span": (
        "digit_span_z ~ temperature_z + precipitation_z * depression_z + "
        "daylight_z * depression_z + precipitation_z * loneliness_z + "
        "anxiety_z + (1 | date_bin)"
    ),
    "self_report": (
        "self_report_z ~ temperature_z + precipitation_z * depression_z + "
        "daylight_z * depression_z + precipitation_z * loneliness_z + "
        "anxiety_z + (1 | date_bin)"
    ),
}

__all__ = [
    "ANALYTICS_RESPONSE_VERSION",
    "ANALYTICS_MODEL_VERSION",
    "ANALYTICS_DEFAULT_MODE",
    "ANALYTICS_RANDOM_EFFECT_GROUPING_FIELD",
    "ANALYTICS_MIXED_MODEL_FORMULAS",
]
