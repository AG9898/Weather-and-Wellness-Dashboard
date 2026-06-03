"""Replace miso demographics columns with sourced v2 fields (T199).

Drops the six T184 demographics columns from misokinesia_participants and
adds nullable typed columns sourced from Demographics copy2.docx.

Revision ID: 20260603_000001
Revises: 20260519_000001
Create Date: 2026-06-03 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260603_000001"
down_revision = "20260519_000001"
branch_labels = None
depends_on = None


OLD_COLUMNS = (
    "age_band",
    "gender",
    "gender_other_text",
    "country",
    "country_other_text",
    "nationality",
)


def upgrade() -> None:
    for column_name in OLD_COLUMNS:
        op.drop_column("misokinesia_participants", column_name)

    op.add_column(
        "misokinesia_participants",
        sa.Column("age", sa.Integer(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("sex", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("gender_identity", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("years_lived_canada", sa.Integer(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("residence_status", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("residence_status_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("student_type", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("total_years_education", sa.Integer(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("cumulative_gpa", sa.Numeric(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("majors_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("highest_education_completed", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("ethnicity", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("ethnicity_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("native_language", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("english_fluency", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("fluent_languages", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("fluent_languages_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("english_speaking_frequency", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("non_english_schooling", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("instruction_languages", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("instruction_languages_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("diagnosed_disorders", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("diagnosed_disorders_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("adhd_diagnosis", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("adhd_medication", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("avid_videogamer", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("video_game_hours_per_week", sa.Integer(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("prescription_stimulants", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("regular_substances", postgresql.ARRAY(sa.Text()), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("regular_substances_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("relationship_status", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("relationship_status_other_text", sa.Text(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("occupational_status", sa.String(), nullable=True),
    )
    op.add_column(
        "misokinesia_participants",
        sa.Column("occupational_status_other_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    for column_name in (
        "occupational_status_other_text",
        "occupational_status",
        "relationship_status_other_text",
        "relationship_status",
        "regular_substances_other_text",
        "regular_substances",
        "prescription_stimulants",
        "video_game_hours_per_week",
        "avid_videogamer",
        "adhd_medication",
        "adhd_diagnosis",
        "diagnosed_disorders_other_text",
        "diagnosed_disorders",
        "instruction_languages_other_text",
        "instruction_languages",
        "non_english_schooling",
        "english_speaking_frequency",
        "fluent_languages_other_text",
        "fluent_languages",
        "english_fluency",
        "native_language",
        "ethnicity_other_text",
        "ethnicity",
        "highest_education_completed",
        "majors_text",
        "cumulative_gpa",
        "total_years_education",
        "student_type",
        "residence_status_other_text",
        "residence_status",
        "years_lived_canada",
        "gender_identity",
        "sex",
        "age",
    ):
        op.drop_column("misokinesia_participants", column_name)

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
