"""Add 4 misokinesia tables (T104).

Creates misokinesia_test_sets, misokinesia_stimuli, misokinesia_participants,
and misokinesia_trial_responses. misokinesia_participants includes end-of-task
free-text and stronger-responses fields (collected once per participant).

Revision ID: 20260317_000001
Revises: 20260313_000001
Create Date: 2026-03-17 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260317_000001"
down_revision = "20260313_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Standalone sequence for misokinesia_participant_number — independent of
    # participants.participant_number so the two counters never interfere.
    op.execute("CREATE SEQUENCE misokinesia_participant_number_seq START 1")

    op.create_table(
        "misokinesia_test_sets",
        sa.Column("test_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("test_set_id", name=op.f("pk_misokinesia_test_sets")),
    )

    op.create_table(
        "misokinesia_stimuli",
        sa.Column("stimulus_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_path", sa.String(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column(
            "mime_type",
            sa.String(),
            nullable=False,
            server_default=sa.text("'video/mp4'"),
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["test_set_id"],
            ["misokinesia_test_sets.test_set_id"],
            name=op.f("fk_misokinesia_stimuli_test_set_id_misokinesia_test_sets"),
        ),
        sa.PrimaryKeyConstraint("stimulus_id", name=op.f("pk_misokinesia_stimuli")),
    )

    op.create_table(
        "misokinesia_participants",
        sa.Column(
            "misokinesia_participant_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("test_set_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "misokinesia_participant_number",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("nextval('misokinesia_participant_number_seq')"),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # End-of-task fields (collected once per participant after all clips)
        sa.Column("end_fidgeting_text", sa.Text(), nullable=True),
        sa.Column("end_emotions_text", sa.Text(), nullable=True),
        sa.Column("stronger_responses", sa.Boolean(), nullable=True),
        sa.Column("stronger_responses_timing", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_misokinesia_participants_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f(
                "fk_misokinesia_participants_participant_uuid_participants"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["test_set_id"],
            ["misokinesia_test_sets.test_set_id"],
            name=op.f(
                "fk_misokinesia_participants_test_set_id_misokinesia_test_sets"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "misokinesia_participant_id",
            name=op.f("pk_misokinesia_participants"),
        ),
    )
    op.create_index(
        "ix_misokinesia_participants_session_id",
        "misokinesia_participants",
        ["session_id"],
    )
    op.create_index(
        "ix_misokinesia_participants_participant_uuid",
        "misokinesia_participants",
        ["participant_uuid"],
    )

    op.create_table(
        "misokinesia_trial_responses",
        sa.Column("response_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "misokinesia_participant_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stimulus_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        # Per-clip questionnaire items (scale 1–5: Strongly Disagree → Strongly Agree)
        sa.Column("q1", sa.SmallInteger(), nullable=False),  # I find this video unpleasant
        sa.Column("q2", sa.SmallInteger(), nullable=False),  # I felt physical discomfort during the video
        sa.Column("q3", sa.SmallInteger(), nullable=False),  # I felt upset during the video
        sa.Column("q4", sa.SmallInteger(), nullable=False),  # I wanted to stop the video early / or close my eyes
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["misokinesia_participant_id"],
            ["misokinesia_participants.misokinesia_participant_id"],
            name=op.f(
                "fk_misokinesia_trial_responses_misokinesia_participant_id_misokinesia_participants"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_misokinesia_trial_responses_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f(
                "fk_misokinesia_trial_responses_participant_uuid_participants"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["stimulus_id"],
            ["misokinesia_stimuli.stimulus_id"],
            name=op.f(
                "fk_misokinesia_trial_responses_stimulus_id_misokinesia_stimuli"
            ),
        ),
        sa.PrimaryKeyConstraint(
            "response_id", name=op.f("pk_misokinesia_trial_responses")
        ),
        sa.UniqueConstraint(
            "misokinesia_participant_id",
            "stimulus_id",
            name=op.f("uq_misokinesia_trial_responses_participant_stimulus"),
        ),
    )
    op.create_index(
        "ix_misokinesia_trial_responses_misokinesia_participant_id",
        "misokinesia_trial_responses",
        ["misokinesia_participant_id"],
    )
    op.create_index(
        "ix_misokinesia_trial_responses_stimulus_id",
        "misokinesia_trial_responses",
        ["stimulus_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_misokinesia_trial_responses_stimulus_id",
        table_name="misokinesia_trial_responses",
    )
    op.drop_index(
        "ix_misokinesia_trial_responses_misokinesia_participant_id",
        table_name="misokinesia_trial_responses",
    )
    op.drop_table("misokinesia_trial_responses")

    op.drop_index(
        "ix_misokinesia_participants_participant_uuid",
        table_name="misokinesia_participants",
    )
    op.drop_index(
        "ix_misokinesia_participants_session_id",
        table_name="misokinesia_participants",
    )
    op.drop_table("misokinesia_participants")

    op.drop_table("misokinesia_stimuli")
    op.drop_table("misokinesia_test_sets")

    op.execute("DROP SEQUENCE misokinesia_participant_number_seq")
