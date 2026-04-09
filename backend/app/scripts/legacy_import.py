"""Manual legacy workbook import runner for preview/commit workflows.

Usage (from backend/):
    PYTHONPATH=. .venv/bin/python -m app.scripts.legacy_import --file ../reference/data_complete.xlsx
    PYTHONPATH=. .venv/bin/python -m app.scripts.legacy_import --file ../reference/data_complete.xlsx --commit
"""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from fastapi import HTTPException

from app.db import get_session_factory
from app.services.import_service import commit_import, parse_file, preview_import


def _print_issues(label: str, issues: list[object]) -> None:
    if not issues:
        return
    print(f"{label}:")
    for issue in issues:
        row = getattr(issue, "row", None)
        field = getattr(issue, "field", None)
        message = getattr(issue, "message", None)
        print(f"  row={row} field={field!r} message={message}")


async def main(*, file_path: Path, commit: bool) -> int:
    contents = file_path.read_bytes()
    parse_result = parse_file(contents, file_path.name)

    async with get_session_factory()() as db:
        if commit:
            try:
                result = await commit_import(parse_result, db)
            except HTTPException as exc:
                print(f"Commit failed with HTTP {exc.status_code}")
                print(json.dumps(exc.detail, indent=2, default=str))
                return 1

            print("Commit complete:")
            print(
                json.dumps(
                    {
                        "rows_total": result.rows_total,
                        "participants_created": result.participants_created,
                        "participants_updated": result.participants_updated,
                        "sessions_created": result.sessions_created,
                        "sessions_updated": result.sessions_updated,
                    },
                    indent=2,
                    default=str,
                )
            )
            return 0

        result = await preview_import(parse_result, db)
        print("Preview summary:")
        print(
            json.dumps(
                {
                    "file_type": result.file_type,
                    "rows_total": result.rows_total,
                    "participants_create": result.participants_create,
                    "participants_update": result.participants_update,
                    "sessions_create": result.sessions_create,
                    "sessions_update": result.sessions_update,
                },
                indent=2,
                default=str,
            )
        )
        _print_issues("Errors", result.errors)
        _print_issues("Warnings", result.warnings)
        return 1 if result.errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Preview or commit a legacy XLSX/CSV import against the current database."
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to the legacy workbook or CSV to import.",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Write the import transactionally instead of running preview mode.",
    )
    args = parser.parse_args()
    raise SystemExit(
        asyncio.run(
            main(
                file_path=Path(args.file).expanduser().resolve(),
                commit=args.commit,
            )
        )
    )
