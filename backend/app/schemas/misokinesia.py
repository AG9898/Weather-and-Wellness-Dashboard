from __future__ import annotations

from datetime import datetime
from decimal import Decimal
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
# RA dashboard
# ---------------------------------------------------------------------------


class MisoDashboardSessionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    misokinesia_participant_number: int
    started_at: datetime
    completed_at: Optional[datetime]
    age: Optional[int]
    sex: Optional[str]
    residence_status: Optional[str]
    avg_clip_score: Optional[float]


class MisoDashboardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active_stimuli_count: int
    recent_sessions: list[MisoDashboardSessionItem]


class MisoVideoScoreItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    video_label: str
    avg_score: float
    response_count: int


class MisoVideoScoresResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    top_5: list[MisoVideoScoreItem]
    bottom_5: list[MisoVideoScoreItem]


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
# Demographics (participant-facing, PATCH)
# ---------------------------------------------------------------------------

_VALID_SEXES = {"Male", "Female"}
_VALID_RESIDENCE_STATUSES = {
    "Canadian Citizenship",
    "Permanent Resident",
    "Student Visa",
    "Other",
}
_VALID_STUDENT_TYPES = {"Domestic", "International"}
_VALID_HIGHEST_EDUCATION = {
    "Elementary or middle school",
    "High school or equivalent (e.g., GED)",
    "College diploma",
    "Bachelors degree",
    "Masters degree",
    "Doctorate degree",
}
_VALID_AGREEMENT_SCALE = {
    "Strongly agree",
    "Agree",
    "Neither agree nor disagree",
    "Disagree",
    "Strongly disagree",
}
_VALID_ENGLISH_FREQUENCY = {"Always", "Often", "Sometimes", "Rarely", "Never"}
_VALID_ADHD_MEDICATION = {"Yes", "Maybe", "No"}
_VALID_RELATIONSHIP_STATUSES = {
    "Single",
    "In a relationship",
    "Married (and not separated)",
    "Common-law",
    "Seperated",
    "Divorced",
    "Widowed",
    "Other",
    "None of the Above",
}
_VALID_OCCUPATIONAL_STATUSES = {
    "Employed full-time",
    "Employed part-time",
    "Out of work but looking for work",
    "Out of work and not looking for work",
    "Homemaker",
    "Student",
    "Military",
    "Retired",
    "Unable to work",
    "Other",
    "None of the above",
}
_VALID_ETHNICITIES = {
    "European Canadian",
    "Chinese",
    "South Asian",
    "Filipino",
    "Southeast Asian",
    "Japanese",
    "Latin American",
    "Korean",
    "Other",
}
_VALID_LANGUAGES = {
    "French",
    "Mandarin",
    "Cantonese",
    "Hindi",
    "Punjabi",
    "Korean",
    "None",
    "Other",
}
_VALID_INSTRUCTION_LANGUAGES = {
    "French",
    "Mandarin",
    "Cantonese",
    "Hindi",
    "Punjabi",
    "Korean",
    "Other",
}
_VALID_DIAGNOSED_DISORDERS = {
    "Neurological Disorder",
    "Generalized Anxiety Disorder",
    "Depression",
    "Mood Disorder",
    "Substance Use Disorder",
    "Other",
    "N/A",
}
_VALID_REGULAR_SUBSTANCES = {
    "Alcohol",
    "Cannabis",
    "Tobacco",
    "Vaping",
    "Caffeinated Stimulants (coffee, energy drinks, etc.)",
    "Other",
    "None of the Above",
}


def _validate_optional_choice(
    value: str | None,
    allowed: set[str],
    field_name: str,
) -> None:
    if value is not None and value not in allowed:
        raise ValueError(f"{field_name} must be one of: {sorted(allowed)}")


def _validate_optional_choices(
    value: list[str] | None,
    allowed: set[str],
    field_name: str,
) -> None:
    if value is None:
        return
    invalid = sorted(set(value) - allowed)
    if invalid:
        raise ValueError(f"{field_name} contains invalid values: {invalid}")


