"""Regression tests for undo-last-session service and router (T99).

Covers:
- get_last_native_session: None when no native sessions exist; correct fields when found
- delete_last_native_session: 404 on no candidate, FK-safe table deletions, conditional
  participant deletion, audit row written, weather tables never touched
- DELETE /sessions/last-native router: registration, confirm=False guard, response mapping,
  404 propagation
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.routing import APIRoute

from app.auth import LabMember, get_current_lab_member
from app.models.undo import AdminSessionUndoLog
from app.routers.sessions import delete_last_native, router
from app.schemas.sessions import UndoLastSessionRequest, UndoLastSessionResponse
from app.services.undo_service import (
    SessionCandidateInfo,
    UndoDeleteResult,
    delete_last_native_session,
    get_last_native_session,
)

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

_SESSION_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_PARTICIPANT_UUID = uuid.UUID("22222222-2222-2222-2222-222222222222")
_DELETER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
_CREATED_AT = datetime(2026, 3, 10, 12, 0, tzinfo=timezone.utc)


def _candidate() -> SessionCandidateInfo:
    return SessionCandidateInfo(
        session_id=_SESSION_ID,
        participant_uuid=_PARTICIPANT_UUID,
        participant_number=7,
        status="complete",
        created_at=_CREATED_AT,
    )


def _lab_member() -> LabMember:
    return LabMember(id=_DELETER_ID, email="ra@lab.test")


# ---------------------------------------------------------------------------
# Fakes — get_last_native_session
# ---------------------------------------------------------------------------


class _NamedRow:
    """Mimics a SQLAlchemy row returned by get_last_native_session's query."""

    def __init__(
        self,
        session_id: uuid.UUID,
        participant_uuid: uuid.UUID,
        participant_number: int,
        status: str,
        created_at: datetime,
    ) -> None:
        self.session_id = session_id
        self.participant_uuid = participant_uuid
        self.participant_number = participant_number
        self.status = status
        self.created_at = created_at


class _OneOrNoneResult:
    def __init__(self, row: _NamedRow | None) -> None:
        self._row = row

    def one_or_none(self) -> _NamedRow | None:
        return self._row


class _SelectFakeSession:
    """Fake AsyncSession for get_last_native_session: returns a configured row."""

    def __init__(self, row: _NamedRow | None) -> None:
        self._row = row

    async def execute(self, stmt: object) -> _OneOrNoneResult:  # noqa: ARG002
        return _OneOrNoneResult(self._row)


# ---------------------------------------------------------------------------
# Fakes — delete_last_native_session
# ---------------------------------------------------------------------------


class _ScalarOneResult:
    def __init__(self, value: int) -> None:
        self._value = value

    def scalar_one(self) -> int:
        return self._value


class _DummyResult:
    """Returned for DELETE statements whose result is not inspected by the service."""


class _DeleteFakeSession:
    """Fake AsyncSession for delete_last_native_session.

    - execute() returns _ScalarOneResult for the remaining-sessions COUNT query and
      _DummyResult for all DELETE statements.
    - add() and commit() are tracked for audit/commit assertions.
    """

    def __init__(self, remaining_sessions: int = 0) -> None:
        self.remaining_sessions = remaining_sessions
        self.executed_sql: list[str] = []
        self.added: list[object] = []
        self.commit_count: int = 0

    async def execute(self, stmt: object) -> _ScalarOneResult | _DummyResult:
        sql = str(stmt)
        self.executed_sql.append(sql)
        if "COUNT" in sql.upper():
            return _ScalarOneResult(self.remaining_sessions)
        return _DummyResult()

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.commit_count += 1


# ---------------------------------------------------------------------------
# Class 1 — get_last_native_session
# ---------------------------------------------------------------------------


class GetLastNativeSessionTests(IsolatedAsyncioTestCase):
    async def test_returns_none_when_no_rows(self) -> None:
        db = _SelectFakeSession(row=None)
        result = await get_last_native_session(db)
        self.assertIsNone(result)

    async def test_returns_candidate_when_native_session_exists(self) -> None:
        row = _NamedRow(
            session_id=_SESSION_ID,
            participant_uuid=_PARTICIPANT_UUID,
            participant_number=7,
            status="complete",
            created_at=_CREATED_AT,
        )
        db = _SelectFakeSession(row=row)
        result = await get_last_native_session(db)

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.session_id, _SESSION_ID)
        self.assertEqual(result.participant_uuid, _PARTICIPANT_UUID)
        self.assertEqual(result.participant_number, 7)
        self.assertEqual(result.status, "complete")
        self.assertEqual(result.created_at, _CREATED_AT)


# ---------------------------------------------------------------------------
# Class 2 — delete_last_native_session
# ---------------------------------------------------------------------------


