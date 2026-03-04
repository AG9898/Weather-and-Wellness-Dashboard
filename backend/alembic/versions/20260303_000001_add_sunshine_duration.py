"""Add sunshine_duration_hours to weather_daily (T64)

Adds a nullable DOUBLE PRECISION column to store hours of sunshine per day.
Populated by the Open-Meteo historical backfill (T65–T66).
No existing rows are modified.

Revision ID: 20260303_000001
Revises: 20260301_000010
Create Date: 2026-03-03 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260303_000001"
down_revision = "20260301_000010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "weather_daily",
        sa.Column("sunshine_duration_hours", sa.Double(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("weather_daily", "sunshine_duration_hours")
