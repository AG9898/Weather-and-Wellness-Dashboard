from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class SurveyULS8(Base):
    __tablename__ = "survey_uls8"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_survey_uls8_session_id"),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    # Raw responses — nullable for imported rows (no raw item data available)
    r1: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r2: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r3: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r4: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r5: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r6: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r7: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r8: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # Computed scores — nullable for imported rows where no deterministic mapping exists
    computed_mean: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    score_0_100: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)

    # Legacy aggregate value from imported data (loneliness mean on 1–4 scale)
    legacy_mean_1_4: Mapped[Optional[float]] = mapped_column(Numeric(), nullable=True)

    # 'native' = submitted via live app; 'imported' = loaded from legacy data
    data_source: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="native"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SurveyCESD10(Base):
    __tablename__ = "survey_cesd10"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_survey_cesd10_session_id"),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    # Raw responses — nullable for imported rows
    r1: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r2: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r3: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r4: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r5: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r6: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r7: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r8: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r9: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r10: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # Computed score — nullable for imported rows
    total_score: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # Legacy aggregate value from imported data (depression mean on 1–4 scale)
    legacy_mean_1_4: Mapped[Optional[float]] = mapped_column(Numeric(), nullable=True)

    # 'native' = submitted via live app; 'imported' = loaded from legacy data
    data_source: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="native"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SurveyGAD7(Base):
    __tablename__ = "survey_gad7"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_survey_gad7_session_id"),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    # Raw responses — nullable for imported rows
    r1: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r2: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r3: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r4: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r5: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r6: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r7: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # Computed scores — nullable for imported rows
    total_score: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    severity_band: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Legacy aggregate values from imported data (anxiety on 1–4 scale)
    legacy_mean_1_4: Mapped[Optional[float]] = mapped_column(Numeric(), nullable=True)
    # Integer 0–21 total when legacy anxiety maps exactly; null otherwise
    legacy_total_score: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # 'native' = submitted via live app; 'imported' = loaded from legacy data
    data_source: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="native"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SurveyCogFunc8a(Base):
    __tablename__ = "survey_cogfunc8a"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_survey_cogfunc8a_session_id"),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )

    # Raw responses — nullable for imported rows (no raw item data available)
    r1: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r2: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r3: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r4: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r5: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r6: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r7: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    r8: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)

    # Computed scores — nullable for imported rows where only a legacy mean exists
    total_sum: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    mean_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)

    # Legacy aggregate value from imported data (PROMIS Cognitive Function mean on 1–5 scale)
    legacy_mean_1_5: Mapped[Optional[float]] = mapped_column(Numeric(), nullable=True)

    # 'native' = submitted via live app; 'imported' = loaded from legacy data
    data_source: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="native"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
