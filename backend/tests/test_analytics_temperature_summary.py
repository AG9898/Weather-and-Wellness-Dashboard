"""Regression tests for the dashboard analytics temperature summary helper."""

from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timezone

from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.temperature_summary import build_temperature_summary


def _build_dataset(
    entries: list[tuple[date, float, int]],
) -> AnalyticsDatasetBuildResult:
    rows: list[AnalyticsDatasetRow] = []
    for day_index, (date_local, temperature_c, participant_count) in enumerate(entries):
        for participant_index in range(participant_count):
            seed = f"{date_local.isoformat()}-{participant_index}"
            rows.append(
                AnalyticsDatasetRow(
                    session_id=uuid.uuid5(uuid.NAMESPACE_URL, f"session-{seed}"),
                    participant_uuid=uuid.uuid5(uuid.NAMESPACE_URL, f"participant-{seed}"),
                    date_local=date_local,
                    date_bin=day_index + 1,
                    temperature=temperature_c,
                    precipitation=0.0,
                    daylight_hours=10.0,
                    anxiety=1.0,
                    depression=1.0,
                    loneliness=1.0,
                    self_report=1.0,
                    digit_span_score=1,
                    imported_fields=(),
                )
            )

    date_from = min(entry[0] for entry in entries)
    date_to = max(entry[0] for entry in entries)
    return AnalyticsDatasetBuildResult(
        date_from=date_from,
        date_to=date_to,
        generated_at=datetime(2025, 8, 2, 12, 0, tzinfo=timezone.utc),
        rows=tuple(rows),
        excluded_rows=(),
    )


def _window_by_key(summary, window_key: str):
    return next(window for window in summary.windows if window.window_key == window_key)


def test_temperature_summary_matches_documented_oracle_counts_and_dates() -> None:
    dataset = _build_dataset(
        [
            (date(2025, 1, 1), 50.0, 1),
            (date(2025, 1, 5), 50.0, 1),
            (date(2025, 1, 9), 50.0, 1),
            (date(2025, 1, 13), 50.0, 1),
            (date(2025, 1, 17), 50.0, 1),
            (date(2025, 1, 21), 50.0, 1),
            (date(2025, 1, 25), 50.0, 1),
            (date(2025, 1, 29), 50.0, 1),
            (date(2025, 2, 2), 50.0, 1),
            (date(2025, 2, 6), 50.0, 1),
            (date(2025, 2, 10), 50.0, 1),
            (date(2025, 2, 14), 50.0, 1),
            (date(2025, 2, 18), 50.0, 1),
            (date(2025, 2, 20), 100.0, 3),
            (date(2025, 2, 22), 50.0, 1),
            (date(2025, 2, 26), 50.0, 1),
            (date(2025, 3, 1), 50.0, 1),
            (date(2025, 3, 4), -10.0, 1),
            (date(2025, 3, 6), -10.0, 1),
            (date(2025, 3, 8), 50.0, 1),
            (date(2025, 3, 12), 50.0, 1),
            (date(2025, 3, 16), 50.0, 1),
            (date(2025, 7, 29), 120.0, 1),
            (date(2025, 8, 1), 130.0, 1),
        ]
    )

    summary = build_temperature_summary(dataset)
    overall = _window_by_key(summary, "overall")
    fall_winter = _window_by_key(summary, "fall_winter")
    spring_summer = _window_by_key(summary, "spring_summer")

    assert overall.day_count == 24
    assert overall.participant_count == 26
    assert overall.cold_group.day_count == 2
    assert overall.cold_group.participant_count == 2
    assert overall.cold_group.dates == [date(2025, 3, 4), date(2025, 3, 6)]
    assert overall.hot_group.day_count == 2
    assert overall.hot_group.participant_count == 2
    assert overall.hot_group.dates == [date(2025, 7, 29), date(2025, 8, 1)]
    assert overall.threshold_method == "window_day_zscore_v1"
    assert overall.threshold_z_cutoff == 2
    assert math.isclose(
        overall.cold_threshold_temperature_c,
        overall.mean_temperature_c - (2 * overall.sd_temperature_c),
    )
    assert math.isclose(
        overall.hot_threshold_temperature_c,
        overall.mean_temperature_c + (2 * overall.sd_temperature_c),
    )

    assert fall_winter.cold_group.day_count == 2
    assert fall_winter.cold_group.participant_count == 2
    assert fall_winter.hot_group.day_count == 1
    assert fall_winter.hot_group.participant_count == 3
    assert fall_winter.threshold_method == "window_day_zscore_v1"
    assert fall_winter.threshold_z_cutoff == 2
    assert math.isclose(
        fall_winter.cold_threshold_temperature_c,
        fall_winter.mean_temperature_c - (2 * fall_winter.sd_temperature_c),
    )
    assert math.isclose(
        fall_winter.hot_threshold_temperature_c,
        fall_winter.mean_temperature_c + (2 * fall_winter.sd_temperature_c),
    )

    assert spring_summer.cold_group.day_count == 0
    assert spring_summer.cold_group.participant_count == 0
    assert spring_summer.hot_group.day_count == 0
    assert spring_summer.hot_group.participant_count == 0
    assert spring_summer.threshold_method == "window_day_zscore_v1"
    assert spring_summer.threshold_z_cutoff == 2
    assert math.isclose(
        spring_summer.cold_threshold_temperature_c,
        spring_summer.mean_temperature_c - (2 * spring_summer.sd_temperature_c),
    )
    assert math.isclose(
        spring_summer.hot_threshold_temperature_c,
        spring_summer.mean_temperature_c + (2 * spring_summer.sd_temperature_c),
    )


