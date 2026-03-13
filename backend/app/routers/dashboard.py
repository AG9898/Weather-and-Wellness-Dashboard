from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_lab_member
from app.analytics.constants import ANALYTICS_DEFAULT_MODE
from app.db import get_session
from app.schemas.analytics import AnalyticsReadMode, DashboardAnalyticsResponse
from app.services import get_dashboard_analytics

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/analytics",
    response_model=DashboardAnalyticsResponse,
)
async def get_dashboard_analytics_route(
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