class DeleteLastNativeSessionTests(IsolatedAsyncioTestCase):
    async def test_raises_404_when_no_native_session(self) -> None:
        """Imported-only or empty DB: no candidate → 404, not a 500 or silent no-op."""
        db = _DeleteFakeSession()
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=None),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await delete_last_native_session(db, _DELETER_ID, reason=None)
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_deletes_all_session_dependent_tables(self) -> None:
        """All FK-dependent tables are targeted before the session row is deleted."""
        db = _DeleteFakeSession(remaining_sessions=0)
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=_candidate()),
        ):
            await delete_last_native_session(db, _DELETER_ID, reason=None)

        all_sql = " ".join(db.executed_sql)
        for table in (
            "digitspan_trials",
            "digitspan_runs",
            "survey_uls8",
            "survey_cesd10",
            "survey_gad7",
            "survey_cogfunc8a",
            "sessions",
        ):
            self.assertIn(table, all_sql, f"Expected DELETE targeting '{table}'")

    async def test_deletes_participant_when_no_other_sessions_remain(self) -> None:
        db = _DeleteFakeSession(remaining_sessions=0)
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=_candidate()),
        ):
            result = await delete_last_native_session(db, _DELETER_ID, reason=None)

        self.assertTrue(result.participant_deleted)
        participant_deletes = [
            s
            for s in db.executed_sql
            if "DELETE" in s.upper() and "participants" in s.lower()
        ]
        self.assertTrue(
            len(participant_deletes) > 0,
            "Expected a DELETE targeting 'participants' when no sessions remain",
        )

    async def test_preserves_participant_when_other_sessions_remain(self) -> None:
        db = _DeleteFakeSession(remaining_sessions=1)
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=_candidate()),
        ):
            result = await delete_last_native_session(db, _DELETER_ID, reason=None)

        self.assertFalse(result.participant_deleted)
        participant_deletes = [
            s
            for s in db.executed_sql
            if "DELETE" in s.upper() and "participants" in s.lower()
        ]
        self.assertEqual(
            len(participant_deletes),
            0,
            "Should NOT DELETE from 'participants' when other sessions remain",
        )

    async def test_audit_row_added_and_committed(self) -> None:
        db = _DeleteFakeSession(remaining_sessions=0)
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=_candidate()),
        ):
            await delete_last_native_session(db, _DELETER_ID, reason="test cleanup")

        audit_rows = [o for o in db.added if isinstance(o, AdminSessionUndoLog)]
        self.assertEqual(len(audit_rows), 1, "Expected exactly one audit row added")
        self.assertEqual(db.commit_count, 1, "Expected exactly one commit")

    async def test_audit_row_fields_match_candidate(self) -> None:
        db = _DeleteFakeSession(remaining_sessions=0)
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=_candidate()),
        ):
            await delete_last_native_session(db, _DELETER_ID, reason="accidental entry")

        audit = next(o for o in db.added if isinstance(o, AdminSessionUndoLog))
        self.assertEqual(audit.deleted_session_id, _SESSION_ID)
        self.assertEqual(audit.deleted_participant_uuid, _PARTICIPANT_UUID)
        self.assertEqual(audit.deleted_participant_number, 7)
        self.assertEqual(audit.session_status_at_delete, "complete")
        self.assertEqual(audit.deleted_by_lab_member_id, _DELETER_ID)
        self.assertEqual(audit.reason, "accidental entry")

    async def test_weather_tables_not_touched(self) -> None:
        db = _DeleteFakeSession(remaining_sessions=0)
        with patch(
            "app.services.undo_service.get_last_native_session",
            new=AsyncMock(return_value=_candidate()),
        ):
            await delete_last_native_session(db, _DELETER_ID, reason=None)

        all_sql = " ".join(db.executed_sql)
        for table in ("weather_daily", "weather_ingest_runs", "study_days"):
            self.assertNotIn(
                table,
                all_sql,
                f"Weather table '{table}' must not appear in any SQL during undo",
            )


# ---------------------------------------------------------------------------
# Class 3 — DELETE /sessions/last-native router
# ---------------------------------------------------------------------------


class UndoRouterTests(IsolatedAsyncioTestCase):
    def test_route_registered_with_delete_and_lab_member_dependency(self) -> None:
        route = next(
            (
                r
                for r in router.routes
                if isinstance(r, APIRoute)
                and r.path == "/sessions/last-native"
                and "DELETE" in (r.methods or set())
            ),
            None,
        )
        self.assertIsNotNone(route, "DELETE /last-native route not registered on sessions router")
        assert route is not None
        dep_calls = {d.call for d in route.dependant.dependencies}
        self.assertIn(get_current_lab_member, dep_calls)
        self.assertIs(route.response_model, UndoLastSessionResponse)

    async def test_confirm_false_raises_422(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            await delete_last_native(
                payload=UndoLastSessionRequest(confirm=False),
                lab_member=_lab_member(),
                db=object(),  # type: ignore[arg-type]
            )
        self.assertEqual(ctx.exception.status_code, 422)

    async def test_successful_delete_maps_service_result(self) -> None:
        service_result = UndoDeleteResult(
            deleted_session_id=_SESSION_ID,
            deleted_participant_uuid=_PARTICIPANT_UUID,
            deleted_participant_number=7,
            session_status_at_delete="complete",
            participant_deleted=True,
        )
        with patch(
            "app.routers.sessions.delete_last_native_session",
            new=AsyncMock(return_value=service_result),
        ):
            response = await delete_last_native(
                payload=UndoLastSessionRequest(confirm=True, reason="done"),
                lab_member=_lab_member(),
                db=object(),  # type: ignore[arg-type]
            )

        self.assertIsInstance(response, UndoLastSessionResponse)
        self.assertEqual(response.deleted_session_id, _SESSION_ID)
        self.assertEqual(response.deleted_participant_uuid, _PARTICIPANT_UUID)
        self.assertEqual(response.deleted_participant_number, 7)
        self.assertEqual(response.session_status_at_delete, "complete")
        self.assertTrue(response.participant_deleted)

    async def test_service_404_propagates(self) -> None:
        with patch(
            "app.routers.sessions.delete_last_native_session",
            new=AsyncMock(
                side_effect=HTTPException(
                    status_code=404,
                    detail="No eligible native session found to undo.",
                )
            ),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await delete_last_native(
                    payload=UndoLastSessionRequest(confirm=True),
                    lab_member=_lab_member(),
                    db=object(),  # type: ignore[arg-type]
                )
        self.assertEqual(ctx.exception.status_code, 404)
