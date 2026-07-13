from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.data_quality import (
    STALE_SESSION_THRESHOLD,
    build_session_data_quality_row,
    classify_session,
    is_valid_run,
)

NOW = datetime(2026, 7, 12, 18, 0, tzinfo=timezone.utc)


def _classify(
    *,
    status: str,
    age: timedelta = timedelta(minutes=15),
    completed_at: datetime | None = None,
    voided_at: datetime | None = None,
) -> str:
    return classify_session(
        status=status,
        created_at=NOW - age,
        completed_at=completed_at,
        voided_at=voided_at,
        now=NOW,
    )


@pytest.mark.parametrize(
    ("status", "completed_at", "voided_at", "expected"),
    [
        ("complete", NOW, None, "complete"),
        ("active", None, None, "partial"),
        ("created", None, None, "empty_active"),
        ("complete", NOW, NOW, "voided"),
    ],
)
def test_classification_branches(
    status: str,
    completed_at: datetime | None,
    voided_at: datetime | None,
    expected: str,
) -> None:
    assert (
        _classify(
            status=status,
            completed_at=completed_at,
            voided_at=voided_at,
        )
        == expected
    )


def test_stale_threshold_boundary_is_two_hours() -> None:
    assert STALE_SESSION_THRESHOLD == timedelta(hours=2)
    assert (
        _classify(
            status="created",
            age=STALE_SESSION_THRESHOLD - timedelta(microseconds=1),
        )
        == "empty_active"
    )
    assert (
        _classify(status="created", age=STALE_SESSION_THRESHOLD) == "empty_stale"
    )


@pytest.mark.parametrize(
    ("status", "voided_at", "expected"),
    [
        ("created", None, False),
        ("active", None, True),
        ("complete", None, True),
        ("active", NOW, False),
        ("complete", NOW, False),
    ],
)
def test_valid_run_rule(
    status: str,
    voided_at: datetime | None,
    expected: bool,
) -> None:
    assert is_valid_run(status=status, voided_at=voided_at) is expected


def _session() -> SimpleNamespace:
    return SimpleNamespace(
        session_id=uuid.uuid4(),
        status="active",
        created_at=NOW - timedelta(minutes=30),
        activated_at=NOW - timedelta(minutes=29),
        completed_at=None,
        voided_at=None,
    )


def _participant(**overrides: object) -> SimpleNamespace:
    values: dict[str, object] = {
        "participant_number": 42,
        "age_band": "18-24",
        "gender": "Woman",
        "handedness": "Right",
        "origin": "Canada",
        "origin_other_text": None,
        "commute_method": "Walk",
        "commute_method_other_text": None,
        "time_outside": "30-60 minutes",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _complete_misokinesia_demographics(**overrides: object) -> SimpleNamespace:
    values: dict[str, object] = {
        "misokinesia_participant_id": uuid.uuid4(),
        "age": 20,
        "sex": "Female",
        "gender_identity": "Woman",
        "years_lived_canada": 10,
        "residence_status": "Citizen",
        "residence_status_other_text": None,
        "student_type": "Undergraduate",
        "total_years_education": 14,
        "cumulative_gpa": 4,
        "majors_text": "Psychology",
        "highest_education_completed": "High school",
        "ethnicity": ["East Asian"],
        "ethnicity_other_text": None,
        "native_language": "English",
        "english_fluency": "Strongly agree",
        "fluent_languages": ["English"],
        "fluent_languages_other_text": None,
        "english_speaking_frequency": "Always",
        "non_english_schooling": False,
        "instruction_languages": None,
        "instruction_languages_other_text": None,
        "diagnosed_disorders": ["N/A"],
        "diagnosed_disorders_other_text": None,
        "adhd_diagnosis": False,
        "adhd_medication": "Not applicable",
        "avid_videogamer": False,
        "video_game_hours_per_week": None,
        "prescription_stimulants": False,
        "regular_substances": ["None of the Above"],
        "regular_substances_other_text": None,
        "relationship_status": "Single",
        "relationship_status_other_text": None,
        "occupational_status": "Student",
        "occupational_status_other_text": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_weather_session_attribution_and_demographics() -> None:
    row = build_session_data_quality_row(
        _session(),
        _participant(),
        None,
        None,
        now=NOW,
    )
    assert (row.study, row.lab, row.run_id) == ("weather", "ww", None)
    assert row.demographics_missing is False


def test_weather_conditional_demographics_are_required() -> None:
    row = build_session_data_quality_row(
        _session(),
        _participant(origin="Other", origin_other_text=" "),
        None,
        None,
        now=NOW,
    )
    assert row.demographics_missing is True


def test_misokinesia_session_attribution_and_demographics() -> None:
    misokinesia = _complete_misokinesia_demographics()
    row = build_session_data_quality_row(
        _session(),
        _participant(age_band=None, gender=None, handedness=None),
        misokinesia,
        None,
        now=NOW,
    )
    assert (row.study, row.lab, row.run_id) == (
        "misokinesia",
        "ww",
        misokinesia.misokinesia_participant_id,
    )
    assert row.demographics_missing is False


def test_misokinesia_missing_demographics_are_flagged() -> None:
    row = build_session_data_quality_row(
        _session(),
        _participant(),
        _complete_misokinesia_demographics(age=None),
        None,
        now=NOW,
    )
    assert row.demographics_missing is True


def test_poffenberger_session_attribution_and_demographics() -> None:
    run = SimpleNamespace(run_id=uuid.uuid4())
    row = build_session_data_quality_row(
        _session(),
        _participant(),
        None,
        run,
        now=NOW,
    )
    assert (row.study, row.lab, row.run_id) == (
        "poffenberger",
        "ihtt",
        run.run_id,
    )
    assert row.demographics_missing is False


def test_poffenberger_missing_demographics_are_flagged() -> None:
    row = build_session_data_quality_row(
        _session(),
        _participant(handedness=None),
        None,
        SimpleNamespace(run_id=uuid.uuid4()),
        now=NOW,
    )
    assert row.demographics_missing is True
