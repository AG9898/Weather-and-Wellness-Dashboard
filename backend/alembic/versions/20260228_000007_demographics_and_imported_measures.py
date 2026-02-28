"""Add participant demographics columns and imported_session_measures table (T47)

Revision ID: 20260228_000007
Revises: 20260227_000006
Create Date: 2026-02-28 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260228_000007"
down_revision = "20260227_000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add demographic / exposure columns to participants (all nullable)
    op.add_column(
        "participants",
        sa.Column("age_band", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("gender", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("origin", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("origin_other_text", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("commute_method", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("commute_method_other_text", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("time_outside", sa.String(), nullable=True),
    )
    op.add_column(
        "participants",
        sa.Column("daylight_exposure_minutes", sa.Integer(), nullable=True),
    )

    # 2. Create imported_session_measures — 1:1 with sessions, stores legacy aggregate values
    op.create_table(
        "imported_session_measures",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("precipitation_mm", sa.Double(), nullable=True),
        sa.Column("temperature_c", sa.Double(), nullable=True),
        sa.Column("anxiety_mean", sa.Double(), nullable=True),
        sa.Column("loneliness_mean", sa.Double(), nullable=True),
        sa.Column("depression_mean", sa.Double(), nullable=True),
        sa.Column("digit_span_max_span", sa.Integer(), nullable=True),
        sa.Column("self_report", sa.Double(), nullable=True),
        sa.Column("source_row_json", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_imported_session_measures_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_imported_session_measures_participant_uuid_participants"),
        ),
    )


def downgrade() -> None:
    # Drop imported_session_measures
    op.drop_table("imported_session_measures")

    # Remove demographic columns from participants (reverse order)
    op.drop_column("participants", "daylight_exposure_minutes")
    op.drop_column("participants", "time_outside")
    op.drop_column("participants", "commute_method_other_text")
    op.drop_column("participants", "commute_method")
    op.drop_column("participants", "origin_other_text")
    op.drop_column("participants", "origin")
    op.drop_column("participants", "gender")
    op.drop_column("participants", "age_band")
