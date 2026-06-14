from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.routing import APIRoute

from app.auth import get_current_lab_member
from app.routers.sessions import (
    _generate_card_sorting_rule_order,
    _is_valid_card_sorting_rule_order,
    get_cognitive_battery,
    router,
    start_session,
)
from app.schemas.sessions import StartSessionCreate

_PARTICIPANT_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_SESSION_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
_NOW = datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc)
_TASK_ORDER = ["stroop", "digitspan", "card_sorting"]
_RULE_ORDER = ("color", "number", "shape", "color", "shape", "number")


class _ScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one(self) -> Any:
        return self._value

    def scalar_one_or_none(self) -> Any:
        return self._value


class _FakeDB:
    def __init__(self, execute_returns: list[Any]) -> None:
        self._returns = list(execute_returns)
        self._index = 0
        self.added: list[Any] = []
        self.committed = False

    async def execute(self, stmt: object) -> _ScalarResult:  # noqa: ARG002
        value = self._returns[self._index] if self._index < len(self._returns) else None
        self._index += 1
        return _ScalarResult(value)

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj: object) -> None:  # noqa: ARG002
        pass


class _FakeParticipant:
    participant_number = 0

    def __init__(self, **kwargs: object) -> None:
        self.participant_uuid = _PARTICIPANT_UUID
        self.participant_number = kwargs["participant_number"]
        for key, value in kwargs.items():
            setattr(self, key, value)


class _FakeSession:
    def __init__(
        self,
        *,
        session_id: uuid.UUID = _SESSION_ID,
        participant_uuid: uuid.UUID = _PARTICIPANT_UUID,
        status: str = "active",
        cognitive_task_order: list[str] | None = None,
        card_sorting_rule_order: list[str] | None = None,
    ) -> None:
        self.session_id = session_id
        self.participant_uuid = participant_uuid
        self.status = status
        self.created_at = _NOW
        self.completed_at = None
        self.cognitive_task_order = cognitive_task_order
        self.card_sorting_rule_order = card_sorting_rule_order


def _start_payload() -> StartSessionCreate:
    return StartSessionCreate(
        age_band="18-24",
        gender="Woman",
        origin="Class",
        commute_method="Walk",
        time_outside="Sometimes (61 minutes - 90 minutes)",
    )


class SessionCognitiveBatteryTests(IsolatedAsyncioTestCase):
    async def test_start_session_stores_cognitive_manifest_orders(self) -> None:
        db = _FakeDB(execute_returns=[41])

        with (
            patch("app.routers.sessions.Participant", _FakeParticipant),
            patch("app.routers.sessions.SessionModel", _FakeSession),
            patch("app.routers.sessions.random.sample", return_value=_TASK_ORDER),
            patch("app.routers.sessions.random.choice", return_value=_RULE_ORDER),
        ):
            response = await start_session(payload=_start_payload(), db=db)

        session = db.added[1]
        assert session.cognitive_task_order == _TASK_ORDER
        assert session.card_sorting_rule_order == list(_RULE_ORDER)
        assert response.session_id == _SESSION_ID
        assert response.start_path == f"/session/{_SESSION_ID}/uls8"
        assert db.committed

    def test_generated_card_sorting_rule_order_is_valid_and_not_predictable(self) -> None:
        predictable = ["color", "shape", "number", "color", "shape", "number"]

        for _ in range(50):
            order = _generate_card_sorting_rule_order()
            assert _is_valid_card_sorting_rule_order(order)
            assert order[0] == "color"
            assert order != predictable
            assert all(
                order[index] != order[index + 1] for index in range(len(order) - 1)
            )
            assert sorted(order) == [
                "color",
                "color",
                "number",
                "number",
                "shape",
                "shape",
            ]

    async def test_get_cognitive_battery_returns_active_session_manifest(self) -> None:
        session = _FakeSession(
            cognitive_task_order=_TASK_ORDER,
            card_sorting_rule_order=list(_RULE_ORDER),
        )
        db = _FakeDB(execute_returns=[session])

        response = await get_cognitive_battery(session_id=_SESSION_ID, db=db)

        assert response.session_id == _SESSION_ID
        assert response.task_order == _TASK_ORDER
        assert response.card_sorting_rule_order == list(_RULE_ORDER)

    async def test_get_cognitive_battery_rejects_missing_session(self) -> None:
        db = _FakeDB(execute_returns=[None])

        with self.assertRaises(HTTPException) as ctx:
            await get_cognitive_battery(session_id=_SESSION_ID, db=db)

        assert ctx.exception.status_code == 404

    async def test_get_cognitive_battery_requires_active_session(self) -> None:
        db = _FakeDB(
            execute_returns=[
                _FakeSession(
                    status="complete",
                    cognitive_task_order=_TASK_ORDER,
                    card_sorting_rule_order=list(_RULE_ORDER),
                )
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await get_cognitive_battery(session_id=_SESSION_ID, db=db)

        assert ctx.exception.status_code == 409

    async def test_get_cognitive_battery_rejects_unassigned_or_invalid_manifest(self) -> None:
        db = _FakeDB(
            execute_returns=[
                _FakeSession(
                    cognitive_task_order=["digitspan", "digitspan", "stroop"],
                    card_sorting_rule_order=[
                        "color",
                        "shape",
                        "number",
                        "color",
                        "shape",
                        "number",
                    ],
                )
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await get_cognitive_battery(session_id=_SESSION_ID, db=db)

        assert ctx.exception.status_code == 409

    def test_routes_have_expected_auth_boundaries(self) -> None:
        start_route = next(
            route
            for route in router.routes
            if isinstance(route, APIRoute)
            and route.path == "/sessions/start"
            and "POST" in (route.methods or set())
        )
        manifest_route = next(
            route
            for route in router.routes
            if isinstance(route, APIRoute)
            and route.path == "/sessions/{session_id}/cognitive-battery"
            and "GET" in (route.methods or set())
        )

        start_dependencies = {dep.call for dep in start_route.dependant.dependencies}
        manifest_dependencies = {
            dep.call for dep in manifest_route.dependant.dependencies
        }

        assert get_current_lab_member in start_dependencies
        assert get_current_lab_member not in manifest_dependencies
