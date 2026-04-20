"""Add MkAQ administration column and responses table (T145).

Extends misokinesia_participants with nullable mkaq_administration ('pre'/'post')
and creates misokinesia_mkaq_responses with 21-item response storage.

Revision ID: 20260420_000001
Revises: 20260407_000001
Create Date: 2026-04-20 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260420_000001"
down_revision = "20260407_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "misokinesia_participants",
        sa.Column(
            "mkaq_administration",
            sa.String(length=4),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        "ck_misokinesia_participants_mkaq_administration",
        "misokinesia_participants",
        "mkaq_administration IN ('pre', 'post')",
    )

    op.create_table(
        "misokinesia_mkaq_responses",
        sa.Column(
            "response_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "misokinesia_participant_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "participant_uuid",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("administration", sa.String(length=4), nullable=False),
        # MkAQ items q1–q21, scale 0–3
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
            name=op.f("pk_misokinesia_mkaq_responses"),
        ),
        sa.ForeignKeyConstraint(
            ["misokinesia_participant_id"],
            ["misokinesia_participants.misokinesia_participant_id"],
            name=op.f("fk_misokinesia_mkaq_responses_misokinesia_participant_id"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_misokinesia_mkaq_responses_session_id"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_misokinesia_mkaq_responses_participant_uuid"),
        ),
        sa.CheckConstraint(
            "administration IN ('pre', 'post')",
            name="ck_misokinesia_mkaq_responses_administration",
        ),
        sa.UniqueConstraint(
            "misokinesia_participant_id",
            name="uq_misokinesia_mkaq_responses_participant",
        ),
    )


def downgrade() -> None:
    op.drop_table("misokinesia_mkaq_responses")
    op.drop_constraint(
        "ck_misokinesia_participants_mkaq_administration",
        "misokinesia_participants",
        type_="check",
    )
    op.drop_column("misokinesia_participants", "mkaq_administration")
