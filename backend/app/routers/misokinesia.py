from __future__ import annotations

import os
import random
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exc as sa_exc
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_lab_member
from app.db import get_session
from app.models.misokinesia import (
    MisokinesiaAqResponse as MisokinesiaAqResponseModel,
    MisokinesiaGAD7Response as MisokinesiaGAD7ResponseModel,
    MisokinesiaMAQResponse as MisokinesiaMAQResponseModel,
    MisokinesiaParticipant,
    MisokinesiaStimulus,
    MisokinesiaTestSet,
    MisokinesiaTrialResponse,
)
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.schemas.misokinesia import (
    MisoGAD7Create,
    MisoGAD7Response,
    MisoMAQCreate,
    MisoMAQResponse,
    MisoDemographicsCreate,
    MisoDemographicsResponse,
    MisokinesiaAqCreate,
    MisokinesiaAqResponse,
    MisokinesiaClipMeta,
    MisokinesiaEndOfTaskCreate,
    MisokinesiaEndOfTaskResponse,
    MisokinesiaManifestResponse,
    MisokinesiaTrialManifestResponse,
    MisokinesiaTrialResponseCreate,
    MisokinesiaTrialResponseResponse,
)
from app.scoring import gad7 as gad7_scoring

router = APIRouter(prefix="/misokinesia", tags=["misokinesia"])
_TRIAL_MANIFEST_CLIP_COUNT = 5
_MKAQ_DUPLICATE_CONSTRAINT = "uq_misokinesia_mkaq_responses_participant"
_GAD7_DUPLICATE_CONSTRAINT = "uq_misokinesia_gad7_responses_participant"
_MAQ_DUPLICATE_CONSTRAINT = "uq_misokinesia_maq_responses_participant"
_SURVEY_KEYS = ["mkaq", "gad7", "maq"]


def _supabase_url() -> str:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set.")
    return url


def _shuffle_stimuli(stimuli: list[MisokinesiaStimulus]) -> list[MisokinesiaStimulus]:
    shuffled = list(stimuli)
    random.shuffle(shuffled)
    return shuffled


def _sample_trial_stimuli(stimuli: list[MisokinesiaStimulus]) -> list[MisokinesiaStimulus]:
    return random.sample(stimuli, _TRIAL_MANIFEST_CLIP_COUNT)


def _clip_meta_from_stimulus(
    stimulus: MisokinesiaStimulus,
    *,
    base_url: str,
) -> MisokinesiaClipMeta:
    return MisokinesiaClipMeta(
        stimulus_id=stimulus.stimulus_id,
        public_url=(
            f"{base_url}/storage/v1/object/public/misokinesia-stimuli/{stimulus.storage_path}"
        ),
        sort_order=stimulus.sort_order,
        duration_ms=stimulus.duration_ms,
    )


def _matches_constraint(exc: sa_exc.IntegrityError, constraint_name: str) -> bool:
    """Best-effort constraint name matcher across DB drivers."""

    diag = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    if diag == constraint_name:
        return True

    return constraint_name in f"{exc} {exc.orig}"


async def _get_post_video_participant(
    participant_id: UUID,
    db: AsyncSession,
    *,
    survey_name: str,
) -> MisokinesiaParticipant:
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

    if miso_participant.completed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"All per-clip responses must be submitted before {survey_name}.",
        )

    return miso_participant


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

    # 4. Randomly assign post-video survey order
    post_survey_order = ",".join(random.sample(_SURVEY_KEYS, len(_SURVEY_KEYS)))

    # 5. Create misokinesia_participants row
    #    misokinesia_participant_number is assigned by the server-side SERIAL sequence
    miso_participant = MisokinesiaParticipant(
        session_id=session_obj.session_id,
        participant_uuid=participant.participant_uuid,
        test_set_id=test_set.test_set_id,
        post_survey_order=post_survey_order,
    )
    db.add(miso_participant)
    await db.commit()
    await db.refresh(miso_participant)

    # 6. Fetch stimuli ordered by sort_order
    stim_result = await db.execute(
        select(MisokinesiaStimulus)
        .where(
            MisokinesiaStimulus.test_set_id == test_set.test_set_id,
            MisokinesiaStimulus.active.is_(True),
        )
        .order_by(MisokinesiaStimulus.sort_order)
    )
    stimuli = stim_result.scalars().all()

    # 7. Randomize playback order per participant, but preserve each clip's
    # canonical sort_order in the returned metadata.
    base_url = _supabase_url()
    randomized_stimuli = _shuffle_stimuli(stimuli)
    clips = [_clip_meta_from_stimulus(s, base_url=base_url) for s in randomized_stimuli]

    return MisokinesiaManifestResponse(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        misokinesia_participant_number=miso_participant.misokinesia_participant_number,
        session_id=session_obj.session_id,
        post_survey_order=miso_participant.post_survey_order,
        clips=clips,
    )


