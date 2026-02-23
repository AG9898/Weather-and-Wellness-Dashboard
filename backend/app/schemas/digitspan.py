from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TrialSubmission(BaseModel):
    trial_number: int = Field(..., ge=1, le=14)
    span_length: int = Field(..., ge=3, le=9)
    sequence_shown: str = Field(..., min_length=1)
    sequence_entered: str = Field(..., min_length=0)
    correct: bool


class DigitSpanRunCreate(BaseModel):
    session_id: UUID
    trials: list[TrialSubmission] = Field(..., min_length=14, max_length=14)


class DigitSpanRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: UUID
    total_correct: int
    max_span: int


__all__ = [
    "TrialSubmission",
    "DigitSpanRunCreate",
    "DigitSpanRunResponse",
]
