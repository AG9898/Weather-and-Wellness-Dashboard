from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models.sessions import Session
from app.services.session_status import guard_session_write


def _session(*, status: str, voided: bool = False) -> Session:
    return Session(
        session_id=uuid.uuid4(),
        participant_uuid=uuid.uuid4(),
        status=status,
        voided_at=datetime.now(timezone.utc) if voided else None,
    )


def test_created_session_activates_and_stamps_timestamp() -> None:
    session = _session(status="created")

    returned = guard_session_write(session)

    assert returned is session
    assert session.status == "active"
    assert session.activated_at is not None


def test_active_session_passes_without_replacing_activation_timestamp() -> None:
    session = _session(status="active")
    session.activated_at = None

    guard_session_write(session)

    assert session.status == "active"
    assert session.activated_at is None


@pytest.mark.parametrize(
    ("session_status", "voided"),
    [("complete", False), ("active", True)],
)
def test_complete_or_voided_session_is_rejected(
    session_status: str,
    voided: bool,
) -> None:
    with pytest.raises(HTTPException) as exc_info:
        guard_session_write(_session(status=session_status, voided=voided))

    assert exc_info.value.status_code == 409
