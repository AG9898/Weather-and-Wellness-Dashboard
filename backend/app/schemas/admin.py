from __future__ import annotations

from pydantic import BaseModel


class ImportRowIssue(BaseModel):
    row: int
    field: str | None = None
    message: str


class ImportPreviewResponse(BaseModel):
    file_type: str
    rows_total: int
    participants_create: int
    participants_update: int
    sessions_create: int
    sessions_update: int
    errors: list[ImportRowIssue]
    warnings: list[ImportRowIssue]


class ImportCommitResponse(BaseModel):
    rows_total: int
    participants_created: int
    participants_updated: int
    sessions_created: int
    sessions_updated: int


class LegacyWeatherBackfillResponse(BaseModel):
    days_inserted: int
    days_updated: int
    days_skipped: int


__all__ = [
    "ImportRowIssue",
    "ImportPreviewResponse",
    "ImportCommitResponse",
    "LegacyWeatherBackfillResponse",
]
