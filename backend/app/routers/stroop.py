from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Session as SessionModel, StroopRun, StroopTrial
from app.schemas.cognitive import StroopRunCreate, StroopRunResponse
from app.scoring.stroop import TrialInput, score

router = APIRouter(prefix="/stroop", tags=["stroop"])


@router.post(
    "/runs",
    response_model=StroopRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_stroop_run(
    payload: StroopRunCreate,
    db: AsyncSession = Depends(get_session),
) -> StroopRunResponse:
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

    # Reject duplicate run for this session (one run per session)
    existing = await db.execute(
        select(StroopRun.run_id).where(StroopRun.session_id == payload.session_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A Stroop run already exists for this session",
        )

    # Recompute correctness and all metrics server-side
    trial_inputs = [
        TrialInput(
            trial_number=t.trial_number,
            condition=t.condition,
            word=t.word,
            ink_color=t.ink_color,
            response_key=t.response_key,
            response_color=t.response_color,
            reaction_time_ms=t.reaction_time_ms,
            timed_out=t.timed_out,
        )
        for t in payload.trials
    ]
    scored = score(trial_inputs)

    # Persist run
    run = StroopRun(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        total_trials=scored.total_trials,
        correct_trials=scored.correct_trials,
        error_trials=scored.error_trials,
        timeout_trials=scored.timeout_trials,
        overall_accuracy=scored.overall_accuracy,
        congruent_accuracy=scored.congruent_accuracy,
        incongruent_accuracy=scored.incongruent_accuracy,
        mean_rt_congruent_ms=scored.mean_rt_congruent_ms,
        mean_rt_incongruent_ms=scored.mean_rt_incongruent_ms,
        stroop_interference_ms=scored.stroop_interference_ms,
    )
    db.add(run)
    await db.flush()  # get run.run_id for FK

    # Persist scored trials with backend-computed correctness
    for scored_trial in scored.trials:
        db.add(
            StroopTrial(
                run_id=run.run_id,
                trial_number=scored_trial.trial_number,
                condition=scored_trial.condition,
                word=scored_trial.word,
                ink_color=scored_trial.ink_color,
                response_key=scored_trial.response_key,
                response_color=scored_trial.response_color,
                correct=scored_trial.correct,
                reaction_time_ms=scored_trial.reaction_time_ms,
                timed_out=scored_trial.timed_out,
            )
        )

    await db.commit()
    await db.refresh(run)
    return StroopRunResponse.model_validate(run)
