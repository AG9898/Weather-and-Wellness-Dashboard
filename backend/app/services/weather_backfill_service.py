"""Legacy weather backfill service (T56).

Backfills weather_daily for study days that have imported session data but no
UBC-ingested weather row. Only temperature and precipitation are populated
(mean of all imported sessions for that local day). All other weather_daily
fields remain null/empty.

An audit weather_ingest_runs row is written per backfilled day with
parser_version="legacy-import-v1" and requested_via="legacy_backfill".
Existing weather_daily rows are never overwritten.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.imported_session_measures import ImportedSessionMeasures
from app.models.sessions import Session as SessionModel
from app.models.weather import StudyDay, WeatherDaily, WeatherIngestRun

_STATION_ID = 3510
_PARSER_VERSION = "legacy-import-v1"


@dataclass
class LegacyWeatherBackfillResult:
    days_backfilled: int
    days_skipped: int  # dates that already had a weather_daily row


async def run_legacy_weather_backfill(
    db: AsyncSession,
) -> LegacyWeatherBackfillResult:
    """Backfill weather_daily for imported days that have no UBC weather data.

    Algorithm:
    1. Aggregate mean temperature and precipitation from imported_session_measures,
       joined to sessions → study_days to get the local date.
    2. Identify which of those dates already have a weather_daily row for station 3510.
    3. For each missing date: insert a weather_ingest_runs audit row and a partial
       weather_daily row. Use on_conflict_do_nothing as an idempotency guard.
    """
    # ── Step 1: aggregate imported measures by study day ──────────────────────
    agg_result = await db.execute(
        select(
            StudyDay.date_local,
            StudyDay.study_day_id,
            func.avg(ImportedSessionMeasures.temperature_c).label("mean_temp"),
            func.avg(ImportedSessionMeasures.precipitation_mm).label("mean_precip"),
        )
        .join(SessionModel, SessionModel.session_id == ImportedSessionMeasures.session_id)
        .join(StudyDay, StudyDay.study_day_id == SessionModel.study_day_id)
        .where(
            or_(
                ImportedSessionMeasures.temperature_c.is_not(None),
                ImportedSessionMeasures.precipitation_mm.is_not(None),
            )
        )
        .group_by(StudyDay.date_local, StudyDay.study_day_id)
        .order_by(StudyDay.date_local)
    )
    date_rows = agg_result.all()

    if not date_rows:
        return LegacyWeatherBackfillResult(days_backfilled=0, days_skipped=0)

    # ── Step 2: find dates that already have weather_daily rows ───────────────
    all_dates = [row.date_local for row in date_rows]
    existing_result = await db.execute(
        select(WeatherDaily.date_local).where(
            WeatherDaily.station_id == _STATION_ID,
            WeatherDaily.date_local.in_(all_dates),
        )
    )
    existing_dates = {row[0] for row in existing_result.all()}

    # ── Step 3: insert audit run + partial weather_daily for each new date ────
    days_backfilled = 0
    days_skipped = 0
    now_utc = datetime.now(timezone.utc)

    for row in date_rows:
        if row.date_local in existing_dates:
            days_skipped += 1
            continue

        run_id = uuid.uuid4()

        # Audit record: one ingest run per backfilled day
        await db.execute(
            pg_insert(WeatherIngestRun).values(
                run_id=run_id,
                station_id=_STATION_ID,
                date_local=row.date_local,
                requested_via="legacy_backfill",
                requested_by_lab_member_id=None,
                source_primary_url="",
                source_secondary_url="",
                http_primary_status=None,
                http_secondary_status=None,
                raw_html_primary=None,
                raw_html_secondary=None,
                raw_html_primary_sha256=None,
                raw_html_secondary_sha256=None,
                parsed_json={},
                parse_status="success",
                parse_errors=[],
                parser_version=_PARSER_VERSION,
            )
        )

        # Partial weather_daily: only temp + precip; JSONB NOT NULL → empty
        await db.execute(
            pg_insert(WeatherDaily)
            .values(
                daily_id=uuid.uuid4(),
                station_id=_STATION_ID,
                study_day_id=row.study_day_id,
                date_local=row.date_local,
                source_run_id=run_id,
                updated_at=now_utc,
                current_temp_c=row.mean_temp,
                current_precip_today_mm=row.mean_precip,
                forecast_periods=[],
                structured_json={},
            )
            .on_conflict_do_nothing(
                constraint="uq_weather_daily_station_id_study_day_id"
            )
        )
        days_backfilled += 1

    await db.commit()

    return LegacyWeatherBackfillResult(
        days_backfilled=days_backfilled,
        days_skipped=days_skipped,
    )
