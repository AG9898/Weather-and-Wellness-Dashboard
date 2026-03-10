"""Extend survey_cogfunc8a for imported legacy rows (T77).

Adds Phase 4-style import support to survey_cogfunc8a so imported legacy
CogFunc/PROMIS aggregates can be stored without fabricating raw item-level
responses. Existing native rows are preserved and receive data_source='native'
via the server default.

Revision ID: 20260310_000001
Revises: 20260303_000001
Create Date: 2026-03-10 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260310_000001"
down_revision = "20260303_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "survey_cogfunc8a",
        sa.Column(
            "data_source",
            sa.String(16),
            nullable=False,
            server_default="native",
        ),
    )
    op.add_column(
        "survey_cogfunc8a",
        sa.Column("legacy_mean_1_5", sa.Numeric(), nullable=True),
    )

    for col in [f"r{i}" for i in range(1, 9)]:
        op.alter_column(
            "survey_cogfunc8a",
            col,
            existing_type=sa.SmallInteger(),
            nullable=True,
        )

    op.alter_column(
        "survey_cogfunc8a",
        "total_sum",
        existing_type=sa.SmallInteger(),
        nullable=True,
    )
    op.alter_column(
        "survey_cogfunc8a",
        "mean_score",
        existing_type=sa.Numeric(5, 4),
        nullable=True,
    )
    op.create_unique_constraint(
        "uq_survey_cogfunc8a_session_id",
        "survey_cogfunc8a",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_survey_cogfunc8a_session_id",
        "survey_cogfunc8a",
        type_="unique",
    )
    op.alter_column(
        "survey_cogfunc8a",
        "mean_score",
        existing_type=sa.Numeric(5, 4),
        nullable=False,
    )
    op.alter_column(
        "survey_cogfunc8a",
        "total_sum",
        existing_type=sa.SmallInteger(),
        nullable=False,
    )

    for col in [f"r{i}" for i in range(1, 9)]:
        op.alter_column(
            "survey_cogfunc8a",
            col,
            existing_type=sa.SmallInteger(),
            nullable=False,
        )

    op.drop_column("survey_cogfunc8a", "legacy_mean_1_5")
    op.drop_column("survey_cogfunc8a", "data_source")
