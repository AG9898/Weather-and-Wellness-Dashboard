from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Session as SessionModel, SurveyULS8, SurveyCESD10, SurveyGAD7, SurveyCogFunc8a
from app.schemas.surveys import (
    ULS8Create, ULS8Response,
    CESD10Create, CESD10Response,
    GAD7Create, GAD7Response,
    CogFunc8aCreate, CogFunc8aResponse,
)
from app.scoring import uls8 as uls8_scoring
from app.scoring import cesd10 as cesd10_scoring
from app.scoring import gad7 as gad7_scoring
from app.scoring import cogfunc8a as cogfunc8a_scoring

router = APIRouter(prefix="/surveys", tags=["surveys"])


async def _get_active_session(session_id, db: AsyncSession) -> SessionModel:
    """Validate session exists and is active, or raise."""
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == session_id)
    )
    session_obj = result.scalar_one_or_none()
    if session_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session_obj.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Session is not active")
    return session_obj


@router.post("/uls8", response_model=ULS8Response, status_code=status.HTTP_201_CREATED)
async def submit_uls8(
    payload: ULS8Create,
    db: AsyncSession = Depends(get_session),
) -> ULS8Response:
    session_obj = await _get_active_session(payload.session_id, db)
    raw = [payload.r1, payload.r2, payload.r3, payload.r4,
           payload.r5, payload.r6, payload.r7, payload.r8]
    scored = uls8_scoring.score(raw)

    row = SurveyULS8(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        r1=payload.r1, r2=payload.r2, r3=payload.r3, r4=payload.r4,
        r5=payload.r5, r6=payload.r6, r7=payload.r7, r8=payload.r8,
        computed_mean=scored.computed_mean,
        score_0_100=scored.score_0_100,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ULS8Response.model_validate(row)


@router.post("/cesd10", response_model=CESD10Response, status_code=status.HTTP_201_CREATED)
async def submit_cesd10(
    payload: CESD10Create,
    db: AsyncSession = Depends(get_session),
) -> CESD10Response:
    session_obj = await _get_active_session(payload.session_id, db)
    raw = [payload.r1, payload.r2, payload.r3, payload.r4, payload.r5,
           payload.r6, payload.r7, payload.r8, payload.r9, payload.r10]
    scored = cesd10_scoring.score(raw)

    row = SurveyCESD10(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        r1=payload.r1, r2=payload.r2, r3=payload.r3, r4=payload.r4, r5=payload.r5,
        r6=payload.r6, r7=payload.r7, r8=payload.r8, r9=payload.r9, r10=payload.r10,
        total_score=scored.total_score,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return CESD10Response.model_validate(row)


@router.post("/gad7", response_model=GAD7Response, status_code=status.HTTP_201_CREATED)
async def submit_gad7(
    payload: GAD7Create,
    db: AsyncSession = Depends(get_session),
) -> GAD7Response:
    session_obj = await _get_active_session(payload.session_id, db)
    raw = [payload.r1, payload.r2, payload.r3, payload.r4,
           payload.r5, payload.r6, payload.r7]
    scored = gad7_scoring.score(raw)

    row = SurveyGAD7(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        r1=payload.r1, r2=payload.r2, r3=payload.r3, r4=payload.r4,
        r5=payload.r5, r6=payload.r6, r7=payload.r7,
        total_score=scored.total_score,
        severity_band=scored.severity_band,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return GAD7Response.model_validate(row)


@router.post("/cogfunc8a", response_model=CogFunc8aResponse, status_code=status.HTTP_201_CREATED)
async def submit_cogfunc8a(
    payload: CogFunc8aCreate,
    db: AsyncSession = Depends(get_session),
) -> CogFunc8aResponse:
    session_obj = await _get_active_session(payload.session_id, db)
    raw = [payload.r1, payload.r2, payload.r3, payload.r4,
           payload.r5, payload.r6, payload.r7, payload.r8]
    scored = cogfunc8a_scoring.score(raw)

    row = SurveyCogFunc8a(
        session_id=payload.session_id,
        participant_uuid=session_obj.participant_uuid,
        r1=payload.r1, r2=payload.r2, r3=payload.r3, r4=payload.r4,
        r5=payload.r5, r6=payload.r6, r7=payload.r7, r8=payload.r8,
        total_sum=scored.total_sum,
        mean_score=scored.mean_score,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return CogFunc8aResponse.model_validate(row)
