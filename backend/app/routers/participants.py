from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_lab_member
from app.db import get_session
from app.models import Participant
from app.schemas.participants import ParticipantCreate, ParticipantResponse

router = APIRouter(
    prefix=/participants,
    tags=[participants],
    dependencies=[Depends(get_current_lab_member)],
)


@router.post(, response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    payload: ParticipantCreate,
    session: AsyncSession = Depends(get_session),
) -> ParticipantResponse:
    # Determine next participant_number sequentially (starting at 1)
    result = await session.execute(select(func.max(Participant.participant_number)))
    current_max: int | None = result.scalar_one()
    next_number = (current_max or 0) + 1

    participant = Participant(
        participant_number=next_number,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )
    session.add(participant)
    await session.commit()
    await session.refresh(participant)
    return ParticipantResponse.model_validate(participant)


@router.get(, response_model=List[ParticipantResponse])
async def list_participants(
    session: AsyncSession = Depends(get_session),
) -> List[ParticipantResponse]:
    result = await session.execute(
        select(Participant).order_by(Participant.participant_number.asc())
    )
    rows = result.scalars().all()
    return [ParticipantResponse.model_validate(p) for p in rows]


@router.get(/{participant_uuid}, response_model=ParticipantResponse)
async def get_participant(
    participant_uuid: UUID,
    session: AsyncSession = Depends(get_session),
) -> ParticipantResponse:
    result = await session.execute(
        select(Participant).where(Participant.participant_uuid == participant_uuid)
    )
    participant = result.scalar_one_or_none()
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=Participant
