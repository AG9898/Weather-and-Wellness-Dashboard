#!/usr/bin/env python3
"""Wipe all misokinesia participant data from the database.

Deletes all rows from:
  - misokinesia_trial_responses
  - misokinesia_participants
  - sessions (only those created for misokinesia participants)
  - participants (only those created for misokinesia participants)

Does NOT touch misokinesia_test_sets or misokinesia_stimuli (seed data).
Resets misokinesia_participant_number_seq back to 1.

Usage (run from repo root or backend/):
    python backend/admin_cli/wipe_misokinesia_participants.py

Pass --confirm to skip the interactive prompt:
    python backend/admin_cli/wipe_misokinesia_participants.py --confirm

Required env var (loaded from backend/.env or repo root .env):
    DATABASE_URL  PostgreSQL connection URL
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Load .env — try backend/.env first, then repo root .env
for _dotenv_path in [
    Path(__file__).parent.parent / ".env",
    Path(__file__).parent.parent.parent / ".env",
]:
    if _dotenv_path.exists():
        from dotenv import load_dotenv
        load_dotenv(_dotenv_path, override=False)
        break

try:
    import asyncpg
except ImportError:
    print("ERROR: asyncpg not installed. Run: pip install asyncpg", file=sys.stderr)
    sys.exit(1)


def _to_asyncpg_dsn(url: str) -> tuple[str, object]:
    """Strip SQLAlchemy driver prefix and extract ssl arg for asyncpg."""
    for prefix, replacement in [
        ("postgresql+asyncpg://", "postgresql://"),
        ("postgres+asyncpg://", "postgresql://"),
        ("postgres://", "postgresql://"),
    ]:
        if url.startswith(prefix):
            url = replacement + url[len(prefix):]
            break

    ssl: object = False
    if "?ssl=require" in url:
        url = url.replace("?ssl=require", "")
        ssl = "require"
    elif "&ssl=require" in url:
        url = url.replace("&ssl=require", "")
        ssl = "require"

    return url, ssl


async def main(confirmed: bool) -> None:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        print("ERROR: DATABASE_URL env var is not set.", file=sys.stderr)
        sys.exit(1)

    dsn, ssl = _to_asyncpg_dsn(raw_url)

    print("Connecting to database…")
    conn = await asyncpg.connect(dsn=dsn, ssl=ssl)

    try:
        # Preview counts before wiping
        responses = await conn.fetchval("SELECT COUNT(*) FROM misokinesia_trial_responses")
        participants = await conn.fetchval("SELECT COUNT(*) FROM misokinesia_participants")
        print(f"Found {participants} misokinesia_participants, {responses} misokinesia_trial_responses.")

        if participants == 0 and responses == 0:
            print("Nothing to wipe. Exiting.")
            return

        if not confirmed:
            answer = input("Wipe all misokinesia participant data? This cannot be undone. [y/N] ").strip().lower()
            if answer != "y":
                print("Aborted.")
                return

        async with conn.transaction():
            # 1. Capture the UUIDs we need to clean up in shared tables
            miso_ids = await conn.fetch(
                "SELECT DISTINCT participant_uuid, session_id FROM misokinesia_participants"
            )
            session_ids = [r["session_id"] for r in miso_ids]
            participant_uuids = [r["participant_uuid"] for r in miso_ids]

            # 2. Misokinesia leaf tables
            deleted_responses = await conn.fetchval(
                "WITH d AS (DELETE FROM misokinesia_trial_responses WHERE session_id = ANY($1::uuid[]) RETURNING 1) SELECT COUNT(*) FROM d",
                session_ids,
            )
            deleted_participants = await conn.fetchval(
                "WITH d AS (DELETE FROM misokinesia_participants RETURNING 1) SELECT COUNT(*) FROM d"
            )

            # 3. Digitspan (trials before runs due to FK)
            await conn.execute(
                "DELETE FROM digitspan_trials WHERE run_id IN (SELECT run_id FROM digitspan_runs WHERE session_id = ANY($1::uuid[]))",
                session_ids,
            )
            await conn.execute(
                "DELETE FROM digitspan_runs WHERE session_id = ANY($1::uuid[])",
                session_ids,
            )

            # 4. Surveys
            for table in ("survey_uls8", "survey_cesd10", "survey_gad7", "survey_cogfunc8a"):
                await conn.execute(
                    f"DELETE FROM {table} WHERE session_id = ANY($1::uuid[])",
                    session_ids,
                )

            # 5. Imported measures
            await conn.execute(
                "DELETE FROM imported_session_measures WHERE session_id = ANY($1::uuid[])",
                session_ids,
            )

            # 6. Shared tables
            deleted_sessions = await conn.fetchval(
                "WITH d AS (DELETE FROM sessions WHERE session_id = ANY($1::uuid[]) RETURNING 1) SELECT COUNT(*) FROM d",
                session_ids,
            )
            deleted_p = await conn.fetchval(
                "WITH d AS (DELETE FROM participants WHERE participant_uuid = ANY($1::uuid[]) RETURNING 1) SELECT COUNT(*) FROM d",
                participant_uuids,
            )

            # 7. Reset the participant number sequence
            await conn.execute("ALTER SEQUENCE misokinesia_participant_number_seq RESTART WITH 1")

        print(
            f"Wiped: {deleted_responses} trial responses, "
            f"{deleted_participants} misokinesia_participants, "
            f"{deleted_sessions} sessions, "
            f"{deleted_p} participants."
        )
        print("Sequence misokinesia_participant_number_seq reset to 1.")
        print("Done.")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe all misokinesia participant data.")
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Skip the interactive confirmation prompt.",
    )
    args = parser.parse_args()
    asyncio.run(main(confirmed=args.confirm))
