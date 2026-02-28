from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Double, ForeignKey, Integer, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class StudyDay(Base):
    """Dimension table: one row per local calendar day (America/Vancouver)."""

    __tablename__ = "study_days"

    study_day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    date_local: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    tz_name: Mapped[str] = mapped_column(String, nullable=False, default="America/Vancouver")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class WeatherIngestRun(Base):
    """Append-only audit record for every weather ingestion attempt."""

    __tablename__ = "weather_ingest_runs"

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    station_id: Mapped[int] = mapped_column(Integer, nullable=False)
    date_local: Mapped[date] = mapped_column(Date, nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # 'github_actions' or 'ra_manual'
    requested_via: Mapped[str] = mapped_column(String, nullable=False)
    # Set from JWT sub when RA triggers; null for GitHub Actions
    requested_by_lab_member_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    source_primary_url: Mapped[str] = mapped_column(String, nullable=False)
    source_secondary_url: Mapped[str] = mapped_column(String, nullable=False)
    http_primary_status: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    http_secondary_status: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    raw_html_primary: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_html_secondary: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_html_primary_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    raw_html_secondary_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    parsed_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # 'success' / 'partial' / 'fail'
    parse_status: Mapped[str] = mapped_column(String, nullable=False)
    parse_errors: Mapped[list] = mapped_column(JSONB, nullable=False)
    parser_version: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class WeatherDaily(Base):
    """One row per station per study day; idempotent upsert target."""

    __tablename__ = "weather_daily"
    __table_args__ = (
        UniqueConstraint("station_id", "study_day_id", name="uq_weather_daily_station_id_study_day_id"),
    )

    daily_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    station_id: Mapped[int] = mapped_column(Integer, nullable=False)
    study_day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("study_days.study_day_id"),
        nullable=False,
    )
    # Denormalized for convenience; must match study_days.date_local
    date_local: Mapped[date] = mapped_column(Date, nullable=False)
    source_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("weather_ingest_runs.run_id"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Current conditions (metadata/display only — day-level analysis uses forecast fields)
    current_observed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_temp_c: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_relative_humidity_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_wind_speed_kmh: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_wind_gust_kmh: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_wind_dir_deg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_pressure_kpa: Mapped[float | None] = mapped_column(Double, nullable=True)
    current_precip_today_mm: Mapped[float | None] = mapped_column(Double, nullable=True)
    # Day-level forecast summary
    forecast_high_c: Mapped[float | None] = mapped_column(Double, nullable=True)
    forecast_low_c: Mapped[float | None] = mapped_column(Double, nullable=True)
    forecast_precip_prob_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    forecast_precip_mm: Mapped[float | None] = mapped_column(Double, nullable=True)
    forecast_condition_text: Mapped[str | None] = mapped_column(String, nullable=True)
    # Structured forecast periods list
    forecast_periods: Mapped[list] = mapped_column(JSONB, nullable=False)
    # Full normalized per-day payload
    structured_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
