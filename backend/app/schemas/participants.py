from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    participant_uuid: UUID
    participant_number: int
    created_at: datetime

    # Phase 3 demographic / exposure columns (nullable)
    age_band: str | None = None
    gender: str | None = None
    origin: str | None = None
    origin_other_text: str | None = None
    commute_method: str | None = None
    commute_method_other_text: str | None = None
    time_outside: str | None = None
    daylight_exposure_minutes: int | None = None


__all__ = [
    "ParticipantResponse",
]
