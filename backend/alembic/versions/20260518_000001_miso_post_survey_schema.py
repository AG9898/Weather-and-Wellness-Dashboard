"""Replace misokinesia mkaq_administration with post_survey_order; add gad7/maq tables (T168).

Drops misokinesia_participants.mkaq_administration and its check constraint.
Adds misokinesia_participants.post_survey_order (nullable VARCHAR for legacy rows).
Creates misokinesia_gad7_responses and misokinesia_maq_responses tables.

Revision ID: 20260518_000001
Revises: 20260513_000001
Create Date: 2026-05-18 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260518_000001"
down_revision = "20260513_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── misokinesia_participants: drop mkaq_administration ───────────────────
    op.drop_constraint(
        "ck_misokinesia_participants_mkaq_administration",
        "misokinesia_participants",
        type_="check",
    )
    op.drop_column("misokinesia_participants", "mkaq_administration")

    # ── misokinesia_participants: add post_survey_order ──────────────────────
    op.add_column(
        "misokinesia_participants",
        sa.Column("post_survey_order", sa.String(length=20), nullable=True),
    )

    # ── New table: misokinesia_gad7_responses ────────────────────────────────
    op.create_table(
        "misokinesia_gad7_responses",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("misokinesia_participant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        # GAD-7 items r1–r7, scale 1–4
        sa.Column("r1", sa.SmallInteger(), nullable=False),
        sa.Column("r2", sa.SmallInteger(), nullable=False),
        sa.Column("r3", sa.SmallInteger(), nullable=False),
        sa.Column("r4", sa.SmallInteger(), nullable=False),
        sa.Column("r5", sa.SmallInteger(), nullable=False),
        sa.Column("r6", sa.SmallInteger(), nullable=False),
        sa.Column("r7", sa.SmallInteger(), nullable=False),
        sa.Column("total_score", sa.SmallInteger(), nullable=False),
        sa.Column("severity_band", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint(
            "response_id",
            name=op.f("pk_misokinesia_gad7_responses"),
        ),
        sa.ForeignKeyConstraint(
            ["misokinesia_participant_id"],
            ["misokinesia_participants.misokinesia_participant_id"],
            name=op.f("fk_misokinesia_gad7_responses_misokinesia_participant_id"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_misokinesia_gad7_responses_session_id"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_misokinesia_gad7_responses_participant_uuid"),
        ),
        sa.CheckConstraint("r1 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r1"),
        sa.CheckConstraint("r2 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r2"),
        sa.CheckConstraint("r3 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r3"),
        sa.CheckConstraint("r4 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r4"),
        sa.CheckConstraint("r5 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r5"),
        sa.CheckConstraint("r6 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r6"),
        sa.CheckConstraint("r7 BETWEEN 1 AND 4", name="ck_misokinesia_gad7_r7"),
        sa.CheckConstraint("total_score BETWEEN 0 AND 21", name="ck_misokinesia_gad7_total_score"),
        sa.UniqueConstraint(
            "misokinesia_participant_id",
            name="uq_misokinesia_gad7_responses_participant",
        ),
    )
    op.create_index(
        "ix_misokinesia_gad7_responses_session_id",
        "misokinesia_gad7_responses",
        ["session_id"],
    )
    op.create_index(
        "ix_misokinesia_gad7_responses_participant_uuid",
        "misokinesia_gad7_responses",
        ["participant_uuid"],
    )

    # ── New table: misokinesia_maq_responses ─────────────────────────────────
    op.create_table(
        "misokinesia_maq_responses",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("misokinesia_participant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        # MAQ items q1–q21, scale 0–3
        sa.Column("q1", sa.SmallInteger(), nullable=False),
        sa.Column("q2", sa.SmallInteger(), nullable=False),
        sa.Column("q3", sa.SmallInteger(), nullable=False),
        sa.Column("q4", sa.SmallInteger(), nullable=False),
        sa.Column("q5", sa.SmallInteger(), nullable=False),
        sa.Column("q6", sa.SmallInteger(), nullable=False),
        sa.Column("q7", sa.SmallInteger(), nullable=False),
        sa.Column("q8", sa.SmallInteger(), nullable=False),
        sa.Column("q9", sa.SmallInteger(), nullable=False),
        sa.Column("q10", sa.SmallInteger(), nullable=False),
        sa.Column("q11", sa.SmallInteger(), nullable=False),
        sa.Column("q12", sa.SmallInteger(), nullable=False),
        sa.Column("q13", sa.SmallInteger(), nullable=False),
        sa.Column("q14", sa.SmallInteger(), nullable=False),
        sa.Column("q15", sa.SmallInteger(), nullable=False),
        sa.Column("q16", sa.SmallInteger(), nullable=False),
        sa.Column("q17", sa.SmallInteger(), nullable=False),
        sa.Column("q18", sa.SmallInteger(), nullable=False),
        sa.Column("q19", sa.SmallInteger(), nullable=False),
        sa.Column("q20", sa.SmallInteger(), nullable=False),
        sa.Column("q21", sa.SmallInteger(), nullable=False),
        sa.Column("total_score", sa.SmallInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint(
            "response_id",
            name=op.f("pk_misokinesia_maq_responses"),
        ),
        sa.ForeignKeyConstraint(
            ["misokinesia_participant_id"],
            ["misokinesia_participants.misokinesia_participant_id"],
            name=op.f("fk_misokinesia_maq_responses_misokinesia_participant_id"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_misokinesia_maq_responses_session_id"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_misokinesia_maq_responses_participant_uuid"),
        ),
        sa.CheckConstraint("total_score BETWEEN 0 AND 63", name="ck_misokinesia_maq_total_score"),
        sa.UniqueConstraint(
            "misokinesia_participant_id",
            name="uq_misokinesia_maq_responses_participant",
        ),
    )
    op.create_index(
        "ix_misokinesia_maq_responses_session_id",
        "misokinesia_maq_responses",
        ["session_id"],
    )
    op.create_index(
        "ix_misokinesia_maq_responses_participant_uuid",
        "misokinesia_maq_responses",
        ["participant_uuid"],
    )


def downgrade() -> None:
    op.drop_index("ix_misokinesia_maq_responses_participant_uuid", "misokinesia_maq_responses")
    op.drop_index("ix_misokinesia_maq_responses_session_id", "misokinesia_maq_responses")
    op.drop_table("misokinesia_maq_responses")

    op.drop_index("ix_misokinesia_gad7_responses_participant_uuid", "misokinesia_gad7_responses")
    op.drop_index("ix_misokinesia_gad7_responses_session_id", "misokinesia_gad7_responses")
    op.drop_table("misokinesia_gad7_responses")

    op.drop_column("misokinesia_participants", "post_survey_order")

    op.add_column(
        "misokinesia_participants",
        sa.Column("mkaq_administration", sa.String(length=4), nullable=True),
    )
    op.create_check_constraint(
        "ck_misokinesia_participants_mkaq_administration",
        "misokinesia_participants",
        "mkaq_administration IN ('pre', 'post')",
    )
