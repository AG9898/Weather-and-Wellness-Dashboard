"""Reconcile imported-only participant/session rows against the authoritative workbook.

Participants present in the database but absent from the authoritative workbook
(``reference/data_complete.xlsx``) that carry **only** imported data are reported
in dry-run mode and deleted in apply mode.

Participants whose participant graph contains any *native* survey or digit span row
are always protected and never deleted.

Usage (from backend/):
    PYTHONPATH=. .venv/bin/python -m app.scripts.reconcile_workbook \\
        --file ../reference/data_complete.xlsx --dry-run

    PYTHONPATH=. .venv/bin/python -m app.scripts.reconcile_workbook \\
        --file ../reference/data_complete.xlsx --apply

Machine-readable JSON summary is printed to stdout regardless of mode.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import AsyncContextManager

from sqlalchemy import select, text

from app.db import get_session_factory
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.services.import_service import _get_sessions_with_native_rows, parse_file

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ── Deletion order must respect FK dependency graph ────────────────────────────
# session_ids and p_uuids are passed as PostgreSQL ARRAY literals via :session_ids
# and :p_uuids params so that ANY(:...) works with SQLAlchemy text().

_DELETE_BY_SESSION_SQL: list[str] = [
    # leaf table first: trials → runs
    "DELETE FROM digitspan_trials WHERE run_id IN "
    "(SELECT run_id FROM digitspan_runs WHERE session_id = ANY(:session_ids))",
    "DELETE FROM digitspan_runs WHERE session_id = ANY(:session_ids)",
    "DELETE FROM survey_uls8 WHERE session_id = ANY(:session_ids)",
    "DELETE FROM survey_cesd10 WHERE session_id = ANY(:session_ids)",
    "DELETE FROM survey_gad7 WHERE session_id = ANY(:session_ids)",
    "DELETE FROM survey_cogfunc8a WHERE session_id = ANY(:session_ids)",
    "DELETE FROM imported_session_measures WHERE session_id = ANY(:session_ids)",
    # misokinesia_trial_responses FK → misokinesia_participants
    "DELETE FROM misokinesia_trial_responses WHERE misokinesia_participant_id IN "
    "(SELECT misokinesia_participant_id FROM misokinesia_participants WHERE session_id = ANY(:session_ids))",
    "DELETE FROM misokinesia_participants WHERE session_id = ANY(:session_ids)",
    "DELETE FROM sessions WHERE session_id = ANY(:session_ids)",
]

_DELETE_BY_PARTICIPANT_SQL: list[str] = [
    # Any remaining misokinesia_participants rows keyed to participant (no session)
    "DELETE FROM misokinesia_trial_responses WHERE misokinesia_participant_id IN "
    "(SELECT misokinesia_participant_id FROM misokinesia_participants WHERE participant_uuid = ANY(:p_uuids))",
    "DELETE FROM misokinesia_participants WHERE participant_uuid = ANY(:p_uuids)",
    "DELETE FROM participants WHERE participant_uuid = ANY(:p_uuids)",
]


@dataclass
class ReconciliationResult:
    """Summary of the reconciliation run."""

    mode: str  # "dry-run" | "apply"
    workbook_path: str
    workbook_participant_count: int
    db_participant_count: int
    absent_from_workbook: list[int]       # all pnums in DB but not workbook
    protected_pnums: list[int]            # absent but have native data – not deleted
    would_delete_pnums: list[int]         # absent + imported-only (dry-run)
    deleted_pnums: list[int]              # absent + imported-only (apply)
    sessions_deleted: int
    participants_deleted: int


async def run_reconciliation(
    *,
    file_path: Path,
    apply: bool,
    session_factory: Callable[[], AsyncContextManager[object]] | None = None,
) -> ReconciliationResult:
    """Main reconciliation logic.

    Args:
        file_path: Path to the authoritative workbook.
        apply: When True, execute deletes. When False, dry-run only.
        session_factory: Injected for tests; defaults to the real DB factory.
    """
    mode = "apply" if apply else "dry-run"
    log.info("Reconciliation mode: %s | workbook: %s", mode, file_path)

    # ── 1. Parse workbook participant numbers ──────────────────────────────────
    contents = file_path.read_bytes()
    parse_result = parse_file(contents, file_path.name)
    workbook_pnums: set[int] = {row.participant_number for row in parse_result.rows}
    log.info("Workbook participant count: %d", len(workbook_pnums))

    if parse_result.errors:
        log.warning(
            "Workbook parse produced %d error(s); proceeding with valid rows only.",
            len(parse_result.errors),
        )

    # ── 2. Load all DB participants ────────────────────────────────────────────
    active_sf = session_factory or get_session_factory()
    async with active_sf() as db:
        p_result = await db.execute(
            select(Participant.participant_number, Participant.participant_uuid)
        )
        all_participants: dict[int, uuid.UUID] = {
            row.participant_number: row.participant_uuid for row in p_result.all()
        }
        log.info("DB participant count: %d", len(all_participants))

        absent_pnums: set[int] = set(all_participants.keys()) - workbook_pnums
        log.info(
            "Participants absent from workbook: %d → %s",
            len(absent_pnums),
            sorted(absent_pnums),
        )

        if not absent_pnums:
            log.info("No absent participants found — DB is consistent with workbook.")
            return ReconciliationResult(
                mode=mode,
                workbook_path=str(file_path),
                workbook_participant_count=len(workbook_pnums),
                db_participant_count=len(all_participants),
                absent_from_workbook=[],
                protected_pnums=[],
                would_delete_pnums=[],
                deleted_pnums=[],
                sessions_deleted=0,
                participants_deleted=0,
            )

        absent_p_uuids: list[uuid.UUID] = [all_participants[pnum] for pnum in absent_pnums]

        # ── 3. Get sessions for absent participants ────────────────────────────
        s_result = await db.execute(
            select(SessionModel.session_id, SessionModel.participant_uuid).where(
                SessionModel.participant_uuid.in_(absent_p_uuids)
            )
        )
        session_rows = s_result.all()
        all_session_ids: list[uuid.UUID] = [r.session_id for r in session_rows]
        p_uuid_by_session: dict[uuid.UUID, uuid.UUID] = {
            r.session_id: r.participant_uuid for r in session_rows
        }

        # ── 4. Detect native rows ──────────────────────────────────────────────
        native_session_ids: set[uuid.UUID] = await _get_sessions_with_native_rows(
            db, all_session_ids
        )
        native_p_uuids: set[uuid.UUID] = {
            p_uuid_by_session[sid]
            for sid in native_session_ids
            if sid in p_uuid_by_session
        }

        pnum_by_puuid: dict[uuid.UUID, int] = {v: k for k, v in all_participants.items()}

        protected_pnums: list[int] = sorted(
            pnum_by_puuid[puuid]
            for puuid in absent_p_uuids
            if puuid in native_p_uuids
        )
        delete_p_uuids: list[uuid.UUID] = [
            puuid for puuid in absent_p_uuids if puuid not in native_p_uuids
        ]
        delete_pnums: list[int] = sorted(
            pnum_by_puuid[puuid] for puuid in delete_p_uuids
        )
        delete_session_ids: list[uuid.UUID] = [
            sid
            for sid, puuid in p_uuid_by_session.items()
            if puuid in set(delete_p_uuids)
        ]

        if protected_pnums:
            log.warning(
                "Protected (have native data, will NOT delete): %s",
                protected_pnums,
            )

        if not apply:
            log.info(
                "Dry-run: would delete %d participant(s) and %d session(s): %s",
                len(delete_pnums),
                len(delete_session_ids),
                delete_pnums,
            )
            return ReconciliationResult(
                mode=mode,
                workbook_path=str(file_path),
                workbook_participant_count=len(workbook_pnums),
                db_participant_count=len(all_participants),
                absent_from_workbook=sorted(absent_pnums),
                protected_pnums=protected_pnums,
                would_delete_pnums=delete_pnums,
                deleted_pnums=[],
                sessions_deleted=0,
                participants_deleted=0,
            )

        # ── 5. Apply deletes ───────────────────────────────────────────────────
        if not delete_p_uuids:
            log.info("No imported-only absent participants to delete.")
            return ReconciliationResult(
                mode=mode,
                workbook_path=str(file_path),
                workbook_participant_count=len(workbook_pnums),
                db_participant_count=len(all_participants),
                absent_from_workbook=sorted(absent_pnums),
                protected_pnums=protected_pnums,
                would_delete_pnums=[],
                deleted_pnums=[],
                sessions_deleted=0,
                participants_deleted=0,
            )

        if delete_session_ids:
            for sql in _DELETE_BY_SESSION_SQL:
                await db.execute(text(sql), {"session_ids": delete_session_ids})

        for sql in _DELETE_BY_PARTICIPANT_SQL:
            await db.execute(text(sql), {"p_uuids": delete_p_uuids})

        sessions_deleted = len(delete_session_ids)
        participants_deleted = len(delete_p_uuids)

        await db.commit()
        log.info(
            "Apply complete: deleted %d participant(s) (%s) and %d session(s).",
            participants_deleted,
            delete_pnums,
            sessions_deleted,
        )

        return ReconciliationResult(
            mode=mode,
            workbook_path=str(file_path),
            workbook_participant_count=len(workbook_pnums),
            db_participant_count=len(all_participants),
            absent_from_workbook=sorted(absent_pnums),
            protected_pnums=protected_pnums,
            would_delete_pnums=[],
            deleted_pnums=delete_pnums,
            sessions_deleted=sessions_deleted,
            participants_deleted=participants_deleted,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Reconcile imported-only participant/session rows against the "
            "authoritative workbook. Reports or removes rows absent from the workbook."
        )
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to the authoritative workbook (e.g. ../reference/data_complete.xlsx).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report imported-only absent rows without deleting anything.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete imported-only absent participant/session rows from the database.",
    )
    args = parser.parse_args()

    if args.dry_run and args.apply:
        raise SystemExit("Choose exactly one of --dry-run or --apply.")
    if not args.dry_run and not args.apply:
        raise SystemExit("Pass --dry-run or --apply.")

    result = asyncio.run(
        run_reconciliation(
            file_path=Path(args.file).expanduser().resolve(),
            apply=args.apply,
        )
    )
    print(json.dumps(asdict(result), indent=2, default=str))
    raise SystemExit(0)


if __name__ == "__main__":
    main()
