from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_lab_member
from app.db import get_session
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.schemas.dashboard import DashboardSummaryResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
