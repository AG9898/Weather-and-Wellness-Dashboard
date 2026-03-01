from __future__ import annotations

from datetime import date

from pydantic import BaseModel

__all__ = [
    "DashboardSummaryResponse",
    "DashboardSummaryRangeResponse",
    "ParticipantsPerDayItem",
    "ParticipantsPerDayResponse",
]


class DashboardSummaryResponse(BaseModel):
    """Summary metrics returned by GET /dashboard/summary."""

    total_participants: int
    sessions_created: int
    sessions_active: int
    sessions_complete: int
    sessions_created_last_7_days: int
    sessions_completed_last_7_days: int


class DashboardSummaryRangeResponse(BaseModel):
    """Range-filtered KPI counts returned by GET /dashboard/summary/range."""

    date_from: date
    date_to: date
    sessions_created: int
    sessions_completed: int
    participants_completed: int


class ParticipantsPerDayItem(BaseModel):
    """Per-day participant and session counts."""

    date_local: date
    sessions_completed: int
    participants_completed: int


class ParticipantsPerDayResponse(BaseModel):
    """Response for GET /dashboard/participants-per-day."""

    items: list[ParticipantsPerDayItem]
