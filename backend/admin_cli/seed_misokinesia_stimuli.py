#!/usr/bin/env python3
"""Seed script: insert one misokinesia_test_sets row and 29 misokinesia_stimuli rows.

Safe to re-run: skips insertion if an active test set already exists.

Usage (run from repo root or backend/):
    python backend/admin_cli/seed_misokinesia_stimuli.py

Required env var (loaded from backend/.env or root .env):
    DATABASE_URL  PostgreSQL connection URL (any supported prefix)
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
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


# ── 29 production stimuli ───────────────────────────────────────────────────
# File names and durations come from reference/labs/Misokinesia/videos_on_site.
# storage_path matches the object key uploaded to the public Supabase bucket.
STIMULI: list[dict[str, int | str]] = [
    {"sort_order": 1, "filename": "ankleWagging.mp4", "duration_ms": 15191},
    {"sort_order": 2, "filename": "armRubbing.mp4", "duration_ms": 15060},
    {"sort_order": 3, "filename": "articulatedToy.mp4", "duration_ms": 15034},
    {"sort_order": 4, "filename": "blinking.mp4", "duration_ms": 15067},
    {"sort_order": 5, "filename": "bobblehead.mp4", "duration_ms": 15100},
    {"sort_order": 6, "filename": "chewing.mp4", "duration_ms": 15039},
    {"sort_order": 7, "filename": "chewingExaggerated.mp4", "duration_ms": 15039},
    {"sort_order": 8, "filename": "chimes.mp4", "duration_ms": 15334},
    {"sort_order": 9, "filename": "chinScratching.mp4", "duration_ms": 15060},
    {"sort_order": 10, "filename": "clothing.mp4", "duration_ms": 15039},
    {"sort_order": 11, "filename": "fan.mp4", "duration_ms": 15100},
    {"sort_order": 12, "filename": "fingerRolling.mp4", "duration_ms": 15060},
    {"sort_order": 13, "filename": "fingerTapping.mp4", "duration_ms": 15060},
    {"sort_order": 14, "filename": "footTapping.mp4", "duration_ms": 15570},
    {"sort_order": 15, "filename": "gesturing.mp4", "duration_ms": 15060},
    {"sort_order": 16, "filename": "hairTwirling.mp4", "duration_ms": 33834},
    {"sort_order": 17, "filename": "handRubbing.mp4", "duration_ms": 15060},
    {"sort_order": 18, "filename": "headScratching.mp4", "duration_ms": 15060},
    {"sort_order": 19, "filename": "heelTapping.mp4", "duration_ms": 17067},
    {"sort_order": 20, "filename": "intentionalGestures.mp4", "duration_ms": 15060},
    {"sort_order": 21, "filename": "jewlery.mp4", "duration_ms": 19067},
    {"sort_order": 22, "filename": "luckyCat.mp4", "duration_ms": 15134},
    {"sort_order": 23, "filename": "metronome.mp4", "duration_ms": 15167},
    {"sort_order": 24, "filename": "nailPicking.mp4", "duration_ms": 15060},
    {"sort_order": 25, "filename": "neckRubbing.mp4", "duration_ms": 15060},
    {"sort_order": 26, "filename": "penClicking.mp4", "duration_ms": 15060},
    {"sort_order": 27, "filename": "penSpinning.mp4", "duration_ms": 15060},
    {"sort_order": 28, "filename": "signLanguage.mp4", "duration_ms": 15060},
    {"sort_order": 29, "filename": "wristRotation.mp4", "duration_ms": 15060},
]


def _to_asyncpg_dsn(url: str) -> str:
    """Strip SQLAlchemy driver prefix so asyncpg can accept the DSN."""
    for prefix, replacement in [
        ("postgresql+asyncpg://", "postgresql://"),
        ("postgres+asyncpg://", "postgresql://"),
        ("postgres://", "postgresql://"),
    ]:
        if url.startswith(prefix):
            return replacement + url[len(prefix):]
    return url


async def main() -> None:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        print("ERROR: DATABASE_URL env var is not set.", file=sys.stderr)
        sys.exit(1)

    dsn = _to_asyncpg_dsn(raw_url)

    # asyncpg doesn't support ?ssl=require query param — convert to SSL arg
    ssl: object = False
    if "?ssl=require" in dsn:
        dsn = dsn.replace("?ssl=require", "")
        ssl = "require"
    elif "&ssl=require" in dsn:
        dsn = dsn.replace("&ssl=require", "")
        ssl = "require"

    print(f"Connecting to database…")
    conn = await asyncpg.connect(dsn=dsn, ssl=ssl)

    try:
        stimuli_by_order = {
            int(s["sort_order"]): s
            for s in STIMULI
        }

        # Check for existing active test set
        existing = await conn.fetchval(
            "SELECT test_set_id FROM misokinesia_test_sets WHERE active = true LIMIT 1"
        )
        if existing:
            existing_rows = await conn.fetch(
                """
                SELECT stimulus_id, sort_order, storage_path, filename, duration_ms
                FROM misokinesia_stimuli
                WHERE test_set_id = $1
                ORDER BY sort_order
                """,
                existing,
            )
            if len(existing_rows) != len(STIMULI):
                print(
                    "ERROR: Active test set exists but does not contain the expected "
                    f"{len(STIMULI)} stimuli rows (found {len(existing_rows)}).",
                    file=sys.stderr,
                )
                sys.exit(1)

            changed_rows = 0
            async with conn.transaction():
                for row in existing_rows:
                    expected = stimuli_by_order.get(row["sort_order"])
                    if expected is None:
                        print(
                            "ERROR: Active test set contains an unexpected sort_order "
                            f"value ({row['sort_order']}).",
                            file=sys.stderr,
                        )
                        sys.exit(1)

                    expected_filename = str(expected["filename"])
                    expected_duration = int(expected["duration_ms"])
                    if (
                        row["storage_path"] == expected_filename
                        and row["filename"] == expected_filename
                        and row["duration_ms"] == expected_duration
                    ):
                        continue

                    await conn.execute(
                        """
                        UPDATE misokinesia_stimuli
                        SET storage_path = $2,
                            filename = $2,
                            duration_ms = $3
                        WHERE stimulus_id = $1
                        """,
                        row["stimulus_id"],
                        expected_filename,
                        expected_duration,
                    )
                    changed_rows += 1

            print(
                f"Active test set already exists (id={existing}, {len(existing_rows)} stimuli). "
                f"Synchronized {changed_rows} stimulus rows."
            )
            return

        test_set_id = uuid.uuid4()

        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO misokinesia_test_sets
                    (test_set_id, name, version, description, active)
                VALUES ($1, $2, $3, $4, true)
                """,
                test_set_id,
                "v1",
                "1.0",
                "Initial misokinesia stimulus set (29 clips, ~15 s each).",
            )
            print(f"Inserted test set: {test_set_id}")

            for s in STIMULI:
                await conn.execute(
                    """
                    INSERT INTO misokinesia_stimuli
                        (stimulus_id, test_set_id, storage_path, filename,
                         duration_ms, mime_type, sort_order, active)
                    VALUES ($1, $2, $3, $4, $5, 'video/mp4', $6, true)
                    """,
                    uuid.uuid4(),
                    test_set_id,
                    s["filename"],   # storage_path = filename (bucket root)
                    s["filename"],
                    s["duration_ms"],
                    s["sort_order"],
                )
            print(f"Inserted {len(STIMULI)} stimuli (sort_order 1–{len(STIMULI)}).")

        print("Done. Seed complete.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
