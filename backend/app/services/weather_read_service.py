from __future__ import annotations

from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.weather import WeatherDaily, WeatherIngestRun
from app.schemas.weather import LatestRunInfo, WeatherDailyItem, WeatherDailyResponse


async def read_weather_daily(
    db: AsyncSession,
    *,
    start: date_type,
    end: date_type,
    station_id: int,
    include_forecast_periods: bool,
    include_latest_run: bool,
) -> WeatherDailyResponse:
    """Read weather rows and latest ingest metadata for dashboard/weather views."""

    if include_forecast_periods:
        rows_result = await db.execute(
            select(WeatherDaily)
            .where(
                WeatherDaily.station_id == station_id,
                WeatherDaily.date_local >= start,
                WeatherDaily.date_local <= end,
            )
            .order_by(WeatherDaily.date_local.asc())
        )
        items = [
            WeatherDailyItem.model_validate(row)
            for row in rows_result.scalars().all()
        ]
    else:
        rows_result = await db.execute(
            select(
                WeatherDaily.station_id,
                WeatherDaily.study_day_id,
                WeatherDaily.date_local,
                WeatherDaily.source_run_id,
                WeatherDaily.updated_at,
                WeatherDaily.current_temp_c,
                WeatherDaily.current_precip_today_mm,
                WeatherDaily.forecast_high_c,
                WeatherDaily.forecast_low_c,
                WeatherDaily.forecast_condition_text,
                WeatherDaily.sunshine_duration_hours,
            )
            .where(
                WeatherDaily.station_id == station_id,
                WeatherDaily.date_local >= start,
                WeatherDaily.date_local <= end,
            )
            .order_by(WeatherDaily.date_local.asc())
        )
        items = [
            WeatherDailyItem(
                station_id=row["station_id"],
                study_day_id=row["study_day_id"],
                date_local=row["date_local"],
                source_run_id=row["source_run_id"],
                updated_at=row["updated_at"],
                current_temp_c=row["current_temp_c"],
                current_precip_today_mm=row["current_precip_today_mm"],
                forecast_high_c=row["forecast_high_c"],
                forecast_low_c=row["forecast_low_c"],
                forecast_condition_text=row["forecast_condition_text"],
                forecast_periods=[],
                sunshine_duration_hours=row["sunshine_duration_hours"],
            )
            for row in rows_result.mappings().all()
        ]

    latest_run = None
    if include_latest_run:
        latest_result = await db.execute(
            select(WeatherIngestRun)
            .where(WeatherIngestRun.station_id == station_id)
            .order_by(WeatherIngestRun.ingested_at.desc())
            .limit(1)
        )
        latest_run = latest_result.scalar_one_or_none()

    return WeatherDailyResponse(
        items=items,
        latest_run=(
            LatestRunInfo(
                run_id=latest_run.run_id,
                ingested_at=latest_run.ingested_at,
                parse_status=latest_run.parse_status,
            )
            if latest_run is not None
            else None
        ),
    )
