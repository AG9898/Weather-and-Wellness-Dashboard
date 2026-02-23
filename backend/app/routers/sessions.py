from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_lab_member
from app.db import get_session
from app.models import Participant, Session as SessionModel
from app.schemas.sessions import SessionCreate, SessionResponse, SessionStatusUpdate

router = APIRouter(prefix="/sessions", tags=["sessions"])


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
    dependencies=[Depends(get_current_lab_member)],
)
async def update_session_status(
    session_id: UUID,
    payload: SessionStatusUpdate,
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

    session_obj.status = payload.status
    if payload.status == "complete":
        from sqlalchemy.sql import func
        session_obj.completed_at = func.now()

    await db.commit()
    await db.refresh(session_obj)
    return SessionResponse.model_validate(session_obj)
