from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember
from app.models.digitspan import DigitSpanRun
from app.models.participants import Participant
from app.models.sessions import Session
from app.models.surveys import SurveyCESD10, SurveyCogFunc8a, SurveyGAD7, SurveyULS8
from app.models.weather import StudyDay, WeatherDaily
from app.schemas.chat import RAChatScope
from app.services.analytics_service import read_dashboard_analytics_snapshot


ChatToolStatus = Literal[
    "ready",
    "insufficient_data",
    "invalid_scope",
    "permission_denied",
]

SUPPORTED_LAB_NAME = "ww"
SUPPORTED_STUDY_SLUGS = frozenset({"weather-wellness", "ww"})
DEFAULT_CHAT_TOOL_WINDOW_DAYS = 30
MAX_CHAT_TOOL_WINDOW_DAYS = 400
MAX_CHAT_TOOL_SESSION_ROWS = 20
DEFAULT_WEATHER_STATION_ID = 3510


@dataclass(frozen=True)
class ChatAggregateToolResult:
    """Bounded JSON-safe output from an approved read-only chat data tool."""

    tool_name: str
    status: ChatToolStatus
    message: str
    data: dict[str, Any]

    def to_json(self) -> dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "status": self.status,
            "message": self.message,
            "data": _json_safe(self.data),
        }

    def response_summary(self) -> str:
        return f"{self.status}: {self.message}"[:500]


@dataclass(frozen=True)
class _ResolvedToolScope:
    date_from: date
    date_to: date
    lab_name: str
    study_slug: str
    is_admin: bool = False


@dataclass(frozen=True)
class _ScopeError:
    status: ChatToolStatus
    message: str
    data: dict[str, Any]


async def run_scoped_aggregate_tools(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
) -> list[ChatAggregateToolResult]:
    """Run the approved aggregate tools for the authenticated lab scope."""

    resolved = await _resolve_tool_scope(db, lab_member=lab_member, chat_scope=chat_scope)
    tool_names = [
        "dashboard_analytics_summary",
        "study_window_session_counts",
        "survey_score_summary",
        "weather_study_day_summary",
        "participant_session_summaries",
    ]
    if isinstance(resolved, _ScopeError):
        return [_result_from_scope_error(tool_name, resolved) for tool_name in tool_names]

    return [
        await _dashboard_analytics_summary(db, resolved),
        await _study_window_session_counts(db, resolved),
        await _survey_score_summary(db, resolved),
        await _weather_study_day_summary(db, resolved),
        await _participant_session_summaries(db, resolved),
    ]


async def get_dashboard_analytics_summary(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
) -> ChatAggregateToolResult:
    resolved = await _resolve_tool_scope(db, lab_member=lab_member, chat_scope=chat_scope)
    if isinstance(resolved, _ScopeError):
        return _result_from_scope_error("dashboard_analytics_summary", resolved)
    return await _dashboard_analytics_summary(db, resolved)


async def get_study_window_session_counts(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
) -> ChatAggregateToolResult:
    resolved = await _resolve_tool_scope(db, lab_member=lab_member, chat_scope=chat_scope)
    if isinstance(resolved, _ScopeError):
        return _result_from_scope_error("study_window_session_counts", resolved)
    return await _study_window_session_counts(db, resolved)


async def get_survey_score_summary(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
) -> ChatAggregateToolResult:
    resolved = await _resolve_tool_scope(db, lab_member=lab_member, chat_scope=chat_scope)
    if isinstance(resolved, _ScopeError):
        return _result_from_scope_error("survey_score_summary", resolved)
    return await _survey_score_summary(db, resolved)


async def get_weather_study_day_summary(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
) -> ChatAggregateToolResult:
    resolved = await _resolve_tool_scope(db, lab_member=lab_member, chat_scope=chat_scope)
    if isinstance(resolved, _ScopeError):
        return _result_from_scope_error("weather_study_day_summary", resolved)
    return await _weather_study_day_summary(db, resolved)


