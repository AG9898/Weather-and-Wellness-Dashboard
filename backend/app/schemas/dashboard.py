from __future__ import annotations

from pydantic import BaseModel

__all__ = ["DashboardSummaryResponse"]


class DashboardSummaryResponse(BaseModel):
    """Summary metrics returned by GET /dashboard/summary."""

    total_participants: int
    sessions_created: int
    sessions_active: int
    sessions_complete: int
    sessions_created_last_7_days: int
    sessions_completed_last_7_days: int