def test_temperature_summary_frequency_bins_count_unique_days_not_rows() -> None:
    dataset = _build_dataset(
        [
            (date(2025, 1, 1), 10.0, 5),
            (date(2025, 1, 2), 10.4, 1),
        ]
    )

    summary = build_temperature_summary(dataset)
    overall = _window_by_key(summary, "overall")

    assert overall.day_count == 2
    assert overall.participant_count == 6
    assert len(overall.frequency_bins) == 1
    assert overall.frequency_bins[0].bin_start_c == 10.0
    assert overall.frequency_bins[0].bin_end_c == 11.0
    assert overall.frequency_bins[0].day_count == 2


def test_temperature_summary_returns_zero_payload_for_empty_seasonal_window() -> None:
    dataset = _build_dataset(
        [
            (date(2025, 7, 29), 120.0, 1),
            (date(2025, 8, 1), 130.0, 1),
        ]
    )

    summary = build_temperature_summary(dataset)
    fall_winter = _window_by_key(summary, "fall_winter")

    assert fall_winter.date_from is None
    assert fall_winter.date_to is None
    assert fall_winter.day_count == 0
    assert fall_winter.participant_count == 0
    assert fall_winter.mean_temperature_c is None
    assert fall_winter.sd_temperature_c is None
    assert fall_winter.frequency_bins == []
    assert fall_winter.cold_group.day_count == 0
    assert fall_winter.cold_group.participant_count == 0
    assert fall_winter.cold_group.participant_ids == []
    assert fall_winter.cold_group.dates == []
    assert fall_winter.cold_group.days == []
    assert fall_winter.hot_group.day_count == 0
    assert fall_winter.hot_group.participant_count == 0
    assert fall_winter.hot_group.participant_ids == []
    assert fall_winter.hot_group.dates == []
    assert fall_winter.hot_group.days == []


def test_temperature_summary_nulls_thresholds_for_single_day_window() -> None:
    dataset = _build_dataset(
        [
            (date(2025, 1, 1), 10.0, 3),
        ]
    )

    summary = build_temperature_summary(dataset)
    overall = _window_by_key(summary, "overall")

    assert overall.day_count == 1
    assert overall.mean_temperature_c == 10.0
    assert overall.sd_temperature_c == 0.0
    assert overall.cold_threshold_temperature_c is None
    assert overall.hot_threshold_temperature_c is None
    assert overall.threshold_method == "window_day_zscore_v1"
    assert overall.threshold_z_cutoff == 2


def test_temperature_summary_nulls_thresholds_for_zero_variance_window() -> None:
    dataset = _build_dataset(
        [
            (date(2025, 1, 1), 10.0, 1),
            (date(2025, 1, 2), 10.0, 1),
        ]
    )

    summary = build_temperature_summary(dataset)
    overall = _window_by_key(summary, "overall")

    assert overall.day_count == 2
    assert overall.mean_temperature_c == 10.0
    assert overall.sd_temperature_c == 0.0
    assert overall.cold_threshold_temperature_c is None
    assert overall.hot_threshold_temperature_c is None
    assert overall.threshold_method == "window_day_zscore_v1"
    assert overall.threshold_z_cutoff == 2
