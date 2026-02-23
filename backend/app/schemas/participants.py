from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ParticipantCreate(BaseModel):
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    participant_uuid: UUID
    participant_number: int
    first_name: str
    last_name: str
    created_at: datetime


__all__ = [
    "ParticipantCreate",
    "ParticipantResponse",
]
