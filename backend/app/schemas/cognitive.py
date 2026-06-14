from __future__ import annotations

from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StroopTrialSubmission(BaseModel):
    trial_number: int = Field(..., ge=1)
    condition: Literal["congruent", "incongruent"]
    word: str = Field(..., min_length=1)
    ink_color: str = Field(..., min_length=1)
    response_key: str | None = None
    response_color: str | None = None
    reaction_time_ms: int | None = Field(default=None, ge=0)
    timed_out: bool

    @model_validator(mode="after")
    def _check_response_consistency(self) -> "StroopTrialSubmission":
        if self.timed_out:
            if self.reaction_time_ms is not None:
                raise ValueError("timed_out trials must not carry a reaction_time_ms")
        else:
            if self.response_color is None:
                raise ValueError("non-timeout trials require a response_color")
        return self


class StroopRunCreate(BaseModel):
    session_id: UUID
    trials: list[StroopTrialSubmission] = Field(..., min_length=1)

    @model_validator(mode="after")
    def _check_unique_trial_numbers(self) -> "StroopRunCreate":
        numbers = [t.trial_number for t in self.trials]
        if len(numbers) != len(set(numbers)):
            raise ValueError("trial_number values must be unique within a run")
        return self


class StroopRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: UUID
    total_trials: int
    correct_trials: int
    error_trials: int
    timeout_trials: int
    overall_accuracy: Decimal
    congruent_accuracy: Decimal | None = None
    incongruent_accuracy: Decimal | None = None
    mean_rt_congruent_ms: Decimal | None = None
    mean_rt_incongruent_ms: Decimal | None = None
    stroop_interference_ms: Decimal | None = None


class CardSortingTrialSubmission(BaseModel):
    trial_number: int = Field(..., ge=1, le=64)
    card_color: str = Field(..., min_length=1)
    card_shape: str = Field(..., min_length=1)
    card_number: int = Field(..., ge=1)
    selected_reference_index: int = Field(..., ge=1, le=4)
    reaction_time_ms: int | None = Field(default=None, ge=0)


class CardSortingRunCreate(BaseModel):
    session_id: UUID
    trials: list[CardSortingTrialSubmission] = Field(..., min_length=1, max_length=64)


class CardSortingRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    run_id: UUID
    total_trials: int
    categories_completed: int
    total_correct: int
    total_errors: int
    perseverative_responses: int
    perseverative_errors: int
    nonperseverative_errors: int
    trials_to_first_category: int | None = None
    failure_to_maintain_set_count: int


__all__ = [
    "CardSortingRunCreate",
    "CardSortingRunResponse",
    "CardSortingTrialSubmission",
    "StroopRunCreate",
    "StroopRunResponse",
    "StroopTrialSubmission",
]
