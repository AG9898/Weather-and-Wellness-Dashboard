"""Add miso demographics columns to misokinesia_participants (T184).

Adds six nullable VARCHAR columns to misokinesia_participants:
  age_band, gender, gender_other_text, country, country_other_text, nationality.

Revision ID: 20260519_000001
Revises: 20260518_000001
Create Date: 2026-05-19 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260519_000001"
down_revision = "20260518_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "misokinesia_participants",
        sa.Column("age_band", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("gender", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("gender_other_text", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("country", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("country_other_text", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("nationality", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("misokinesia_participants", "nationality")
    op.drop_column("misokinesia_participants", "country_other_text")
    op.drop_column("misokinesia_participants", "country")
    op.drop_column("misokinesia_participants", "gender_other_text")
    op.drop_column("misokinesia_participants", "gender")
    op.drop_column("misokinesia_participants", "age_band")