async def get_participant_session_summaries(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
    participant_number: int | None = None,
    limit: int = MAX_CHAT_TOOL_SESSION_ROWS,
) -> ChatAggregateToolResult:
    resolved = await _resolve_tool_scope(db, lab_member=lab_member, chat_scope=chat_scope)
    if isinstance(resolved, _ScopeError):
        return _result_from_scope_error("participant_session_summaries", resolved)
    return await _participant_session_summaries(
        db,
        resolved,
        participant_number=participant_number,
        limit=limit,
    )


async def _resolve_tool_scope(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    chat_scope: RAChatScope,
) -> _ResolvedToolScope | _ScopeError:
    lab_name = (lab_member.lab_name or "").strip().lower()
    is_admin = (lab_member.role or "").strip().lower() == "admin"
    # Admins have whole-DB access: they bypass the per-lab allowlist, mirroring
    # get_current_ra_for_lab in app/auth.py. Non-admin RAs remain restricted to
    # the Weather-Wellness scope until OPEN-05 multi-lab isolation is resolved.
    if not is_admin and lab_name != SUPPORTED_LAB_NAME:
        return _ScopeError(
            status="permission_denied",
            message="Chat data tools are available only for the authenticated Weather-Wellness lab scope.",
            data={"lab_name": lab_name or None},
        )

    study_slug = chat_scope.study_slug or "weather-wellness"
    if study_slug not in SUPPORTED_STUDY_SLUGS:
        return _ScopeError(
            status="invalid_scope",
            message="The requested study is not available in this lab scope.",
            data={"study_slug": study_slug},
        )

    date_from = chat_scope.date_from
    date_to = chat_scope.date_to
    if date_from is None and date_to is None:
        date_to = await _read_latest_study_date(db)
        if date_to is None:
            return _ScopeError(
                status="insufficient_data",
                message="No study days are available yet for aggregate chat summaries.",
                data={"lab_name": lab_name, "study_slug": study_slug},
            )
        date_from = date_to - timedelta(days=DEFAULT_CHAT_TOOL_WINDOW_DAYS - 1)
    elif date_from is None and date_to is not None:
        date_from = date_to - timedelta(days=DEFAULT_CHAT_TOOL_WINDOW_DAYS - 1)
    elif date_to is None and date_from is not None:
        date_to = date_from + timedelta(days=DEFAULT_CHAT_TOOL_WINDOW_DAYS - 1)

    if date_from is None or date_to is None:
        raise AssertionError("chat tool date scope resolution failed")

    if date_from > date_to:
        return _ScopeError(
            status="invalid_scope",
            message="date_from must not be after date_to.",
            data={"date_from": date_from, "date_to": date_to},
        )

    if (date_to - date_from).days + 1 > MAX_CHAT_TOOL_WINDOW_DAYS:
        return _ScopeError(
            status="invalid_scope",
            message=f"Aggregate chat tool date ranges are capped at {MAX_CHAT_TOOL_WINDOW_DAYS} days.",
            data={"date_from": date_from, "date_to": date_to},
        )

    return _ResolvedToolScope(
        date_from=date_from,
        date_to=date_to,
        lab_name=lab_name or SUPPORTED_LAB_NAME,
        study_slug=study_slug,
        is_admin=is_admin,
    )


