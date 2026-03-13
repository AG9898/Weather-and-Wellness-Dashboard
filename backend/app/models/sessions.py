from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


from app.db import Base


class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        Index(
            "ix_sessions_complete_completed_at",
            "completed_at",
            "session_id",
            postgresql_where=text("status = 'complete'"),
        ),
        Index(
            "ix_sessions_complete_study_day_completed_at",
            "study_day_id",
            "completed_at",
            "session_id",
            postgresql_where=text("status = 'complete' AND study_day_id IS NOT NULL"),
        ),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Set when session becomes complete; links session to weather data via study_days
    study_day_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("study_days.study_day_id"), nullable=True
    )
