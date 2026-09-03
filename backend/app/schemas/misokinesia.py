from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Session locale
# ---------------------------------------------------------------------------

# Supported Misokinesia session locales. Component-scoped: `ko` is not an
# available locale anywhere outside the Misokinesia component. See
# docs/labs/weather-wellness/misokinesia/LOCALIZATION.md.
MISO_LOCALES = ("en", "ko")
_DEFAULT_LOCALE = "en"


# ---------------------------------------------------------------------------
# Manifest (start session response)
# ---------------------------------------------------------------------------

class MisokinesiaClipMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stimulus_id: UUID
    public_url: str
    sort_order: int
    duration_ms: int


class MisokinesiaStartRequest(BaseModel):
    """Optional body for POST /misokinesia/start.

    ``language`` is the session locale selected by the RA before the participant
    begins. It is fixed for the lifetime of the session and selects
    participant-facing labels only; stored choice values remain
    language-independent option keys. See LOCALIZATION.md.
    """

    language: str = _DEFAULT_LOCALE

    @model_validator(mode="after")
    def validate_language(self) -> "MisokinesiaStartRequest":
        if self.language not in MISO_LOCALES:
            raise ValueError(f"language must be one of: {sorted(MISO_LOCALES)}")
        return self


class MisokinesiaManifestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    misokinesia_participant_id: UUID
    misokinesia_participant_number: int
    session_id: UUID
    post_survey_order: str
    language: str
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

# Choice values are stored as language-independent option keys, registered in
# docs/labs/weather-wellness/misokinesia/LOCALIZATION.md section 2. English
# display strings never reach the API; the frontend maps keys to labels per
# locale. Legacy rows were rewritten to keys by migration 20260903_000001.

_VALID_SEXES = {"sex_male", "sex_female"}
_VALID_RESIDENCE_STATUSES = {
    "residence_citizenship",
    "residence_permanent_resident",
    "residence_student_visa",
    "residence_other",
}
_VALID_STUDENT_TYPES = {"student_domestic", "student_international"}
_VALID_HIGHEST_EDUCATION = {
    "education_elementary_middle",
    "education_high_school",
    "education_college_diploma",
    "education_bachelors",
    "education_masters",
    "education_doctorate",
}
_VALID_AGREEMENT_SCALE = {
    "fluency_strongly_agree",
    "fluency_agree",
    "fluency_neutral",
    "fluency_disagree",
    "fluency_strongly_disagree",
}
_VALID_ENGLISH_FREQUENCY = {
    "frequency_always",
    "frequency_often",
    "frequency_sometimes",
    "frequency_rarely",
    "frequency_never",
}
_VALID_GAD7_DIFFICULTY_IMPACTS = {
    "Not difficult at all",
    "Somewhat difficult",
    "Very difficult",
    "Extremely difficult",
}
_VALID_ADHD_MEDICATION = {"adhd_med_yes", "adhd_med_maybe", "adhd_med_no"}
_VALID_RELATIONSHIP_STATUSES = {
    "relationship_single",
    "relationship_in_relationship",
    "relationship_married",
    "relationship_common_law",
    "relationship_separated",
    "relationship_divorced",
    "relationship_widowed",
    "relationship_other",
    "relationship_none",
}
_VALID_OCCUPATIONAL_STATUSES = {
    "occupation_employed_full_time",
    "occupation_employed_part_time",
    "occupation_out_of_work_looking",
    "occupation_out_of_work_not_looking",
    "occupation_homemaker",
    "occupation_student",
    "occupation_military",
    "occupation_retired",
    "occupation_unable_to_work",
    "occupation_other",
    "occupation_none",
}
_VALID_ETHNICITIES = {
    "ethnicity_european",
    "ethnicity_chinese",
    "ethnicity_south_asian",
    "ethnicity_filipino",
    "ethnicity_southeast_asian",
    "ethnicity_japanese",
    "ethnicity_latin_american",
    "ethnicity_korean",
    "ethnicity_other",
}

