"""Undo Last Session — backend service (T96).

Provides two public functions:

    get_last_native_session(db) -> SessionCandidateInfo | None
        Return metadata about the most recently created native session that
        is eligible for undo, or None if no such session exists.

    delete_last_native_session(db, deleter_id, reason) -> UndoDeleteResult
        Transactionally delete the most recently created native session plus all
        its dependent rows, optionally delete the participant if they have no
        other sessions, and write an append-only audit row.

A "native" session is any session that does NOT have a corresponding row in
`imported_session_measures` — imported legacy sessions are excluded.

Deletion order (FK-safe):
    1. digitspan_trials (FK → digitspan_runs)
    2. digitspan_runs   (FK → sessions)
    3. survey_uls8      (FK → sessions)
    4. survey_cesd10    (FK → sessions)
    5. survey_gad7      (FK → sessions)
    6. survey_cogfunc8a (FK → sessions)
    7. imported_session_measures (FK → sessions; should not exist for native
       sessions but included defensively)
    8. sessions
    9. participants (only when no other sessions remain)
   10. admin_session_undo_log  ← audit row appended last within the transaction

Weather-domain tables (weather_daily, weather_ingest_runs, study_days) are
never touched.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.digitspan import DigitSpanRun, DigitSpanTrial
from app.models.imported_session_measures import ImportedSessionMeasures
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.models.surveys import SurveyCESD10, SurveyCogFunc8a, SurveyGAD7, SurveyULS8
from app.models.undo import AdminSessionUndoLog


@dataclass
class SessionCandidateInfo:
    """Metadata about the undo-eligible native session."""

    session_id: uuid.UUID
    participant_uuid: uuid.UUID
    participant_number: int
    status: str
    created_at: object  # datetime; kept as Any to avoid import complexity


@dataclass
class UndoDeleteResult:
    """Summary of what was removed by delete_last_native_session."""

    deleted_session_id: uuid.UUID
    deleted_participant_uuid: uuid.UUID
    deleted_participant_number: int
    session_status_at_delete: str
    participant_deleted: bool


async def get_last_native_session(
    db: AsyncSession,
) -> SessionCandidateInfo | None:
    """Return metadata for the most recently created native session, or None.

    A session is native when it has no `imported_session_measures` row.
    """
    # Subquery: session IDs that have an imported_session_measures row
    imported_ids_sq = select(ImportedSessionMeasures.session_id).scalar_subquery()

    stmt = (
        select(
            SessionModel.session_id,
            SessionModel.participant_uuid,
            SessionModel.status,
            SessionModel.created_at,
            Participant.participant_number,
        )
        .join(Participant, Participant.participant_uuid == SessionModel.participant_uuid)
        .where(SessionModel.session_id.not_in(imported_ids_sq))
        .order_by(SessionModel.created_at.desc())
        .limit(1)
    )

    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return None

    return SessionCandidateInfo(
        session_id=row.session_id,
        participant_uuid=row.participant_uuid,
        participant_number=row.participant_number,
        status=row.status,
        created_at=row.created_at,
    )


async def delete_last_native_session(
    db: AsyncSession,
    deleter_id: uuid.UUID,
    reason: str | None,
) -> UndoDeleteResult:
    """Transactionally delete the last native session and write an audit row.

    Raises:
        HTTPException 404 — no eligible native session exists.
        HTTPException 500 — unexpected failure; partial state is rolled back.
    """
    candidate = await get_last_native_session(db)
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No eligible native session found to undo.",
        )

    session_id = candidate.session_id
    participant_uuid = candidate.participant_uuid
    participant_number = candidate.participant_number
    session_status = candidate.status

    # --- Delete dependent rows in FK-safe order ----------------------------

    # 1. digitspan_trials (via run_id in digitspan_runs)
    run_id_sq = (
        select(DigitSpanRun.run_id)
        .where(DigitSpanRun.session_id == session_id)
        .scalar_subquery()
    )
    await db.execute(
        delete(DigitSpanTrial).where(DigitSpanTrial.run_id.in_(run_id_sq))
    )

    # 2. digitspan_runs
    await db.execute(
        delete(DigitSpanRun).where(DigitSpanRun.session_id == session_id)
    )

    # 3–6. Survey tables
    await db.execute(delete(SurveyULS8).where(SurveyULS8.session_id == session_id))
    await db.execute(
        delete(SurveyCESD10).where(SurveyCESD10.session_id == session_id)
    )
    await db.execute(delete(SurveyGAD7).where(SurveyGAD7.session_id == session_id))
    await db.execute(
        delete(SurveyCogFunc8a).where(SurveyCogFunc8a.session_id == session_id)
    )

    # 7. imported_session_measures (defensive; native sessions should not have one)
    await db.execute(
        delete(ImportedSessionMeasures).where(
            ImportedSessionMeasures.session_id == session_id
        )
    )

    # 8. sessions row
    await db.execute(
        delete(SessionModel).where(SessionModel.session_id == session_id)
    )

    # 9. Participant — only if no other sessions remain
    remaining_count_result = await db.execute(
        select(func.count()).where(
            SessionModel.participant_uuid == participant_uuid
        )
    )
    remaining = remaining_count_result.scalar_one()
    participant_deleted = remaining == 0
    if participant_deleted:
        await db.execute(
            delete(Participant).where(Participant.participant_uuid == participant_uuid)
        )

    # 10. Audit row (append-only; written inside the same transaction)
    audit_row = AdminSessionUndoLog(
        undo_id=uuid.uuid4(),
        deleted_session_id=session_id,
        deleted_participant_uuid=participant_uuid,
        deleted_participant_number=participant_number,
        session_status_at_delete=session_status,
        deleted_by_lab_member_id=deleter_id,
        reason=reason,
    )
    db.add(audit_row)

    await db.commit()

    return UndoDeleteResult(
        deleted_session_id=session_id,
        deleted_participant_uuid=participant_uuid,
        deleted_participant_number=participant_number,
        session_status_at_delete=session_status,
        participant_deleted=participant_deleted,
    )
