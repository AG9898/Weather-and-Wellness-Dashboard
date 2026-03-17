from __future__ import annotations

import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exc as sa_exc
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_lab_member
from app.db import get_session
from app.models.misokinesia import (
    MisokinesiaParticipant,
    MisokinesiaStimulus,
    MisokinesiaTestSet,
    MisokinesiaTrialResponse,
)
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.schemas.misokinesia import (
    MisokinesiaClipMeta,
    MisokinesiaEndOfTaskCreate,
    MisokinesiaEndOfTaskResponse,
    MisokinesiaManifestResponse,
    MisokinesiaTrialResponseCreate,
    MisokinesiaTrialResponseResponse,
)

router = APIRouter(prefix="/misokinesia", tags=["misokinesia"])


def _supabase_url() -> str:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set.")
    return url


@router.post(
    "/start",
    response_model=MisokinesiaManifestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_lab_member)],
)
async def start_misokinesia_session(
    db: AsyncSession = Depends(get_session),
) -> MisokinesiaManifestResponse:
    """RA-triggered start: atomically create anonymous participant + session +
    misokinesia_participants row, then return the clip manifest."""

    # 1. Resolve the single active test set
    ts_result = await db.execute(
        select(MisokinesiaTestSet).where(MisokinesiaTestSet.active.is_(True))
    )
    test_set = ts_result.scalars().first()
    if test_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active misokinesia test set found. Seed data before starting a session.",
        )

    # 2. Create anonymous participant (MAX+1 pattern, same as sessions.py)
    max_result = await db.execute(select(func.max(Participant.participant_number)))
    current_max: int | None = max_result.scalar_one()
    next_number = (current_max or 0) + 1

    participant = Participant(participant_number=next_number)
    db.add(participant)
    await db.flush()  # assigns participant_uuid

    # 3. Create session (status='active')
    session_obj = SessionModel(
        participant_uuid=participant.participant_uuid,
        status="active",
    )
    db.add(session_obj)
    await db.flush()  # assigns session_id

    # 4. Create misokinesia_participants row
    #    misokinesia_participant_number is assigned by the server-side SERIAL sequence
    miso_participant = MisokinesiaParticipant(
        session_id=session_obj.session_id,
        participant_uuid=participant.participant_uuid,
        test_set_id=test_set.test_set_id,
    )
    db.add(miso_participant)
    await db.commit()
    await db.refresh(miso_participant)

    # 5. Fetch stimuli ordered by sort_order
    stim_result = await db.execute(
        select(MisokinesiaStimulus)
        .where(
            MisokinesiaStimulus.test_set_id == test_set.test_set_id,
            MisokinesiaStimulus.active.is_(True),
        )
        .order_by(MisokinesiaStimulus.sort_order)
    )
    stimuli = stim_result.scalars().all()

    # 6. Build public URLs
    base_url = _supabase_url()
    clips = [
        MisokinesiaClipMeta(
            stimulus_id=s.stimulus_id,
            public_url=f"{base_url}/storage/v1/object/public/misokinesia-stimuli/{s.storage_path}",
            sort_order=s.sort_order,
            duration_ms=s.duration_ms,
        )
        for s in stimuli
    ]

    return MisokinesiaManifestResponse(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        misokinesia_participant_number=miso_participant.misokinesia_participant_number,
        session_id=session_obj.session_id,
        clips=clips,
    )


