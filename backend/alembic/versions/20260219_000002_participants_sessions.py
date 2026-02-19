"""create participants and sessions tables

Revision ID: 20260219_000002
Revises: 20260219_000001
Create Date: 2026-02-19 00:10:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260219_000002"
down_revision = "20260219_000001"
branch_labels = None
depends_on = None


STATUS_ENUM_VALUES = ("created", "active", "complete")


def upgrade() -> None:
    # participants table
    op.create_table(
        "participants",
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("participant_number", sa.Integer(), nullable=False),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("participant_number", name=op.f("uq_participants_participant_number")),
    )

    # sessions table
    op.create_table(
        "sessions",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["participant_uuid"], ["participants.participant_uuid"], name=op.f("fk_sessions_participant_uuid_participants")),
        sa.CheckConstraint(
            "status in ('created','active','complete')",
            name=op.f("ck_sessions_status_allowed"),
        ),
    )


def downgrade() -> None:
    op.drop_table("sessions")
    op.drop_table("participants")
