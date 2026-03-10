"""Add durable analytics run and snapshot tables (T84).

Creates a Postgres-backed append-only analytics run log plus a durable snapshot
table for per-range analytics payloads. Redis remains an optional cache layer
for reads, not the canonical analytics store.

Revision ID: 20260310_000002
Revises: 20260310_000001
Create Date: 2026-03-10 00:00:02.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "20260310_000002"
down_revision = "20260310_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "analytics_runs",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("response_version", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "triggered_by_lab_member_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "warnings_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "error_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "result_payload_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "date_from <= date_to",
            name="ck_analytics_runs_date_range",
        ),
        sa.PrimaryKeyConstraint("run_id", name=op.f("pk_analytics_runs")),
    )
    op.create_index(
        "ix_analytics_runs_range_created_at",
        "analytics_runs",
        ["date_from", "date_to", "model_version", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_analytics_runs_status_started_at",
        "analytics_runs",
        ["status", "started_at"],
        unique=False,
    )

    op.create_table(
        "analytics_snapshots",
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("model_version", sa.String(length=64), nullable=False),
        sa.Column("response_version", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "warnings_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "payload_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "source_run_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "date_from <= date_to",
            name="ck_analytics_snapshots_date_range",
        ),
        sa.ForeignKeyConstraint(
            ["source_run_id"],
            ["analytics_runs.run_id"],
            name=op.f("fk_analytics_snapshots_source_run_id_analytics_runs"),
        ),
        sa.PrimaryKeyConstraint(
            "snapshot_id",
            name=op.f("pk_analytics_snapshots"),
        ),
        sa.UniqueConstraint(
            "date_from",
            "date_to",
            "model_version",
            "response_version",
            name="uq_analytics_snapshots_range_version",
        ),
    )
    op.create_index(
        "ix_analytics_snapshots_range_generated_at",
        "analytics_snapshots",
        ["date_from", "date_to", "model_version", "generated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_analytics_snapshots_range_generated_at",
        table_name="analytics_snapshots",
    )
    op.drop_table("analytics_snapshots")

    op.drop_index(
        "ix_analytics_runs_status_started_at",
        table_name="analytics_runs",
    )
    op.drop_index(
        "ix_analytics_runs_range_created_at",
        table_name="analytics_runs",
    )
    op.drop_table("analytics_runs")
