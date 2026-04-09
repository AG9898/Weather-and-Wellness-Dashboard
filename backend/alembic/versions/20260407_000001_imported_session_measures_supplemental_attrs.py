"""Store supplemental legacy workbook attributes on imported_session_measures.

Revision ID: 20260407_000001
Revises: 20260317_000001
Create Date: 2026-04-07 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260407_000001"
down_revision = "20260317_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "imported_session_measures",
        sa.Column(
            "supplemental_attributes_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("imported_session_measures", "supplemental_attributes_json")
