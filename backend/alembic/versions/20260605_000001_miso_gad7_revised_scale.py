"""Revise misokinesia GAD-7 scale and add difficulty impact.

Revision ID: 20260605_000001
Revises: 20260603_000001
Create Date: 2026-06-05 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260605_000001"
down_revision = "20260603_000001"
branch_labels = None
depends_on = None


GAD7_ITEM_COLUMNS = tuple(f"r{i}" for i in range(1, 8))


def _drop_item_checks() -> None:
    for column_name in GAD7_ITEM_COLUMNS:
        for constraint_name in (
            f"ck_misokinesia_gad7_{column_name}",
            f"ck_misokinesia_gad7_responses_ck_misokinesia_gad7_{column_name}",
        ):
            op.execute(
                sa.text(
                    f"ALTER TABLE misokinesia_gad7_responses "
                    f"DROP CONSTRAINT IF EXISTS {constraint_name}"
                )
            )


def _create_item_checks(min_value: int, max_value: int) -> None:
    for column_name in GAD7_ITEM_COLUMNS:
        op.create_check_constraint(
            op.f(f"ck_misokinesia_gad7_{column_name}"),
            "misokinesia_gad7_responses",
            sa.text(f"{column_name} BETWEEN {min_value} AND {max_value}"),
        )


def upgrade() -> None:
    _drop_item_checks()

    op.add_column(
        "misokinesia_gad7_responses",
        sa.Column("difficulty_impact", sa.String(), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_misokinesia_gad7_difficulty_impact"),
        "misokinesia_gad7_responses",
        sa.text(
            "difficulty_impact IS NULL OR difficulty_impact IN "
            "('Not difficult at all', 'Somewhat difficult', 'Very difficult', "
            "'Extremely difficult')"
        ),
    )

    op.execute(
        """
        UPDATE misokinesia_gad7_responses
        SET
          r1 = r1 - 1,
          r2 = r2 - 1,
          r3 = r3 - 1,
          r4 = r4 - 1,
          r5 = r5 - 1,
          r6 = r6 - 1,
          r7 = r7 - 1
        WHERE r1 BETWEEN 1 AND 4
          AND r2 BETWEEN 1 AND 4
          AND r3 BETWEEN 1 AND 4
          AND r4 BETWEEN 1 AND 4
          AND r5 BETWEEN 1 AND 4
          AND r6 BETWEEN 1 AND 4
          AND r7 BETWEEN 1 AND 4
        """
    )
    op.execute(
        """
        UPDATE misokinesia_gad7_responses
        SET total_score = r1 + r2 + r3 + r4 + r5 + r6 + r7
        """
    )

    _create_item_checks(0, 3)


def downgrade() -> None:
    _drop_item_checks()

    op.drop_constraint(
        op.f("ck_misokinesia_gad7_difficulty_impact"),
        "misokinesia_gad7_responses",
        type_="check",
    )
    op.drop_column("misokinesia_gad7_responses", "difficulty_impact")

    op.execute(
        """
        UPDATE misokinesia_gad7_responses
        SET
          r1 = r1 + 1,
          r2 = r2 + 1,
          r3 = r3 + 1,
          r4 = r4 + 1,
          r5 = r5 + 1,
          r6 = r6 + 1,
          r7 = r7 + 1
        WHERE r1 BETWEEN 0 AND 3
          AND r2 BETWEEN 0 AND 3
          AND r3 BETWEEN 0 AND 3
          AND r4 BETWEEN 0 AND 3
          AND r5 BETWEEN 0 AND 3
          AND r6 BETWEEN 0 AND 3
          AND r7 BETWEEN 0 AND 3
        """
    )

    _create_item_checks(1, 4)
