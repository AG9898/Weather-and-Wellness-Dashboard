from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import CardSortingRun, CardSortingTrial, Session as SessionModel
from app.schemas.cognitive import CardSortingRunCreate, CardSortingRunResponse
from app.scoring.card_sorting import CardSortingScoringError, TrialInput, score

router = APIRouter(prefix="/card-sorting", tags=["card-sorting"])


@router.post(
    "/runs",
    response_model=CardSortingRunResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_card_sorting_run(
    payload: CardSortingRunCreate,
    db: AsyncSession = Depends(get_session),
) -> CardSortingRunResponse:
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

    rule_order = session_obj.card_sorting_rule_order
    if not rule_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session has no stored card sorting rule order",
        )

    # Reject duplicate run for this session (one run per session)
    existing = await db.execute(
        select(CardSortingRun.run_id).where(
            CardSortingRun.session_id == payload.session_id
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A card sorting run already exists for this session",
        )

    # Recompute correctness, streaks, shifts, and all metrics server-side
    # against the stored hidden rule order.
    trial_inputs = [
        TrialInput(
            trial_number=t.trial_number,
            card_color=t.card_color,
            card_shape=t.card_shape,
            card_number=t.card_number,
            selected_reference_index=t.selected_reference_index,
            reaction_time_ms=t.reaction_time_ms,
        )
        for t in payload.trials
    ]
    try:
        scored = score(trial_inputs, list(rule_order))
    except CardSortingScoringError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc

    run = CardSortingRun(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        rule_order=list(rule_order),
        total_trials=scored.total_trials,
        categories_completed=scored.categories_completed,
        total_correct=scored.total_correct,
        total_errors=scored.total_errors,
        perseverative_responses=scored.perseverative_responses,
        perseverative_errors=scored.perseverative_errors,
        nonperseverative_errors=scored.nonperseverative_errors,
        trials_to_first_category=scored.trials_to_first_category,
        failure_to_maintain_set_count=scored.failure_to_maintain_set_count,
    )
    db.add(run)
    await db.flush()  # get run.run_id for FK

    for scored_trial in scored.trials:
        db.add(
            CardSortingTrial(
                run_id=run.run_id,
                trial_number=scored_trial.trial_number,
                category_index=scored_trial.category_index,
                active_rule=scored_trial.active_rule,
                previous_rule=scored_trial.previous_rule,
                card_color=scored_trial.card_color,
                card_shape=scored_trial.card_shape,
                card_number=scored_trial.card_number,
                selected_reference_index=scored_trial.selected_reference_index,
                correct=scored_trial.correct,
                perseverative_response=scored_trial.perseverative_response,
                perseverative_error=scored_trial.perseverative_error,
                streak_before=scored_trial.streak_before,
                streak_after=scored_trial.streak_after,
                category_completed_after_trial=scored_trial.category_completed_after_trial,
                reaction_time_ms=scored_trial.reaction_time_ms,
                feedback=scored_trial.feedback,
            )
        )

    await db.commit()
    await db.refresh(run)
    return CardSortingRunResponse.model_validate(run)
