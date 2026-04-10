"""Manual legacy workbook import runner for preview/commit/cross-check workflows.

Usage (from backend/):
    PYTHONPATH=. .venv/bin/python -m app.scripts.legacy_import --file ../reference/data_complete.xlsx
    PYTHONPATH=. .venv/bin/python -m app.scripts.legacy_import --file ../reference/data_complete.xlsx --commit
    PYTHONPATH=. .venv/bin/python -m app.scripts.legacy_import --file ../reference/data_complete.xlsx --cross-check
    PYTHONPATH=. .venv/bin/python -m app.scripts.legacy_import --file ../reference/data_complete.xlsx --cross-check --reference-file ../reference/data_full_1-230.xlsx
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import HTTPException

from app.db import get_session_factory
from app.services.import_service import ParseResult, commit_import, parse_file, preview_import

if TYPE_CHECKING:
    pass

# ── Cross-check constants ──────────────────────────────────────────────────────

_PARTICIPANT_Z_PAIRS: list[tuple[str, str]] = [
    ("anxiety_mean", "anxiety_z"),
    ("loneliness_mean", "loneliness_z"),
    ("depression_mean", "depression_z"),
    ("self_report", "self_report_z"),
    ("digit_span_legacy_score", "digit_span_z"),
]

_WEATHER_Z_COLS: tuple[str, ...] = ("precipitation_z", "temperature_z", "daylight_z")

_Z_TOLERANCE = 0.001  # absolute tolerance for z-score floating-point comparison


# ── Z-score helper ─────────────────────────────────────────────────────────────

def _sample_z_scores(values: list[float]) -> list[float]:
    """Return sample z-scores (ddof=1) for a list of float values."""
    n = len(values)
    if n < 2:
        return [0.0] * n
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / (n - 1)
    std = math.sqrt(variance) if variance > 0 else 0.0
    if std == 0.0:
        return [0.0] * n
    return [(v - mean) / std for v in values]


# ── Cross-check report ─────────────────────────────────────────────────────────

def run_cross_check(
    primary: ParseResult,
    reference: ParseResult | None,
    *,
    primary_name: str,
    reference_name: str | None,
) -> int:
    """Print a read-only verification report. Returns 0 if all checks pass, 1 otherwise."""
    exit_code = 0

    print(f"=== Cross-check: {primary_name} ===")
    if primary.errors:
        print(f"  PARSE ERRORS ({len(primary.errors)}) — results may be incomplete:")
        for e in primary.errors:
            print(f"    row={e.row} field={e.field!r}: {e.message}")
        exit_code = 1

    primary_keys = {(r.participant_number, r.date_local) for r in primary.rows}
    print(f"  Primary rows: {len(primary.rows)}, unique participant-date keys: {len(primary_keys)}")

    # ── Key overlap (only when reference is provided) ─────────────────────────
    if reference is not None and reference_name is not None:
        print(f"\n--- Key overlap: {primary_name}  vs  {reference_name} ---")
        if reference.errors:
            print(f"  PARSE ERRORS in reference ({len(reference.errors)}) — overlap may be incomplete")
            exit_code = 1
        ref_keys = {(r.participant_number, r.date_local) for r in reference.rows}
        print(f"  Reference rows: {len(reference.rows)}, unique keys: {len(ref_keys)}")
        only_primary = sorted(primary_keys - ref_keys)
        only_reference = sorted(ref_keys - primary_keys)
        in_both = len(primary_keys & ref_keys)
        print(f"  In both:           {in_both}")
        print(f"  Only in primary:   {len(only_primary)}")
        print(f"  Only in reference: {len(only_reference)}")
        if only_primary:
            sample = only_primary[:5]
            print(f"    Examples (primary-only): {sample}")
        if only_reference:
            sample = only_reference[:5]
            print(f"    Examples (reference-only): {sample}")

    # ── Participant z-score parity ────────────────────────────────────────────
    print("\n--- Participant z-score parity ---")
    any_z_mismatch = False
    for raw_field, z_col in _PARTICIPANT_Z_PAIRS:
        indexed_vals: list[tuple[int, float]] = []
        for i, row in enumerate(primary.rows):
            v = getattr(row, raw_field)
            if v is not None:
                indexed_vals.append((i, float(v)))

        if not indexed_vals:
            print(f"  {z_col:<20s}: no data")
            continue

        indices, raw_vals = zip(*indexed_vals)
        computed = _sample_z_scores(list(raw_vals))
        computed_by_index = dict(zip(indices, computed))

        n_checked = 0
        n_match = 0
        n_mismatch = 0
        n_missing_wb = 0
        max_diff = 0.0

        for idx, z_computed in computed_by_index.items():
            row = primary.rows[idx]
            z_wb = row.supplemental_attributes_json.get(z_col)
            if z_wb is None:
                n_missing_wb += 1
                continue
            n_checked += 1
            diff = abs(z_computed - float(z_wb))
            max_diff = max(max_diff, diff)
            if diff <= _Z_TOLERANCE:
                n_match += 1
            else:
                n_mismatch += 1

        if n_mismatch > 0:
            any_z_mismatch = True
            exit_code = 1
            status_str = f"MISMATCH ({n_mismatch}/{n_checked} rows differ)"
        elif n_checked == 0:
            status_str = f"workbook z absent — computed only ({len(indexed_vals)} raw values)"
        else:
            status_str = f"OK ({n_match}/{n_checked})"

        print(f"  {z_col:<20s}: {status_str}  max_diff={max_diff:.6f}  missing_wb={n_missing_wb}")

    if not any_z_mismatch:
        print("  Participant z-scores: PASS")

    # ── Weather z-scores (informational) ─────────────────────────────────────
    print("\n--- Weather z-scores (informational) ---")
    print("  NOTE: workbook weather z-scores (precipitation_z, temperature_z, daylight_z)")
    print("  are NOT expected to match backend analytics z-scores.")
    print("  Backend uses unique-day weather standardization; workbook uses row-level")
    print("  standardization across all participants. Divergence is expected and correct.")
    present: list[str] = []
    for col in _WEATHER_Z_COLS:
        count = sum(
            1 for r in primary.rows
            if r.supplemental_attributes_json.get(col) is not None
        )
        if count:
            present.append(f"{col}({count} rows)")
    if present:
        print(f"  Workbook weather z columns present: {', '.join(present)}")
    else:
        print("  No weather z columns found in workbook.")

    return exit_code


def _print_issues(label: str, issues: list[object]) -> None:
    if not issues:
        return
    print(f"{label}:")
    for issue in issues:
        row = getattr(issue, "row", None)
        field = getattr(issue, "field", None)
        message = getattr(issue, "message", None)
        print(f"  row={row} field={field!r} message={message}")


async def main(
    *,
    file_path: Path,
    commit: bool,
    cross_check: bool,
    reference_file_path: Path | None,
) -> int:
    contents = file_path.read_bytes()
    parse_result = parse_file(contents, file_path.name)

    if cross_check:
        reference_result: ParseResult | None = None
        reference_name: str | None = None
        if reference_file_path is not None:
            ref_contents = reference_file_path.read_bytes()
            reference_result = parse_file(ref_contents, reference_file_path.name)
            reference_name = reference_file_path.name
        return run_cross_check(
            parse_result,
            reference_result,
            primary_name=file_path.name,
            reference_name=reference_name,
        )

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
        description="Preview, commit, or cross-check a legacy XLSX/CSV import."
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to the primary legacy workbook or CSV.",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Write the import transactionally instead of running preview mode.",
    )
    parser.add_argument(
        "--cross-check",
        action="store_true",
        dest="cross_check",
        help=(
            "Read-only verification: recompute workbook z-scores and report parity. "
            "Does not require a database connection."
        ),
    )
    parser.add_argument(
        "--reference-file",
        dest="reference_file",
        help="Optional second workbook to compare participant-date keys against.",
    )
    args = parser.parse_args()
    raise SystemExit(
        asyncio.run(
            main(
                file_path=Path(args.file).expanduser().resolve(),
                commit=args.commit,
                cross_check=args.cross_check,
                reference_file_path=(
                    Path(args.reference_file).expanduser().resolve()
                    if args.reference_file
                    else None
                ),
            )
        )
    )
