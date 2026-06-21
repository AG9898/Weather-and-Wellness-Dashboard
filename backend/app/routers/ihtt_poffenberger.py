from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_ra_for_lab
from app.config import compute_daylight_exposure_minutes
from app.db import get_session
from app.models.participants import Participant
from app.models.poffenberger import PoffenbergerRun
from app.models.sessions import Session as SessionModel
from app.schemas.poffenberger import (
    PoffenbergerBlockManifest,
    PoffenbergerExperimentalTrialManifest,
    PoffenbergerManifest,
    PoffenbergerPracticeTrialManifest,
    PoffenbergerStartRequest,
    PoffenbergerStartResponse,
)

router = APIRouter(prefix="/ihtt/poffenberger", tags=["ihtt-poffenberger"])

_PRACTICE_TRIALS = 10
_BLOCKS = 12
_TRIALS_PER_BLOCK = 50
_TRIALS_PER_VISUAL_FIELD_PER_BLOCK = 25
_LEFT_HAND_KEY = "f"
_RIGHT_HAND_KEY = "j"
_JITTER_MIN_MS = 1000
_JITTER_MAX_MS = 2000


def _expected_key(response_hand: str) -> str:
    return _LEFT_HAND_KEY if response_hand == "left" else _RIGHT_HAND_KEY


def _balanced_visual_fields(
    rng: random.Random,
    *,
    per_field_count: int,
) -> list[str]:
    fields = ["lvf"] * per_field_count + ["rvf"] * per_field_count
    rng.shuffle(fields)
    return fields


def _jitter_ms(rng: random.Random) -> int:
    return rng.randint(_JITTER_MIN_MS, _JITTER_MAX_MS)


def generate_production_manifest(
    rng: random.Random | None = None,
) -> PoffenbergerManifest:
    """Build the recorded-session manifest from the IHTT RA protocol."""
    manifest_rng = rng or random.SystemRandom()

    practice_fields = _balanced_visual_fields(
        manifest_rng,
        per_field_count=_PRACTICE_TRIALS // 2,
    )
    practice_trials = [
        PoffenbergerPracticeTrialManifest(
            trial_number=index + 1,
            visual_field=visual_field,  # type: ignore[arg-type]
            expected_key=_RIGHT_HAND_KEY,
            jitter_ms=_jitter_ms(manifest_rng),
        )
        for index, visual_field in enumerate(practice_fields)
    ]

    hand_order = ["left"] * (_BLOCKS // 2) + ["right"] * (_BLOCKS // 2)
    manifest_rng.shuffle(hand_order)

    blocks: list[PoffenbergerBlockManifest] = []
    global_trial_number = 1
    for block_index, response_hand in enumerate(hand_order, start=1):
        visual_fields = _balanced_visual_fields(
            manifest_rng,
            per_field_count=_TRIALS_PER_VISUAL_FIELD_PER_BLOCK,
        )
        trials: list[PoffenbergerExperimentalTrialManifest] = []
        for trial_index, visual_field in enumerate(visual_fields, start=1):
            trials.append(
                PoffenbergerExperimentalTrialManifest(
                    trial_number=trial_index,
                    global_trial_number=global_trial_number,
                    visual_field=visual_field,  # type: ignore[arg-type]
                    jitter_ms=_jitter_ms(manifest_rng),
                )
            )
            global_trial_number += 1
        blocks.append(
            PoffenbergerBlockManifest(
                block_number=block_index,
                response_hand=response_hand,  # type: ignore[arg-type]
                expected_key=_expected_key(response_hand),
                trials=trials,
            )
        )

    return PoffenbergerManifest(practice_trials=practice_trials, blocks=blocks)


@router.post(
    "/start",
    response_model=PoffenbergerStartResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_poffenberger_session(
    payload: PoffenbergerStartRequest,
    _member: LabMember = Depends(get_current_ra_for_lab("ihtt")),
    db: AsyncSession = Depends(get_session),
) -> PoffenbergerStartResponse:
    session_start_utc = datetime.now(timezone.utc)
    daylight_minutes = compute_daylight_exposure_minutes(session_start_utc)

    result = await db.execute(select(func.max(Participant.participant_number)))
    current_max: int | None = result.scalar_one()
    next_number = (current_max or 0) + 1

    participant = Participant(
        participant_number=next_number,
        age_band=payload.age_band,
        gender=payload.gender,
        origin=payload.origin,
        origin_other_text=payload.origin_other_text,
        commute_method=payload.commute_method,
        commute_method_other_text=payload.commute_method_other_text,
        time_outside=payload.time_outside,
        daylight_exposure_minutes=daylight_minutes,
    )
    db.add(participant)
    await db.flush()

    session_obj = SessionModel(
        participant_uuid=participant.participant_uuid,
        status="active",
    )
    db.add(session_obj)
    await db.flush()

    manifest = generate_production_manifest()
    run = PoffenbergerRun(
        session_id=session_obj.session_id,
        participant_uuid=participant.participant_uuid,
        manifest_json=manifest.model_dump(mode="json"),
        total_practice_trials=len(manifest.practice_trials),
        total_experimental_trials=sum(len(block.trials) for block in manifest.blocks),
    )
    db.add(run)
    await db.commit()
    await db.refresh(participant)
    await db.refresh(session_obj)
    await db.refresh(run)

    return PoffenbergerStartResponse(
        run_id=run.run_id,
        session_id=session_obj.session_id,
        participant_uuid=participant.participant_uuid,
        start_path=f"/ihtt/poffenberger/{run.run_id}",
        manifest=manifest,
    )