# Case B — divergent option sets (LOCALIZATION.md section 2, Q14 and Q17).
# The reference language of the instrument is offered as a "fluent in addition"
# option only in the *other* locale: an en session may select Korean, a ko
# session may select English, and neither may select its own base language.
_SHARED_FLUENT_LANGUAGES = {
    "fluent_lang_french",
    "fluent_lang_mandarin",
    "fluent_lang_cantonese",
    "fluent_lang_hindi",
    "fluent_lang_punjabi",
    "fluent_lang_none",
    "fluent_lang_other",
}
FLUENT_LANGUAGES_BY_LOCALE: dict[str, set[str]] = {
    "en": _SHARED_FLUENT_LANGUAGES | {"fluent_lang_korean"},
    "ko": _SHARED_FLUENT_LANGUAGES | {"fluent_lang_english"},
}
# Union of every locale's set; the locale-agnostic schema validator uses this so
# unknown keys fail at parse time, and the locale-aware pass then narrows it.
_VALID_LANGUAGES = FLUENT_LANGUAGES_BY_LOCALE["en"] | FLUENT_LANGUAGES_BY_LOCALE["ko"]

_SHARED_INSTRUCTION_LANGUAGES = {
    "instruction_lang_french",
    "instruction_lang_mandarin",
    "instruction_lang_cantonese",
    "instruction_lang_hindi",
    "instruction_lang_punjabi",
    "instruction_lang_other",
}
INSTRUCTION_LANGUAGES_BY_LOCALE: dict[str, set[str]] = {
    "en": _SHARED_INSTRUCTION_LANGUAGES | {"instruction_lang_korean"},
    "ko": _SHARED_INSTRUCTION_LANGUAGES | {"instruction_lang_english"},
}
_VALID_INSTRUCTION_LANGUAGES = (
    INSTRUCTION_LANGUAGES_BY_LOCALE["en"] | INSTRUCTION_LANGUAGES_BY_LOCALE["ko"]
)

# Korean universities cap the GPA scale at 4.5 (or 4.3); Canadian programs go to
# 5.0. LOCALIZATION.md section 3.
GPA_MAX_BY_LOCALE: dict[str, Decimal] = {
    "en": Decimal("5.0"),
    "ko": Decimal("4.5"),
}
# Widest bound across locales; the per-locale pass narrows it.
_GPA_ABSOLUTE_MAX = max(GPA_MAX_BY_LOCALE.values())

_VALID_DIAGNOSED_DISORDERS = {
    "disorder_neurological",
    "disorder_generalized_anxiety",
    "disorder_depression",
    "disorder_mood",
    "disorder_substance_use",
    "disorder_other",
    "disorder_na",
}
_VALID_REGULAR_SUBSTANCES = {
    "substance_alcohol",
    "substance_cannabis",
    "substance_tobacco",
    "substance_vaping",
    "substance_caffeine",
    "substance_other",
    "substance_none",
}


