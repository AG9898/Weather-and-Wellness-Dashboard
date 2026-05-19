from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Manifest (start session response)
# ---------------------------------------------------------------------------

class MisokinesiaClipMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stimulus_id: UUID
    public_url: str
    sort_order: int
    duration_ms: int


class MisokinesiaManifestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    misokinesia_participant_id: UUID
    misokinesia_participant_number: int
    session_id: UUID
    post_survey_order: str
    clips: list[MisokinesiaClipMeta]


class MisokinesiaTrialManifestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    post_survey_order: str
    clips: list[MisokinesiaClipMeta]


# ---------------------------------------------------------------------------
# Per-participant record
# ---------------------------------------------------------------------------

class MisokinesiaParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    misokinesia_participant_id: UUID
    session_id: UUID
    participant_uuid: UUID
    test_set_id: UUID
    misokinesia_participant_number: int
    started_at: datetime
    completed_at: Optional[datetime]
    created_at: datetime


# ---------------------------------------------------------------------------
# Per-clip trial responses
# ---------------------------------------------------------------------------

class MisokinesiaTrialResponseCreate(BaseModel):
    stimulus_id: UUID
    display_order: int = Field(..., ge=1)
    # Scale 1–5: Strongly Disagree → Strongly Agree
    q1: int = Field(..., ge=1, le=5)  # I find this video unpleasant
    q2: int = Field(..., ge=1, le=5)  # I felt physical discomfort during the video
    q3: int = Field(..., ge=1, le=5)  # I felt upset during the video
    q4: int = Field(..., ge=1, le=5)  # I wanted to stop the video early / or close my eyes


class MisokinesiaTrialResponseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    response_id: UUID
    session_id: UUID
    is_complete: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# End-of-task questionnaire
# ---------------------------------------------------------------------------

_VALID_TIMING_OPTIONS = {
    "Immediately",
    "After 5 seconds",
    "After 10 seconds",
    "At the end of the video",
}


class MisokinesiaEndOfTaskCreate(BaseModel):
    end_fidgeting_text: Optional[str] = None
    end_emotions_text: Optional[str] = None
    stronger_responses: Optional[bool] = None
    stronger_responses_timing: Optional[str] = None

    @model_validator(mode="after")
    def validate_timing_requires_stronger_responses(self) -> "MisokinesiaEndOfTaskCreate":
        if self.stronger_responses_timing is not None:
            if not self.stronger_responses:
                raise ValueError(
                    "stronger_responses_timing may only be set when stronger_responses is true"
                )
            if self.stronger_responses_timing not in _VALID_TIMING_OPTIONS:
                raise ValueError(
                    f"stronger_responses_timing must be one of: {sorted(_VALID_TIMING_OPTIONS)}"
                )
        return self


class MisokinesiaEndOfTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    misokinesia_participant_id: UUID
    end_fidgeting_text: Optional[str]
    end_emotions_text: Optional[str]
    stronger_responses: Optional[bool]
    stronger_responses_timing: Optional[str]


# ---------------------------------------------------------------------------
# MkAQ (Misokinesia Assessment Questionnaire)
# ---------------------------------------------------------------------------

class MisokinesiaAqCreate(BaseModel):
    q1: int = Field(..., ge=0, le=3)
    q2: int = Field(..., ge=0, le=3)
    q3: int = Field(..., ge=0, le=3)
    q4: int = Field(..., ge=0, le=3)
    q5: int = Field(..., ge=0, le=3)
    q6: int = Field(..., ge=0, le=3)
    q7: int = Field(..., ge=0, le=3)
    q8: int = Field(..., ge=0, le=3)
    q9: int = Field(..., ge=0, le=3)
    q10: int = Field(..., ge=0, le=3)
    q11: int = Field(..., ge=0, le=3)
    q12: int = Field(..., ge=0, le=3)
    q13: int = Field(..., ge=0, le=3)
    q14: int = Field(..., ge=0, le=3)
    q15: int = Field(..., ge=0, le=3)
    q16: int = Field(..., ge=0, le=3)
    q17: int = Field(..., ge=0, le=3)
    q18: int = Field(..., ge=0, le=3)
    q19: int = Field(..., ge=0, le=3)
    q20: int = Field(..., ge=0, le=3)
    q21: int = Field(..., ge=0, le=3)


class MisokinesiaAqResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    response_id: UUID
    misokinesia_participant_id: UUID
    session_id: UUID
    total_score: int
    created_at: datetime


__all__ = [
    "MisokinesiaClipMeta",
    "MisokinesiaManifestResponse",
    "MisokinesiaTrialManifestResponse",
    "MisokinesiaParticipantResponse",
    "MisokinesiaTrialResponseCreate",
    "MisokinesiaTrialResponseResponse",
    "MisokinesiaEndOfTaskCreate",
    "MisokinesiaEndOfTaskResponse",
    "MisokinesiaAqCreate",
    "MisokinesiaAqResponse",
]
