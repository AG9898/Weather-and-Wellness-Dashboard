"""Add Weather-Wellness cognitive battery persistence schema.

Revision ID: 20260614_000001
Revises: 20260605_000001
Create Date: 2026-06-14 00:00:01.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260614_000001"
down_revision = "20260605_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("cognitive_task_order", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "sessions",
        sa.Column("card_sorting_rule_order", postgresql.JSONB(), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_sessions_cognitive_task_order_array"),
        "sessions",
        sa.text(
            "cognitive_task_order IS NULL "
            "OR jsonb_typeof(cognitive_task_order) = 'array'"
        ),
    )
    op.create_check_constraint(
        op.f("ck_sessions_card_sorting_rule_order_array"),
        "sessions",
        sa.text(
            "card_sorting_rule_order IS NULL "
            "OR jsonb_typeof(card_sorting_rule_order) = 'array'"
        ),
    )

    op.create_table(
        "stroop_runs",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_trials", sa.Integer(), nullable=False),
        sa.Column("correct_trials", sa.Integer(), nullable=False),
        sa.Column("error_trials", sa.Integer(), nullable=False),
        sa.Column("timeout_trials", sa.Integer(), nullable=False),
        sa.Column("overall_accuracy", sa.Numeric(8, 4), nullable=False),
        sa.Column("congruent_accuracy", sa.Numeric(8, 4), nullable=True),
        sa.Column("incongruent_accuracy", sa.Numeric(8, 4), nullable=True),
        sa.Column("mean_rt_congruent_ms", sa.Numeric(10, 2), nullable=True),
        sa.Column("mean_rt_incongruent_ms", sa.Numeric(10, 2), nullable=True),
        sa.Column("stroop_interference_ms", sa.Numeric(10, 2), nullable=True),
        sa.Column("data_source", sa.String(length=16), nullable=False, server_default="native"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("run_id", name=op.f("pk_stroop_runs")),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_stroop_runs_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_stroop_runs_participant_uuid_participants"),
        ),
        sa.UniqueConstraint("session_id", name="uq_stroop_runs_session_id"),
        sa.CheckConstraint("total_trials >= 0", name=op.f("ck_stroop_runs_total_trials_nonnegative")),
        sa.CheckConstraint("correct_trials >= 0", name=op.f("ck_stroop_runs_correct_trials_nonnegative")),
        sa.CheckConstraint("error_trials >= 0", name=op.f("ck_stroop_runs_error_trials_nonnegative")),
        sa.CheckConstraint("timeout_trials >= 0", name=op.f("ck_stroop_runs_timeout_trials_nonnegative")),
        sa.CheckConstraint(
            "overall_accuracy >= 0 AND overall_accuracy <= 1",
            name=op.f("ck_stroop_runs_overall_accuracy_range"),
        ),
        sa.CheckConstraint(
            "congruent_accuracy IS NULL OR (congruent_accuracy >= 0 AND congruent_accuracy <= 1)",
            name=op.f("ck_stroop_runs_congruent_accuracy_range"),
        ),
        sa.CheckConstraint(
            "incongruent_accuracy IS NULL OR (incongruent_accuracy >= 0 AND incongruent_accuracy <= 1)",
            name=op.f("ck_stroop_runs_incongruent_accuracy_range"),
        ),
    )

    op.create_table(
        "stroop_trials",
        sa.Column("trial_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trial_number", sa.Integer(), nullable=False),
        sa.Column("condition", sa.String(), nullable=False),
        sa.Column("word", sa.String(), nullable=False),
        sa.Column("ink_color", sa.String(), nullable=False),
        sa.Column("response_key", sa.String(), nullable=True),
        sa.Column("response_color", sa.String(), nullable=True),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("reaction_time_ms", sa.Integer(), nullable=True),
        sa.Column("timed_out", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("trial_id", name=op.f("pk_stroop_trials")),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["stroop_runs.run_id"],
            name=op.f("fk_stroop_trials_run_id_stroop_runs"),
        ),
        sa.UniqueConstraint("run_id", "trial_number", name="uq_stroop_trials_run_trial_number"),
        sa.CheckConstraint("trial_number >= 1", name=op.f("ck_stroop_trials_trial_number_positive")),
        sa.CheckConstraint(
            "condition IN ('congruent', 'incongruent')",
            name=op.f("ck_stroop_trials_condition_allowed"),
        ),
        sa.CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name=op.f("ck_stroop_trials_reaction_time_nonnegative"),
        ),
    )

    op.create_table(
        "card_sorting_runs",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("participant_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_order", postgresql.JSONB(), nullable=False),
        sa.Column("total_trials", sa.Integer(), nullable=False),
        sa.Column("categories_completed", sa.Integer(), nullable=False),
        sa.Column("total_correct", sa.Integer(), nullable=False),
        sa.Column("total_errors", sa.Integer(), nullable=False),
        sa.Column("perseverative_responses", sa.Integer(), nullable=False),
        sa.Column("perseverative_errors", sa.Integer(), nullable=False),
        sa.Column("nonperseverative_errors", sa.Integer(), nullable=False),
        sa.Column("trials_to_first_category", sa.Integer(), nullable=True),
        sa.Column("failure_to_maintain_set_count", sa.Integer(), nullable=False),
        sa.Column("data_source", sa.String(length=16), nullable=False, server_default="native"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("run_id", name=op.f("pk_card_sorting_runs")),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["sessions.session_id"],
            name=op.f("fk_card_sorting_runs_session_id_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["participant_uuid"],
            ["participants.participant_uuid"],
            name=op.f("fk_card_sorting_runs_participant_uuid_participants"),
        ),
        sa.UniqueConstraint("session_id", name="uq_card_sorting_runs_session_id"),
        sa.CheckConstraint("jsonb_typeof(rule_order) = 'array'", name=op.f("ck_card_sorting_runs_rule_order_array")),
        sa.CheckConstraint("total_trials >= 0", name=op.f("ck_card_sorting_runs_total_trials_nonnegative")),
        sa.CheckConstraint(
            "categories_completed >= 0 AND categories_completed <= 6",
            name=op.f("ck_card_sorting_runs_categories_completed_range"),
        ),
        sa.CheckConstraint("total_correct >= 0", name=op.f("ck_card_sorting_runs_total_correct_nonnegative")),
        sa.CheckConstraint("total_errors >= 0", name=op.f("ck_card_sorting_runs_total_errors_nonnegative")),
        sa.CheckConstraint(
            "perseverative_responses >= 0",
            name=op.f("ck_card_sorting_runs_perseverative_responses_nonnegative"),
        ),
        sa.CheckConstraint(
            "perseverative_errors >= 0",
            name=op.f("ck_card_sorting_runs_perseverative_errors_nonnegative"),
        ),
        sa.CheckConstraint(
            "nonperseverative_errors >= 0",
            name=op.f("ck_card_sorting_runs_nonperseverative_errors_nonnegative"),
        ),
        sa.CheckConstraint(
            "trials_to_first_category IS NULL OR trials_to_first_category >= 1",
            name=op.f("ck_card_sorting_runs_trials_to_first_category_positive"),
        ),
        sa.CheckConstraint(
            "failure_to_maintain_set_count >= 0",
            name=op.f("ck_card_sorting_runs_failure_to_maintain_set_nonnegative"),
        ),
    )

    op.create_table(
        "card_sorting_trials",
        sa.Column("trial_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("trial_number", sa.Integer(), nullable=False),
        sa.Column("category_index", sa.Integer(), nullable=False),
        sa.Column("active_rule", sa.String(), nullable=False),
        sa.Column("previous_rule", sa.String(), nullable=True),
        sa.Column("card_color", sa.String(), nullable=False),
        sa.Column("card_shape", sa.String(), nullable=False),
        sa.Column("card_number", sa.Integer(), nullable=False),
        sa.Column("selected_reference_index", sa.Integer(), nullable=False),
        sa.Column("correct", sa.Boolean(), nullable=False),
        sa.Column("perseverative_response", sa.Boolean(), nullable=False),
        sa.Column("perseverative_error", sa.Boolean(), nullable=False),
        sa.Column("streak_before", sa.Integer(), nullable=False),
        sa.Column("streak_after", sa.Integer(), nullable=False),
        sa.Column("category_completed_after_trial", sa.Boolean(), nullable=False),
        sa.Column("reaction_time_ms", sa.Integer(), nullable=True),
        sa.Column("feedback", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("trial_id", name=op.f("pk_card_sorting_trials")),
        sa.ForeignKeyConstraint(
            ["run_id"],
            ["card_sorting_runs.run_id"],
            name=op.f("fk_card_sorting_trials_run_id_card_sorting_runs"),
        ),
        sa.UniqueConstraint(
            "run_id",
            "trial_number",
            name="uq_card_sorting_trials_run_trial_number",
        ),
        sa.CheckConstraint(
            "trial_number >= 1 AND trial_number <= 64",
            name=op.f("ck_card_sorting_trials_trial_number_range"),
        ),
        sa.CheckConstraint(
            "category_index >= 1 AND category_index <= 6",
            name=op.f("ck_card_sorting_trials_category_index_range"),
        ),
        sa.CheckConstraint(
            "active_rule IN ('color', 'shape', 'number')",
            name=op.f("ck_card_sorting_trials_active_rule_allowed"),
        ),
        sa.CheckConstraint(
            "previous_rule IS NULL OR previous_rule IN ('color', 'shape', 'number')",
            name=op.f("ck_card_sorting_trials_previous_rule_allowed"),
        ),
        sa.CheckConstraint(
            "card_number >= 1",
            name=op.f("ck_card_sorting_trials_card_number_positive"),
        ),
        sa.CheckConstraint(
            "selected_reference_index >= 1 AND selected_reference_index <= 4",
            name=op.f("ck_card_sorting_trials_selected_reference_index_range"),
        ),
        sa.CheckConstraint("streak_before >= 0", name=op.f("ck_card_sorting_trials_streak_before_nonnegative")),
        sa.CheckConstraint("streak_after >= 0", name=op.f("ck_card_sorting_trials_streak_after_nonnegative")),
        sa.CheckConstraint(
            "reaction_time_ms IS NULL OR reaction_time_ms >= 0",
            name=op.f("ck_card_sorting_trials_reaction_time_nonnegative"),
        ),
        sa.CheckConstraint(
            "feedback IN ('correct', 'incorrect')",
            name=op.f("ck_card_sorting_trials_feedback_allowed"),
        ),
    )


def downgrade() -> None:
    op.drop_table("card_sorting_trials")
    op.drop_table("card_sorting_runs")
    op.drop_table("stroop_trials")
    op.drop_table("stroop_runs")

    op.drop_constraint(
        op.f("ck_sessions_card_sorting_rule_order_array"),
        "sessions",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_sessions_cognitive_task_order_array"),
        "sessions",
        type_="check",
    )
    op.drop_column("sessions", "card_sorting_rule_order")
    op.drop_column("sessions", "cognitive_task_order")
