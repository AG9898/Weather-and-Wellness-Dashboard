"""Regression tests for the dashboard analytics temperature summary helper."""

from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timezone

from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.temperature_summary import build_temperature_summary


_GLOBAL_PARTICIPANT_COUNTER = 0


def _build_dataset(
    entries: list[tuple[date, float, int]],
) -> AnalyticsDatasetBuildResult:
    global _GLOBAL_PARTICIPANT_COUNTER
    rows: list[AnalyticsDatasetRow] = []
    for day_index, (date_local, temperature_c, participant_count) in enumerate(entries):
        for participant_index in range(participant_count):
            seed = f"{date_local.isoformat()}-{participant_index}"
            _GLOBAL_PARTICIPANT_COUNTER += 1
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
                    participant_number=_GLOBAL_PARTICIPANT_COUNTER,
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


def test_frequency_bins_participant_sessions_assigned_to_correct_bin() -> None:
    """Each bin's participant_sessions should list the session rows that fall into that bin."""
    # Two days in the same 1°C bin (floor 10), one day in a different bin (floor 11)
    p1_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "p1")
    p2_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "p2")
    p3_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "p3")
    s1_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "s1")
    s2_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "s2")
    s3_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "s3")

    rows = (
        AnalyticsDatasetRow(
            session_id=s1_uuid,
            participant_uuid=p1_uuid,
            date_local=date(2025, 1, 1),
            date_bin=1,
            temperature=10.3,
            precipitation=0.0,
            daylight_hours=8.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
            participant_number=101,
        ),
        AnalyticsDatasetRow(
            session_id=s2_uuid,
            participant_uuid=p2_uuid,
            date_local=date(2025, 1, 2),
            date_bin=2,
            temperature=10.9,
            precipitation=0.0,
            daylight_hours=8.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
            participant_number=102,
        ),
        AnalyticsDatasetRow(
            session_id=s3_uuid,
            participant_uuid=p3_uuid,
            date_local=date(2025, 1, 3),
            date_bin=3,
            temperature=11.5,
            precipitation=0.0,
            daylight_hours=8.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
            participant_number=103,
        ),
    )
    dataset = AnalyticsDatasetBuildResult(
        date_from=date(2025, 1, 1),
        date_to=date(2025, 1, 3),
        generated_at=datetime(2025, 8, 2, 12, 0, tzinfo=timezone.utc),
        rows=rows,
        excluded_rows=(),
    )

    summary = build_temperature_summary(dataset)
    overall = _window_by_key(summary, "overall")

    # Two bins: [10, 11) and [11, 12)
    assert len(overall.frequency_bins) == 2
    bin_10 = next(b for b in overall.frequency_bins if b.bin_start_c == 10.0)
    bin_11 = next(b for b in overall.frequency_bins if b.bin_start_c == 11.0)

    assert bin_10.day_count == 2
    assert len(bin_10.participant_sessions) == 2
    session_ids_in_10 = {ps.session_id for ps in bin_10.participant_sessions}
    assert s1_uuid in session_ids_in_10
    assert s2_uuid in session_ids_in_10

    participant_numbers_in_10 = {ps.participant_number for ps in bin_10.participant_sessions}
    assert participant_numbers_in_10 == {101, 102}

    assert bin_11.day_count == 1
    assert len(bin_11.participant_sessions) == 1
    assert bin_11.participant_sessions[0].session_id == s3_uuid
    assert bin_11.participant_sessions[0].participant_number == 103
    assert bin_11.participant_sessions[0].participant_uuid == p3_uuid
    assert bin_11.participant_sessions[0].date_local == date(2025, 1, 3)


def test_frequency_bins_participant_sessions_respect_day_count_semantics() -> None:
    """Bin day_count remains day-level; participant_sessions list can be longer."""
    # One day with 3 participants: day_count=1, but 3 participant_sessions entries
    p_uuids = [uuid.uuid5(uuid.NAMESPACE_URL, f"p{i}") for i in range(3)]
    s_uuids = [uuid.uuid5(uuid.NAMESPACE_URL, f"s{i}") for i in range(3)]

    rows = tuple(
        AnalyticsDatasetRow(
            session_id=s_uuids[i],
            participant_uuid=p_uuids[i],
            date_local=date(2025, 6, 15),
            date_bin=1,
            temperature=22.7,
            precipitation=0.0,
            daylight_hours=15.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
            participant_number=200 + i,
        )
        for i in range(3)
    )
    dataset = AnalyticsDatasetBuildResult(
        date_from=date(2025, 6, 15),
        date_to=date(2025, 6, 15),
        generated_at=datetime(2025, 8, 2, 12, 0, tzinfo=timezone.utc),
        rows=rows,
        excluded_rows=(),
    )

    summary = build_temperature_summary(dataset)
    overall = _window_by_key(summary, "overall")

    assert len(overall.frequency_bins) == 1
    the_bin = overall.frequency_bins[0]
    assert the_bin.bin_start_c == 22.0
    assert the_bin.bin_end_c == 23.0
    # Day count is still 1 (one unique study day)
    assert the_bin.day_count == 1
    # But participant_sessions has 3 entries
    assert len(the_bin.participant_sessions) == 3
    nums = {ps.participant_number for ps in the_bin.participant_sessions}
    assert nums == {200, 201, 202}


def test_frequency_bins_participant_sessions_respect_seasonal_window_split() -> None:
    """Seasonal windows only include sessions from days in that window."""
    p1_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "fw-p1")
    s1_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "fw-s1")
    p2_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "ss-p2")
    s2_uuid = uuid.uuid5(uuid.NAMESPACE_URL, "ss-s2")

    rows = (
        AnalyticsDatasetRow(
            session_id=s1_uuid,
            participant_uuid=p1_uuid,
            date_local=date(2025, 1, 15),  # fall/winter
            date_bin=1,
            temperature=5.0,
            precipitation=0.0,
            daylight_hours=8.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
            participant_number=301,
        ),
        AnalyticsDatasetRow(
            session_id=s2_uuid,
            participant_uuid=p2_uuid,
            date_local=date(2025, 6, 15),  # spring/summer
            date_bin=2,
            temperature=20.0,
            precipitation=0.0,
            daylight_hours=15.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
            participant_number=302,
        ),
    )
    dataset = AnalyticsDatasetBuildResult(
        date_from=date(2025, 1, 15),
        date_to=date(2025, 6, 15),
        generated_at=datetime(2025, 8, 2, 12, 0, tzinfo=timezone.utc),
        rows=rows,
        excluded_rows=(),
    )

    summary = build_temperature_summary(dataset)
    fall_winter = _window_by_key(summary, "fall_winter")
    spring_summer = _window_by_key(summary, "spring_summer")

    assert len(fall_winter.frequency_bins) == 1
    fw_bin = fall_winter.frequency_bins[0]
    assert fw_bin.bin_start_c == 5.0
    assert len(fw_bin.participant_sessions) == 1
    assert fw_bin.participant_sessions[0].session_id == s1_uuid
    assert fw_bin.participant_sessions[0].participant_number == 301

    assert len(spring_summer.frequency_bins) == 1
    ss_bin = spring_summer.frequency_bins[0]
    assert ss_bin.bin_start_c == 20.0
    assert len(ss_bin.participant_sessions) == 1
    assert ss_bin.participant_sessions[0].session_id == s2_uuid
    assert ss_bin.participant_sessions[0].participant_number == 302
