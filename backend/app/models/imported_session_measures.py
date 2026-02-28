from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Double, ForeignKey, Integer
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ImportedSessionMeasures(Base):
    """Legacy aggregate outcomes imported from external data files.

    One row per session (1:1 with sessions). Stores imported aggregate
    measure values and the full raw source row for auditability.
    """

    __tablename__ = "imported_session_measures"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.session_id"),
        primary_key=True,
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("participants.participant_uuid"),
        nullable=False,
    )

    # Legacy imported measure columns (units as provided in source data)
    precipitation_mm: Mapped[float | None] = mapped_column(Double, nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Double, nullable=True)
    anxiety_mean: Mapped[float | None] = mapped_column(Double, nullable=True)
    loneliness_mean: Mapped[float | None] = mapped_column(Double, nullable=True)
    depression_mean: Mapped[float | None] = mapped_column(Double, nullable=True)
    digit_span_max_span: Mapped[int | None] = mapped_column(Integer, nullable=True)
    self_report: Mapped[float | None] = mapped_column(Double, nullable=True)

    # Full raw source row stored for audit / future remapping
    source_row_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
