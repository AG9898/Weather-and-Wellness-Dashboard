"""Add complete-session analytics hot-path indexes.

Revision ID: 20260313_000001
Revises: 20260311_000001
Create Date: 2026-03-13 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260313_000001"
down_revision = "20260311_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_sessions_complete_completed_at",
        "sessions",
        ["completed_at", "session_id"],
        unique=False,
        postgresql_where=sa.text("status = 'complete'"),
    )
    op.create_index(
        "ix_sessions_complete_study_day_completed_at",
        "sessions",
        ["study_day_id", "completed_at", "session_id"],
        unique=False,
        postgresql_where=sa.text("status = 'complete' AND study_day_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_sessions_complete_study_day_completed_at",
        table_name="sessions",
    )
    op.drop_index(
        "ix_sessions_complete_completed_at",
        table_name="sessions",
    )
