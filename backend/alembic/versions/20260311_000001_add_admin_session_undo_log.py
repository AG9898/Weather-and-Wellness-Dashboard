"""Add admin_session_undo_log table (T96).

Append-only audit table for the RA-only Undo Last Session feature. Stores
deleted session and participant identifiers by value so audit rows survive
the hard deletion of the referenced rows.

Revision ID: 20260311_000001
Revises: 20260310_000002
Create Date: 2026-03-11 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260311_000001"
down_revision = "20260310_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "admin_session_undo_log",
        sa.Column("undo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "deleted_session_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column(
            "deleted_participant_uuid", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("deleted_participant_number", sa.Integer(), nullable=False),
        sa.Column("session_status_at_delete", sa.String(), nullable=False),
        sa.Column(
            "deleted_by_lab_member_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint(
            "undo_id", name=op.f("pk_admin_session_undo_log")
        ),
    )


def downgrade() -> None:
    op.drop_table("admin_session_undo_log")
