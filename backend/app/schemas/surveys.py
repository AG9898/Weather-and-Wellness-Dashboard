from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- ULS-8 ---

class ULS8Create(BaseModel):
    session_id: UUID
    r1: int = Field(..., ge=1, le=4)
    r2: int = Field(..., ge=1, le=4)
    r3: int = Field(..., ge=1, le=4)
    r4: int = Field(..., ge=1, le=4)
    r5: int = Field(..., ge=1, le=4)
    r6: int = Field(..., ge=1, le=4)
    r7: int = Field(..., ge=1, le=4)
    r8: int = Field(..., ge=1, le=4)


class ULS8Response(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    response_id: UUID
    computed_mean: Decimal
    score_0_100: Decimal


# --- CES-D 10 ---

class CESD10Create(BaseModel):
    session_id: UUID
    r1: int = Field(..., ge=1, le=4)
    r2: int = Field(..., ge=1, le=4)
    r3: int = Field(..., ge=1, le=4)
    r4: int = Field(..., ge=1, le=4)
    r5: int = Field(..., ge=1, le=4)
    r6: int = Field(..., ge=1, le=4)
    r7: int = Field(..., ge=1, le=4)
    r8: int = Field(..., ge=1, le=4)
    r9: int = Field(..., ge=1, le=4)
    r10: int = Field(..., ge=1, le=4)


class CESD10Response(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    response_id: UUID
    total_score: int


# --- GAD-7 ---

class GAD7Create(BaseModel):
    session_id: UUID
    r1: int = Field(..., ge=1, le=4)
    r2: int = Field(..., ge=1, le=4)
    r3: int = Field(..., ge=1, le=4)
    r4: int = Field(..., ge=1, le=4)
    r5: int = Field(..., ge=1, le=4)
    r6: int = Field(..., ge=1, le=4)
    r7: int = Field(..., ge=1, le=4)


class GAD7Response(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    response_id: UUID
    total_score: int
    severity_band: str


# --- CogFunc 8a ---

class CogFunc8aCreate(BaseModel):
    session_id: UUID
    r1: int = Field(..., ge=1, le=5)
    r2: int = Field(..., ge=1, le=5)
    r3: int = Field(..., ge=1, le=5)
    r4: int = Field(..., ge=1, le=5)
    r5: int = Field(..., ge=1, le=5)
    r6: int = Field(..., ge=1, le=5)
    r7: int = Field(..., ge=1, le=5)
    r8: int = Field(..., ge=1, le=5)


class CogFunc8aResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    response_id: UUID
    total_sum: int
    mean_score: Decimal


__all__ = [
    "ULS8Create", "ULS8Response",
    "CESD10Create", "CESD10Response",
    "GAD7Create", "GAD7Response",
    "CogFunc8aCreate", "CogFunc8aResponse",
]
