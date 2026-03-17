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


# ── 29 placeholder stimuli ──────────────────────────────────────────────────
# duration_ms values are approximate; update once real files are measured.
# All clips are ~15 s; the longest known clip is ~33 s (assigned to clip_19).
STIMULI: list[dict] = [
    {"sort_order": i, "filename": f"clip_{i:02d}.mp4", "duration_ms": 15000}
    for i in range(1, 30)
]
# Mark the longest clip (position 19 per study materials)
STIMULI[18]["duration_ms"] = 33000


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
        # Check for existing active test set
        existing = await conn.fetchval(
            "SELECT test_set_id FROM misokinesia_test_sets WHERE active = true LIMIT 1"
        )
        if existing:
            stimulus_count = await conn.fetchval(
                "SELECT COUNT(*) FROM misokinesia_stimuli WHERE test_set_id = $1",
                existing,
            )
            print(
                f"Active test set already exists (id={existing}, "
                f"{stimulus_count} stimuli). Nothing to do."
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
