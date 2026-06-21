"""Add IHTT Poffenberger persistence schema (T1833).

Creates run-level and trial-level tables for the IHTT Poffenberger component.
Rows are linked to both participant_uuid and session_id, keep the
server-generated manifest/assignments, retain raw client timing fields, and
store server-computed four-condition and crossed/uncrossed summaries.

Revision ID: 20260621_000001
Revises: 20260620_000001
Create Date: 2026-06-21 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260621_000001"
down_revision = "20260620_000001"
branch_labels = None
depends_on = None


CONDITION_KEYS = ("lh_lvf", "lh_rvf", "rh_lvf", "rh_rvf")


def _condition_summary_columns(condition_key: str) -> list[sa.Column]:
    return [
        sa.Column(f"{condition_key}_total_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(f"{condition_key}_valid_rt_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(f"{condition_key}_timeout_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(f"{condition_key}_invalid_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(f"{condition_key}_accurate_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(f"{condition_key}_accuracy", sa.Numeric(8, 4), nullable=True),
        sa.Column(f"{condition_key}_mean_rt_ms", sa.Numeric(10, 2), nullable=True),
        sa.Column(f"{condition_key}_median_rt_ms", sa.Numeric(10, 2), nullable=True),
        sa.Column(f"{condition_key}_sd_rt_ms", sa.Numeric(10, 2), nullable=True),
    ]


def upgrade() -> None:
    run_columns: list[sa.Column] = [
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "manifest_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("total_practice_trials", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_experimental_trials", sa.Integer(), nullable=False, server_default="0"),
    ]
    for condition_key in CONDITION_KEYS:
        run_columns.extend(_condition_summary_columns(condition_key))
    run_columns.extend(
        [
            sa.Column("mean_rt_crossed_ms", sa.Numeric(10, 2), nullable=True),
            sa.Column("mean_rt_uncrossed_ms", sa.Numeric(10, 2), nullable=True),
            sa.Column("ihtt_difference_ms", sa.Numeric(10, 2), nullable=True),
            sa.Column("accuracy_crossed", sa.Numeric(8, 4), nullable=True),
            sa.Column("accuracy_uncrossed", sa.Numeric(8, 4), nullable=True),
        ]
    )

    op.create_table(
        "ihtt_poffenberger_runs",
        *run_columns,
        sa.PrimaryKeyConstraint("run_id", name=op.f("pk_ihtt_poffenberger_runs")),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_ihtt_poffenberger_runs_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_ihtt_poffenberger_runs_participant_uuid_participants"),
        ),
        sa.UniqueConstraint("session_id", name="uq_ihtt_poffenberger_runs_session_id"),
        sa.CheckConstraint(
            "NOT is_complete OR completed_at IS NOT NULL",
            name=op.f("ck_ihtt_poffenberger_runs_complete_requires_completed_at"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(manifest_json) = 'object'",
            name=op.f("ck_ihtt_poffenberger_runs_manifest_object"),
        ),
        sa.CheckConstraint(
            "total_practice_trials >= 0",
            name=op.f("ck_ihtt_poffenberger_runs_practice_nonnegative"),
        ),
        sa.CheckConstraint(
            "total_experimental_trials >= 0",
            name=op.f("ck_ihtt_poffenberger_runs_experimental_nonnegative"),
        ),
        *[
            sa.CheckConstraint(
                f"{condition_key}_accuracy IS NULL OR "
                f"({condition_key}_accuracy >= 0 AND {condition_key}_accuracy <= 1)",
                name=op.f(f"ck_ihtt_poffenberger_runs_{condition_key}_accuracy_range"),
            )
            for condition_key in CONDITION_KEYS
        ],
        sa.CheckConstraint(
            "accuracy_crossed IS NULL OR (accuracy_crossed >= 0 AND accuracy_crossed <= 1)",
            name=op.f("ck_ihtt_poffenberger_runs_accuracy_crossed_range"),
        ),
        sa.CheckConstraint(
            "accuracy_uncrossed IS NULL OR (accuracy_uncrossed >= 0 AND accuracy_uncrossed <= 1)",
            name=op.f("ck_ihtt_poffenberger_runs_accuracy_uncrossed_range"),
        ),
    )
    op.create_index(
        "ix_ihtt_poffenberger_runs_participant_uuid",
        "ihtt_poffenberger_runs",
        ["participant_uuid"],
    )

    op.create_table(
        "ihtt_poffenberger_trials",
        sa.Column("trial_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("block_number", sa.Integer(), nullable=False),
        sa.Column("trial_number", sa.Integer(), nullable=False),
        sa.Column("global_trial_number", sa.Integer(), nullable=False),
        sa.Column("response_hand", sa.String(), nullable=False),
        sa.Column("visual_field", sa.String(), nullable=False),
        sa.Column("condition_key", sa.String(), nullable=False),
        sa.Column("is_practice", sa.Boolean(), nullable=False),
        sa.Column("is_scored", sa.Boolean(), nullable=False),
        sa.Column("expected_key", sa.String(), nullable=False),
        sa.Column("pressed_key", sa.String(), nullable=True),
        sa.Column("reaction_time_ms", sa.Integer(), nullable=True),
        sa.Column("is_valid_response", sa.Boolean(), nullable=False),
        sa.Column("is_timeout", sa.Boolean(), nullable=False),
        sa.Column("is_accurate", sa.Boolean(), nullable=False),
        sa.Column("jitter_ms", sa.Integer(), nullable=False),
        sa.Column("client_trial_started_at_ms", sa.Numeric(14, 3), nullable=True),
        sa.Column("client_stimulus_onset_ms", sa.Numeric(14, 3), nullable=True),
        sa.Column("client_response_at_ms", sa.Numeric(14, 3), nullable=True),
        sa.Column("client_trial_ended_at_ms", sa.Numeric(14, 3), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("trial_id", name=op.f("pk_ihtt_poffenberger_trials")),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["ihtt_poffenberger_runs.run_id"],
            name=op.f("fk_ihtt_poffenberger_trials_run_id_ihtt_poffenberger_runs"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_ihtt_poffenberger_trials_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_ihtt_poffenberger_trials_participant_uuid_participants"),
        ),
        sa.UniqueConstraint(
            "run_id",
            "global_trial_number",
            name="uq_ihtt_poffenberger_trials_run_global_trial",
        ),
        sa.CheckConstraint("block_number >= 0", name=op.f("ck_ihtt_poffenberger_trials_block_nonnegative")),
        sa.CheckConstraint("trial_number >= 1", name=op.f("ck_ihtt_poffenberger_trials_trial_positive")),
        sa.CheckConstraint("global_trial_number >= 1", name=op.f("ck_ihtt_poffenberger_trials_global_positive")),
        sa.CheckConstraint(
            "response_hand IN ('left', 'right')",
            name=op.f("ck_ihtt_poffenberger_trials_response_hand_allowed"),
        ),
        sa.CheckConstraint(
            "visual_field IN ('lvf', 'rvf')",
            name=op.f("ck_ihtt_poffenberger_trials_visual_field_allowed"),
        ),
        sa.CheckConstraint(
            "condition_key IN ('lh_lvf', 'lh_rvf', 'rh_lvf', 'rh_rvf')",
            name=op.f("ck_ihtt_poffenberger_trials_condition_key_allowed"),
        ),
        sa.CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name=op.f("ck_ihtt_poffenberger_trials_rt_nonnegative"),
        ),
        sa.CheckConstraint("jitter_ms >= 0", name=op.f("ck_ihtt_poffenberger_trials_jitter_nonnegative")),
        sa.CheckConstraint(
            "NOT is_practice OR is_scored = false",
            name=op.f("ck_ihtt_poffenberger_trials_practice_not_scored"),
        ),
    )
    op.create_index(
        "ix_ihtt_poffenberger_trials_run_id",
        "ihtt_poffenberger_trials",
        ["run_id"],
    )
    op.create_index(
        "ix_ihtt_poffenberger_trials_session_id",
        "ihtt_poffenberger_trials",
        ["session_id"],
    )
    op.create_index(
        "ix_ihtt_poffenberger_trials_participant_uuid",
        "ihtt_poffenberger_trials",
        ["participant_uuid"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ihtt_poffenberger_trials_participant_uuid",
        table_name="ihtt_poffenberger_trials",
    )
    op.drop_index(
        "ix_ihtt_poffenberger_trials_session_id",
        table_name="ihtt_poffenberger_trials",
    )
    op.drop_index(
        "ix_ihtt_poffenberger_trials_run_id",
        table_name="ihtt_poffenberger_trials",
    )
    op.drop_table("ihtt_poffenberger_trials")

    op.drop_index(
        "ix_ihtt_poffenberger_runs_participant_uuid",
        table_name="ihtt_poffenberger_runs",
    )
    op.drop_table("ihtt_poffenberger_runs")
