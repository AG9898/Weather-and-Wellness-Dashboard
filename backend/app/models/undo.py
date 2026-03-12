from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class AdminSessionUndoLog(Base):
    """Append-only audit record for RA-triggered undo-last-session operations."""

    __tablename__ = "admin_session_undo_log"

    undo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Identifiers stored by value — no FK to deleted rows
    deleted_session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    deleted_participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    deleted_participant_number: Mapped[int] = mapped_column(Integer, nullable=False)
    session_status_at_delete: Mapped[str] = mapped_column(String, nullable=False)
    deleted_by_lab_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
