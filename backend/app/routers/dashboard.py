from __future__ import annotations

from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_lab_member
from app.analytics.constants import ANALYTICS_DEFAULT_MODE
from app.db import get_session, get_session_factory
from app.schemas.analytics import AnalyticsReadMode, DashboardAnalyticsResponse
from app.services import (
    complete_dashboard_analytics_refresh,
    get_dashboard_analytics,
    request_dashboard_analytics_refresh,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _complete_dashboard_analytics_refresh_task(run_id: UUID) -> None:
    async with get_session_factory()() as db:
        await complete_dashboard_analytics_refresh(db, run_id=run_id)


@router.get(
    "/analytics",
    response_model=DashboardAnalyticsResponse,
)
async def get_dashboard_analytics_route(
    background_tasks: BackgroundTasks,
    date_from: date_type = Query(
        ...,
        description="Inclusive start date (YYYY-MM-DD, America/Vancouver)",
    ),
    date_to: date_type = Query(
        ...,
        description="Inclusive end date (YYYY-MM-DD, America/Vancouver)",
    ),
    mode: AnalyticsReadMode = Query(
        ANALYTICS_DEFAULT_MODE,
        description="Analytics read mode: snapshot (default) or live.",
    ),
    lab_member: LabMember = Depends(get_current_lab_member),
    db: AsyncSession = Depends(get_session),
) -> DashboardAnalyticsResponse:
    """Return dashboard analytics snapshot data or trigger a live recompute."""

    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="date_from must not be after date_to",
        )

    if mode == "live":
        refresh_request = await request_dashboard_analytics_refresh(
            db,
            date_from=date_from,
            date_to=date_to,
            triggered_by_lab_member_id=lab_member.id,
        )
        if refresh_request.run_id is not None:
            background_tasks.add_task(
                _complete_dashboard_analytics_refresh_task,
                refresh_request.run_id,
            )
        analytics_response = refresh_request.response
    else:
        analytics_response = await get_dashboard_analytics(
            db,
            date_from=date_from,
            date_to=date_to,
            mode=mode,
            triggered_by_lab_member_id=lab_member.id,
        )

    if analytics_response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analytics snapshot exists for the requested range",
        )

    return analytics_response