async def _dashboard_analytics_summary(
    db: AsyncSession,
    scope: _ResolvedToolScope,
) -> ChatAggregateToolResult:
    response = await read_dashboard_analytics_snapshot(
        db,
        date_from=scope.date_from,
        date_to=scope.date_to,
    )
    if response is None:
        return ChatAggregateToolResult(
            tool_name="dashboard_analytics_summary",
            status="insufficient_data",
            message=(
                "No dashboard analytics snapshot is available for the requested "
                f"{scope.date_from.isoformat()} to {scope.date_to.isoformat()} range."
            ),
            data=_scope_data(scope),
        )

    effects: list[dict[str, Any]] = []
    for model in response.models[:4]:
        effects.extend(
            {
                "outcome": model.outcome,
                "term": effect.term,
                "predictor": effect.predictor,
                "direction": effect.direction,
                "significant": effect.significant,
                "coefficient": effect.coefficient,
                "p_value": effect.p_value,
            }
            for effect in model.effects[:8]
        )

    data = {
        **_scope_data(scope),
        "status": response.status,
        "dataset": response.dataset.model_dump(mode="json"),
        "model_count": len(response.models),
        "effects": effects[:24],
        "temperature_windows": [
            {
                "window_key": window.window_key,
                "day_count": window.day_count,
                "participant_count": window.participant_count,
                "mean_temperature_c": window.mean_temperature_c,
                "cold_day_count": window.cold_group.day_count,
                "hot_day_count": window.hot_group.day_count,
            }
            for window in response.temperature_summary.windows[:3]
        ],
    }
    return ChatAggregateToolResult(
        tool_name="dashboard_analytics_summary",
        status="ready",
        message=(
            "Dashboard analytics snapshot found with "
            f"{response.dataset.included_sessions} included sessions and "
            f"{len(response.models)} model summaries."
        ),
        data=data,
    )


async def _study_window_session_counts(
    db: AsyncSession,
    scope: _ResolvedToolScope,
) -> ChatAggregateToolResult:
    window_result = await db.execute(
        select(
            func.min(StudyDay.date_local).label("first_study_day"),
            func.max(StudyDay.date_local).label("latest_study_day"),
            func.count(StudyDay.study_day_id).label("study_day_count"),
        )
    )
    window = window_result.mappings().one()

    session_result = await db.execute(
        select(Session.status.label("status"), func.count(Session.session_id).label("count"))
        .select_from(Session)
        .join(StudyDay, Session.study_day_id == StudyDay.study_day_id)
        .where(
            StudyDay.date_local >= scope.date_from,
            StudyDay.date_local <= scope.date_to,
        )
        .group_by(Session.status)
        .order_by(Session.status.asc())
    )
    session_counts = {
        row["status"]: _int(row["count"])
        for row in session_result.mappings().all()
    }
    total_linked_sessions = sum(session_counts.values())
    study_day_count = _int(window["study_day_count"])

    if study_day_count == 0 and total_linked_sessions == 0:
        return ChatAggregateToolResult(
            tool_name="study_window_session_counts",
            status="insufficient_data",
            message="No study days or linked sessions are available for aggregate chat summaries.",
            data={**_scope_data(scope), "session_counts": {}},
        )

    return ChatAggregateToolResult(
        tool_name="study_window_session_counts",
        status="ready",
        message=(
            f"Study window spans {study_day_count} study days; "
            f"{total_linked_sessions} linked sessions fall in the requested range."
        ),
        data={
            **_scope_data(scope),
            "study_window": {
                "first_study_day": window["first_study_day"],
                "latest_study_day": window["latest_study_day"],
                "study_day_count": study_day_count,
            },
            "session_counts": session_counts,
            "total_linked_sessions": total_linked_sessions,
        },
    )


async def _survey_score_summary(
    db: AsyncSession,
    scope: _ResolvedToolScope,
) -> ChatAggregateToolResult:
    metrics = [
        await _numeric_score_summary(db, scope, SurveyULS8, SurveyULS8.score_0_100, "uls8_score_0_100"),
        await _numeric_score_summary(db, scope, SurveyULS8, SurveyULS8.legacy_mean_1_4, "uls8_legacy_mean_1_4"),
        await _numeric_score_summary(db, scope, SurveyCESD10, SurveyCESD10.total_score, "cesd10_total_score"),
        await _numeric_score_summary(db, scope, SurveyCESD10, SurveyCESD10.legacy_mean_1_4, "cesd10_legacy_mean_1_4"),
        await _numeric_score_summary(db, scope, SurveyGAD7, SurveyGAD7.total_score, "gad7_total_score"),
        await _numeric_score_summary(db, scope, SurveyGAD7, SurveyGAD7.legacy_mean_1_4, "gad7_legacy_mean_1_4"),
        await _numeric_score_summary(db, scope, SurveyCogFunc8a, SurveyCogFunc8a.mean_score, "cogfunc8a_mean_score"),
        await _numeric_score_summary(db, scope, SurveyCogFunc8a, SurveyCogFunc8a.legacy_mean_1_5, "cogfunc8a_legacy_mean_1_5"),
        await _numeric_score_summary(db, scope, DigitSpanRun, DigitSpanRun.total_correct, "digitspan_total_correct"),
        await _numeric_score_summary(db, scope, DigitSpanRun, DigitSpanRun.max_span, "digitspan_max_span"),
    ]
    populated_metrics = [metric for metric in metrics if metric["count"] > 0]
    total_values = sum(metric["count"] for metric in populated_metrics)
    if not populated_metrics:
        return ChatAggregateToolResult(
            tool_name="survey_score_summary",
            status="insufficient_data",
            message="No survey or digit span scores are available for the requested range.",
            data={**_scope_data(scope), "metrics": []},
        )

    return ChatAggregateToolResult(
        tool_name="survey_score_summary",
        status="ready",
        message=(
            f"Found {len(populated_metrics)} aggregate score metrics across "
            f"{total_values} scored values in the requested range."
        ),
        data={**_scope_data(scope), "metrics": populated_metrics[:20]},
    )