def _validate_other_text(
    *,
    selected: str | list[str] | None,
    other_text: str | None,
    field_name: str,
    text_field_name: str,
) -> None:
    has_other = (
        "Other" in selected
        if isinstance(selected, list)
        else selected == "Other"
    )
    has_text = other_text is not None and other_text.strip() != ""
    if has_other and not has_text:
        raise ValueError(f"{text_field_name} is required when {field_name} includes Other")
    if has_text and not has_other:
        raise ValueError(f"{text_field_name} may only be set when {field_name} includes Other")


def _validate_exclusive_choice(
    value: list[str] | None,
    exclusive_value: str,
    field_name: str,
) -> None:
    if value is not None and exclusive_value in value and len(value) > 1:
        raise ValueError(f"{exclusive_value} is exclusive in {field_name}")


class MisoDemographicsCreate(BaseModel):
    age: Optional[int] = Field(default=None, ge=0, le=100)
    sex: Optional[str] = None
    gender_identity: Optional[str] = None
    years_lived_canada: Optional[int] = Field(default=None, ge=0, le=100)
    residence_status: Optional[str] = None
    residence_status_other_text: Optional[str] = None
    student_type: Optional[str] = None
    total_years_education: Optional[int] = Field(default=None, ge=0, le=100)
    cumulative_gpa: Optional[Decimal] = Field(default=None, ge=0, le=5)
    majors_text: Optional[str] = None
    highest_education_completed: Optional[str] = None
    ethnicity: Optional[list[str]] = None
    ethnicity_other_text: Optional[str] = None
    native_language: Optional[str] = None
    english_fluency: Optional[str] = None
    fluent_languages: Optional[list[str]] = None
    fluent_languages_other_text: Optional[str] = None
    english_speaking_frequency: Optional[str] = None
    non_english_schooling: Optional[bool] = None
    instruction_languages: Optional[list[str]] = None
    instruction_languages_other_text: Optional[str] = None
    diagnosed_disorders: Optional[list[str]] = None
    diagnosed_disorders_other_text: Optional[str] = None
    adhd_diagnosis: Optional[bool] = None
    adhd_medication: Optional[str] = None
    avid_videogamer: Optional[bool] = None
    video_game_hours_per_week: Optional[int] = Field(default=None, ge=0, le=100)
    prescription_stimulants: Optional[bool] = None
    regular_substances: Optional[list[str]] = None
    regular_substances_other_text: Optional[str] = None
    relationship_status: Optional[str] = None
    relationship_status_other_text: Optional[str] = None
    occupational_status: Optional[str] = None
    occupational_status_other_text: Optional[str] = None

    @model_validator(mode="after")
    def validate_demographics(self) -> "MisoDemographicsCreate":
        _validate_optional_choice(self.sex, _VALID_SEXES, "sex")
        _validate_optional_choice(
            self.residence_status,
            _VALID_RESIDENCE_STATUSES,
            "residence_status",
        )
        _validate_optional_choice(self.student_type, _VALID_STUDENT_TYPES, "student_type")
        _validate_optional_choice(
            self.highest_education_completed,
            _VALID_HIGHEST_EDUCATION,
            "highest_education_completed",
        )
        _validate_optional_choice(
            self.english_fluency,
            _VALID_AGREEMENT_SCALE,
            "english_fluency",
        )
        _validate_optional_choice(
            self.english_speaking_frequency,
            _VALID_ENGLISH_FREQUENCY,
            "english_speaking_frequency",
        )
        _validate_optional_choice(
            self.adhd_medication,
            _VALID_ADHD_MEDICATION,
            "adhd_medication",
        )
        _validate_optional_choice(
            self.relationship_status,
            _VALID_RELATIONSHIP_STATUSES,
            "relationship_status",
        )
        _validate_optional_choice(
            self.occupational_status,
            _VALID_OCCUPATIONAL_STATUSES,
            "occupational_status",
        )
        _validate_optional_choices(self.ethnicity, _VALID_ETHNICITIES, "ethnicity")
        _validate_optional_choices(
            self.fluent_languages,
            _VALID_LANGUAGES,
            "fluent_languages",
        )
        _validate_optional_choices(
            self.instruction_languages,
            _VALID_INSTRUCTION_LANGUAGES,
            "instruction_languages",
        )
        _validate_optional_choices(
            self.diagnosed_disorders,
            _VALID_DIAGNOSED_DISORDERS,
            "diagnosed_disorders",
        )
        _validate_optional_choices(
            self.regular_substances,
            _VALID_REGULAR_SUBSTANCES,
            "regular_substances",
        )

        _validate_other_text(
            selected=self.residence_status,
            other_text=self.residence_status_other_text,
            field_name="residence_status",
            text_field_name="residence_status_other_text",
        )
        _validate_other_text(
            selected=self.ethnicity,
            other_text=self.ethnicity_other_text,
            field_name="ethnicity",
            text_field_name="ethnicity_other_text",
        )
        _validate_other_text(
            selected=self.fluent_languages,
            other_text=self.fluent_languages_other_text,
            field_name="fluent_languages",
            text_field_name="fluent_languages_other_text",
        )
        _validate_other_text(
            selected=self.instruction_languages,
            other_text=self.instruction_languages_other_text,
            field_name="instruction_languages",
            text_field_name="instruction_languages_other_text",
        )
        _validate_other_text(
            selected=self.diagnosed_disorders,
            other_text=self.diagnosed_disorders_other_text,
            field_name="diagnosed_disorders",
            text_field_name="diagnosed_disorders_other_text",
        )
        _validate_other_text(
            selected=self.regular_substances,
            other_text=self.regular_substances_other_text,
            field_name="regular_substances",
            text_field_name="regular_substances_other_text",
        )
        _validate_other_text(
            selected=self.relationship_status,
            other_text=self.relationship_status_other_text,
            field_name="relationship_status",
            text_field_name="relationship_status_other_text",
        )
        _validate_other_text(
            selected=self.occupational_status,
            other_text=self.occupational_status_other_text,
            field_name="occupational_status",
            text_field_name="occupational_status_other_text",
        )

        _validate_exclusive_choice(self.fluent_languages, "None", "fluent_languages")
        _validate_exclusive_choice(self.diagnosed_disorders, "N/A", "diagnosed_disorders")
        _validate_exclusive_choice(
            self.regular_substances,
            "None of the Above",
            "regular_substances",
        )

        if self.non_english_schooling is not True:
            if self.instruction_languages is not None:
                raise ValueError(
                    "instruction_languages may only be set when non_english_schooling is true"
                )
            if self.instruction_languages_other_text is not None:
                raise ValueError(
                    "instruction_languages_other_text may only be set when non_english_schooling is true"
                )
        elif not self.instruction_languages:
            raise ValueError(
                "instruction_languages is required when non_english_schooling is true"
            )

        if self.avid_videogamer is not True:
            if self.video_game_hours_per_week is not None:
                raise ValueError(
                    "video_game_hours_per_week may only be set when avid_videogamer is true"
                )
        elif self.video_game_hours_per_week is None:
            raise ValueError(
                "video_game_hours_per_week is required when avid_videogamer is true"
            )

        return self


class MisoDemographicsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    misokinesia_participant_id: UUID


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


class MisoGAD7Create(BaseModel):
    r1: int = Field(..., ge=1, le=4)
    r2: int = Field(..., ge=1, le=4)
    r3: int = Field(..., ge=1, le=4)
    r4: int = Field(..., ge=1, le=4)
    r5: int = Field(..., ge=1, le=4)
    r6: int = Field(..., ge=1, le=4)
    r7: int = Field(..., ge=1, le=4)


class MisoGAD7Response(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    response_id: UUID
    total_score: int
    severity_band: str


class MisoMAQCreate(BaseModel):
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


class MisoMAQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    response_id: UUID
    total_score: int


__all__ = [
    "MisokinesiaClipMeta",
    "MisokinesiaManifestResponse",
    "MisokinesiaTrialManifestResponse",
    "MisoDashboardSessionItem",
    "MisoDashboardResponse",
    "MisokinesiaParticipantResponse",
    "MisokinesiaTrialResponseCreate",
    "MisokinesiaTrialResponseResponse",
    "MisokinesiaEndOfTaskCreate",
    "MisokinesiaEndOfTaskResponse",
    "MisokinesiaAqCreate",
    "MisokinesiaAqResponse",
    "MisoGAD7Create",
    "MisoGAD7Response",
    "MisoMAQCreate",
    "MisoMAQResponse",
    "MisoDemographicsCreate",
    "MisoDemographicsResponse",
]
