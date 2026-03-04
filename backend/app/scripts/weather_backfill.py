"""Weather-only backfill script (weather_daily table only, no participant/session data).

Step 1: Legacy weather backfill — reads existing imported_session_measures rows and
        writes mean temp+precip per date into weather_daily where no row exists yet.
        (No-op if imported_session_measures is empty.)

Step 2: Open-Meteo historical backfill — fetches all daily aggregates from the
        Open-Meteo Archive API (2025-01-01 → today, America/Vancouver) and:
          Case A: fully inserts dates with no existing weather_daily row
          Case B: COALESCE-updates null fields on legacy-import rows (adds humidity + sunshine)
          Case C: skips UBC EOS live rows and already-enhanced open-meteo rows

Safe to re-run: all DB writes are idempotent.
Does not touch participants, sessions, surveys, or digitspan_runs.

Usage (from backend/):
    python -m app.scripts.weather_backfill --dry-run   # preview only
    python -m app.scripts.weather_backfill              # apply to Supabase
"""
from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import date
from zoneinfo import ZoneInfo

from app.config import STUDY_TIMEZONE
from app.db import get_session_factory
from app.services.historical_weather_backfill_service import (
    HistoricalWeatherBackfillResult,
    run_historical_weather_backfill,
)
from app.services.historical_weather_service import OpenMeteoError
from app.services.weather_backfill_service import run_legacy_weather_backfill

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

_STUDY_START = date(2025, 1, 1)


def _today_vancouver() -> date:
    return date.today()  # script runs locally in Vancouver timezone


async def main(dry_run: bool) -> None:
    today = _today_vancouver()
    session_factory = get_session_factory()

    if dry_run:
        log.info("DRY RUN mode — no changes will be written to the database.")
        log.info(
            "Would run: legacy weather backfill, then Open-Meteo backfill %s → %s",
            _STUDY_START,
            today,
        )
        return

    # ── Step 1: Legacy weather backfill (temp + precip from imported sessions) ──
    log.info("Step 1: Legacy weather backfill (imported_session_measures → weather_daily) …")
    async with session_factory() as db:
        legacy_result = await run_legacy_weather_backfill(db)
    log.info(
        "  Legacy backfill done — inserted: %d days, updated (overwrote open-meteo): %d days, skipped (ubc-eos): %d days",
        legacy_result.days_inserted,
        legacy_result.days_updated,
        legacy_result.days_skipped,
    )
    if legacy_result.days_inserted == 0 and legacy_result.days_updated == 0:
        log.info(
            "  (No import data found in imported_session_measures, or all dates already have import/ubc-eos rows.)"
        )

    # ── Step 2: Open-Meteo historical backfill ────────────────────────────────
    log.info(
        "Step 2: Open-Meteo historical backfill (%s → %s, America/Vancouver) …",
        _STUDY_START,
        today,
    )
    try:
        async with session_factory() as db:
            om_result: HistoricalWeatherBackfillResult = await run_historical_weather_backfill(
                db,
                start_date=_STUDY_START,
                end_date=today,
            )
    except OpenMeteoError as exc:
        log.error(
            "Open-Meteo API error (HTTP %d): %s", exc.status_code, exc.detail
        )
        raise SystemExit(1) from exc

    log.info(
        "  Open-Meteo backfill done — inserted: %d days, enhanced: %d days, skipped (live/already done): %d days",
        om_result.days_inserted,
        om_result.days_enhanced,
        om_result.days_skipped,
    )

    log.info("Weather backfill complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill weather_daily from legacy import data + Open-Meteo."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be done without writing to the database.",
    )
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
