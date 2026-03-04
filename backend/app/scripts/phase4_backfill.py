"""Phase 4 one-off backfill: remap existing imported_session_measures into
canonical survey and digit span tables, and backfill missing weather_daily rows.

What this script does:
1. For every row in imported_session_measures it upserts the corresponding rows
   into digitspan_runs / survey_uls8 / survey_cesd10 / survey_gad7 using the
   Phase 4 schema (data_source='imported', legacy-value columns populated).
2. If a session's study_day_id is missing (sessions imported before Phase 3
   study-day support was wired), derives it from completed_at in America/Vancouver
   and sets it.
3. Calls the legacy weather backfill service to fill in weather_daily rows for
   any imported days that still lack weather data (temp + precip only).

Safety guarantees:
- Idempotent: safe to re-run; all DB writes use INSERT … ON CONFLICT DO UPDATE /
  DO NOTHING so repeated runs produce the same result.
- Native rows are never touched: each canonical-table upsert carries a WHERE
  data_source='imported' guard at the DB level.
- study_day_id is derived from sessions.completed_at (America/Vancouver semantics)
  only when it is currently NULL — existing values are not overwritten.

Usage (from backend/):
    python -m app.scripts.phase4_backfill --dry-run   # preview, no writes
    python -m app.scripts.phase4_backfill              # apply
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import uuid
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import STUDY_TIMEZONE
from app.db import get_session_factory
from app.models.digitspan import DigitSpanRun
from app.models.imported_session_measures import ImportedSessionMeasures
from app.models.sessions import Session as SessionModel
from app.models.surveys import SurveyCESD10, SurveyGAD7, SurveyULS8
from app.models.weather import StudyDay
from app.services.weather_backfill_service import run_legacy_weather_backfill

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ── GAD-7 severity (mirrors import_service.py) ────────────────────────────────

def _gad7_severity(total: int) -> str:
    if total <= 4:
        return "minimal"
    if total <= 9:
        return "mild"
    if total <= 14:
        return "moderate"
    return "severe"


# ── Result container ───────────────────────────────────────────────────────────

@dataclass
class BackfillCounts:
    sessions_total: int = 0
    study_day_fixed: int = 0
    ds_created: int = 0
    ds_updated: int = 0
    ds_skipped: int = 0   # no digit_span_max_span value
    uls8_created: int = 0
    uls8_updated: int = 0
    uls8_skipped: int = 0
    cesd10_created: int = 0
    cesd10_updated: int = 0
    cesd10_skipped: int = 0
    gad7_created: int = 0
    gad7_updated: int = 0
    gad7_skipped: int = 0
    weather_inserted: int = 0
    weather_updated: int = 0   # open-meteo rows overwritten with import temp/precip
    weather_skipped: int = 0


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def _get_or_create_study_day(db: AsyncSession, d: object) -> uuid.UUID:
    """Insert-or-update a study_days row; return the study_day_id."""
    stmt = (
        pg_insert(StudyDay)
        .values(
            study_day_id=uuid.uuid4(),
            date_local=d,
            tz_name=STUDY_TIMEZONE,
        )
        .on_conflict_do_update(
            index_elements=["date_local"],
            set_={"tz_name": STUDY_TIMEZONE},
        )
        .returning(StudyDay.study_day_id)
    )
    return (await db.execute(stmt)).scalar_one()


# ── Core backfill logic ────────────────────────────────────────────────────────

async def run_backfill(dry_run: bool = False) -> BackfillCounts:
    counts = BackfillCounts()
    tz = ZoneInfo(STUDY_TIMEZONE)
    session_factory = get_session_factory()

    async with session_factory() as db:
        # 1. Load all imported measures joined to their sessions
        result = await db.execute(
            select(
                ImportedSessionMeasures.session_id,
                ImportedSessionMeasures.participant_uuid,
                ImportedSessionMeasures.digit_span_max_span,
                ImportedSessionMeasures.loneliness_mean,
                ImportedSessionMeasures.depression_mean,
                ImportedSessionMeasures.anxiety_mean,
                SessionModel.completed_at,
                SessionModel.study_day_id,
            ).join(
                SessionModel,
                SessionModel.session_id == ImportedSessionMeasures.session_id,
            )
        )
        rows = result.all()

        if not rows:
            log.info("No imported_session_measures rows found — nothing to backfill.")
            return counts

        counts.sessions_total = len(rows)
        log.info("Found %d imported session(s) to process.", counts.sessions_total)

        session_ids = [r.session_id for r in rows]

        # 2. Pre-query which sessions already have imported rows in each table
        async def _existing_imported(model: type) -> set[uuid.UUID]:
            r = await db.execute(
                select(model.session_id).where(
                    model.data_source == "imported",
                    model.session_id.in_(session_ids),
                )
            )
            return set(r.scalars().all())

        existing_ds = await _existing_imported(DigitSpanRun)
        existing_uls8 = await _existing_imported(SurveyULS8)
        existing_cesd10 = await _existing_imported(SurveyCESD10)
        existing_gad7 = await _existing_imported(SurveyGAD7)

        # 3. Process each session
        for row in rows:
            sid = row.session_id
            p_uuid = row.participant_uuid

            # ── Fix missing study_day_id ────────────────────────────────────
            if row.study_day_id is None and row.completed_at is not None:
                date_local = row.completed_at.astimezone(tz).date()
                counts.study_day_fixed += 1
                if not dry_run:
                    study_day_id = await _get_or_create_study_day(db, date_local)
                    await db.execute(
                        update(SessionModel)
                        .where(SessionModel.session_id == sid)
                        .values(study_day_id=study_day_id)
                    )

            # ── digitspan_runs ──────────────────────────────────────────────
            if row.digit_span_max_span is None:
                counts.ds_skipped += 1
            else:
                total_correct = row.digit_span_max_span
                if sid in existing_ds:
                    counts.ds_updated += 1
                else:
                    counts.ds_created += 1
                if not dry_run:
                    await db.execute(
                        pg_insert(DigitSpanRun)
                        .values(
                            run_id=uuid.uuid4(),
                            session_id=sid,
                            participant_uuid=p_uuid,
                            total_correct=total_correct,
                            max_span=None,
                            data_source="imported",
                        )
                        .on_conflict_do_update(
                            index_elements=["session_id"],
                            set_={
                                "total_correct": total_correct,
                                "max_span": None,
                                "data_source": "imported",
                            },
                            where=DigitSpanRun.data_source == "imported",
                        )
                    )

            # ── survey_uls8 (loneliness_mean → legacy_mean_1_4) ────────────
            if row.loneliness_mean is None:
                counts.uls8_skipped += 1
            else:
                if sid in existing_uls8:
                    counts.uls8_updated += 1
                else:
                    counts.uls8_created += 1
                if not dry_run:
                    await db.execute(
                        pg_insert(SurveyULS8)
                        .values(
                            response_id=uuid.uuid4(),
                            session_id=sid,
                            participant_uuid=p_uuid,
                            legacy_mean_1_4=row.loneliness_mean,
                            data_source="imported",
                        )
                        .on_conflict_do_update(
                            index_elements=["session_id"],
                            set_={
                                "legacy_mean_1_4": row.loneliness_mean,
                                "data_source": "imported",
                            },
                            where=SurveyULS8.data_source == "imported",
                        )
                    )

            # ── survey_cesd10 (depression_mean → legacy_mean_1_4) ──────────
            if row.depression_mean is None:
                counts.cesd10_skipped += 1
            else:
                if sid in existing_cesd10:
                    counts.cesd10_updated += 1
                else:
                    counts.cesd10_created += 1
                if not dry_run:
                    await db.execute(
                        pg_insert(SurveyCESD10)
                        .values(
                            response_id=uuid.uuid4(),
                            session_id=sid,
                            participant_uuid=p_uuid,
                            legacy_mean_1_4=row.depression_mean,
                            data_source="imported",
                        )
                        .on_conflict_do_update(
                            index_elements=["session_id"],
                            set_={
                                "legacy_mean_1_4": row.depression_mean,
                                "data_source": "imported",
                            },
                            where=SurveyCESD10.data_source == "imported",
                        )
                    )

            # ── survey_gad7 (anxiety_mean → legacy_mean_1_4 + total_score) ─
            if row.anxiety_mean is None:
                counts.gad7_skipped += 1
            else:
                anx = row.anxiety_mean
                anx_int = int(anx)
                if anx == anx_int and 0 <= anx_int <= 21:
                    gad7_total: int | None = anx_int
                    gad7_band: str | None = _gad7_severity(anx_int)
                else:
                    gad7_total = None
                    gad7_band = None

                if sid in existing_gad7:
                    counts.gad7_updated += 1
                else:
                    counts.gad7_created += 1
                if not dry_run:
                    await db.execute(
                        pg_insert(SurveyGAD7)
                        .values(
                            response_id=uuid.uuid4(),
                            session_id=sid,
                            participant_uuid=p_uuid,
                            legacy_mean_1_4=anx,
                            legacy_total_score=gad7_total,
                            total_score=gad7_total,
                            severity_band=gad7_band,
                            data_source="imported",
                        )
                        .on_conflict_do_update(
                            index_elements=["session_id"],
                            set_={
                                "legacy_mean_1_4": anx,
                                "legacy_total_score": gad7_total,
                                "total_score": gad7_total,
                                "severity_band": gad7_band,
                                "data_source": "imported",
                            },
                            where=SurveyGAD7.data_source == "imported",
                        )
                    )

        if not dry_run:
            await db.commit()
            log.info("Canonical table upserts committed.")

    # 4. Legacy weather backfill (separate DB session, already handles idempotency)
    if not dry_run:
        async with session_factory() as db2:
            weather_result = await run_legacy_weather_backfill(db2)
            counts.weather_inserted = weather_result.days_inserted
            counts.weather_updated = weather_result.days_updated
            counts.weather_skipped = weather_result.days_skipped

    return counts


def _print_summary(counts: BackfillCounts, dry_run: bool) -> None:
    prefix = "DRY RUN — " if dry_run else ""
    log.info("%sBackfill summary (%d imported sessions processed):", prefix, counts.sessions_total)
    log.info("  study_day_id fixed:  %d", counts.study_day_fixed)
    log.info(
        "  digitspan_runs  — created: %d, updated: %d, skipped (null): %d",
        counts.ds_created, counts.ds_updated, counts.ds_skipped,
    )
    log.info(
        "  survey_uls8     — created: %d, updated: %d, skipped (null): %d",
        counts.uls8_created, counts.uls8_updated, counts.uls8_skipped,
    )
    log.info(
        "  survey_cesd10   — created: %d, updated: %d, skipped (null): %d",
        counts.cesd10_created, counts.cesd10_updated, counts.cesd10_skipped,
    )
    log.info(
        "  survey_gad7     — created: %d, updated: %d, skipped (null): %d",
        counts.gad7_created, counts.gad7_updated, counts.gad7_skipped,
    )
    if not dry_run:
        log.info(
            "  weather_daily   — inserted: %d days, updated (overwrote open-meteo): %d days, skipped (ubc-eos): %d days",
            counts.weather_inserted, counts.weather_updated, counts.weather_skipped,
        )


async def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Phase 4 backfill: remap existing imported sessions into canonical "
            "survey/digitspan tables and backfill missing weather_daily rows."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be done without writing to the database.",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("DRY RUN mode — no changes will be written to the database.")

    counts = await run_backfill(dry_run=args.dry_run)
    _print_summary(counts, dry_run=args.dry_run)

    if not args.dry_run:
        log.info("Phase 4 backfill complete.")


if __name__ == "__main__":
    asyncio.run(main())
