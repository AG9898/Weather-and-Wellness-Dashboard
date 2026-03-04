"""Legacy weather backfill service (T56, updated for correct precedence).

Backfills weather_daily with temperature and precipitation derived from
imported_session_measures (mean per local study day).

Precedence (highest to lowest — matching the full weather data hierarchy):
  1. UBC EOS live rows (parser_version="ubc-eos-v1")  — never touched
  2. Legacy import rows (parser_version="legacy-import-v1") — already correct; no-op
  3. Open-Meteo rows (parser_version="open-meteo-v1") — overwritten with import
     temp/precip; existing humidity/sunshine values are preserved
  4. No row — full insert of temp + precip only

This ensures that actual measurements recorded during study sessions always take
precedence over ERA5 satellite reanalysis data from Open-Meteo.

Returns LegacyWeatherBackfillResult(days_inserted, days_updated, days_skipped).
  days_inserted: new weather_daily rows created
  days_updated:  open-meteo rows overwritten with import temp/precip
  days_skipped:  dates skipped (ubc-eos-v1 rows — highest quality, never touched)
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.imported_session_measures import ImportedSessionMeasures
from app.models.sessions import Session as SessionModel
from app.models.weather import StudyDay, WeatherDaily, WeatherIngestRun

_STATION_ID = 3510
_PARSER_VERSION = "legacy-import-v1"
_UBC_EOS_VERSION = "ubc-eos-v1"
_OPEN_METEO_VERSION = "open-meteo-v1"


@dataclass
class LegacyWeatherBackfillResult:
    days_inserted: int   # new rows inserted (no prior weather_daily row)
    days_updated: int    # open-meteo rows overwritten with import temp/precip
    days_skipped: int    # ubc-eos rows — untouched (highest quality)


async def run_legacy_weather_backfill(
    db: AsyncSession,
) -> LegacyWeatherBackfillResult:
    """Backfill / overwrite weather_daily with import temp+precip per study day.

    Algorithm:
    1. Aggregate mean temperature and precipitation from imported_session_measures
       joined to sessions → study_days to get the local date.
    2. Classify each import date's existing weather_daily row (if any) by
       parser_version via weather_ingest_runs.
    3. Apply precedence rules:
       - No row          → insert new partial weather_daily (temp + precip only)
       - open-meteo-v1   → UPDATE current_temp_c + current_precip_today_mm with
                           import values; preserve existing humidity/sunshine
       - legacy-import-v1 → already correct; no-op (idempotent)
       - ubc-eos-v1      → skip (highest quality; never touched)
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
        return LegacyWeatherBackfillResult(
            days_inserted=0, days_updated=0, days_skipped=0
        )

    # ── Step 2: classify existing rows by parser_version ─────────────────────
    all_dates = [row.date_local for row in date_rows]
    existing_result = await db.execute(
        select(
            WeatherDaily.date_local,
            WeatherDaily.daily_id,
            WeatherIngestRun.parser_version,
        )
        .join(WeatherIngestRun, WeatherIngestRun.run_id == WeatherDaily.source_run_id)
        .where(
            WeatherDaily.station_id == _STATION_ID,
            WeatherDaily.date_local.in_(all_dates),
        )
    )
    # date_local → (daily_id, parser_version)
    existing_by_date: dict[object, tuple[uuid.UUID, str]] = {
        row.date_local: (row.daily_id, row.parser_version)
        for row in existing_result.all()
    }

    # ── Step 3: apply precedence rules ───────────────────────────────────────
    days_inserted = 0
    days_updated = 0
    days_skipped = 0
    now_utc = datetime.now(timezone.utc)

    for row in date_rows:
        existing = existing_by_date.get(row.date_local)

        if existing is None:
            # No existing row — insert new partial weather_daily
            run_id = await _insert_audit_run(db, row.date_local, now_utc)
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
            days_inserted += 1

        elif existing[1] == _OPEN_METEO_VERSION:
            # Open-Meteo row — overwrite temp/precip with import values.
            # Existing humidity and sunshine are preserved (only temp+precip updated).
            daily_id, _ = existing
            run_id = await _insert_audit_run(db, row.date_local, now_utc)
            await db.execute(
                update(WeatherDaily)
                .where(WeatherDaily.daily_id == daily_id)
                .values(
                    current_temp_c=row.mean_temp,
                    current_precip_today_mm=row.mean_precip,
                    source_run_id=run_id,
                    updated_at=now_utc,
                )
            )
            days_updated += 1

        elif existing[1] == _UBC_EOS_VERSION:
            # UBC EOS live row — highest quality; never touched
            days_skipped += 1

        else:
            # Already a legacy-import-v1 row (or unknown) — idempotent no-op
            pass

    await db.commit()

    return LegacyWeatherBackfillResult(
        days_inserted=days_inserted,
        days_updated=days_updated,
        days_skipped=days_skipped,
    )


async def _insert_audit_run(
    db: AsyncSession,
    date_local: object,
    now_utc: datetime,
) -> uuid.UUID:
    """Insert one weather_ingest_runs audit row and return its run_id."""
    run_id = uuid.uuid4()
    await db.execute(
        pg_insert(WeatherIngestRun).values(
            run_id=run_id,
            station_id=_STATION_ID,
            date_local=date_local,
            ingested_at=now_utc,
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
    return run_id
