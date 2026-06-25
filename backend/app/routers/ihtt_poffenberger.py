from __future__ import annotations

import random
from datetime import datetime, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_ra_for_lab
from app.config import STUDY_TIMEZONE
from app.db import get_session
from app.models.participants import Participant
from app.models.poffenberger import PoffenbergerRun, PoffenbergerTrial
from app.models.sessions import Session as SessionModel
from app.schemas.poffenberger import (
    PoffenbergerBlockManifest,
    PoffenbergerDashboardResponse,
    PoffenbergerDashboardRunItem,
    PoffenbergerExperimentalTrialManifest,
    PoffenbergerManifest,
    PoffenbergerPracticeTrialManifest,
    PoffenbergerStartRequest,
    PoffenbergerStartResponse,
    PoffenbergerSubmitRequest,
    PoffenbergerSubmitResponse,
)
from app.scoring.poffenberger import (
    PoffenbergerScoringError,
    TrialInput,
    score as score_poffenberger,
)
from app.services.poffenberger_export_service import (
    build_poffenberger_xlsx,
    build_sample_poffenberger_xlsx,
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


def _today_local() -> str:
    return datetime.now(ZoneInfo(STUDY_TIMEZONE)).date().isoformat()


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
    result = await db.execute(select(func.max(Participant.participant_number)))
    current_max: int | None = result.scalar_one()
    next_number = (current_max or 0) + 1

    participant = Participant(
        participant_number=next_number,
        age_band=payload.age_band,
        gender=payload.gender,
        handedness=payload.handedness,
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


@router.get(
    "/dashboard",
    response_model=PoffenbergerDashboardResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(get_current_ra_for_lab("ihtt"))],
)
async def get_poffenberger_dashboard(
    db: AsyncSession = Depends(get_session),
) -> PoffenbergerDashboardResponse:
    """RA-only dashboard summary for the IHTT Poffenberger operations page.

    Only IHTT creates Poffenberger runs, so the recorded-run set is already
    study-scoped without a separate lab filter (mirrors the misokinesia board).
    """
    agg_stmt = select(
        func.count(PoffenbergerRun.run_id).label("total_runs"),
        func.count(PoffenbergerRun.run_id)
        .filter(PoffenbergerRun.is_complete.is_(True))
        .label("completed_runs"),
        func.avg(PoffenbergerRun.ihtt_difference_ms)
        .filter(PoffenbergerRun.is_complete.is_(True))
        .label("avg_ihtt_difference_ms"),
    )
    agg = (await db.execute(agg_stmt)).mappings().all()
    agg_row = agg[0] if agg else {}

    recent_stmt = (
        select(
            Participant.participant_number,
            PoffenbergerRun.started_at,
            PoffenbergerRun.completed_at,
            PoffenbergerRun.is_complete,
            Participant.age_band,
            Participant.gender,
            Participant.handedness,
            PoffenbergerRun.ihtt_difference_ms,
        )
        .join(
            Participant,
            Participant.participant_uuid == PoffenbergerRun.participant_uuid,
        )
        .order_by(PoffenbergerRun.started_at.desc())
        .limit(10)
    )
    recent_rows = (await db.execute(recent_stmt)).mappings().all()

    return PoffenbergerDashboardResponse(
        total_runs=int(agg_row.get("total_runs") or 0),
        completed_runs=int(agg_row.get("completed_runs") or 0),
        avg_ihtt_difference_ms=agg_row.get("avg_ihtt_difference_ms"),
        recent_runs=[
            PoffenbergerDashboardRunItem(
                participant_number=row["participant_number"],
                started_at=row["started_at"],
                completed_at=row["completed_at"],
                is_complete=row["is_complete"],
                age_band=row["age_band"],
                gender=row["gender"],
                handedness=row["handedness"],
                ihtt_difference_ms=row["ihtt_difference_ms"],
            )
            for row in recent_rows
        ],
    )


@router.get(
    "/export.xlsx",
    dependencies=[Depends(get_current_ra_for_lab("ihtt"))],
    response_class=Response,
)
async def export_poffenberger_xlsx(
    sample_data: bool = Query(
        default=False,
        description="Return fictional sample rows for reviewing the workbook layout.",
    ),
    db: AsyncSession = Depends(get_session),
) -> Response:
    today = _today_local()
    if sample_data:
        xlsx_bytes = build_sample_poffenberger_xlsx(export_date=today)
    else:
        xlsx_bytes = await build_poffenberger_xlsx(db, export_date=today)
    filename = f"Poffenberger test - {today}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _apply_condition_summary(
    run: PoffenbergerRun,
    condition_key: str,
    summary: object,
) -> None:
    for field_name in (
        "total_trials",
        "valid_rt_trials",
        "timeout_trials",
        "invalid_trials",
        "accurate_trials",
        "accuracy",
        "mean_rt_ms",
        "median_rt_ms",
        "sd_rt_ms",
    ):
        setattr(run, f"{condition_key}_{field_name}", getattr(summary, field_name))


