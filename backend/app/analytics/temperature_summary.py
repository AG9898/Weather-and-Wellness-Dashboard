"""Day-level temperature summary helper for dashboard analytics."""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.constants import (
    ANALYTICS_TEMPERATURE_THRESHOLD_METHOD,
    ANALYTICS_TEMPERATURE_THRESHOLD_Z_CUTOFF,
)
from app.schemas.analytics import (
    AnalyticsTemperatureSummaryDayResponse,
    AnalyticsTemperatureSummaryFrequencyBinResponse,
    AnalyticsTemperatureSummaryGroupResponse,
    AnalyticsTemperatureSummaryParticipantSessionResponse,
    AnalyticsTemperatureSummaryResponse,
    AnalyticsTemperatureSummaryWindowResponse,
)


@dataclass(frozen=True)
class _TemperatureDayAggregate:
    date_local: date
    temperature_c: float
    participant_count: int
    participant_ids: tuple[str, ...]


@dataclass
class _TemperatureDayBucket:
    temperatures: set[float]
    participant_ids: set[str]
    participant_count: int = 0


def build_temperature_summary(
    dataset_result: AnalyticsDatasetBuildResult,
) -> AnalyticsTemperatureSummaryResponse:
    """Build the descriptive temperature summary for the active analytics window."""

    rows = dataset_result.rows
    day_aggregates = _aggregate_temperature_days(rows)
    windows = [
        _build_temperature_window("overall", day_aggregates, rows),
        _build_temperature_window(
            "fall_winter",
            tuple(day for day in day_aggregates if _is_fall_winter(day.date_local)),
            tuple(row for row in rows if _is_fall_winter(row.date_local)),
        ),
        _build_temperature_window(
            "spring_summer",
            tuple(day for day in day_aggregates if _is_spring_summer(day.date_local)),
            tuple(row for row in rows if _is_spring_summer(row.date_local)),
        ),
    ]
    return AnalyticsTemperatureSummaryResponse(windows=windows)


def _aggregate_temperature_days(
    rows: tuple[AnalyticsDatasetRow, ...],
) -> tuple[_TemperatureDayAggregate, ...]:
    if not rows:
        return ()

    grouped: dict[date, _TemperatureDayBucket] = defaultdict(
        lambda: _TemperatureDayBucket(temperatures=set(), participant_ids=set())
    )
    for row in rows:
        bucket = grouped[row.date_local]
        bucket.temperatures.add(float(row.temperature))
        bucket.participant_ids.add(str(row.participant_uuid))
        bucket.participant_count += 1

    aggregates: list[_TemperatureDayAggregate] = []
    for date_local in sorted(grouped):
        bucket = grouped[date_local]
        if len(bucket.temperatures) > 1:
            raise ValueError(
                f"conflicting temperature values were found for date_local {date_local!r}"
            )
        aggregates.append(
            _TemperatureDayAggregate(
                date_local=date_local,
                temperature_c=next(iter(bucket.temperatures)),
                participant_count=bucket.participant_count,
                participant_ids=tuple(sorted(bucket.participant_ids)),
            )
        )
    return tuple(aggregates)


def _build_temperature_window(
    window_key: str,
    day_aggregates: tuple[_TemperatureDayAggregate, ...],
    rows: tuple[AnalyticsDatasetRow, ...],
) -> AnalyticsTemperatureSummaryWindowResponse:
    if not day_aggregates:
        return AnalyticsTemperatureSummaryWindowResponse(window_key=window_key)

    temperatures = [day.temperature_c for day in day_aggregates]
    mean_temperature_c = sum(temperatures) / len(temperatures)
    sd_temperature_c = _sample_standard_deviation(temperatures)
    cold_threshold_temperature_c, hot_threshold_temperature_c = _temperature_thresholds(
        mean_temperature_c=mean_temperature_c,
        sd_temperature_c=sd_temperature_c,
        day_count=len(day_aggregates),
    )
    z_scores = _temperature_z_scores(
        day_aggregates,
        mean_temperature_c=mean_temperature_c,
        sd_temperature_c=sd_temperature_c,
    )

    day_responses = [
        AnalyticsTemperatureSummaryDayResponse(
            date_local=day.date_local,
            temperature_c=day.temperature_c,
            temperature_z=z_scores[day.date_local],
            participant_ids=list(day.participant_ids),
            participant_count=day.participant_count,
        )
        for day in day_aggregates
    ]

    return AnalyticsTemperatureSummaryWindowResponse(
        window_key=window_key,
        date_from=day_aggregates[0].date_local,
        date_to=day_aggregates[-1].date_local,
        day_count=len(day_aggregates),
        participant_count=sum(day.participant_count for day in day_aggregates),
        mean_temperature_c=mean_temperature_c,
        sd_temperature_c=sd_temperature_c,
        cold_threshold_temperature_c=cold_threshold_temperature_c,
        hot_threshold_temperature_c=hot_threshold_temperature_c,
        threshold_method=ANALYTICS_TEMPERATURE_THRESHOLD_METHOD,
        threshold_z_cutoff=ANALYTICS_TEMPERATURE_THRESHOLD_Z_CUTOFF,
        frequency_bins=_build_frequency_bins(day_aggregates, rows),
        cold_group=_build_temperature_group(
            [day for day in day_responses if day.temperature_z < -2]
        ),
        hot_group=_build_temperature_group(
            [day for day in day_responses if day.temperature_z > 2]
        ),
    )


