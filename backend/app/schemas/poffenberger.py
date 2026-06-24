from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.sessions import AGE_BAND_OPTIONS, GENDER_OPTIONS


PoffenbergerResponseHand = Literal["left", "right"]
PoffenbergerVisualField = Literal["lvf", "rvf"]
PoffenbergerConditionKey = Literal["lh_lvf", "lh_rvf", "rh_lvf", "rh_rvf"]


class PoffenbergerConditionSummary(BaseModel):
    total_trials: int = Field(default=0, ge=0)
    valid_rt_trials: int = Field(default=0, ge=0)
    timeout_trials: int = Field(default=0, ge=0)
    invalid_trials: int = Field(default=0, ge=0)
    accurate_trials: int = Field(default=0, ge=0)
    accuracy: Decimal | None = Field(default=None, ge=0, le=1)
    mean_rt_ms: Decimal | None = Field(default=None, ge=0)
    median_rt_ms: Decimal | None = Field(default=None, ge=0)
    sd_rt_ms: Decimal | None = Field(default=None, ge=0)


class PoffenbergerRunCreate(BaseModel):
    session_id: UUID
    participant_uuid: UUID
    manifest_json: dict[str, Any]
    total_practice_trials: int = Field(default=0, ge=0)
    total_experimental_trials: int = Field(default=0, ge=0)


HANDEDNESS_OPTIONS = frozenset({
    "Left-handed",
    "Right-handed",
    "Ambidextrous",
    "Prefer not to say",
})


class PoffenbergerStartRequest(BaseModel):
    """IHTT demographics payload for recorded Poffenberger start."""

    model_config = ConfigDict(extra="forbid")

    age_band: str
    gender: str
    handedness: str

    @model_validator(mode="after")
    def validate_demographics(self) -> "PoffenbergerStartRequest":
        errors: list[str] = []

        if self.age_band not in AGE_BAND_OPTIONS:
            errors.append(
                f"age_band must be one of: {', '.join(sorted(AGE_BAND_OPTIONS))}"
            )
        if self.gender not in GENDER_OPTIONS:
            errors.append(
                f"gender must be one of: {', '.join(sorted(GENDER_OPTIONS))}"
            )
        if self.handedness not in HANDEDNESS_OPTIONS:
            errors.append(
                f"handedness must be one of: {', '.join(sorted(HANDEDNESS_OPTIONS))}"
            )

        if errors:
            raise ValueError(errors)
        return self


class PoffenbergerPracticeTrialManifest(BaseModel):
    trial_number: int = Field(..., ge=1)
    response_hand: Literal["right"] = "right"
    visual_field: PoffenbergerVisualField
    expected_key: str = Field(..., min_length=1)
    jitter_ms: int = Field(..., ge=1000, le=2000)


class PoffenbergerExperimentalTrialManifest(BaseModel):
    trial_number: int = Field(..., ge=1, le=50)
    global_trial_number: int = Field(..., ge=1, le=600)
    visual_field: PoffenbergerVisualField
    jitter_ms: int = Field(..., ge=1000, le=2000)


class PoffenbergerBlockManifest(BaseModel):
    block_number: int = Field(..., ge=1, le=12)
    response_hand: PoffenbergerResponseHand
    expected_key: str = Field(..., min_length=1)
    trials: list[PoffenbergerExperimentalTrialManifest] = Field(
        ..., min_length=50, max_length=50
    )


class PoffenbergerManifest(BaseModel):
    practice_trials: list[PoffenbergerPracticeTrialManifest] = Field(
        ..., min_length=10, max_length=10
    )
    blocks: list[PoffenbergerBlockManifest] = Field(..., min_length=12, max_length=12)


class PoffenbergerStartResponse(BaseModel):
    run_id: UUID
    session_id: UUID
    participant_uuid: UUID
    start_path: str
    manifest: PoffenbergerManifest


class PoffenbergerDashboardRunItem(BaseModel):
    """One recorded Poffenberger run for the RA operations ledger."""

    model_config = ConfigDict(from_attributes=True)

    participant_number: int
    started_at: datetime
    completed_at: datetime | None = None
    is_complete: bool
    age_band: str | None = None
    gender: str | None = None
    handedness: str | None = None
    ihtt_difference_ms: Decimal | None = None


class PoffenbergerDashboardResponse(BaseModel):
    """RA-only dashboard summary for the IHTT Poffenberger operations page."""

    total_runs: int = Field(default=0, ge=0)
    completed_runs: int = Field(default=0, ge=0)
    avg_ihtt_difference_ms: Decimal | None = None
    recent_runs: list[PoffenbergerDashboardRunItem]


class PoffenbergerSubmittedTrial(BaseModel):
    block_number: int = Field(..., ge=0)
    trial_number: int = Field(..., ge=1)
    global_trial_number: int = Field(..., ge=1)
    response_hand: PoffenbergerResponseHand
    visual_field: PoffenbergerVisualField
    expected_key: str = Field(..., min_length=1)
    pressed_key: str | None = None
    reaction_time_ms: int | None = Field(default=None, ge=1)
    is_timeout: bool = False
    is_practice: bool = False
    client_trial_started_at_ms: Decimal | None = Field(default=None, ge=0)
    client_stimulus_onset_ms: Decimal | None = Field(default=None, ge=0)
    client_response_at_ms: Decimal | None = Field(default=None, ge=0)
    client_trial_ended_at_ms: Decimal | None = Field(default=None, ge=0)


