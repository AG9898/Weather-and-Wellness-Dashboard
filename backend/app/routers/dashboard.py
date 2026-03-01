from __future__ import annotations

from datetime import date as date_type, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, case, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_lab_member
from app.config import STUDY_TIMEZONE
from app.db import get_session
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.models.weather import StudyDay
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    DashboardSummaryRangeResponse,
    ParticipantsPerDayItem,
    ParticipantsPerDayResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _local_date_to_utc_range(d_from: date_type, d_to: date_type) -> tuple[datetime, datetime]:
    """Return UTC [start, end) bounds for an inclusive local-day range [d_from, d_to]."""
    tz = ZoneInfo(STUDY_TIMEZONE)
    start_utc = datetime(d_from.year, d_from.month, d_from.day, 0, 0, 0, tzinfo=tz).astimezone(timezone.utc)
    # Exclusive end: start of the day after d_to in local time
    end_utc = (datetime(d_to.year, d_to.month, d_to.day, 0, 0, 0, tzinfo=tz) + timedelta(days=1)).astimezone(timezone.utc)
    return start_utc, end_utc


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    dependencies=[Depends(get_current_lab_member)],
)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_session),
) -> DashboardSummaryResponse:
    """Return RA dashboard summary metrics.

    Counts total participants, sessions by status (created/active/complete),
    and sessions created or completed in the last 7 days.
    Requires lab-member authentication.
    """
    # Total participants
    participant_count_result = await db.execute(
        select(func.count()).select_from(Participant)
    )
    total_participants: int = participant_count_result.scalar_one()

    # Session counts — single pass using conditional aggregation
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=7)

    session_agg_result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(
                case((SessionModel.status == "created", 1), else_=0)
            ).label("created"),
            func.sum(
                case((SessionModel.status == "active", 1), else_=0)
            ).label("active"),
            func.sum(
                case((SessionModel.status == "complete", 1), else_=0)
            ).label("complete"),
            func.sum(
                case((SessionModel.created_at >= cutoff, 1), else_=0)
            ).label("created_last_7"),
            func.sum(
                case(
                    (
                        (SessionModel.completed_at != None)  # noqa: E711
                        & (SessionModel.completed_at >= cutoff),
                        1,
                    ),
                    else_=0,
                )
            ).label("completed_last_7"),
        ).select_from(SessionModel)
    )

    row = session_agg_result.one()

    return DashboardSummaryResponse(
        total_participants=total_participants,
        sessions_created=int(row.created or 0),
        sessions_active=int(row.active or 0),
        sessions_complete=int(row.complete or 0),
        sessions_created_last_7_days=int(row.created_last_7 or 0),
        sessions_completed_last_7_days=int(row.completed_last_7 or 0),
    )


@router.get(
    "/summary/range",
    response_model=DashboardSummaryRangeResponse,
    dependencies=[Depends(get_current_lab_member)],
)
async def get_dashboard_summary_range(
    date_from: date_type = Query(..., description="Inclusive start date (YYYY-MM-DD, America/Vancouver)"),
    date_to: date_type = Query(..., description="Inclusive end date (YYYY-MM-DD, America/Vancouver)"),
    db: AsyncSession = Depends(get_session),
) -> DashboardSummaryRangeResponse:
    """Return range-filtered KPI counts for the selected local-day window.

    Counts sessions created/completed and distinct participants with completed
    sessions within [date_from, date_to] (inclusive, America/Vancouver).
    """
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must not be after date_to",
        )

    range_start_utc, range_end_utc = _local_date_to_utc_range(date_from, date_to)

    # Single-pass aggregation over all sessions; date filters applied via CASE
    agg_result = await db.execute(
        select(
            func.sum(
                case(
                    (
                        (SessionModel.created_at >= range_start_utc)
                        & (SessionModel.created_at < range_end_utc),
                        1,
                    ),
                    else_=0,
                )
            ).label("sessions_created"),
            func.sum(
                case(
                    (
                        (SessionModel.completed_at != None)  # noqa: E711
                        & (SessionModel.completed_at >= range_start_utc)
                        & (SessionModel.completed_at < range_end_utc),
                        1,
                    ),
                    else_=0,
                )
            ).label("sessions_completed"),
        ).select_from(SessionModel)
    )
    row = agg_result.one()

    # Distinct participants with completed sessions in range
    participants_result = await db.execute(
        select(func.count(distinct(SessionModel.participant_uuid))).where(
            SessionModel.status == "complete",
            SessionModel.completed_at != None,  # noqa: E711
            SessionModel.completed_at >= range_start_utc,
            SessionModel.completed_at < range_end_utc,
        )
    )
    participants_completed: int = participants_result.scalar_one() or 0

    return DashboardSummaryRangeResponse(
        date_from=date_from,
        date_to=date_to,
        sessions_created=int(row.sessions_created or 0),
        sessions_completed=int(row.sessions_completed or 0),
        participants_completed=participants_completed,
    )


@router.get(
    "/participants-per-day",
    response_model=ParticipantsPerDayResponse,
    dependencies=[Depends(get_current_lab_member)],
)
async def get_participants_per_day(
    start: date_type = Query(..., description="Inclusive start date (YYYY-MM-DD, America/Vancouver)"),
    end: date_type = Query(..., description="Inclusive end date (YYYY-MM-DD, America/Vancouver)"),
    db: AsyncSession = Depends(get_session),
) -> ParticipantsPerDayResponse:
    """Return per-day participant and session counts within [start, end] (inclusive).

    Aggregates completed sessions by study_days.date_local (America/Vancouver).
    Only sessions with a linked study_day_id are included.
    """
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start must not be after end",
        )

    rows_result = await db.execute(
        select(
            StudyDay.date_local,
            func.count(SessionModel.session_id).label("sessions_completed"),
            func.count(distinct(SessionModel.participant_uuid)).label("participants_completed"),
        )
        .join(SessionModel, SessionModel.study_day_id == StudyDay.study_day_id)
        .where(
            StudyDay.date_local >= start,
            StudyDay.date_local <= end,
            SessionModel.status == "complete",
        )
        .group_by(StudyDay.date_local)
        .order_by(StudyDay.date_local.asc())
    )
    rows = rows_result.all()

    return ParticipantsPerDayResponse(
        items=[
            ParticipantsPerDayItem(
                date_local=row.date_local,
                sessions_completed=row.sessions_completed,
                participants_completed=row.participants_completed,
            )
            for row in rows
        ]
    )
