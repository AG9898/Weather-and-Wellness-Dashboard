"""Weather ingestion router.

POST /weather/ingest/ubc-eos
    Dual auth: LabMember JWT (ra_manual) or X-WW-Weather-Ingest-Secret header (github_actions).
    Per-station cooldown (429) and advisory lock (409) prevent duplicate / concurrent runs.
    Idempotent daily upsert into weather_daily keyed by (station_id, study_day_id).

GET /weather/daily
    RA-only. Returns weather_daily rows for a date range plus the most recent ingest run.
"""
from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import date as date_type
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_lab_member
from app.db import get_session
from app.models.weather import StudyDay, WeatherDaily, WeatherIngestRun
from app.schemas.weather import (
    LatestRunInfo,
    WeatherDailyItem,
    WeatherDailyResponse,
    WeatherIngestRequest,
    WeatherIngestResponse,
)
from app.services.weather_parser import fetch_and_parse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/weather", tags=["weather"])
_bearer_scheme = HTTPBearer(auto_error=False)


# ── Auth ──────────────────────────────────────────────────────────────────────

@dataclass
class _IngestAuth:
    requested_via: str       # "ra_manual" or "github_actions"
    lab_member_id: UUID | None


async def _require_ingest_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    ingest_secret: Annotated[
        str | None, Header(alias="X-WW-Weather-Ingest-Secret")
    ] = None,
) -> _IngestAuth:
    """JWT first (ra_manual); if absent fall back to shared secret (github_actions)."""
    if credentials is not None:
        # Bearer token present — must be a valid LabMember JWT; no fallback
        lab_member: LabMember = get_current_lab_member(credentials)
        return _IngestAuth(requested_via="ra_manual", lab_member_id=lab_member.id)

    # No JWT — check shared secret
    secrets_raw = os.getenv("WEATHER_INGEST_SHARED_SECRETS", "")
    valid_secrets = {s.strip() for s in secrets_raw.split(",") if s.strip()}
    if ingest_secret and ingest_secret in valid_secrets:
        return _IngestAuth(requested_via="github_actions", lab_member_id=None)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication for weather ingestion",
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/ingest/ubc-eos",
    response_model=WeatherIngestResponse,
    status_code=status.HTTP_200_OK,
)
async def ingest_weather(
    payload: WeatherIngestRequest,
    auth: _IngestAuth = Depends(_require_ingest_auth),
    db: AsyncSession = Depends(get_session),
) -> WeatherIngestResponse:
    station_id = payload.station_id

    # ── 1. Cooldown check ─────────────────────────────────────────────────────
    cooldown_secs = int(os.getenv("WEATHER_INGEST_COOLDOWN_SECONDS", "600"))
    last_row = await db.execute(
        select(WeatherIngestRun.ingested_at)
        .where(WeatherIngestRun.station_id == station_id)
        .order_by(WeatherIngestRun.ingested_at.desc())
        .limit(1)
    )
    last_ingested = last_row.scalar_one_or_none()

    if last_ingested is not None:
        last_utc = (
            last_ingested.replace(tzinfo=timezone.utc)
            if last_ingested.tzinfo is None
            else last_ingested.astimezone(timezone.utc)
        )
        elapsed = (datetime.now(timezone.utc) - last_utc).total_seconds()
        if elapsed < cooldown_secs:
            retry_after = int(cooldown_secs - elapsed) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Ingestion cooldown active for station {station_id}. "
                    f"Retry after {retry_after}s."
                ),
                headers={"Retry-After": str(retry_after)},
            )

    # ── 2. Fetch and parse HTML (async, no DB) ────────────────────────────────
    logger.info(
        "Starting weather ingestion for station=%s via=%s",
        station_id,
        auth.requested_via,
    )
    parse_result = await fetch_and_parse(station_id)
    logger.info(
        "Ingest parse_status=%s errors=%d periods=%d",
        parse_result.parse_status,
        len(parse_result.parse_errors),
        len(parse_result.forecast_periods),
    )

    # ── 3. Advisory lock + DB writes ─────────────────────────────────────────
    run_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    # pg_try_advisory_xact_lock: returns TRUE if acquired; FALSE if already held.
    # Lock is held for the duration of this transaction.
    lock_row = await db.execute(
        text("SELECT pg_try_advisory_xact_lock(:key)"),
        {"key": station_id},
    )
    if not lock_row.scalar_one():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ingestion already in progress for station {station_id}",
        )

    # Insert weather_ingest_runs (always, regardless of parse_status)
    await db.execute(
        pg_insert(WeatherIngestRun).values(
            run_id=run_id,
            station_id=station_id,
            date_local=parse_result.date_local,
            requested_via=auth.requested_via,
            requested_by_lab_member_id=auth.lab_member_id,
            source_primary_url=parse_result.source_primary_url,
            source_secondary_url=parse_result.source_secondary_url,
            http_primary_status=parse_result.http_primary_status,
            http_secondary_status=parse_result.http_secondary_status,
            raw_html_primary=parse_result.raw_html_primary,
            raw_html_secondary=parse_result.raw_html_secondary,
            raw_html_primary_sha256=parse_result.raw_html_primary_sha256,
            raw_html_secondary_sha256=parse_result.raw_html_secondary_sha256,
            parsed_json=parse_result.parsed_json,
            parse_status=parse_result.parse_status,
            parse_errors=parse_result.parse_errors,
            parser_version=parse_result.parser_version,
        )
    )

    # Upsert weather_daily only when something useful was parsed
    upserted_days = 0
    if parse_result.parse_status != "fail":
        # Get-or-create study_day row for today's local date
        day_stmt = (
            pg_insert(StudyDay)
            .values(
                study_day_id=uuid.uuid4(),
                date_local=parse_result.date_local,
                tz_name="America/Edmonton",
            )
            .on_conflict_do_update(
                index_elements=["date_local"],
                set_={"tz_name": "America/Edmonton"},
            )
            .returning(StudyDay.study_day_id)
        )
        study_day_id: UUID = (await db.execute(day_stmt)).scalar_one()

        # Idempotent upsert into weather_daily
        daily_values: dict = {
            "daily_id": uuid.uuid4(),
            "station_id": station_id,
            "study_day_id": study_day_id,
            "date_local": parse_result.date_local,
            "source_run_id": run_id,
            "updated_at": now_utc,
            "current_observed_at": parse_result.current_observed_at,
            "current_temp_c": parse_result.current_temp_c,
            "current_relative_humidity_pct": parse_result.current_relative_humidity_pct,
            "current_wind_speed_kmh": parse_result.current_wind_speed_kmh,
            "current_wind_gust_kmh": parse_result.current_wind_gust_kmh,
            "current_wind_dir_deg": parse_result.current_wind_dir_deg,
            "current_pressure_kpa": parse_result.current_pressure_kpa,
            "current_precip_today_mm": parse_result.current_precip_today_mm,
            "forecast_high_c": parse_result.forecast_high_c,
            "forecast_low_c": parse_result.forecast_low_c,
            "forecast_precip_prob_pct": parse_result.forecast_precip_prob_pct,
            "forecast_precip_mm": parse_result.forecast_precip_mm,
            "forecast_condition_text": parse_result.forecast_condition_text,
            "forecast_periods": parse_result.forecast_periods,
            "structured_json": parse_result.parsed_json,
        }
        # On conflict: overwrite all mutable fields (source_run_id, weather data, updated_at)
        update_set = {
            k: v for k, v in daily_values.items()
            if k not in ("daily_id", "station_id", "study_day_id", "created_at")
        }
        await db.execute(
            pg_insert(WeatherDaily)
            .values(**daily_values)
            .on_conflict_do_update(
                constraint="uq_weather_daily_station_id_study_day_id",
                set_=update_set,
            )
        )
        upserted_days = 1

    await db.commit()

    return WeatherIngestResponse(
        run_id=run_id,
        station_id=station_id,
        ingested_at=now_utc,
        parse_status=parse_result.parse_status,
        parse_errors=parse_result.parse_errors,
        upserted_days=upserted_days,
    )


