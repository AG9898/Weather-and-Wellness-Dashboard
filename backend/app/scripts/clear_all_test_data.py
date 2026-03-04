"""One-off (repeatable) data wipe for demo/reset.

This script clears *all* study-domain data while keeping the schema intact.
It intentionally mirrors the table set and TRUNCATE behavior from the Alembic
migration:

    backend/alembic/versions/20260228_000009_clear_all_test_data.py

Why a script (instead of re-running the migration)?
- That migration is already applied in any DB that has upgraded past it.
- Newer migrations (Phase 4) relax NOT NULL constraints for imported rows;
  downgrading to re-run the old wipe migration is not safe when imported rows
  exist (would require making NULL columns NOT NULL again).

Usage (from backend/):
    python -m app.scripts.clear_all_test_data --dry-run
    python -m app.scripts.clear_all_test_data --apply

Notes:
- Does not touch schema (DDL) or `alembic_version`.
- Irreversible: deleted rows cannot be recovered unless you have an export.
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import text

from app.db import get_session_factory

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# Keep this list in sync with the Alembic wipe migration.
_DATA_TABLES = ", ".join(
    [
        "digitspan_trials",
        "digitspan_runs",
        "survey_uls8",
        "survey_cesd10",
        "survey_gad7",
        "survey_cogfunc8a",
        "imported_session_measures",
        "weather_daily",
        "weather_ingest_runs",
        "sessions",
        "study_days",
        "participants",
    ]
)


async def run_wipe(apply: bool) -> None:
    sql = f"TRUNCATE TABLE {_DATA_TABLES} CASCADE"
    log.info("About to run: %s", sql)
    if not apply:
        log.info("Dry-run only; no DB writes performed.")
        return

    session_factory = get_session_factory()
    async with session_factory() as db:
        await db.execute(text(sql))
        await db.commit()

        # Post-check: confirm tables are empty (helps catch permission/target DB issues).
        # Note: identifiers can't be safely parameterized, so keep table list static.
        for t in [x.strip() for x in _DATA_TABLES.split(",")]:
            cnt = (await db.execute(text(f"SELECT count(*) FROM {t}"))).scalar_one()
            log.info("Row count after wipe: %s = %s", t, cnt)

    log.info("Wipe complete (all listed tables should be 0).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Clear all study-domain data.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the TRUNCATE statement without executing it.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute the TRUNCATE statement (IRREVERSIBLE).",
    )
    args = parser.parse_args()

    if args.dry_run and args.apply:
        raise SystemExit("Choose exactly one of --dry-run or --apply")
    if not args.dry_run and not args.apply:
        raise SystemExit("Pass --dry-run or --apply")

    asyncio.run(run_wipe(apply=args.apply))


if __name__ == "__main__":
    main()
