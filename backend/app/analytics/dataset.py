"""Canonical analytics dataset builder for dashboard modeling."""

from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import STUDY_TIMEZONE
from app.models.digitspan import DigitSpanRun
from app.models.imported_session_measures import ImportedSessionMeasures
from app.models.sessions import Session
from app.models.surveys import (
    SurveyCESD10,
    SurveyCogFunc8a,
    SurveyGAD7,
    SurveyULS8,
)
from app.models.weather import StudyDay, WeatherDaily

AnalyticsFieldName = Literal[
    "temperature",
    "precipitation",
    "daylight_hours",
    "anxiety",
    "depression",
    "loneliness",
    "self_report",
    "digit_span_score",
]


@dataclass(frozen=True)
class AnalyticsDatasetRow:
    """Single canonical row used by downstream analytics services."""

    session_id: uuid.UUID
    participant_uuid: uuid.UUID
    date_local: date
    date_bin: int
    temperature: float
    precipitation: float
    daylight_hours: float
    anxiety: float
    depression: float
    loneliness: float
    self_report: float | None
    digit_span_score: int | None
    imported_fields: tuple[AnalyticsFieldName, ...] = ()


@dataclass(frozen=True)
class AnalyticsExcludedRow:
    """Candidate row excluded from the canonical modeling dataset."""

    session_id: uuid.UUID
    participant_uuid: uuid.UUID
    date_local: date | None
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class AnalyticsExclusionReasonCount:
    """Structured exclusion summary entry."""

    reason: str
    count: int


@dataclass(frozen=True)
class AnalyticsDatasetBuildResult:
    """Canonical dataset rows plus structured exclusion metadata."""

    date_from: date
    date_to: date
    generated_at: datetime
    rows: tuple[AnalyticsDatasetRow, ...]
    excluded_rows: tuple[AnalyticsExcludedRow, ...]

    @property
    def included_sessions(self) -> int:
        return len(self.rows)

    @property
    def included_days(self) -> int:
        return len({row.date_local for row in self.rows})

    @property
    def native_rows(self) -> int:
        return sum(1 for row in self.rows if not row.imported_fields)

    @property
    def imported_rows(self) -> int:
        return sum(1 for row in self.rows if row.imported_fields)

    @property
    def excluded_count(self) -> int:
        return len(self.excluded_rows)

    @property
    def exclusion_reasons(self) -> tuple[AnalyticsExclusionReasonCount, ...]:
        counter: Counter[str] = Counter()
        for row in self.excluded_rows:
            counter.update(row.reasons)
        return tuple(
            AnalyticsExclusionReasonCount(reason=reason, count=count)
            for reason, count in sorted(counter.items())
        )


@dataclass(frozen=True)
class _PendingAnalyticsDatasetRow:
    session_id: uuid.UUID
    participant_uuid: uuid.UUID
    date_local: date
    temperature: float
    precipitation: float
    daylight_hours: float
    anxiety: float
    depression: float
    loneliness: float
    self_report: float | None
    digit_span_score: int | None
    imported_fields: tuple[AnalyticsFieldName, ...]