# ── GET /daily ────────────────────────────────────────────────────────────────

_MAX_DATE_RANGE_DAYS = 365


@router.get("/daily", response_model=WeatherDailyResponse)
async def get_weather_daily(
    start: date_type = Query(..., description="Start date inclusive (YYYY-MM-DD, America/Edmonton)"),
    end: date_type = Query(..., description="End date inclusive (YYYY-MM-DD, America/Edmonton)"),
    station_id: int = Query(default=3510, description="Station ID"),
    _: LabMember = Depends(get_current_lab_member),
    db: AsyncSession = Depends(get_session),
) -> WeatherDailyResponse:
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start must not be after end",
        )
    if (end - start).days > _MAX_DATE_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Date range exceeds maximum of {_MAX_DATE_RANGE_DAYS} days",
        )

    rows_result = await db.execute(
        select(WeatherDaily)
        .where(
            WeatherDaily.station_id == station_id,
            WeatherDaily.date_local >= start,
            WeatherDaily.date_local <= end,
        )
        .order_by(WeatherDaily.date_local.asc())
    )
    rows = rows_result.scalars().all()

    latest_result = await db.execute(
        select(WeatherIngestRun)
        .where(WeatherIngestRun.station_id == station_id)
        .order_by(WeatherIngestRun.ingested_at.desc())
        .limit(1)
    )
    latest_run = latest_result.scalar_one_or_none()

    return WeatherDailyResponse(
        items=[WeatherDailyItem.model_validate(row) for row in rows],
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
