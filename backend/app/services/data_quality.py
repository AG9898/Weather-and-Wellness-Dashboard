from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.misokinesia import MisokinesiaParticipant
from app.models.participants import Participant
from app.models.poffenberger import PoffenbergerRun
from app.models.sessions import Session

SessionClassification = Literal[
    "complete",
    "partial",
    "empty_active",
    "empty_stale",
    "voided",
]
StudySlug = Literal["weather", "misokinesia", "poffenberger"]

STALE_SESSION_THRESHOLD = timedelta(hours=2)
VALID_RUN_STATUSES = frozenset({"active", "complete"})

_WEATHER_REQUIRED_DEMOGRAPHICS = (
    "age_band",
    "gender",
    "origin",
    "commute_method",
    "time_outside",
)
_POFFENBERGER_REQUIRED_DEMOGRAPHICS = (
    "age_band",
    "gender",
    "handedness",
)
_MISOKINESIA_REQUIRED_DEMOGRAPHICS = (
    "age",
    "sex",
    "gender_identity",
    "years_lived_canada",
    "residence_status",
    "student_type",
    "total_years_education",
    "cumulative_gpa",
    "majors_text",
    "highest_education_completed",
    "ethnicity",
    "native_language",
    "english_fluency",
    "fluent_languages",
    "english_speaking_frequency",
    "non_english_schooling",
    "diagnosed_disorders",
    "adhd_diagnosis",
    "adhd_medication",
    "avid_videogamer",
    "prescription_stimulants",
    "regular_substances",
    "relationship_status",
    "occupational_status",
)


@dataclass(frozen=True, slots=True)
class SessionDataQualityRow:
    study: StudySlug
    lab: str
    participant_number: int
    session_id: uuid.UUID
    run_id: uuid.UUID | None
    created_at: datetime
    activated_at: datetime | None
    completed_at: datetime | None
    classification: SessionClassification
    demographics_missing: bool


def is_valid_run(*, status: str, voided_at: datetime | None) -> bool:
    """Return the canonical reporting-validity decision for a session."""
    return status in VALID_RUN_STATUSES and voided_at is None


def classify_session(
    *,
    status: str,
    created_at: datetime,
    completed_at: datetime | None,
    voided_at: datetime | None,
    now: datetime,
    stale_threshold: timedelta = STALE_SESSION_THRESHOLD,
) -> SessionClassification:
    """Classify a session using duration-based, timezone-independent age."""
    if voided_at is not None:
        return "voided"
    if completed_at is not None:
        return "complete"
    if status == "active":
        return "partial"
    if status == "created":
        if now - created_at >= stale_threshold:
            return "empty_stale"
        return "empty_active"
    raise ValueError(f"Unsupported incomplete session status: {status!r}")


def _is_missing(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, tuple, set, frozenset)):
        return len(value) == 0
    return False


def _has_missing_fields(source: object, fields: tuple[str, ...]) -> bool:
    return any(_is_missing(getattr(source, field, None)) for field in fields)


def _weather_demographics_missing(participant: Participant) -> bool:
    if _has_missing_fields(participant, _WEATHER_REQUIRED_DEMOGRAPHICS):
        return True
    if participant.origin == "Other" and _is_missing(participant.origin_other_text):
        return True
    return participant.commute_method == "Other" and _is_missing(
        participant.commute_method_other_text
    )


def _misokinesia_demographics_missing(
    participant: MisokinesiaParticipant,
) -> bool:
    if _has_missing_fields(participant, _MISOKINESIA_REQUIRED_DEMOGRAPHICS):
        return True

    conditional_other_fields = (
        (participant.residence_status, "Other", participant.residence_status_other_text),
        (participant.ethnicity, "Other", participant.ethnicity_other_text),
        (participant.fluent_languages, "Other", participant.fluent_languages_other_text),
        (
            participant.diagnosed_disorders,
            "Other",
            participant.diagnosed_disorders_other_text,
        ),
        (
            participant.regular_substances,
            "Other",
            participant.regular_substances_other_text,
        ),
        (
            participant.relationship_status,
            "Other",
            participant.relationship_status_other_text,
        ),
        (
            participant.occupational_status,
            "Other",
            participant.occupational_status_other_text,
        ),
    )
    for selected, trigger, detail in conditional_other_fields:
        includes_trigger = (
            trigger in selected
            if isinstance(selected, (list, tuple, set, frozenset))
            else selected == trigger
        )
        if includes_trigger and _is_missing(detail):
            return True

    if participant.non_english_schooling is True:
        if _is_missing(participant.instruction_languages):
            return True
        if (
            "Other" in participant.instruction_languages
            and _is_missing(participant.instruction_languages_other_text)
        ):
            return True
    return participant.avid_videogamer is True and _is_missing(
        participant.video_game_hours_per_week
    )


def build_session_data_quality_row(
    session: Session,
    participant: Participant,
    misokinesia_participant: MisokinesiaParticipant | None,
    poffenberger_run: PoffenbergerRun | None,
    *,
    now: datetime,
) -> SessionDataQualityRow:
    """Attribute and classify one joined session row."""
    if misokinesia_participant is not None and poffenberger_run is not None:
        raise ValueError(f"Session {session.session_id} belongs to multiple studies")

    if misokinesia_participant is not None:
        study: StudySlug = "misokinesia"
        lab = "ww"
        run_id = misokinesia_participant.misokinesia_participant_id
        demographics_missing = _misokinesia_demographics_missing(
            misokinesia_participant
        )
    elif poffenberger_run is not None:
        study = "poffenberger"
        lab = "ihtt"
        run_id = poffenberger_run.run_id
        demographics_missing = _has_missing_fields(
            participant,
            _POFFENBERGER_REQUIRED_DEMOGRAPHICS,
        )
    else:
        study = "weather"
        lab = "ww"
        run_id = None
        demographics_missing = _weather_demographics_missing(participant)

    return SessionDataQualityRow(
        study=study,
        lab=lab,
        participant_number=participant.participant_number,
        session_id=session.session_id,
        run_id=run_id,
        created_at=session.created_at,
        activated_at=session.activated_at,
        completed_at=session.completed_at,
        classification=classify_session(
            status=session.status,
            created_at=session.created_at,
            completed_at=session.completed_at,
            voided_at=session.voided_at,
            now=now,
        ),
        demographics_missing=demographics_missing,
    )


async def get_session_data_quality_rows(
    db: AsyncSession,
    *,
    now: datetime | None = None,
) -> list[SessionDataQualityRow]:
    """Return classified sessions across Weather, Misokinesia, and IHTT."""
    evaluated_at = now or datetime.now(timezone.utc)
    statement = (
        select(Session, Participant, MisokinesiaParticipant, PoffenbergerRun)
        .join(Participant, Participant.participant_uuid == Session.participant_uuid)
        .outerjoin(
            MisokinesiaParticipant,
            MisokinesiaParticipant.session_id == Session.session_id,
        )
        .outerjoin(PoffenbergerRun, PoffenbergerRun.session_id == Session.session_id)
        .order_by(Session.created_at.desc())
    )
    result = await db.execute(statement)
    return [
        build_session_data_quality_row(
            session,
            participant,
            misokinesia_participant,
            poffenberger_run,
            now=evaluated_at,
        )
        for session, participant, misokinesia_participant, poffenberger_run in result.all()
    ]
