from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func, text

from app.db import Base


class MisokinesiaTestSet(Base):
    __tablename__ = "misokinesia_test_sets"

    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MisokinesiaStimulus(Base):
    __tablename__ = "misokinesia_stimuli"

    stimulus_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_test_sets.test_set_id"),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(
        String, nullable=False, server_default=text("'video/mp4'")
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MisokinesiaParticipant(Base):
    __tablename__ = "misokinesia_participants"

    misokinesia_participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    test_set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_test_sets.test_set_id"),
        nullable=False,
    )
    # Independent sequence — auto-assigned server-side
    misokinesia_participant_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("nextval('misokinesia_participant_number_seq')"),
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Randomized post-video survey order; comma-separated e.g. "mkaq,gad7,maq"
    post_survey_order: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # End-of-task fields (collected once, after all clips and post-video surveys)
    end_fidgeting_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    end_emotions_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stronger_responses: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    stronger_responses_timing: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    # Miso-specific demographics (T184); collected before intro, all optional
    age_band: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    gender_other_text: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    country_other_text: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String, nullable=True)


class MisokinesiaAqResponse(Base):
    __tablename__ = "misokinesia_mkaq_responses"
    __table_args__ = (
        UniqueConstraint(
            "misokinesia_participant_id",
            name="uq_misokinesia_mkaq_responses_participant",
        ),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    misokinesia_participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_participants.misokinesia_participant_id"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    administration: Mapped[str] = mapped_column(String(4), nullable=False)
    q1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q7: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q8: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q9: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q10: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q11: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q12: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q13: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q14: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q15: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q16: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q17: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q18: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q19: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q20: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q21: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MisokinesiaGAD7Response(Base):
    __tablename__ = "misokinesia_gad7_responses"
    __table_args__ = (
        UniqueConstraint(
            "misokinesia_participant_id",
            name="uq_misokinesia_gad7_responses_participant",
        ),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    misokinesia_participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_participants.misokinesia_participant_id"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    # GAD-7 items r1–r7, scale 1–4 (1=Never, 4=Often)
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


class MisokinesiaMAQResponse(Base):
    __tablename__ = "misokinesia_maq_responses"
    __table_args__ = (
        UniqueConstraint(
            "misokinesia_participant_id",
            name="uq_misokinesia_maq_responses_participant",
        ),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    misokinesia_participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_participants.misokinesia_participant_id"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    # MAQ items q1–q21, scale 0–3
    q1: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q2: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q3: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q4: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q5: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q6: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q7: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q8: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q9: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q10: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q11: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q12: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q13: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q14: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q15: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q16: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q17: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q18: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q19: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q20: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    q21: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MisokinesiaTrialResponse(Base):
    __tablename__ = "misokinesia_trial_responses"
    __table_args__ = (
        UniqueConstraint(
            "misokinesia_participant_id",
            "stimulus_id",
            name="uq_misokinesia_trial_responses_participant_stimulus",
        ),
    )

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    misokinesia_participant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_participants.misokinesia_participant_id"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    stimulus_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("misokinesia_stimuli.stimulus_id"),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    # Per-clip questionnaire items (scale 1–5: Strongly Disagree → Strongly Agree)
    q1: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # I find this video unpleasant
    q2: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # I felt physical discomfort during the video
    q3: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # I felt upset during the video
    q4: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # I wanted to stop the video early / or close my eyes
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
