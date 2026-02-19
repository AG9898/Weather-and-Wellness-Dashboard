from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class SurveyULS8(Base):
    __tablename__ = "survey_uls8"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    r1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r7: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r8: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    computed_mean: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    score_0_100: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SurveyCESD10(Base):
    __tablename__ = "survey_cesd10"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    r1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r7: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r8: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r9: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r10: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SurveyGAD7(Base):
    __tablename__ = "survey_gad7"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    r1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r7: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    severity_band: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SurveyCogFunc8a(Base):
    __tablename__ = "survey_cogfunc8a"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    r1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r7: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    r8: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    total_sum: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    mean_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
