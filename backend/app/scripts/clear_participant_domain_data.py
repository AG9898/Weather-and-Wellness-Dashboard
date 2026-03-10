"""One-off participant-domain wipe that preserves weather history.

This script clears participant/session outcome data while keeping weather rows
and their required `study_days` rows intact. It is intended for resetting the
imported/native participant dataset before a fresh re-import without losing
historical weather context.

Usage (from backend/):
    python -m app.scripts.clear_participant_domain_data --dry-run
    python -m app.scripts.clear_participant_domain_data --apply

Notes:
- Preserves `weather_daily` and `weather_ingest_runs`.
- Removes orphaned `study_days` rows after participant/session data is cleared.
- Does not touch schema (DDL) or `alembic_version`.
- Irreversible unless you have an export/backup.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import AsyncContextManager

from sqlalchemy import text

from app.db import get_session_factory

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


_PARTICIPANT_DOMAIN_TABLES = [
    "digitspan_trials",
    "digitspan_runs",
    "survey_uls8",
    "survey_cesd10",
    "survey_gad7",
    "survey_cogfunc8a",
    "imported_session_measures",
    "sessions",
    "participants",
]

_PRESERVED_WEATHER_TABLES = [
    "weather_daily",
    "weather_ingest_runs",
]

_VERIFY_TABLES = [
    *_PARTICIPANT_DOMAIN_TABLES,
    "study_days",
    *_PRESERVED_WEATHER_TABLES,
]

_SELECTIVE_WIPE_SQL = (
    "TRUNCATE TABLE "
    + ", ".join(_PARTICIPANT_DOMAIN_TABLES)
    + " CASCADE"
)

_DELETE_ORPHAN_STUDY_DAYS_SQL = """
DELETE FROM study_days
WHERE NOT EXISTS (
    SELECT 1
    FROM weather_daily
    WHERE weather_daily.study_day_id = study_days.study_day_id
)
""".strip()


@dataclass(slots=True)
class SelectiveWipeSummary:
    deleted_orphan_study_days: int
    post_counts: dict[str, int]


async def _collect_counts(db: object, tables: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table in tables:
        counts[table] = int(
            (await db.execute(text(f"SELECT count(*) FROM {table}"))).scalar_one()
        )
    return counts


async def run_selective_wipe(
    *,
    apply: bool,
    session_factory: Callable[[], AsyncContextManager[object]] | None = None,
) -> SelectiveWipeSummary | None:
    log.info("Participant-domain wipe SQL: %s", _SELECTIVE_WIPE_SQL)
    log.info(
        "Orphan study_days cleanup SQL: %s",
        _DELETE_ORPHAN_STUDY_DAYS_SQL.replace("\n", " "),
    )
    log.info(
        "Preserved weather tables: %s",
        ", ".join(_PRESERVED_WEATHER_TABLES),
    )

    if not apply:
        log.info("Dry-run only; no DB writes performed.")
        return None

    active_session_factory = session_factory or get_session_factory()
    async with active_session_factory() as db:
        await db.execute(text(_SELECTIVE_WIPE_SQL))
        delete_result = await db.execute(text(_DELETE_ORPHAN_STUDY_DAYS_SQL))
        await db.commit()

        post_counts = await _collect_counts(db, _VERIFY_TABLES)
        deleted_orphan_study_days = int(delete_result.rowcount or 0)

    for table, count in post_counts.items():
        log.info("Row count after selective wipe: %s = %s", table, count)

    log.info(
        "Selective wipe complete. Deleted %s orphaned study_days row(s).",
        deleted_orphan_study_days,
    )
    return SelectiveWipeSummary(
        deleted_orphan_study_days=deleted_orphan_study_days,
        post_counts=post_counts,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clear participant/session outcome data while preserving weather history."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the wipe statements without executing them.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute the selective wipe (IRREVERSIBLE).",
    )
    args = parser.parse_args()

    if args.dry_run and args.apply:
        raise SystemExit("Choose exactly one of --dry-run or --apply")
    if not args.dry_run and not args.apply:
        raise SystemExit("Pass --dry-run or --apply")

    asyncio.run(run_selective_wipe(apply=args.apply))


if __name__ == "__main__":
    main()
