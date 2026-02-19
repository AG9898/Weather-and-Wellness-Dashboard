from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.auth import get_current_lab_member
from app.db import get_session
from app.models import Participant, Session as SessionModel
from app.schemas.sessions import (
    SessionCreate,
    SessionResponse,
    SessionStatusUpdate,
)

router = APIRouter(prefix=/sessions, tags=[sessions])


@router.post(, response_model=SessionResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(get_current_lab_member)])
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    participant = await db.get(Participant, payload.participant_uuid)
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=participant
