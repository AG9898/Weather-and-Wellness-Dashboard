from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.sessions import Session


def guard_session_write(session_obj: Session) -> Session:
    """Accept a writable session, activating a created session on first write."""
    if (
        getattr(session_obj, "voided_at", None) is not None
        or session_obj.status == "complete"
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session is complete or voided",
        )
    if session_obj.status == "created":
        session_obj.status = "active"
        session_obj.activated_at = datetime.now(timezone.utc)
    elif session_obj.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session is not writable",
        )
    return session_obj
