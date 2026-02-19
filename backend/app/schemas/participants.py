from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ParticipantCreate(BaseModel):
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)


class ParticipantResponse(BaseModel):
    participant_uuid: UUID
    participant_number: int
    first_name: str
    last_name: str
    created_at: datetime

    class Config:
        from_attributes = True


__all__ = [
    ParticipantCreate,
    ParticipantResponse,
]
PY}
