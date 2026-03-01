from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_lab_member
from app.config import STUDY_TIMEZONE, compute_daylight_exposure_minutes
from app.db import get_session
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.schemas.sessions import (
    AllowedStatus,
    SessionCreate,
    SessionListItemResponse,
    SessionListResponse,
    SessionResponse,
    SessionStatusUpdate,
    StartSessionCreate,
    StartSessionResponse,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])
_optional_bearer = HTTPBearer(auto_error=False)

_VALID_STATUSES = {"created", "active", "complete"}


@router.get(
    "",
    response_model=SessionListResponse,
    dependencies=[Depends(get_current_lab_member)],
)
async def list_sessions(
    page: Annotated[int, Query(ge=1, description="Page number (1-based)")] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=100, description="Items per page (max 100)")
    ] = 20,
    status_filter: Annotated[
        Optional[str], Query(alias="status", description="Filter by status: created | active | complete")
    ] = None,
    participant_number: Annotated[
        Optional[int], Query(ge=1, description="Filter by participant number")
    ] = None,
    date_from: Annotated[
        Optional[date], Query(description="Filter sessions created on or after this date (YYYY-MM-DD)")
    ] = None,
    date_to: Annotated[
        Optional[date], Query(description="Filter sessions created on or before this date (YYYY-MM-DD)")
    ] = None,
    db: AsyncSession = Depends(get_session),
) -> SessionListResponse:
    """List sessions with optional filters and pagination.

    Results are ordered by created_at descending (newest first).
    Requires lab-member authentication.
    """
    # Validate status filter
    if status_filter is not None and status_filter not in _VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status value '{status_filter}'. Must be one of: created, active, complete",
        )

    # Validate date range
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must not be later than date_to",
        )

    # Base query joining sessions → participants for participant_number
    base_stmt = (
        select(SessionModel, Participant.participant_number)
        .join(Participant, SessionModel.participant_uuid == Participant.participant_uuid)
    )

    # Apply filters
    if status_filter is not None:
        base_stmt = base_stmt.where(SessionModel.status == status_filter)

    if participant_number is not None:
        base_stmt = base_stmt.where(Participant.participant_number == participant_number)

    _tz = ZoneInfo(STUDY_TIMEZONE)
    if date_from is not None:
        # Start of local day in study timezone
        cutoff_start = datetime(date_from.year, date_from.month, date_from.day, 0, 0, 0, tzinfo=_tz)
        base_stmt = base_stmt.where(SessionModel.created_at >= cutoff_start)

    if date_to is not None:
        # End of local day in study timezone (inclusive)
        cutoff_end = datetime(date_to.year, date_to.month, date_to.day, 23, 59, 59, tzinfo=_tz)
        base_stmt = base_stmt.where(SessionModel.created_at <= cutoff_end)

    # Total count (before pagination)
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total_result = await db.execute(count_stmt)
    total: int = total_result.scalar_one()

    # Ordered, paginated results
    offset = (page - 1) * page_size
    rows_result = await db.execute(
        base_stmt.order_by(SessionModel.created_at.desc()).offset(offset).limit(page_size)
    )
    rows = rows_result.all()

    items = [
        SessionListItemResponse(
            session_id=session_obj.session_id,
            participant_uuid=session_obj.participant_uuid,
            participant_number=pnum,
            status=session_obj.status,
            created_at=session_obj.created_at,
            completed_at=session_obj.completed_at,
        )
        for session_obj, pnum in rows
    ]

    pages = max(1, math.ceil(total / page_size))

    return SessionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_lab_member)],
)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    participant = await db.get(Participant, payload.participant_uuid)
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    session_obj = SessionModel(
        participant_uuid=payload.participant_uuid,
        status="created",
    )
    db.add(session_obj)
    await db.commit()
    await db.refresh(session_obj)
    return SessionResponse.model_validate(session_obj)


@router.post(
    "/start",
    response_model=StartSessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_lab_member)],
)
async def start_session(
    payload: StartSessionCreate,
    db: AsyncSession = Depends(get_session),
) -> StartSessionResponse:
    """One-click supervised flow: atomically create an anonymous participant (with
    demographics) and an active session, returning the consent-gated start path."""
    # Capture session start time for daylight exposure computation
    session_start_utc = datetime.now(timezone.utc)
    daylight_minutes = compute_daylight_exposure_minutes(session_start_utc)

    # Auto-increment participant number
    result = await db.execute(select(func.max(Participant.participant_number)))
    current_max: int | None = result.scalar_one()
    next_number = (current_max or 0) + 1

    participant = Participant(
        participant_number=next_number,
        age_band=payload.age_band,
        gender=payload.gender,
        origin=payload.origin,
        origin_other_text=payload.origin_other_text,
        commute_method=payload.commute_method,
        commute_method_other_text=payload.commute_method_other_text,
        time_outside=payload.time_outside,
        daylight_exposure_minutes=daylight_minutes,
    )
    db.add(participant)
    await db.flush()  # assigns participant_uuid without committing

    session_obj = SessionModel(
        participant_uuid=participant.participant_uuid,
        status="active",
    )
    db.add(session_obj)
    await db.commit()
    await db.refresh(participant)
    await db.refresh(session_obj)

    return StartSessionResponse(
        participant_uuid=participant.participant_uuid,
        participant_number=participant.participant_number,
        session_id=session_obj.session_id,
        status=session_obj.status,
        created_at=session_obj.created_at,
        completed_at=session_obj.completed_at,
        start_path=f"/session/{session_obj.session_id}/uls8",
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_by_id(
    session_id: UUID,
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == session_id)
    )
    session_obj = result.scalar_one_or_none()
    if session_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return SessionResponse.model_validate(session_obj)


@router.patch(
    "/{session_id}/status",
    response_model=SessionResponse,
)
async def update_session_status(
    session_id: UUID,
    payload: SessionStatusUpdate,
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == session_id)
    )
    session_obj = result.scalar_one_or_none()
    if session_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # Participant pages may mark active sessions complete without auth.
    # Any other status transition is RA-only and requires a valid JWT.
    if payload.status == "complete":
        if credentials is None and session_obj.status != "active":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Session must be active before completion",
            )
        if credentials is not None:
            get_current_lab_member(credentials)
    else:
        get_current_lab_member(credentials)

    session_obj.status = payload.status
    if payload.status == "complete":
        from sqlalchemy.sql import func as sqlfunc
        session_obj.completed_at = sqlfunc.now()

    await db.commit()
    await db.refresh(session_obj)
    return SessionResponse.model_validate(session_obj)