@router.get(
    "/trial-manifest",
    response_model=MisokinesiaTrialManifestResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(get_current_lab_member)],
)
async def get_trial_manifest(
    full: bool = False,
    db: AsyncSession = Depends(get_session),
) -> MisokinesiaTrialManifestResponse:
    """RA-only read endpoint for trial mode clip sampling. Performs no writes.

    full=False (default): returns 5 randomly sampled active clips (short trial).
    full=True: returns all active clips in a randomized order (full trial).
    Always returns a locally generated post_survey_order (not persisted).
    """

    ts_result = await db.execute(
        select(MisokinesiaTestSet).where(MisokinesiaTestSet.active.is_(True))
    )
    test_set = ts_result.scalars().first()
    if test_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active misokinesia test set found. Seed data before requesting a trial manifest.",
        )

    stim_result = await db.execute(
        select(MisokinesiaStimulus)
        .where(
            MisokinesiaStimulus.test_set_id == test_set.test_set_id,
            MisokinesiaStimulus.active.is_(True),
        )
        .order_by(MisokinesiaStimulus.sort_order)
    )
    stimuli = stim_result.scalars().all()

    if not full and len(stimuli) < _TRIAL_MANIFEST_CLIP_COUNT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "At least 5 active misokinesia stimuli are required for a trial manifest."
            ),
        )

    base_url = _supabase_url()
    selected_stimuli = _shuffle_stimuli(stimuli) if full else _sample_trial_stimuli(stimuli)
    clips = [_clip_meta_from_stimulus(s, base_url=base_url) for s in selected_stimuli]

    post_survey_order = ",".join(random.sample(_SURVEY_KEYS, len(_SURVEY_KEYS)))

    return MisokinesiaTrialManifestResponse(
        post_survey_order=post_survey_order,
        clips=clips,
    )


@router.patch(
    "/participants/{participant_id}/demographics",
    response_model=MisoDemographicsResponse,
    status_code=status.HTTP_200_OK,
)
async def submit_demographics(
    participant_id: UUID,
    payload: MisoDemographicsCreate,
    db: AsyncSession = Depends(get_session),
) -> MisoDemographicsResponse:
    """Participant-facing (no auth). Write miso-specific demographics to
    misokinesia_participants. Idempotent — later calls overwrite earlier values.
    All fields optional. Returns 404 if participant not found, 422 for invalid
    categorical values or inconsistent other_text fields (validated by schema).
    """

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

    miso_participant.age_band = payload.age_band
    miso_participant.gender = payload.gender
    miso_participant.gender_other_text = payload.gender_other_text
    miso_participant.country = payload.country
    miso_participant.country_other_text = payload.country_other_text
    miso_participant.nationality = payload.nationality

    await db.commit()

    return MisoDemographicsResponse(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
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


@router.post(
    "/participants/{participant_id}/mkaq",
    response_model=MisokinesiaAqResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_mkaq(
    participant_id: UUID,
    payload: MisokinesiaAqCreate,
    db: AsyncSession = Depends(get_session),
) -> MisokinesiaAqResponse:
    """Participant-facing (no auth). Submit the required 21-item MkAQ once.
    MkAQ is always post-video; all per-clip responses must be submitted first.
    """

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

    # MkAQ is always post-video; require all per-clip responses first.
    if miso_participant.completed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All per-clip responses must be submitted before MkAQ.",
        )

    total_score = sum(
        getattr(payload, f"q{i}") for i in range(1, 22)
    )

    response_row = MisokinesiaAqResponseModel(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        session_id=miso_participant.session_id,
        participant_uuid=miso_participant.participant_uuid,
        administration="post",
        q1=payload.q1,
        q2=payload.q2,
        q3=payload.q3,
        q4=payload.q4,
        q5=payload.q5,
        q6=payload.q6,
        q7=payload.q7,
        q8=payload.q8,
        q9=payload.q9,
        q10=payload.q10,
        q11=payload.q11,
        q12=payload.q12,
        q13=payload.q13,
        q14=payload.q14,
        q15=payload.q15,
        q16=payload.q16,
        q17=payload.q17,
        q18=payload.q18,
        q19=payload.q19,
        q20=payload.q20,
        q21=payload.q21,
        total_score=total_score,
    )
    db.add(response_row)
    try:
        await db.flush()
    except sa_exc.IntegrityError as exc:
        await db.rollback()
        if _matches_constraint(exc, _MKAQ_DUPLICATE_CONSTRAINT):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An MkAQ response for this participant already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist MkAQ response due to data integrity constraints.",
        )

    await db.commit()
    await db.refresh(response_row)

    return MisokinesiaAqResponse(
        response_id=response_row.response_id,
        misokinesia_participant_id=response_row.misokinesia_participant_id,
        session_id=response_row.session_id,
        total_score=response_row.total_score,
        created_at=response_row.created_at,
    )