def _build_frequency_bins(
    day_aggregates: tuple[_TemperatureDayAggregate, ...],
    rows: tuple[AnalyticsDatasetRow, ...],
) -> list[AnalyticsTemperatureSummaryFrequencyBinResponse]:
    min_bin_start = math.floor(min(day.temperature_c for day in day_aggregates))
    max_bin_start = math.floor(max(day.temperature_c for day in day_aggregates))

    # day_count per bin (unique-day semantics)
    bin_counts = {bin_start: 0 for bin_start in range(min_bin_start, max_bin_start + 1)}
    for day in day_aggregates:
        bin_counts[math.floor(day.temperature_c)] += 1

    # day temperature lookup for bin assignment of session rows
    day_temperature: dict[date, float] = {day.date_local: day.temperature_c for day in day_aggregates}

    # participant-session entries per bin
    bin_sessions: dict[int, list[AnalyticsTemperatureSummaryParticipantSessionResponse]] = {
        bin_start: [] for bin_start in range(min_bin_start, max_bin_start + 1)
    }
    for row in rows:
        temp = day_temperature.get(row.date_local)
        if temp is None:
            continue
        bin_key = math.floor(temp)
        if bin_key not in bin_sessions:
            continue
        bin_sessions[bin_key].append(
            AnalyticsTemperatureSummaryParticipantSessionResponse(
                participant_uuid=row.participant_uuid,
                participant_number=row.participant_number,
                session_id=row.session_id,
                date_local=row.date_local,
            )
        )

    return [
        AnalyticsTemperatureSummaryFrequencyBinResponse(
            bin_start_c=float(bin_start),
            bin_end_c=float(bin_start + 1),
            day_count=bin_counts[bin_start],
            participant_sessions=bin_sessions[bin_start],
        )
        for bin_start in range(min_bin_start, max_bin_start + 1)
    ]


def _build_temperature_group(
    day_responses: list[AnalyticsTemperatureSummaryDayResponse],
) -> AnalyticsTemperatureSummaryGroupResponse:
    if not day_responses:
        return AnalyticsTemperatureSummaryGroupResponse()

    return AnalyticsTemperatureSummaryGroupResponse(
        day_count=len(day_responses),
        participant_count=sum(day.participant_count for day in day_responses),
        participant_ids=sorted(
            {participant_id for day in day_responses for participant_id in day.participant_ids}
        ),
        dates=[day.date_local for day in day_responses],
        days=day_responses,
    )


def _temperature_z_scores(
    day_aggregates: tuple[_TemperatureDayAggregate, ...],
    *,
    mean_temperature_c: float,
    sd_temperature_c: float,
) -> dict[date, float]:
    if len(day_aggregates) < 2 or sd_temperature_c <= 0:
        return {day.date_local: 0.0 for day in day_aggregates}

    return {
        day.date_local: (day.temperature_c - mean_temperature_c) / sd_temperature_c
        for day in day_aggregates
    }


def _sample_standard_deviation(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0

    mean_value = sum(values) / len(values)
    variance = sum((value - mean_value) ** 2 for value in values) / (len(values) - 1)
    return math.sqrt(variance)


def _temperature_thresholds(
    *,
    mean_temperature_c: float,
    sd_temperature_c: float,
    day_count: int,
) -> tuple[float | None, float | None]:
    if day_count < 2 or sd_temperature_c <= 0:
        return None, None

    cutoff = float(ANALYTICS_TEMPERATURE_THRESHOLD_Z_CUTOFF)
    return (
        mean_temperature_c - (cutoff * sd_temperature_c),
        mean_temperature_c + (cutoff * sd_temperature_c),
    )


def _is_fall_winter(date_local: date) -> bool:
    return date_local >= date(date_local.year, 9, 22) or date_local <= date(
        date_local.year, 3, 21
    )


def _is_spring_summer(date_local: date) -> bool:
    return not _is_fall_winter(date_local)


__all__ = ["build_temperature_summary"]
