from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    participant_uuid: UUID
    participant_number: int
    created_at: datetime


__all__ = [
    "ParticipantResponse",
]
