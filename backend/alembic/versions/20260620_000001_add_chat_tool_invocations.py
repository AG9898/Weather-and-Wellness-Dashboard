"""Add chat_tool_invocations table (T1829).

Append-only audit table for the RA chatbot agentic coordinator loop. Records
one row per approved tool invocation (tool name, model-supplied params, and
resulting status) for research-ethics review and debugging. Stores tool
metadata and status only — never raw participant rows or PII. No FK to a
conversation table because v1 does not persist conversations server-side.

Revision ID: 20260620_000001
Revises: 20260614_000001
Create Date: 2026-06-20 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260620_000001"
down_revision = "20260614_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_tool_invocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "conversation_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("lab_name", sa.String(), nullable=False),
        sa.Column("tool_name", sa.String(), nullable=False),
        sa.Column(
            "params",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_chat_tool_invocations")),
    )


def downgrade() -> None:
    op.drop_table("chat_tool_invocations")
