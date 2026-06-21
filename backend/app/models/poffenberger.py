from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class PoffenbergerRun(Base):
    __tablename__ = "ihtt_poffenberger_runs"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_ihtt_poffenberger_runs_session_id"),
        CheckConstraint(
            "NOT is_complete OR completed_at IS NOT NULL",
            name="complete_requires_completed_at",
        ),
        CheckConstraint(
            "jsonb_typeof(manifest_json) = 'object'",
            name="manifest_object",
        ),
        CheckConstraint(
            "total_practice_trials >= 0",
            name="practice_nonnegative",
        ),
        CheckConstraint(
            "total_experimental_trials >= 0",
            name="experimental_nonnegative",
        ),
        CheckConstraint(
            "lh_lvf_accuracy IS NULL OR (lh_lvf_accuracy >= 0 AND lh_lvf_accuracy <= 1)",
            name="lh_lvf_accuracy_range",
        ),
        CheckConstraint(
            "lh_rvf_accuracy IS NULL OR (lh_rvf_accuracy >= 0 AND lh_rvf_accuracy <= 1)",
            name="lh_rvf_accuracy_range",
        ),
        CheckConstraint(
            "rh_lvf_accuracy IS NULL OR (rh_lvf_accuracy >= 0 AND rh_lvf_accuracy <= 1)",
            name="rh_lvf_accuracy_range",
        ),
        CheckConstraint(
            "rh_rvf_accuracy IS NULL OR (rh_rvf_accuracy >= 0 AND rh_rvf_accuracy <= 1)",
            name="rh_rvf_accuracy_range",
        ),
        CheckConstraint(
            "accuracy_crossed IS NULL OR (accuracy_crossed >= 0 AND accuracy_crossed <= 1)",
            name="accuracy_crossed_range",
        ),
        CheckConstraint(
            "accuracy_uncrossed IS NULL OR (accuracy_uncrossed >= 0 AND accuracy_uncrossed <= 1)",
            name="accuracy_uncrossed_range",
        ),
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    manifest_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_complete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    total_practice_trials: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    total_experimental_trials: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )

    lh_lvf_total_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_lvf_valid_rt_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_lvf_timeout_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_lvf_invalid_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_lvf_accurate_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_lvf_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    lh_lvf_mean_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    lh_lvf_median_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    lh_lvf_sd_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    lh_rvf_total_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_rvf_valid_rt_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_rvf_timeout_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_rvf_invalid_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_rvf_accurate_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    lh_rvf_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    lh_rvf_mean_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    lh_rvf_median_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    lh_rvf_sd_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    rh_lvf_total_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_lvf_valid_rt_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_lvf_timeout_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_lvf_invalid_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_lvf_accurate_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_lvf_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    rh_lvf_mean_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    rh_lvf_median_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    rh_lvf_sd_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    rh_rvf_total_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_rvf_valid_rt_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_rvf_timeout_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_rvf_invalid_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_rvf_accurate_trials: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    rh_rvf_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    rh_rvf_mean_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    rh_rvf_median_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    rh_rvf_sd_rt_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    mean_rt_crossed_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    mean_rt_uncrossed_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    ihtt_difference_ms: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    accuracy_crossed: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    accuracy_uncrossed: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)


class PoffenbergerTrial(Base):
    __tablename__ = "ihtt_poffenberger_trials"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "global_trial_number",
            name="uq_ihtt_poffenberger_trials_run_global_trial",
        ),
        CheckConstraint("block_number >= 0", name="block_nonnegative"),
        CheckConstraint("trial_number >= 1", name="trial_positive"),
        CheckConstraint("global_trial_number >= 1", name="global_positive"),
        CheckConstraint(
            "response_hand IN ('left', 'right')",
            name="response_hand_allowed",
        ),
        CheckConstraint(
            "visual_field IN ('lvf', 'rvf')",
            name="visual_field_allowed",
        ),
        CheckConstraint(
            "condition_key IN ('lh_lvf', 'lh_rvf', 'rh_lvf', 'rh_rvf')",
            name="condition_key_allowed",
        ),
        CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name="rt_nonnegative",
        ),
        CheckConstraint("jitter_ms >= 0", name="jitter_nonnegative"),
        CheckConstraint("NOT is_practice OR is_scored = false", name="practice_not_scored"),
    )

    trial_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ihtt_poffenberger_runs.run_id"), nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.session_id"), nullable=False
    )
    participant_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("participants.participant_uuid"), nullable=False
    )
    block_number: Mapped[int] = mapped_column(Integer, nullable=False)
    trial_number: Mapped[int] = mapped_column(Integer, nullable=False)
    global_trial_number: Mapped[int] = mapped_column(Integer, nullable=False)
    response_hand: Mapped[str] = mapped_column(String, nullable=False)
    visual_field: Mapped[str] = mapped_column(String, nullable=False)
    condition_key: Mapped[str] = mapped_column(String, nullable=False)
    is_practice: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_scored: Mapped[bool] = mapped_column(Boolean, nullable=False)
    expected_key: Mapped[str] = mapped_column(String, nullable=False)
    pressed_key: Mapped[str | None] = mapped_column(String, nullable=True)
    reaction_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_valid_response: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_timeout: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_accurate: Mapped[bool] = mapped_column(Boolean, nullable=False)
    jitter_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    client_trial_started_at_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3), nullable=True
    )
    client_stimulus_onset_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3), nullable=True
    )
    client_response_at_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3), nullable=True
    )
    client_trial_ended_at_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