class PoffenbergerSubmitRequest(BaseModel):
    run_id: UUID
    session_id: UUID
    trials: list[PoffenbergerSubmittedTrial] = Field(
        ..., min_length=600, max_length=610
    )


class PoffenbergerSubmitResponse(BaseModel):
    run_id: UUID
    session_id: UUID
    condition_summaries: dict[PoffenbergerConditionKey, PoffenbergerConditionSummary]
    mean_rt_crossed_ms: Decimal | None = None
    mean_rt_uncrossed_ms: Decimal | None = None
    ihtt_difference_ms: Decimal | None = None
    accuracy_crossed: Decimal | None = None
    accuracy_uncrossed: Decimal | None = None
    is_complete: bool


class PoffenbergerRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: UUID
    session_id: UUID
    participant_uuid: UUID
    manifest_json: dict[str, Any]
    started_at: datetime
    completed_at: datetime | None = None
    is_complete: bool
    total_practice_trials: int
    total_experimental_trials: int

    lh_lvf_total_trials: int
    lh_lvf_valid_rt_trials: int
    lh_lvf_timeout_trials: int
    lh_lvf_invalid_trials: int
    lh_lvf_accurate_trials: int
    lh_lvf_accuracy: Decimal | None = None
    lh_lvf_mean_rt_ms: Decimal | None = None
    lh_lvf_median_rt_ms: Decimal | None = None
    lh_lvf_sd_rt_ms: Decimal | None = None

    lh_rvf_total_trials: int
    lh_rvf_valid_rt_trials: int
    lh_rvf_timeout_trials: int
    lh_rvf_invalid_trials: int
    lh_rvf_accurate_trials: int
    lh_rvf_accuracy: Decimal | None = None
    lh_rvf_mean_rt_ms: Decimal | None = None
    lh_rvf_median_rt_ms: Decimal | None = None
    lh_rvf_sd_rt_ms: Decimal | None = None

    rh_lvf_total_trials: int
    rh_lvf_valid_rt_trials: int
    rh_lvf_timeout_trials: int
    rh_lvf_invalid_trials: int
    rh_lvf_accurate_trials: int
    rh_lvf_accuracy: Decimal | None = None
    rh_lvf_mean_rt_ms: Decimal | None = None
    rh_lvf_median_rt_ms: Decimal | None = None
    rh_lvf_sd_rt_ms: Decimal | None = None

    rh_rvf_total_trials: int
    rh_rvf_valid_rt_trials: int
    rh_rvf_timeout_trials: int
    rh_rvf_invalid_trials: int
    rh_rvf_accurate_trials: int
    rh_rvf_accuracy: Decimal | None = None
    rh_rvf_mean_rt_ms: Decimal | None = None
    rh_rvf_median_rt_ms: Decimal | None = None
    rh_rvf_sd_rt_ms: Decimal | None = None

    mean_rt_crossed_ms: Decimal | None = None
    mean_rt_uncrossed_ms: Decimal | None = None
    ihtt_difference_ms: Decimal | None = None
    accuracy_crossed: Decimal | None = None
    accuracy_uncrossed: Decimal | None = None


class PoffenbergerTrialCreate(BaseModel):
    run_id: UUID
    session_id: UUID
    participant_uuid: UUID
    block_number: int = Field(..., ge=0)
    trial_number: int = Field(..., ge=1)
    global_trial_number: int = Field(..., ge=1)
    response_hand: PoffenbergerResponseHand
    visual_field: PoffenbergerVisualField
    condition_key: PoffenbergerConditionKey
    is_practice: bool
    is_scored: bool
    expected_key: str = Field(..., min_length=1)
    pressed_key: str | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0)
    is_valid_response: bool
    is_timeout: bool
    is_accurate: bool
    jitter_ms: int = Field(..., ge=0)
    client_trial_started_at_ms: Decimal | None = Field(default=None, ge=0)
    client_stimulus_onset_ms: Decimal | None = Field(default=None, ge=0)
    client_response_at_ms: Decimal | None = Field(default=None, ge=0)
    client_trial_ended_at_ms: Decimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_trial_flags(self) -> "PoffenbergerTrialCreate":
        if self.is_practice and self.is_scored:
            raise ValueError("practice trials must not be marked scored")
        expected_condition = (
            ("lh" if self.response_hand == "left" else "rh")
            + "_"
            + self.visual_field
        )
        if self.condition_key != expected_condition:
            raise ValueError("condition_key must match response_hand and visual_field")
        return self


class PoffenbergerTrialResponse(PoffenbergerTrialCreate):
    model_config = ConfigDict(from_attributes=True)

    trial_id: UUID
    created_at: datetime


__all__ = [
    "PoffenbergerConditionKey",
    "PoffenbergerConditionSummary",
    "PoffenbergerDashboardResponse",
    "PoffenbergerDashboardRunItem",
    "PoffenbergerBlockManifest",
    "PoffenbergerExperimentalTrialManifest",
    "PoffenbergerManifest",
    "PoffenbergerPracticeTrialManifest",
    "PoffenbergerResponseHand",
    "PoffenbergerRunCreate",
    "PoffenbergerRunResponse",
    "PoffenbergerStartRequest",
    "PoffenbergerStartResponse",
    "PoffenbergerSubmittedTrial",
    "PoffenbergerSubmitRequest",
    "PoffenbergerSubmitResponse",
    "PoffenbergerTrialCreate",
    "PoffenbergerTrialResponse",
    "PoffenbergerVisualField",
    "HANDEDNESS_OPTIONS",
]