# Option key that gates each field's free-text follow-up, keyed by the field it
# belongs to. Single source of truth for the request validators below and for
# downstream consumers that must detect an "other" selection without a
# follow-up (app/services/data_quality.py). Never compare against the English
# display string "Other": a ko participant selecting 기타 stores the same key.
OTHER_TEXT_OPTION_KEYS: dict[str, str] = {
    "residence_status": "residence_other",
    "ethnicity": "ethnicity_other",
    "fluent_languages": "fluent_lang_other",
    "instruction_languages": "instruction_lang_other",
    "diagnosed_disorders": "disorder_other",
    "regular_substances": "substance_other",
    "relationship_status": "relationship_other",
    "occupational_status": "occupation_other",
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
    other_key: str,
) -> None:
    """Gate a free-text follow-up on the field's ``other`` option KEY.

    The trigger is the registered option key (e.g. ``ethnicity_other``), never
    the English display string ``"Other"`` — a ko participant selecting 기타
    submits the same key as an en participant selecting Other.
    """
    has_other = (
        other_key in selected
        if isinstance(selected, list)
        else selected == other_key
    )
    has_text = other_text is not None and other_text.strip() != ""
    if has_other and not has_text:
        raise ValueError(
            f"{text_field_name} is required when {field_name} includes {other_key}"
        )
    if has_text and not has_other:
        raise ValueError(
            f"{text_field_name} may only be set when {field_name} includes {other_key}"
        )


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
    # Widest bound across locales; ``validate_demographics_for_locale`` narrows
    # it to 4.5 for a ko session. See LOCALIZATION.md section 3.
    cumulative_gpa: Optional[Decimal] = Field(
        default=None, ge=0, le=_GPA_ABSOLUTE_MAX
    )
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
            other_key=OTHER_TEXT_OPTION_KEYS["residence_status"],
        )
        _validate_other_text(
            selected=self.ethnicity,
            other_text=self.ethnicity_other_text,
            field_name="ethnicity",
            text_field_name="ethnicity_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["ethnicity"],
        )
        _validate_other_text(
            selected=self.fluent_languages,
            other_text=self.fluent_languages_other_text,
            field_name="fluent_languages",
            text_field_name="fluent_languages_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["fluent_languages"],
        )
        _validate_other_text(
            selected=self.instruction_languages,
            other_text=self.instruction_languages_other_text,
            field_name="instruction_languages",
            text_field_name="instruction_languages_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["instruction_languages"],
        )
        _validate_other_text(
            selected=self.diagnosed_disorders,
            other_text=self.diagnosed_disorders_other_text,
            field_name="diagnosed_disorders",
            text_field_name="diagnosed_disorders_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["diagnosed_disorders"],
        )
        _validate_other_text(
            selected=self.regular_substances,
            other_text=self.regular_substances_other_text,
            field_name="regular_substances",
            text_field_name="regular_substances_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["regular_substances"],
        )
        _validate_other_text(
            selected=self.relationship_status,
            other_text=self.relationship_status_other_text,
            field_name="relationship_status",
            text_field_name="relationship_status_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["relationship_status"],
        )
        _validate_other_text(
            selected=self.occupational_status,
            other_text=self.occupational_status_other_text,
            field_name="occupational_status",
            text_field_name="occupational_status_other_text",
            other_key=OTHER_TEXT_OPTION_KEYS["occupational_status"],
        )

        _validate_exclusive_choice(
            self.fluent_languages,
            "fluent_lang_none",
            "fluent_languages",
        )
        _validate_exclusive_choice(
            self.diagnosed_disorders,
            "disorder_na",
            "diagnosed_disorders",
        )
        _validate_exclusive_choice(
            self.regular_substances,
            "substance_none",
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


def validate_demographics_for_locale(
    payload: MisoDemographicsCreate,
    language: str,
) -> None:
    """Apply the validation rules that depend on the session locale.

    ``MisoDemographicsCreate`` alone cannot enforce these: the locale lives on
    ``misokinesia_participants.language`` and is deliberately not part of the
    request body, so a client cannot widen its own validation by claiming a
    different locale. The router resolves the stored language and calls this
    after the locale-agnostic model validation has passed.

    Raises ``ValueError`` (surfaced by the router as HTTP 422) when a value is
    outside the locale's allowed set. Rules are registered in
    ``docs/labs/weather-wellness/misokinesia/LOCALIZATION.md`` section 3.
    """

    if language not in MISO_LOCALES:
        raise ValueError(f"unsupported session language: {language!r}")

    _validate_optional_choices(
        payload.fluent_languages,
        FLUENT_LANGUAGES_BY_LOCALE[language],
        "fluent_languages",
    )
    _validate_optional_choices(
        payload.instruction_languages,
        INSTRUCTION_LANGUAGES_BY_LOCALE[language],
        "instruction_languages",
    )

    gpa_max = GPA_MAX_BY_LOCALE[language]
    if payload.cumulative_gpa is not None and payload.cumulative_gpa > gpa_max:
        raise ValueError(
            f"cumulative_gpa must be less than or equal to {gpa_max} "
            f"for locale {language!r}"
        )


# ---------------------------------------------------------------------------
# End-of-task questionnaire
# ---------------------------------------------------------------------------

# Language-independent option keys (LOCALIZATION.md section 2, end-of-task
# `stronger_responses_timing`). The English display strings this field used to
# accept are no longer valid API values; the frontend maps keys to labels per
# locale.
_VALID_TIMING_OPTIONS = {
    "timing_immediately",
    "timing_after_5s",
    "timing_after_10s",
    "timing_end_of_video",
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
    r1: int = Field(..., ge=0, le=3)
    r2: int = Field(..., ge=0, le=3)
    r3: int = Field(..., ge=0, le=3)
    r4: int = Field(..., ge=0, le=3)
    r5: int = Field(..., ge=0, le=3)
    r6: int = Field(..., ge=0, le=3)
    r7: int = Field(..., ge=0, le=3)
    difficulty_impact: Optional[str] = None

    @model_validator(mode="after")
    def validate_difficulty_impact(self) -> "MisoGAD7Create":
        if (
            self.difficulty_impact is not None
            and self.difficulty_impact not in _VALID_GAD7_DIFFICULTY_IMPACTS
        ):
            raise ValueError("difficulty_impact must match a GAD-7 difficulty option.")

        if any(getattr(self, f"r{i}") > 0 for i in range(1, 8)) and not self.difficulty_impact:
            raise ValueError(
                "difficulty_impact is required when any GAD-7 problem is endorsed."
            )

        return self


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
