"""Historical weather backfill service (T65).

Implements the three-case precedence rule for Open-Meteo historical backfill:

  Case A — no existing weather_daily row for station 3510 on that date:
    Full insert of all six mapped fields.
    Get-or-create study_days row.
    ON CONFLICT DO NOTHING idempotency guard.
    Counted in days_inserted.

  Case B — existing row sourced from legacy-import-v1:
    UPDATE only null fields using COALESCE:
      current_relative_humidity_pct, sunshine_duration_hours,
      forecast_high_c, forecast_low_c.
    current_temp_c and current_precip_today_mm are never touched.
    source_run_id updated to the new open-meteo-v1 audit row.
    Counted in days_enhanced.

  Case C — existing row sourced from ubc-eos-v1 or open-meteo-v1:
    Skipped entirely.
    Counted in days_skipped.

One weather_ingest_runs audit row is written per affected day (Case A or B).
Running the service twice over the same range is idempotent:
  second run returns days_inserted=0, days_enhanced=0.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import STUDY_TIMEZONE
from app.models.weather import StudyDay, WeatherDaily, WeatherIngestRun
from app.services.historical_weather_service import (
    OpenMeteoDay,
    OpenMeteoError,
    build_open_meteo_url,
    fetch_open_meteo,
)

_STATION_ID = 3510
_PARSER_VERSION = "open-meteo-v1"
_REQUESTED_VIA = "historical_api_backfill"
_IMPORT_PARSER_VERSION = "legacy-import-v1"


@dataclass
class HistoricalWeatherBackfillResult:
    days_inserted: int
    days_enhanced: int
    days_skipped: int


@dataclass
class _ExistingRow:
    daily_id: uuid.UUID
    date_local: date
    parser_version: str
    study_day_id: uuid.UUID


async def run_historical_weather_backfill(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    station_id: int = _STATION_ID,
) -> HistoricalWeatherBackfillResult:
    """Run the Open-Meteo historical weather backfill for the given date range.

    Fetches data from Open-Meteo then applies the three-case precedence rule.
    Raises OpenMeteoError if Open-Meteo returns a non-2xx response (caller
    should translate to HTTP 502).
    """
    # ── Step 1: fetch Open-Meteo data (may raise OpenMeteoError) ─────────────
    open_meteo_data: dict[date, OpenMeteoDay] = await fetch_open_meteo(
        start_date, end_date
    )
    if not open_meteo_data:
        return HistoricalWeatherBackfillResult(
            days_inserted=0, days_enhanced=0, days_skipped=0
        )

    source_url = build_open_meteo_url(start_date, end_date)
    all_dates = list(open_meteo_data.keys())

    # ── Step 2: classify existing rows by parser_version ─────────────────────
    existing_result = await db.execute(
        select(
            WeatherDaily.daily_id,
            WeatherDaily.date_local,
            WeatherDaily.study_day_id,
            WeatherIngestRun.parser_version,
        )
        .join(WeatherIngestRun, WeatherIngestRun.run_id == WeatherDaily.source_run_id)
        .where(
            WeatherDaily.station_id == station_id,
            WeatherDaily.date_local.in_(all_dates),
        )
    )
    existing_by_date: dict[date, _ExistingRow] = {
        row.date_local: _ExistingRow(
            daily_id=row.daily_id,
            date_local=row.date_local,
            parser_version=row.parser_version,
            study_day_id=row.study_day_id,
        )
        for row in existing_result.all()
    }

    # ── Step 3: apply precedence rules ───────────────────────────────────────
    days_inserted = 0
    days_enhanced = 0
    days_skipped = 0
    now_utc = datetime.now(timezone.utc)

    for day_date, om_day in sorted(open_meteo_data.items()):
        existing = existing_by_date.get(day_date)

        if existing is None:
            # Case A: no existing row — full insert
            run_id = await _insert_audit_run(db, station_id, day_date, source_url, om_day, now_utc)
            study_day_id = await _get_or_create_study_day(db, day_date)
            await db.execute(
                pg_insert(WeatherDaily)
                .values(
                    daily_id=uuid.uuid4(),
                    station_id=station_id,
                    study_day_id=study_day_id,
                    date_local=day_date,
                    source_run_id=run_id,
                    updated_at=now_utc,
                    current_temp_c=om_day.current_temp_c,
                    current_relative_humidity_pct=om_day.current_relative_humidity_pct,
                    current_precip_today_mm=om_day.current_precip_today_mm,
                    forecast_high_c=om_day.forecast_high_c,
                    forecast_low_c=om_day.forecast_low_c,
                    sunshine_duration_hours=om_day.sunshine_duration_hours,
                    forecast_periods=[],
                    structured_json={},
                )
                .on_conflict_do_nothing(
                    constraint="uq_weather_daily_station_id_study_day_id"
                )
            )
            days_inserted += 1

        elif existing.parser_version == _IMPORT_PARSER_VERSION:
            # Case B: import-sourced row — COALESCE update of null fields only
            run_id = await _insert_audit_run(db, station_id, day_date, source_url, om_day, now_utc)
            await db.execute(
                update(WeatherDaily)
                .where(WeatherDaily.daily_id == existing.daily_id)
                .values(
                    current_relative_humidity_pct=func.coalesce(
                        WeatherDaily.current_relative_humidity_pct,
                        om_day.current_relative_humidity_pct,
                    ),
                    sunshine_duration_hours=func.coalesce(
                        WeatherDaily.sunshine_duration_hours,
                        om_day.sunshine_duration_hours,
                    ),
                    forecast_high_c=func.coalesce(
                        WeatherDaily.forecast_high_c,
                        om_day.forecast_high_c,
                    ),
                    forecast_low_c=func.coalesce(
                        WeatherDaily.forecast_low_c,
                        om_day.forecast_low_c,
                    ),
                    source_run_id=run_id,
                    updated_at=now_utc,
                )
            )
            days_enhanced += 1

        else:
            # Case C: ubc-eos-v1 or open-meteo-v1 row — skip entirely
            days_skipped += 1

    await db.commit()

    return HistoricalWeatherBackfillResult(
        days_inserted=days_inserted,
        days_enhanced=days_enhanced,
        days_skipped=days_skipped,
    )


async def _get_or_create_study_day(db: AsyncSession, day_date: date) -> uuid.UUID:
    """Get or create a study_days row for the given local date."""
    stmt = (
        pg_insert(StudyDay)
        .values(
            study_day_id=uuid.uuid4(),
            date_local=day_date,
            tz_name=STUDY_TIMEZONE,
        )
        .on_conflict_do_update(
            index_elements=["date_local"],
            set_={"tz_name": STUDY_TIMEZONE},
        )
        .returning(StudyDay.study_day_id)
    )
    return (await db.execute(stmt)).scalar_one()


async def _insert_audit_run(
    db: AsyncSession,
    station_id: int,
    day_date: date,
    source_url: str,
    om_day: OpenMeteoDay,
    now_utc: datetime,
) -> uuid.UUID:
    """Insert one weather_ingest_runs audit row and return its run_id."""
    run_id = uuid.uuid4()
    await db.execute(
        pg_insert(WeatherIngestRun).values(
            run_id=run_id,
            station_id=station_id,
            date_local=day_date,
            ingested_at=now_utc,
            requested_via=_REQUESTED_VIA,
            requested_by_lab_member_id=None,
            source_primary_url=source_url,
            source_secondary_url="",
            http_primary_status=200,
            http_secondary_status=None,
            raw_html_primary=None,
            raw_html_secondary=None,
            raw_html_primary_sha256=None,
            raw_html_secondary_sha256=None,
            parsed_json={
                "current_temp_c": om_day.current_temp_c,
                "current_relative_humidity_pct": om_day.current_relative_humidity_pct,
                "current_precip_today_mm": om_day.current_precip_today_mm,
                "forecast_high_c": om_day.forecast_high_c,
                "forecast_low_c": om_day.forecast_low_c,
                "sunshine_duration_hours": om_day.sunshine_duration_hours,
            },
            parse_status="success",
            parse_errors=[],
            parser_version=_PARSER_VERSION,
        )
    )
    return run_id