async def _weather_study_day_summary(
    db: AsyncSession,
    scope: _ResolvedToolScope,
) -> ChatAggregateToolResult:
    study_day_result = await db.execute(
        select(func.count(StudyDay.study_day_id).label("study_day_count"))
        .where(
            StudyDay.date_local >= scope.date_from,
            StudyDay.date_local <= scope.date_to,
        )
    )
    study_day_count = _int(study_day_result.mappings().one()["study_day_count"])

    weather_result = await db.execute(
        select(
            func.count(WeatherDaily.daily_id).label("weather_day_count"),
            func.avg(WeatherDaily.current_temp_c).label("mean_temperature_c"),
            func.min(WeatherDaily.current_temp_c).label("min_temperature_c"),
            func.max(WeatherDaily.current_temp_c).label("max_temperature_c"),
            func.avg(WeatherDaily.current_precip_today_mm).label("mean_precip_today_mm"),
            func.sum(WeatherDaily.current_precip_today_mm).label("total_precip_today_mm"),
            func.avg(WeatherDaily.sunshine_duration_hours).label("mean_sunshine_duration_hours"),
        )
        .where(
            WeatherDaily.station_id == DEFAULT_WEATHER_STATION_ID,
            WeatherDaily.date_local >= scope.date_from,
            WeatherDaily.date_local <= scope.date_to,
        )
    )
    weather = weather_result.mappings().one()
    weather_day_count = _int(weather["weather_day_count"])

    if study_day_count == 0 and weather_day_count == 0:
        return ChatAggregateToolResult(
            tool_name="weather_study_day_summary",
            status="insufficient_data",
            message="No study-day or weather rows are available for the requested range.",
            data={**_scope_data(scope), "study_day_count": 0, "weather_day_count": 0},
        )

    return ChatAggregateToolResult(
        tool_name="weather_study_day_summary",
        status="ready",
        message=(
            f"Found {study_day_count} study days and {weather_day_count} weather rows "
            f"for station {DEFAULT_WEATHER_STATION_ID} in the requested range."
        ),
        data={
            **_scope_data(scope),
            "station_id": DEFAULT_WEATHER_STATION_ID,
            "study_day_count": study_day_count,
            "weather_day_count": weather_day_count,
            "mean_temperature_c": _round_float(weather["mean_temperature_c"]),
            "min_temperature_c": _round_float(weather["min_temperature_c"]),
            "max_temperature_c": _round_float(weather["max_temperature_c"]),
            "mean_precip_today_mm": _round_float(weather["mean_precip_today_mm"]),
            "total_precip_today_mm": _round_float(weather["total_precip_today_mm"]),
            "mean_sunshine_duration_hours": _round_float(weather["mean_sunshine_duration_hours"]),
        },
    )