@router.post(
    "/participants/{participant_id}/responses",
    response_model=MisokinesiaTrialResponseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_trial_response(
    participant_id: UUID,
    payload: MisokinesiaTrialResponseCreate,
    db: AsyncSession = Depends(get_session),
) -> MisokinesiaTrialResponseResponse:
    """Participant-facing (no auth). Submit one per-clip questionnaire response."""

    # 1. Verify participant row exists
    mp_result = await db.execute(
        select(MisokinesiaParticipant).where(
            MisokinesiaParticipant.misokinesia_participant_id == participant_id
        )
    )
    miso_participant = mp_result.scalar_one_or_none()
    if miso_participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Misokinesia participant not found.",
        )

    # 2. Guard: all clips already complete → 409
    if miso_participant.completed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All stimuli for this participant have already been answered.",
        )

    # 3. Verify stimulus_id belongs to this participant's test_set
    stim_result = await db.execute(
        select(MisokinesiaStimulus).where(
            MisokinesiaStimulus.stimulus_id == payload.stimulus_id,
            MisokinesiaStimulus.test_set_id == miso_participant.test_set_id,
        )
    )
    stimulus = stim_result.scalar_one_or_none()
    if stimulus is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="stimulus_id does not belong to this participant's test set.",
        )

    # 4. Insert response — catch UNIQUE violation → 409
    response_row = MisokinesiaTrialResponse(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        session_id=miso_participant.session_id,
        participant_uuid=miso_participant.participant_uuid,
        stimulus_id=payload.stimulus_id,
        display_order=payload.display_order,
        q1=payload.q1,
        q2=payload.q2,
        q3=payload.q3,
        q4=payload.q4,
    )
    db.add(response_row)
    try:
        await db.flush()
    except sa_exc.IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A response for this participant and stimulus already exists.",
        )

    # 5. Check if all stimuli now have responses → auto-set completed_at
    total_stimuli_result = await db.execute(
        select(func.count(MisokinesiaStimulus.stimulus_id)).where(
            MisokinesiaStimulus.test_set_id == miso_participant.test_set_id,
            MisokinesiaStimulus.active.is_(True),
        )
    )
    total_stimuli: int = total_stimuli_result.scalar_one()

    submitted_result = await db.execute(
        select(func.count(MisokinesiaTrialResponse.response_id)).where(
            MisokinesiaTrialResponse.misokinesia_participant_id
            == miso_participant.misokinesia_participant_id
        )
    )
    submitted_count: int = submitted_result.scalar_one()

    is_complete = submitted_count >= total_stimuli
    if is_complete:
        miso_participant.completed_at = func.now()

    await db.commit()
    await db.refresh(response_row)

    return MisokinesiaTrialResponseResponse(
        response_id=response_row.response_id,
        session_id=miso_participant.session_id,
        is_complete=is_complete,
        created_at=response_row.created_at,
    )


@router.patch(
    "/participants/{participant_id}/end-of-task",
    response_model=MisokinesiaEndOfTaskResponse,
    status_code=status.HTTP_200_OK,
)
async def submit_end_of_task(
    participant_id: UUID,
    payload: MisokinesiaEndOfTaskCreate,
    db: AsyncSession = Depends(get_session),
) -> MisokinesiaEndOfTaskResponse:
    """Participant-facing (no auth). Submit end-of-task questionnaire after all clips."""

    # 1. Verify participant row exists
    mp_result = await db.execute(
        select(MisokinesiaParticipant).where(
            MisokinesiaParticipant.misokinesia_participant_id == participant_id
        )
    )
    miso_participant = mp_result.scalar_one_or_none()
    if miso_participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Misokinesia participant not found.",
        )

    # 2. Require completed_at to be set (all per-clip responses submitted)
    if miso_participant.completed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All per-clip responses must be submitted before the end-of-task questionnaire.",
        )

    # 3. Write end-of-task fields
    miso_participant.end_fidgeting_text = payload.end_fidgeting_text
    miso_participant.end_emotions_text = payload.end_emotions_text
    miso_participant.stronger_responses = payload.stronger_responses
    miso_participant.stronger_responses_timing = payload.stronger_responses_timing

    await db.commit()
    await db.refresh(miso_participant)

    return MisokinesiaEndOfTaskResponse(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        end_fidgeting_text=miso_participant.end_fidgeting_text,
        end_emotions_text=miso_participant.end_emotions_text,
        stronger_responses=miso_participant.stronger_responses,
        stronger_responses_timing=miso_participant.stronger_responses_timing,
    )