@router.post(
    "/runs/{run_id}/submit",
    response_model=PoffenbergerSubmitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_poffenberger_run(
    run_id: UUID,
    payload: PoffenbergerSubmitRequest,
    db: AsyncSession = Depends(get_session),
) -> PoffenbergerSubmitResponse:
    if payload.run_id != run_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Payload run_id must match path run_id",
        )

    result = await db.execute(
        select(PoffenbergerRun).where(PoffenbergerRun.run_id == run_id)
    )
    run = result.scalar_one_or_none()
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Poffenberger run not found",
        )
    if payload.session_id != run.session_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Payload session_id does not match run",
        )
    if run.is_complete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Poffenberger run already submitted",
        )

    session_result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == run.session_id)
    )
    session_obj = session_result.scalar_one_or_none()
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

    try:
        manifest = PoffenbergerManifest.model_validate(run.manifest_json)
        scored = score_poffenberger(
            [
                TrialInput(
                    block_number=trial.block_number,
                    trial_number=trial.trial_number,
                    global_trial_number=trial.global_trial_number,
                    response_hand=trial.response_hand,
                    visual_field=trial.visual_field,
                    expected_key=trial.expected_key,
                    pressed_key=trial.pressed_key,
                    reaction_time_ms=trial.reaction_time_ms,
                    is_timeout=trial.is_timeout,
                    is_practice=trial.is_practice,
                    client_trial_started_at_ms=trial.client_trial_started_at_ms,
                    client_stimulus_onset_ms=trial.client_stimulus_onset_ms,
                    client_response_at_ms=trial.client_response_at_ms,
                    client_trial_ended_at_ms=trial.client_trial_ended_at_ms,
                )
                for trial in payload.trials
            ],
            manifest,
        )
    except PoffenbergerScoringError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Stored Poffenberger manifest is invalid",
        ) from exc

    for condition_key, summary in scored.condition_summaries.items():
        _apply_condition_summary(run, condition_key, summary)
    run.mean_rt_crossed_ms = scored.mean_rt_crossed_ms
    run.mean_rt_uncrossed_ms = scored.mean_rt_uncrossed_ms
    run.ihtt_difference_ms = scored.ihtt_difference_ms
    run.accuracy_crossed = scored.accuracy_crossed
    run.accuracy_uncrossed = scored.accuracy_uncrossed
    completed_at = datetime.now(timezone.utc)
    run.completed_at = completed_at
    run.is_complete = True
    session_obj.status = "complete"
    session_obj.completed_at = completed_at

    for trial in scored.trials:
        db.add(
            PoffenbergerTrial(
                run_id=run.run_id,
                session_id=run.session_id,
                participant_uuid=run.participant_uuid,
                block_number=trial.block_number,
                trial_number=trial.trial_number,
                global_trial_number=trial.global_trial_number,
                response_hand=trial.response_hand,
                visual_field=trial.visual_field,
                condition_key=trial.condition_key,
                is_practice=trial.is_practice,
                is_scored=trial.is_scored,
                expected_key=trial.expected_key,
                pressed_key=trial.pressed_key,
                reaction_time_ms=trial.reaction_time_ms,
                is_valid_response=trial.is_valid_response,
                is_timeout=trial.is_timeout,
                is_accurate=trial.is_accurate,
                jitter_ms=trial.jitter_ms,
                client_trial_started_at_ms=trial.client_trial_started_at_ms,
                client_stimulus_onset_ms=trial.client_stimulus_onset_ms,
                client_response_at_ms=trial.client_response_at_ms,
                client_trial_ended_at_ms=trial.client_trial_ended_at_ms,
            )
        )

    await db.commit()
    await db.refresh(run)

    return PoffenbergerSubmitResponse(
        run_id=run.run_id,
        session_id=run.session_id,
        condition_summaries=scored.condition_summaries,
        mean_rt_crossed_ms=scored.mean_rt_crossed_ms,
        mean_rt_uncrossed_ms=scored.mean_rt_uncrossed_ms,
        ihtt_difference_ms=scored.ihtt_difference_ms,
        accuracy_crossed=scored.accuracy_crossed,
        accuracy_uncrossed=scored.accuracy_uncrossed,
        is_complete=run.is_complete,
    )