async def _participant_session_summaries(
    db: AsyncSession,
    scope: _ResolvedToolScope,
    *,
    participant_number: int | None = None,
    limit: int = MAX_CHAT_TOOL_SESSION_ROWS,
) -> ChatAggregateToolResult:
    if participant_number is not None and participant_number < 1:
        return ChatAggregateToolResult(
            tool_name="participant_session_summaries",
            status="invalid_scope",
            message="participant_number must be a positive integer.",
            data={**_scope_data(scope), "participant_number": participant_number},
        )

    row_limit = min(max(int(limit), 1), MAX_CHAT_TOOL_SESSION_ROWS)
    filters = [
        StudyDay.date_local >= scope.date_from,
        StudyDay.date_local <= scope.date_to,
    ]
    if participant_number is not None:
        filters.append(Participant.participant_number == participant_number)

    result = await db.execute(
        select(
            Participant.participant_number.label("participant_number"),
            Participant.age_band.label("age_band"),
            Participant.gender.label("gender"),
            Participant.origin.label("origin"),
            Participant.commute_method.label("commute_method"),
            Participant.time_outside.label("time_outside"),
            Participant.daylight_exposure_minutes.label("daylight_exposure_minutes"),
            Session.status.label("session_status"),
            Session.created_at.label("session_created_at"),
            Session.completed_at.label("session_completed_at"),
            StudyDay.date_local.label("date_local"),
            SurveyULS8.score_0_100.label("uls8_score_0_100"),
            SurveyULS8.legacy_mean_1_4.label("uls8_legacy_mean_1_4"),
            SurveyCESD10.total_score.label("cesd10_total_score"),
            SurveyCESD10.legacy_mean_1_4.label("cesd10_legacy_mean_1_4"),
            SurveyGAD7.total_score.label("gad7_total_score"),
            SurveyGAD7.severity_band.label("gad7_severity_band"),
            SurveyGAD7.legacy_mean_1_4.label("gad7_legacy_mean_1_4"),
            SurveyCogFunc8a.mean_score.label("cogfunc8a_mean_score"),
            SurveyCogFunc8a.legacy_mean_1_5.label("cogfunc8a_legacy_mean_1_5"),
            DigitSpanRun.total_correct.label("digitspan_total_correct"),
            DigitSpanRun.max_span.label("digitspan_max_span"),
            DigitSpanRun.data_source.label("digitspan_data_source"),
        )
        .select_from(Session)
        .join(Participant, Session.participant_uuid == Participant.participant_uuid)
        .join(StudyDay, Session.study_day_id == StudyDay.study_day_id)
        .outerjoin(SurveyULS8, SurveyULS8.session_id == Session.session_id)
        .outerjoin(SurveyCESD10, SurveyCESD10.session_id == Session.session_id)
        .outerjoin(SurveyGAD7, SurveyGAD7.session_id == Session.session_id)
        .outerjoin(SurveyCogFunc8a, SurveyCogFunc8a.session_id == Session.session_id)
        .outerjoin(DigitSpanRun, DigitSpanRun.session_id == Session.session_id)
        .where(*filters)
        .order_by(Session.created_at.desc())
        .limit(row_limit)
    )
    rows = result.mappings().all()[:row_limit]
    if not rows:
        scope_label = (
            f"participant {participant_number}"
            if participant_number is not None
            else "the requested range"
        )
        return ChatAggregateToolResult(
            tool_name="participant_session_summaries",
            status="insufficient_data",
            message=f"No participant/session rows are available for {scope_label}.",
            data={
                **_scope_data(scope),
                "participant_number": participant_number,
                "limit": row_limit,
                "sessions": [],
            },
        )

    sessions = [_participant_session_row(row) for row in rows]
    participant_count = len({session["participant_number"] for session in sessions})
    filter_label = (
        f"participant {participant_number}"
        if participant_number is not None
        else f"{participant_count} participants"
    )
    return ChatAggregateToolResult(
        tool_name="participant_session_summaries",
        status="ready",
        message=(
            f"Found {len(sessions)} bounded anonymous session summaries for "
            f"{filter_label}; responses use participant_number and omit raw UUIDs."
        ),
        data={
            **_scope_data(scope),
            "participant_number": participant_number,
            "limit": row_limit,
            "returned_sessions": len(sessions),
            "sessions": sessions,
        },
    )


