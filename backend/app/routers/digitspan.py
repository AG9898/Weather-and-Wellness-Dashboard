from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import DigitSpanRun, DigitSpanTrial, Session as SessionModel
from app.schemas.digitspan import DigitSpanRunCreate, DigitSpanRunResponse
from app.scoring.digitspan import TrialInput, score

router = APIRouter(prefix="/digitspan", tags=["digitspan"])


@router.post("/runs", response_model=DigitSpanRunResponse, status_code=status.HTTP_201_CREATED)
async def create_digitspan_run(
    payload: DigitSpanRunCreate,
    db: AsyncSession = Depends(get_session),
) -> DigitSpanRunResponse:
    # Validate session exists and is active
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == payload.session_id)
    )
    session_obj = result.scalar_one_or_none()
    if session_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    if session_obj.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session is not active",
        )

    # Score the trials
    trial_inputs = [
        TrialInput(
            trial_number=t.trial_number,
            span_length=t.span_length,
            sequence_shown=t.sequence_shown,
            sequence_entered=t.sequence_entered,
            correct=t.correct,
        )
        for t in payload.trials
    ]
    scored = score(trial_inputs)

    # Persist run
    run = DigitSpanRun(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        total_correct=scored.total_correct,
        max_span=scored.max_span,
    )
    db.add(run)
    await db.flush()  # get run.run_id for FK

    # Persist trials
    for t in payload.trials:
        trial = DigitSpanTrial(
            run_id=run.run_id,
            trial_number=t.trial_number,
            span_length=t.span_length,
            sequence_shown=t.sequence_shown,
            sequence_entered=t.sequence_entered,
            correct=t.correct,
        )
        db.add(trial)

    await db.commit()
    await db.refresh(run)
    return DigitSpanRunResponse.model_validate(run)
