"""Add study_days, weather_ingest_runs, weather_daily; add study_day_id to sessions

Revision ID: 20260226_000005
Revises: 20260219_000004
Create Date: 2026-02-26 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260226_000005"
down_revision = "20260219_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. study_days — dimension table (no FK to other weather tables)
    op.create_table(
        "study_days",
        sa.Column("study_day_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("date_local", sa.Date(), nullable=False),
        sa.Column("tz_name", sa.String(), nullable=False, server_default="America/Edmonton"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("date_local", name=op.f("uq_study_days_date_local")),
    )

    # 2. weather_ingest_runs — append-only audit log (no FK to weather_daily)
    op.create_table(
        "weather_ingest_runs",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=False),
        sa.Column("date_local", sa.Date(), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("requested_via", sa.String(), nullable=False),
        sa.Column("requested_by_lab_member_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_primary_url", sa.String(), nullable=False),
        sa.Column("source_secondary_url", sa.String(), nullable=False),
        sa.Column("http_primary_status", sa.SmallInteger(), nullable=True),
        sa.Column("http_secondary_status", sa.SmallInteger(), nullable=True),
        sa.Column("raw_html_primary", sa.Text(), nullable=True),
        sa.Column("raw_html_secondary", sa.Text(), nullable=True),
        sa.Column("raw_html_primary_sha256", sa.String(64), nullable=True),
        sa.Column("raw_html_secondary_sha256", sa.String(64), nullable=True),
        sa.Column("parsed_json", postgresql.JSONB(), nullable=False),
        sa.Column("parse_status", sa.String(), nullable=False),
        sa.Column("parse_errors", postgresql.JSONB(), nullable=False),
        sa.Column("parser_version", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    # Indexes: recent-run debugging and day-range queries
    op.create_index(
        "ix_weather_ingest_runs_station_ingested",
        "weather_ingest_runs",
        ["station_id", sa.text("ingested_at DESC")],
    )
    op.create_index(
        "ix_weather_ingest_runs_station_date",
        "weather_ingest_runs",
        ["station_id", "date_local"],
    )

    # 3. weather_daily — one row per station per study day
    op.create_table(
        "weather_daily",
        sa.Column("daily_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("station_id", sa.Integer(), nullable=False),
        sa.Column("study_day_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date_local", sa.Date(), nullable=False),
        sa.Column("source_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("current_observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_temp_c", sa.Double(), nullable=True),
        sa.Column("current_relative_humidity_pct", sa.Integer(), nullable=True),
        sa.Column("current_wind_speed_kmh", sa.Double(), nullable=True),
        sa.Column("current_wind_gust_kmh", sa.Double(), nullable=True),
        sa.Column("current_wind_dir_deg", sa.Integer(), nullable=True),
        sa.Column("current_pressure_kpa", sa.Double(), nullable=True),
        sa.Column("current_precip_today_mm", sa.Double(), nullable=True),
        sa.Column("forecast_high_c", sa.Double(), nullable=True),
        sa.Column("forecast_low_c", sa.Double(), nullable=True),
        sa.Column("forecast_precip_prob_pct", sa.Integer(), nullable=True),
        sa.Column("forecast_precip_mm", sa.Double(), nullable=True),
        sa.Column("forecast_condition_text", sa.String(), nullable=True),
        sa.Column("forecast_periods", postgresql.JSONB(), nullable=False),
        sa.Column("structured_json", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["study_day_id"], ["study_days.study_day_id"],
            name=op.f("fk_weather_daily_study_day_id_study_days"),
        ),
        sa.ForeignKeyConstraint(
            ["source_run_id"], ["weather_ingest_runs.run_id"],
            name=op.f("fk_weather_daily_source_run_id_weather_ingest_runs"),
        ),
        # Idempotency constraint: one row per station per day
        sa.UniqueConstraint(
            "station_id", "study_day_id",
            name="uq_weather_daily_station_id_study_day_id",
        ),
    )
    # Index for day-range queries
    op.create_index(
        "ix_weather_daily_station_date",
        "weather_daily",
        ["station_id", "date_local"],
    )

    # 4. Add study_day_id FK to sessions (nullable; set when session becomes complete)
    op.add_column(
        "sessions",
        sa.Column("study_day_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_sessions_study_day_id_study_days"),
        "sessions",
        "study_days",
        ["study_day_id"],
        ["study_day_id"],
    )


def downgrade() -> None:
    # Remove FK and column from sessions
    op.drop_constraint(
        op.f("fk_sessions_study_day_id_study_days"), "sessions", type_="foreignkey"
    )
    op.drop_column("sessions", "study_day_id")

    # Drop weather_daily (depends on study_days and weather_ingest_runs)
    op.drop_index("ix_weather_daily_station_date", table_name="weather_daily")
    op.drop_table("weather_daily")

    # Drop weather_ingest_runs
    op.drop_index("ix_weather_ingest_runs_station_date", table_name="weather_ingest_runs")
    op.drop_index("ix_weather_ingest_runs_station_ingested", table_name="weather_ingest_runs")
    op.drop_table("weather_ingest_runs")

    # Drop study_days
    op.drop_table("study_days")
