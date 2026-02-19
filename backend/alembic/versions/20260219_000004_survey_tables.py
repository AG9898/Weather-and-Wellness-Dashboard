"""create survey tables for ULS-8, CES-D10, GAD-7, CogFunc 8a

Revision ID: 20260219_000004
Revises: 20260219_000003
Create Date: 2026-02-19 00:40:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260219_000004"

down_revision = "20260219_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # survey_uls8
    op.create_table(
        "survey_uls8",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(\"r1\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r2\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r3\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r4\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r5\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r6\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r7\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r8\", sa.SmallInteger(), nullable=False),
        sa.Column("computed_mean", sa.Numeric(5, 4), nullable=False),
        sa.Column("score_0_100", sa.Numeric(6, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], name=op.f("fk_survey_uls8_session_id_sessions")),
        sa.ForeignKeyConstraint(["participant_uuid"], ["participants.participant_uuid"], name=op.f("fk_survey_uls8_participant_uuid_participants")),
    )


    # survey_cesd10
    op.create_table(
        "survey_cesd10",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(\"r1\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r2\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r3\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r4\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r5\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r6\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r7\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r8\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r9\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r10\", sa.SmallInteger(), nullable=False),
        sa.Column("total_score", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], name=op.f("fk_survey_cesd10_session_id_sessions")),
        sa.ForeignKeyConstraint(["participant_uuid"], ["participants.participant_uuid"], name=op.f("fk_survey_cesd10_participant_uuid_participants")),
    )


    # survey_gad7
    op.create_table(
        "survey_gad7",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(\"r1\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r2\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r3\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r4\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r5\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r6\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r7\", sa.SmallInteger(), nullable=False),
        sa.Column("total_score", sa.SmallInteger(), nullable=False),
        sa.Column("severity_band", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], name=op.f("fk_survey_gad7_session_id_sessions")),
        sa.ForeignKeyConstraint(["participant_uuid"], ["participants.participant_uuid"], name=op.f("fk_survey_gad7_participant_uuid_participants")),
    )


    # survey_cogfunc8a
    op.create_table(
        "survey_cogfunc8a",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(\"r1\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r2\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r3\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r4\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r5\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r6\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r7\", sa.SmallInteger(), nullable=False),
        sa.Column(\"r8\", sa.SmallInteger(), nullable=False),
        sa.Column("total_sum", sa.SmallInteger(), nullable=False),
        sa.Column("mean_score", sa.Numeric(5, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.session_id"], name=op.f("fk_survey_cogfunc8a_session_id_sessions")),
        sa.ForeignKeyConstraint(["participant_uuid"], ["participants.participant_uuid"], name=op.f("fk_survey_cogfunc8a_participant_uuid_participants")),
    )


def downgrade() -> None:
    op.drop_table("survey_cogfunc8a")
    op.drop_table("survey_gad7")
    op.drop_table("survey_cesd10")
    op.drop_table("survey_uls8")
