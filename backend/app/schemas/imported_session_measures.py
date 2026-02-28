from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ImportedSessionMeasuresResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: UUID
    participant_uuid: UUID
    precipitation_mm: float | None = None
    temperature_c: float | None = None
    anxiety_mean: float | None = None
    loneliness_mean: float | None = None
    depression_mean: float | None = None
    digit_span_max_span: int | None = None
    self_report: float | None = None
    source_row_json: dict[str, Any]
    created_at: datetime


__all__ = [
    "ImportedSessionMeasuresResponse",
]
