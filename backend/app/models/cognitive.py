from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class StroopRun(Base):
    __tablename__ = "stroop_runs"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_stroop_runs_session_id"),
        CheckConstraint("total_trials >= 0", name="total_trials_nonnegative"),
        CheckConstraint(
            "correct_trials >= 0",
            name="correct_trials_nonnegative",
        ),
        CheckConstraint("error_trials >= 0", name="error_trials_nonnegative"),
        CheckConstraint(
            "timeout_trials >= 0",
            name="timeout_trials_nonnegative",
        ),
        CheckConstraint(
            "overall_accuracy >= 0 AND overall_accuracy <= 1",
            name="overall_accuracy_range",
        ),
        CheckConstraint(
            "congruent_accuracy IS NULL OR (congruent_accuracy >= 0 AND congruent_accuracy <= 1)",
            name="congruent_accuracy_range",
        ),
        CheckConstraint(
            "incongruent_accuracy IS NULL OR (incongruent_accuracy >= 0 AND incongruent_accuracy <= 1)",
            name="incongruent_accuracy_range",
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
    total_trials: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_trials: Mapped[int] = mapped_column(Integer, nullable=False)
    error_trials: Mapped[int] = mapped_column(Integer, nullable=False)
    timeout_trials: Mapped[int] = mapped_column(Integer, nullable=False)
    overall_accuracy: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    congruent_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    incongruent_accuracy: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 4), nullable=True
    )
    mean_rt_congruent_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    mean_rt_incongruent_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    stroop_interference_ms: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    data_source: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="native"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class StroopTrial(Base):
    __tablename__ = "stroop_trials"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "trial_number",
            name="uq_stroop_trials_run_trial_number",
        ),
        CheckConstraint(
            "trial_number >= 1",
            name="trial_number_positive",
        ),
        CheckConstraint(
            "condition IN ('congruent', 'incongruent')",
            name="condition_allowed",
        ),
        CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name="reaction_time_nonnegative",
        ),
    )

    trial_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stroop_runs.run_id"), nullable=False
    )
    trial_number: Mapped[int] = mapped_column(Integer, nullable=False)
    condition: Mapped[str] = mapped_column(String, nullable=False)
    word: Mapped[str] = mapped_column(String, nullable=False)
    ink_color: Mapped[str] = mapped_column(String, nullable=False)
    response_key: Mapped[str | None] = mapped_column(String, nullable=True)
    response_color: Mapped[str | None] = mapped_column(String, nullable=True)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reaction_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timed_out: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CardSortingRun(Base):
    __tablename__ = "card_sorting_runs"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_card_sorting_runs_session_id"),
        CheckConstraint(
            "jsonb_typeof(rule_order) = 'array'",
            name="rule_order_array",
        ),
        CheckConstraint(
            "total_trials >= 0",
            name="total_trials_nonnegative",
        ),
        CheckConstraint(
            "categories_completed >= 0 AND categories_completed <= 6",
            name="categories_completed_range",
        ),
        CheckConstraint(
            "total_correct >= 0",
            name="total_correct_nonnegative",
        ),
        CheckConstraint(
            "total_errors >= 0",
            name="total_errors_nonnegative",
        ),
        CheckConstraint(
            "perseverative_responses >= 0",
            name="perseverative_responses_nonnegative",
        ),
        CheckConstraint(
            "perseverative_errors >= 0",
            name="perseverative_errors_nonnegative",
        ),
        CheckConstraint(
            "nonperseverative_errors >= 0",
            name="nonperseverative_errors_nonnegative",
        ),
        CheckConstraint(
            "trials_to_first_category IS NULL OR trials_to_first_category >= 1",
            name="trials_to_first_category_positive",
        ),
        CheckConstraint(
            "failure_to_maintain_set_count >= 0",
            name="failure_to_maintain_set_nonnegative",
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
    rule_order: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    total_trials: Mapped[int] = mapped_column(Integer, nullable=False)
    categories_completed: Mapped[int] = mapped_column(Integer, nullable=False)
    total_correct: Mapped[int] = mapped_column(Integer, nullable=False)
    total_errors: Mapped[int] = mapped_column(Integer, nullable=False)
    perseverative_responses: Mapped[int] = mapped_column(Integer, nullable=False)
    perseverative_errors: Mapped[int] = mapped_column(Integer, nullable=False)
    nonperseverative_errors: Mapped[int] = mapped_column(Integer, nullable=False)
    trials_to_first_category: Mapped[int | None] = mapped_column(Integer, nullable=True)
    failure_to_maintain_set_count: Mapped[int] = mapped_column(Integer, nullable=False)
    data_source: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default="native"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CardSortingTrial(Base):
    __tablename__ = "card_sorting_trials"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "trial_number",
            name="uq_card_sorting_trials_run_trial_number",
        ),
        CheckConstraint(
            "trial_number >= 1 AND trial_number <= 64",
            name="trial_number_range",
        ),
        CheckConstraint(
            "category_index >= 1 AND category_index <= 6",
            name="category_index_range",
        ),
        CheckConstraint(
            "active_rule IN ('color', 'shape', 'number')",
            name="active_rule_allowed",
        ),
        CheckConstraint(
            "previous_rule IS NULL OR previous_rule IN ('color', 'shape', 'number')",
            name="previous_rule_allowed",
        ),
        CheckConstraint(
            "card_number >= 1",
            name="card_number_positive",
        ),
        CheckConstraint(
            "selected_reference_index >= 1 AND selected_reference_index <= 4",
            name="selected_reference_index_range",
        ),
        CheckConstraint(
            "streak_before >= 0",
            name="streak_before_nonnegative",
        ),
        CheckConstraint(
            "streak_after >= 0",
            name="streak_after_nonnegative",
        ),
        CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name="reaction_time_nonnegative",
        ),
        CheckConstraint(
            "feedback IN ('correct', 'incorrect')",
            name="feedback_allowed",
        ),
    )

    trial_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("card_sorting_runs.run_id"), nullable=False
    )
    trial_number: Mapped[int] = mapped_column(Integer, nullable=False)
    category_index: Mapped[int] = mapped_column(Integer, nullable=False)
    active_rule: Mapped[str] = mapped_column(String, nullable=False)
    previous_rule: Mapped[str | None] = mapped_column(String, nullable=True)
    card_color: Mapped[str] = mapped_column(String, nullable=False)
    card_shape: Mapped[str] = mapped_column(String, nullable=False)
    card_number: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_reference_index: Mapped[int] = mapped_column(Integer, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    perseverative_response: Mapped[bool] = mapped_column(Boolean, nullable=False)
    perseverative_error: Mapped[bool] = mapped_column(Boolean, nullable=False)
    streak_before: Mapped[int] = mapped_column(Integer, nullable=False)
    streak_after: Mapped[int] = mapped_column(Integer, nullable=False)
    category_completed_after_trial: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reaction_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
