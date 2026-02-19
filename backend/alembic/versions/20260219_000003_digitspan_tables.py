"""create digit span tables

Revision ID: 20260219_000003
Revises: 20260219_000002
Create Date: 2026-02-19 00:25:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260219_000003"
down_revision = "20260219_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # digitspan_runs table
    op.create_table(
        "digitspan_runs",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_correct", sa.Integer(), nullable=False),
        sa.Column("max_span", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint([
            "session_id"
        ], [
            "sessions.session_id"
        ], name=op.f("fk_digitspan_runs_session_id_sessions")),
        sa.ForeignKeyConstraint([
            "participant_uuid"
        ], [
            "participants.participant_uuid"
        ], name=op.f("fk_digitspan_runs_participant_uuid_participants")),
    )

    # digitspan_trials table
    op.create_table(
        "digitspan_trials",
        sa.Column("trial_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trial_number", sa.Integer(), nullable=False),
        sa.Column("span_length", sa.Integer(), nullable=False),
        sa.Column("sequence_shown", sa.String(), nullable=False),
        sa.Column("sequence_entered", sa.String(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint([
            "run_id"
        ], [
            "digitspan_runs.run_id"
        ], name=op.f("fk_digitspan_trials_run_id_digitspan_runs")),
        sa.CheckConstraint("trial_number >= 1 AND trial_number <= 14", name=op.f("ck_digitspan_trials_trial_number_range")),
        sa.CheckConstraint("span_length >= 3 AND span_length <= 9", name=op.f("ck_digitspan_trials_span_length_range")),
    )


def downgrade() -> None:
    op.drop_table("digitspan_trials")
    op.drop_table("digitspan_runs")