def _local_date_to_utc_range(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    tz = ZoneInfo(STUDY_TIMEZONE)
    start_utc = datetime(
        date_from.year, date_from.month, date_from.day, tzinfo=tz
    ).astimezone(timezone.utc)
    end_utc = (
        datetime(date_to.year, date_to.month, date_to.day, tzinfo=tz)
        + timedelta(days=1)
    ).astimezone(timezone.utc)
    return start_utc, end_utc


def _to_float(value: object | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    return float(value)


def _to_int(value: object | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return int(value)
    if isinstance(value, int):
        return value
    return int(value)


def _resolve_float(
    *,
    native_value: object | None,
    imported_values: tuple[object | None, ...] = (),
) -> tuple[float | None, Literal["native", "imported", "missing"]]:
    coerced_native = _to_float(native_value)
    if coerced_native is not None:
        return coerced_native, "native"

    for imported_value in imported_values:
        coerced_imported = _to_float(imported_value)
        if coerced_imported is not None:
            return coerced_imported, "imported"

    return None, "missing"


def _resolve_digit_span(
    *,
    total_correct: object | None,
    data_source: object | None,
) -> tuple[int | None, Literal["native", "imported", "missing"]]:
    coerced = _to_int(total_correct)
    if coerced is None:
        return None, "missing"
    if data_source == "imported":
        return coerced, "imported"
    return coerced, "native"


def _build_pending_row(raw_row: object) -> _PendingAnalyticsDatasetRow | AnalyticsExcludedRow:
    session_id = getattr(raw_row, "session_id")
    participant_uuid = getattr(raw_row, "participant_uuid")
    date_local = getattr(raw_row, "date_local", None)

    reasons: list[str] = []
    imported_fields: list[AnalyticsFieldName] = []

    if date_local is None:
        reasons.append("missing_study_day")

    temperature, temperature_source = _resolve_float(
        native_value=getattr(raw_row, "weather_temperature", None) if date_local is not None else None,
        imported_values=(getattr(raw_row, "import_temperature", None),),
    )
    if temperature is None:
        reasons.append("missing_temperature")
    elif temperature_source == "imported":
        imported_fields.append("temperature")

    precipitation, precipitation_source = _resolve_float(
        native_value=getattr(raw_row, "weather_precipitation", None) if date_local is not None else None,
        imported_values=(getattr(raw_row, "import_precipitation", None),),
    )
    if precipitation is None:
        reasons.append("missing_precipitation")
    elif precipitation_source == "imported":
        imported_fields.append("precipitation")

    daylight_hours, daylight_source = _resolve_float(
        native_value=getattr(raw_row, "weather_daylight_hours", None) if date_local is not None else None,
    )
    if daylight_hours is None:
        reasons.append("missing_daylight_hours")
    elif daylight_source == "imported":
        imported_fields.append("daylight_hours")

    anxiety, anxiety_source = _resolve_float(
        native_value=(
            getattr(raw_row, "gad_total_score", None)
            if getattr(raw_row, "gad_data_source", None) == "native"
            else None
        ),
        imported_values=(
            getattr(raw_row, "gad_legacy_total_score", None),
            getattr(raw_row, "gad_legacy_mean", None),
            getattr(raw_row, "import_anxiety_mean", None),
        ),
    )
    if anxiety is None:
        reasons.append("missing_anxiety")
    elif anxiety_source == "imported":
        imported_fields.append("anxiety")

    depression, depression_source = _resolve_float(
        native_value=(
            getattr(raw_row, "cesd_total_score", None)
            if getattr(raw_row, "cesd_data_source", None) == "native"
            else None
        ),
        imported_values=(
            getattr(raw_row, "cesd_legacy_mean", None),
            getattr(raw_row, "import_depression_mean", None),
        ),
    )
    if depression is None:
        reasons.append("missing_depression")
    elif depression_source == "imported":
        imported_fields.append("depression")

    loneliness, loneliness_source = _resolve_float(
        native_value=(
            getattr(raw_row, "uls_computed_mean", None)
            if getattr(raw_row, "uls_data_source", None) == "native"
            else None
        ),
        imported_values=(
            getattr(raw_row, "uls_legacy_mean", None),
            getattr(raw_row, "import_loneliness_mean", None),
        ),
    )
    if loneliness is None:
        reasons.append("missing_loneliness")
    elif loneliness_source == "imported":
        imported_fields.append("loneliness")

    self_report, self_report_source = _resolve_float(
        native_value=(
            getattr(raw_row, "cogfunc_mean_score", None)
            if getattr(raw_row, "cogfunc_data_source", None) == "native"
            else None
        ),
        imported_values=(
            getattr(raw_row, "cogfunc_legacy_mean", None),
            getattr(raw_row, "import_self_report", None),
        ),
    )
    if self_report_source == "imported" and self_report is not None:
        imported_fields.append("self_report")

    digit_span_score, digit_span_source = _resolve_digit_span(
        total_correct=getattr(raw_row, "digit_span_total_correct", None),
        data_source=getattr(raw_row, "digit_span_data_source", None),
    )
    if digit_span_source == "imported" and digit_span_score is not None:
        imported_fields.append("digit_span_score")

    if self_report is None and digit_span_score is None:
        reasons.append("missing_modeled_outcome")

    unique_reasons = tuple(sorted(set(reasons)))
    if unique_reasons:
        return AnalyticsExcludedRow(
            session_id=session_id,
            participant_uuid=participant_uuid,
            date_local=date_local,
            reasons=unique_reasons,
        )

    return _PendingAnalyticsDatasetRow(
        session_id=session_id,
        participant_uuid=participant_uuid,
        date_local=date_local,
        temperature=temperature,
        precipitation=precipitation,
        daylight_hours=daylight_hours,
        anxiety=anxiety,
        depression=depression,
        loneliness=loneliness,
        self_report=self_report,
        digit_span_score=digit_span_score,
        imported_fields=tuple(sorted(set(imported_fields))),
    )


async def build_canonical_analysis_dataset(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> AnalyticsDatasetBuildResult:
    """Build the canonical analytics dataset for the requested local-date window."""

    if date_from > date_to:
        raise ValueError("date_from must not be after date_to")

    range_start_utc, range_end_utc = _local_date_to_utc_range(date_from, date_to)

    rows_result = await db.execute(
        select(
            Session.session_id.label("session_id"),
            Session.participant_uuid.label("participant_uuid"),
            StudyDay.date_local.label("date_local"),
            WeatherDaily.current_temp_c.label("weather_temperature"),
            WeatherDaily.current_precip_today_mm.label("weather_precipitation"),
            WeatherDaily.sunshine_duration_hours.label("weather_daylight_hours"),
            ImportedSessionMeasures.temperature_c.label("import_temperature"),
            ImportedSessionMeasures.precipitation_mm.label("import_precipitation"),
            ImportedSessionMeasures.anxiety_mean.label("import_anxiety_mean"),
            ImportedSessionMeasures.loneliness_mean.label("import_loneliness_mean"),
            ImportedSessionMeasures.depression_mean.label("import_depression_mean"),
            ImportedSessionMeasures.self_report.label("import_self_report"),
            DigitSpanRun.total_correct.label("digit_span_total_correct"),
            DigitSpanRun.data_source.label("digit_span_data_source"),
            SurveyGAD7.total_score.label("gad_total_score"),
            SurveyGAD7.legacy_total_score.label("gad_legacy_total_score"),
            SurveyGAD7.legacy_mean_1_4.label("gad_legacy_mean"),
            SurveyGAD7.data_source.label("gad_data_source"),
            SurveyCESD10.total_score.label("cesd_total_score"),
            SurveyCESD10.legacy_mean_1_4.label("cesd_legacy_mean"),
            SurveyCESD10.data_source.label("cesd_data_source"),
            SurveyULS8.computed_mean.label("uls_computed_mean"),
            SurveyULS8.legacy_mean_1_4.label("uls_legacy_mean"),
            SurveyULS8.data_source.label("uls_data_source"),
            SurveyCogFunc8a.mean_score.label("cogfunc_mean_score"),
            SurveyCogFunc8a.legacy_mean_1_5.label("cogfunc_legacy_mean"),
            SurveyCogFunc8a.data_source.label("cogfunc_data_source"),
        )
        .select_from(Session)
        .outerjoin(StudyDay, Session.study_day_id == StudyDay.study_day_id)
        .outerjoin(WeatherDaily, Session.study_day_id == WeatherDaily.study_day_id)
        .outerjoin(DigitSpanRun, DigitSpanRun.session_id == Session.session_id)
        .outerjoin(SurveyGAD7, SurveyGAD7.session_id == Session.session_id)
        .outerjoin(SurveyCESD10, SurveyCESD10.session_id == Session.session_id)
        .outerjoin(SurveyULS8, SurveyULS8.session_id == Session.session_id)
        .outerjoin(SurveyCogFunc8a, SurveyCogFunc8a.session_id == Session.session_id)
        .outerjoin(
            ImportedSessionMeasures,
            ImportedSessionMeasures.session_id == Session.session_id,
        )
        .where(
            Session.status == "complete",
            or_(
                and_(
                    StudyDay.date_local.is_not(None),
                    StudyDay.date_local >= date_from,
                    StudyDay.date_local <= date_to,
                ),
                and_(
                    Session.completed_at.is_not(None),
                    Session.completed_at >= range_start_utc,
                    Session.completed_at < range_end_utc,
                ),
            ),
        )
        .order_by(StudyDay.date_local.asc(), Session.completed_at.asc(), Session.session_id.asc())
    )

    pending_rows: list[_PendingAnalyticsDatasetRow] = []
    excluded_rows: list[AnalyticsExcludedRow] = []
    for raw_row in rows_result.all():
        built = _build_pending_row(raw_row)
        if isinstance(built, AnalyticsExcludedRow):
            excluded_rows.append(built)
        else:
            pending_rows.append(built)

    date_bins = {
        row_date: index
        for index, row_date in enumerate(sorted({row.date_local for row in pending_rows}), start=1)
    }
    included_rows = tuple(
        AnalyticsDatasetRow(
            session_id=row.session_id,
            participant_uuid=row.participant_uuid,
            date_local=row.date_local,
            date_bin=date_bins[row.date_local],
            temperature=row.temperature,
            precipitation=row.precipitation,
            daylight_hours=row.daylight_hours,
            anxiety=row.anxiety,
            depression=row.depression,
            loneliness=row.loneliness,
            self_report=row.self_report,
            digit_span_score=row.digit_span_score,
            imported_fields=row.imported_fields,
        )
        for row in pending_rows
    )

    return AnalyticsDatasetBuildResult(
        date_from=date_from,
        date_to=date_to,
        generated_at=datetime.now(timezone.utc),
        rows=included_rows,
        excluded_rows=tuple(excluded_rows),
    )


__all__ = [
    "AnalyticsDatasetBuildResult",
    "AnalyticsDatasetRow",
    "AnalyticsExcludedRow",
    "AnalyticsExclusionReasonCount",
    "build_canonical_analysis_dataset",
]
