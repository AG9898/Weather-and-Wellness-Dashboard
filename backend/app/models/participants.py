from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Participant(Base):
    __tablename__ = "participants"

    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    participant_number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Phase 3 demographic / exposure columns (all nullable; collected at session start)
    age_band: Mapped[str | None] = mapped_column(String, nullable=True)
    gender: Mapped[str | None] = mapped_column(String, nullable=True)
    origin: Mapped[str | None] = mapped_column(String, nullable=True)
    origin_other_text: Mapped[str | None] = mapped_column(String, nullable=True)
    commute_method: Mapped[str | None] = mapped_column(String, nullable=True)
    commute_method_other_text: Mapped[str | None] = mapped_column(String, nullable=True)
    time_outside: Mapped[str | None] = mapped_column(String, nullable=True)
    # Minutes since DAYLIGHT_START_LOCAL_TIME (default 06:00 America/Vancouver) at session start
    daylight_exposure_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
