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


class SessionListItemResponse(BaseModel):
    """Session row enriched with participant_number for RA dashboard tables."""

    session_id: UUID
    participant_uuid: UUID
    participant_number: int
    status: AllowedStatus
    created_at: datetime
    completed_at: datetime | None


class SessionListResponse(BaseModel):
    """Paginated session list returned by GET /sessions."""

    items: list[SessionListItemResponse]
    total: int
    page: int
    page_size: int
    pages: int


class StartSessionResponse(BaseModel):
    """Response for POST /sessions/start — one-click supervised flow."""

    participant_uuid: UUID
    participant_number: int
    session_id: UUID
    status: AllowedStatus
    created_at: datetime
    completed_at: datetime | None
    start_path: str


__all__ = [
    "AllowedStatus",
    "SessionCreate",
    "SessionListItemResponse",
    "SessionListResponse",
    "SessionResponse",
    "SessionStatusUpdate",
    "StartSessionResponse",
]
