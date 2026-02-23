from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


AllowedStatus = Literal["created", "active", "complete"]


class SessionCreate(BaseModel):
    participant_uuid: UUID


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    participant_uuid: UUID
    status: AllowedStatus
    created_at: datetime
    completed_at: datetime | None


class SessionStatusUpdate(BaseModel):
    status: AllowedStatus


__all__ = [
    "AllowedStatus",
    "SessionCreate",
    "SessionResponse",
    "SessionStatusUpdate",
]