@router.post(
    "/participants/{participant_id}/gad7",
    response_model=MisoGAD7Response,
    status_code=status.HTTP_201_CREATED,
)
async def submit_miso_gad7(
    participant_id: UUID,
    payload: MisoGAD7Create,
    db: AsyncSession = Depends(get_session),
) -> MisoGAD7Response:
    """Participant-facing (no auth). Submit post-video GAD-7 once."""

    miso_participant = await _get_post_video_participant(
        participant_id,
        db,
        survey_name="GAD-7",
    )

    raw_scores = [getattr(payload, f"r{i}") for i in range(1, 8)]
    scored = gad7_scoring.score_gad7(raw_scores)
    response_row = MisokinesiaGAD7ResponseModel(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        session_id=miso_participant.session_id,
        participant_uuid=miso_participant.participant_uuid,
        r1=payload.r1,
        r2=payload.r2,
        r3=payload.r3,
        r4=payload.r4,
        r5=payload.r5,
        r6=payload.r6,
        r7=payload.r7,
        total_score=scored.total_score,
        severity_band=scored.severity_band,
    )
    db.add(response_row)
    try:
        await db.flush()
    except sa_exc.IntegrityError as exc:
        await db.rollback()
        if _matches_constraint(exc, _GAD7_DUPLICATE_CONSTRAINT):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A GAD-7 response for this participant already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist GAD-7 response due to data integrity constraints.",
        )

    await db.commit()
    await db.refresh(response_row)

    return MisoGAD7Response(
        response_id=response_row.response_id,
        total_score=response_row.total_score,
        severity_band=response_row.severity_band,
    )


@router.post(
    "/participants/{participant_id}/maq",
    response_model=MisoMAQResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_miso_maq(
    participant_id: UUID,
    payload: MisoMAQCreate,
    db: AsyncSession = Depends(get_session),
) -> MisoMAQResponse:
    """Participant-facing (no auth). Submit post-video MAQ once."""

    miso_participant = await _get_post_video_participant(
        participant_id,
        db,
        survey_name="MAQ",
    )

    item_scores = {f"q{i}": getattr(payload, f"q{i}") for i in range(1, 22)}
    total_score = sum(item_scores.values())
    response_row = MisokinesiaMAQResponseModel(
        misokinesia_participant_id=miso_participant.misokinesia_participant_id,
        session_id=miso_participant.session_id,
        participant_uuid=miso_participant.participant_uuid,
        **item_scores,
        total_score=total_score,
    )
    db.add(response_row)
    try:
        await db.flush()
    except sa_exc.IntegrityError as exc:
        await db.rollback()
        if _matches_constraint(exc, _MAQ_DUPLICATE_CONSTRAINT):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A MAQ response for this participant already exists.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist MAQ response due to data integrity constraints.",
        )

    await db.commit()
    await db.refresh(response_row)

    return MisoMAQResponse(
        response_id=response_row.response_id,
        total_score=response_row.total_score,
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
    """Participant-facing (no auth). Submit end-of-task questionnaire after all clips
    and post-video surveys are complete."""

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

    # 3. Require all post-video surveys to be submitted.
    mkaq_check = await db.execute(
        select(MisokinesiaAqResponseModel).where(
            MisokinesiaAqResponseModel.misokinesia_participant_id == participant_id
        )
    )
    gad7_check = await db.execute(
        select(MisokinesiaGAD7ResponseModel).where(
            MisokinesiaGAD7ResponseModel.misokinesia_participant_id == participant_id
        )
    )
    maq_check = await db.execute(
        select(MisokinesiaMAQResponseModel).where(
            MisokinesiaMAQResponseModel.misokinesia_participant_id == participant_id
        )
    )
    if (
        mkaq_check.scalar_one_or_none() is None
        or gad7_check.scalar_one_or_none() is None
        or maq_check.scalar_one_or_none() is None
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="All post-video surveys must be submitted before the end-of-task questionnaire.",
        )

    # 4. Write end-of-task fields
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