def _participant_session_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "participant_number": _int(row["participant_number"]),
        "date_local": row["date_local"],
        "session": {
            "status": row["session_status"],
            "created_at": row["session_created_at"],
            "completed_at": row["session_completed_at"],
        },
        "demographics": {
            "age_band": row["age_band"],
            "gender": row["gender"],
            "origin": row["origin"],
            "commute_method": row["commute_method"],
            "time_outside": row["time_outside"],
            "daylight_exposure_minutes": row["daylight_exposure_minutes"],
        },
        "survey_scores": {
            "uls8_score_0_100": _round_float(row["uls8_score_0_100"]),
            "uls8_legacy_mean_1_4": _round_float(row["uls8_legacy_mean_1_4"]),
            "cesd10_total_score": _int_or_none(row["cesd10_total_score"]),
            "cesd10_legacy_mean_1_4": _round_float(row["cesd10_legacy_mean_1_4"]),
            "gad7_total_score": _int_or_none(row["gad7_total_score"]),
            "gad7_severity_band": row["gad7_severity_band"],
            "gad7_legacy_mean_1_4": _round_float(row["gad7_legacy_mean_1_4"]),
            "cogfunc8a_mean_score": _round_float(row["cogfunc8a_mean_score"]),
            "cogfunc8a_legacy_mean_1_5": _round_float(row["cogfunc8a_legacy_mean_1_5"]),
        },
        "digit_span": {
            "total_correct": _int_or_none(row["digitspan_total_correct"]),
            "max_span": _int_or_none(row["digitspan_max_span"]),
            "data_source": row["digitspan_data_source"],
        },
    }


async def _numeric_score_summary(
    db: AsyncSession,
    scope: _ResolvedToolScope,
    model: Any,
    column: Any,
    label: str,
) -> dict[str, Any]:
    result = await db.execute(
        select(
            func.count(column).label("count"),
            func.avg(column).label("mean"),
            func.min(column).label("min"),
            func.max(column).label("max"),
        )
        .select_from(model)
        .join(Session, model.session_id == Session.session_id)
        .join(StudyDay, Session.study_day_id == StudyDay.study_day_id)
        .where(
            StudyDay.date_local >= scope.date_from,
            StudyDay.date_local <= scope.date_to,
            column.is_not(None),
        )
    )
    row = result.mappings().one()
    return {
        "metric": label,
        "count": _int(row["count"]),
        "mean": _round_float(row["mean"]),
        "min": _round_float(row["min"]),
        "max": _round_float(row["max"]),
    }


async def _read_latest_study_date(db: AsyncSession) -> date | None:
    result = await db.execute(select(func.max(StudyDay.date_local)))
    return result.scalar_one_or_none()


def _result_from_scope_error(
    tool_name: str,
    error: _ScopeError,
) -> ChatAggregateToolResult:
    return ChatAggregateToolResult(
        tool_name=tool_name,
        status=error.status,
        message=error.message,
        data=error.data,
    )


def _scope_data(scope: _ResolvedToolScope) -> dict[str, Any]:
    return {
        "lab_name": scope.lab_name,
        "study_slug": scope.study_slug,
        "date_from": scope.date_from,
        "date_to": scope.date_to,
        "admin_all_labs": scope.is_admin,
    }


def _json_safe(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    return value


def _round_float(value: Any) -> float | None:
    if value is None:
        return None
    return round(float(value), 4)


def _int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)


__all__ = [
    "ChatAggregateToolResult",
    "ChatToolStatus",
    "DEFAULT_CHAT_TOOL_WINDOW_DAYS",
    "MAX_CHAT_TOOL_WINDOW_DAYS",
    "MAX_CHAT_TOOL_SESSION_ROWS",
    "get_dashboard_analytics_summary",
    "get_participant_session_summaries",
    "get_study_window_session_counts",
    "get_survey_score_summary",
    "get_weather_study_day_summary",
    "run_scoped_aggregate_tools",
]
