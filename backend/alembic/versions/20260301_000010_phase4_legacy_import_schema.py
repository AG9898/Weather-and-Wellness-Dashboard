"""Phase 4 — legacy import remapping schema additions (T54)

Adds data_source flag, legacy-value columns, nullable relaxations, and
session_id uniqueness constraints to the four tables that receive imported
aggregate rows: digitspan_runs, survey_uls8, survey_cesd10, survey_gad7.

Goals:
- data_source VARCHAR(16) DEFAULT 'native' distinguishes native submissions
  from rows remapped from legacy imported data.
- legacy_mean_1_4 / legacy_total_score columns store imported aggregate
  values that cannot be deterministically reconstructed into raw r* items.
- Raw response columns (r1…rN) and computed score columns become nullable
  so imported rows can be stored without fabricating item-level data.
- UNIQUE constraint on session_id enforces the 1:1 session ↔ outcome row
  invariant at the DB level for these four tables.
- Existing native rows are unaffected: they will receive data_source='native'
  via the server_default and all previously-NOT-NULL columns still have data.

Revision ID: 20260301_000010
Revises: 20260228_000009
Create Date: 2026-03-01 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260301_000010"
down_revision = "20260228_000009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ──────────────────────────────────────────────────────────────────────
    # digitspan_runs
    # ──────────────────────────────────────────────────────────────────────
    op.add_column(
        "digitspan_runs",
        sa.Column(
            "data_source",
            sa.String(16),
            nullable=False,
            server_default="native",
        ),
    )
    # max_span is now nullable — imported rows have total_correct but not max_span
    op.alter_column(
        "digitspan_runs",
        "max_span",
        existing_type=sa.Integer(),
        nullable=True,
    )
    # Enforce at most one run per session
    op.create_unique_constraint(
        "uq_digitspan_runs_session_id", "digitspan_runs", ["session_id"]
    )

    # ──────────────────────────────────────────────────────────────────────
    # survey_uls8
    # ──────────────────────────────────────────────────────────────────────
    op.add_column(
        "survey_uls8",
        sa.Column(
            "data_source",
            sa.String(16),
            nullable=False,
            server_default="native",
        ),
    )
    op.add_column(
        "survey_uls8",
        sa.Column("legacy_mean_1_4", sa.Numeric(), nullable=True),
    )
    # Raw responses and computed scores nullable for imported rows
    for col in [f"r{i}" for i in range(1, 9)]:
        op.alter_column(
            "survey_uls8", col, existing_type=sa.SmallInteger(), nullable=True
        )
    op.alter_column(
        "survey_uls8",
        "computed_mean",
        existing_type=sa.Numeric(5, 4),
        nullable=True,
    )
    op.alter_column(
        "survey_uls8",
        "score_0_100",
        existing_type=sa.Numeric(6, 2),
        nullable=True,
    )
    op.create_unique_constraint(
        "uq_survey_uls8_session_id", "survey_uls8", ["session_id"]
    )

    # ──────────────────────────────────────────────────────────────────────
    # survey_cesd10
    # ──────────────────────────────────────────────────────────────────────
    op.add_column(
        "survey_cesd10",
        sa.Column(
            "data_source",
            sa.String(16),
            nullable=False,
            server_default="native",
        ),
    )
    op.add_column(
        "survey_cesd10",
        sa.Column("legacy_mean_1_4", sa.Numeric(), nullable=True),
    )
    for col in [f"r{i}" for i in range(1, 11)]:
        op.alter_column(
            "survey_cesd10", col, existing_type=sa.SmallInteger(), nullable=True
        )
    op.alter_column(
        "survey_cesd10",
        "total_score",
        existing_type=sa.SmallInteger(),
        nullable=True,
    )
    op.create_unique_constraint(
        "uq_survey_cesd10_session_id", "survey_cesd10", ["session_id"]
    )

    # ──────────────────────────────────────────────────────────────────────
    # survey_gad7
    # ──────────────────────────────────────────────────────────────────────
    op.add_column(
        "survey_gad7",
        sa.Column(
            "data_source",
            sa.String(16),
            nullable=False,
            server_default="native",
        ),
    )
    op.add_column(
        "survey_gad7",
        sa.Column("legacy_mean_1_4", sa.Numeric(), nullable=True),
    )
    op.add_column(
        "survey_gad7",
        sa.Column("legacy_total_score", sa.SmallInteger(), nullable=True),
    )
    for col in [f"r{i}" for i in range(1, 8)]:
        op.alter_column(
            "survey_gad7", col, existing_type=sa.SmallInteger(), nullable=True
        )
    op.alter_column(
        "survey_gad7",
        "total_score",
        existing_type=sa.SmallInteger(),
        nullable=True,
    )
    op.alter_column(
        "survey_gad7",
        "severity_band",
        existing_type=sa.String(),
        nullable=True,
    )
    op.create_unique_constraint(
        "uq_survey_gad7_session_id", "survey_gad7", ["session_id"]
    )


def downgrade() -> None:
    # ── survey_gad7 ──────────────────────────────────────────────────────
    op.drop_constraint("uq_survey_gad7_session_id", "survey_gad7", type_="unique")
    op.drop_column("survey_gad7", "legacy_total_score")
    op.drop_column("survey_gad7", "legacy_mean_1_4")
    op.drop_column("survey_gad7", "data_source")
    for col in [f"r{i}" for i in range(1, 8)]:
        op.alter_column(
            "survey_gad7", col, existing_type=sa.SmallInteger(), nullable=False
        )
    op.alter_column(
        "survey_gad7", "total_score", existing_type=sa.SmallInteger(), nullable=False
    )
    op.alter_column(
        "survey_gad7", "severity_band", existing_type=sa.String(), nullable=False
    )

    # ── survey_cesd10 ────────────────────────────────────────────────────
    op.drop_constraint("uq_survey_cesd10_session_id", "survey_cesd10", type_="unique")
    op.drop_column("survey_cesd10", "legacy_mean_1_4")
    op.drop_column("survey_cesd10", "data_source")
    for col in [f"r{i}" for i in range(1, 11)]:
        op.alter_column(
            "survey_cesd10", col, existing_type=sa.SmallInteger(), nullable=False
        )
    op.alter_column(
        "survey_cesd10", "total_score", existing_type=sa.SmallInteger(), nullable=False
    )

    # ── survey_uls8 ──────────────────────────────────────────────────────
    op.drop_constraint("uq_survey_uls8_session_id", "survey_uls8", type_="unique")
    op.drop_column("survey_uls8", "legacy_mean_1_4")
    op.drop_column("survey_uls8", "data_source")
    for col in [f"r{i}" for i in range(1, 9)]:
        op.alter_column(
            "survey_uls8", col, existing_type=sa.SmallInteger(), nullable=False
        )
    op.alter_column(
        "survey_uls8",
        "computed_mean",
        existing_type=sa.Numeric(5, 4),
        nullable=False,
    )
    op.alter_column(
        "survey_uls8",
        "score_0_100",
        existing_type=sa.Numeric(6, 2),
        nullable=False,
    )

    # ── digitspan_runs ───────────────────────────────────────────────────
    op.drop_constraint(
        "uq_digitspan_runs_session_id", "digitspan_runs", type_="unique"
    )
    op.drop_column("digitspan_runs", "data_source")
    op.alter_column(
        "digitspan_runs", "max_span", existing_type=sa.Integer(), nullable=False
    )
