from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator


AllowedStatus = Literal["created", "active", "complete"]

# Canonical preset option lists for start-session demographics (DESIGN_SPEC.md)
AGE_BAND_OPTIONS = frozenset({"Under 18", "18-24", "25-31", "32-38", ">38"})
GENDER_OPTIONS = frozenset({"Woman", "Man", "Non-binary", "Prefer not to say"})
ORIGIN_OPTIONS = frozenset({"Home", "Work", "Class", "Library", "Gym/Recreation Center", "Other"})
COMMUTE_METHOD_OPTIONS = frozenset({"Walk", "Transit", "Car", "Bike/Scooter", "Other"})
TIME_OUTSIDE_OPTIONS = frozenset({
    "Never (0-30 minutes)",
    "Rarely (31 minutes- 60 minutes)",
    "Sometimes (61 minutes - 90 minutes)",
    "Often (over 90 minutes)",
})


class SessionCreate(BaseModel):
    participant_uuid: UUID


class StartSessionCreate(BaseModel):
    """Demographics payload for POST /sessions/start (Phase 3)."""

    age_band: str
    gender: str
    origin: str
    origin_other_text: str | None = None
    commute_method: str
    commute_method_other_text: str | None = None
    time_outside: str

    @model_validator(mode="after")
    def validate_demographics(self) -> "StartSessionCreate":
        errors: list[str] = []

        if self.age_band not in AGE_BAND_OPTIONS:
            errors.append(
                f"age_band must be one of: {', '.join(sorted(AGE_BAND_OPTIONS))}"
            )
        if self.gender not in GENDER_OPTIONS:
            errors.append(
                f"gender must be one of: {', '.join(sorted(GENDER_OPTIONS))}"
            )
        if self.origin not in ORIGIN_OPTIONS:
            errors.append(
                f"origin must be one of: {', '.join(sorted(ORIGIN_OPTIONS))}"
            )
        if self.commute_method not in COMMUTE_METHOD_OPTIONS:
            errors.append(
                f"commute_method must be one of: {', '.join(sorted(COMMUTE_METHOD_OPTIONS))}"
            )
        if self.time_outside not in TIME_OUTSIDE_OPTIONS:
            errors.append(
                f"time_outside must be one of: {', '.join(sorted(TIME_OUTSIDE_OPTIONS))}"
            )

        if self.origin == "Other" and not (self.origin_other_text or "").strip():
            errors.append("origin_other_text is required when origin is 'Other'")
        if self.commute_method == "Other" and not (self.commute_method_other_text or "").strip():
            errors.append("commute_method_other_text is required when commute_method is 'Other'")

        if errors:
            raise ValueError(errors)
        return self


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


class UndoLastSessionRequest(BaseModel):
    """Request body for DELETE /sessions/last-native."""

    confirm: bool
    reason: str | None = None


class UndoLastSessionResponse(BaseModel):
    """Typed delete summary returned by DELETE /sessions/last-native."""

    deleted_session_id: UUID
    deleted_participant_uuid: UUID
    deleted_participant_number: int
    session_status_at_delete: AllowedStatus
    participant_deleted: bool


class LastNativeSessionInfo(BaseModel):
    """Candidate session metadata returned by GET /sessions/last-native."""

    session_id: UUID
    participant_uuid: UUID
    participant_number: int
    status: AllowedStatus
    created_at: datetime


__all__ = [
    "AllowedStatus",
    "LastNativeSessionInfo",
    "SessionCreate",
    "SessionListItemResponse",
    "SessionListResponse",
    "SessionResponse",
    "SessionStatusUpdate",
    "StartSessionCreate",
    "StartSessionResponse",
    "UndoLastSessionRequest",
    "UndoLastSessionResponse",
]
