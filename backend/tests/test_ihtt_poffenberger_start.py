from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Any
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from jose import jwt

from app.auth import LabMember
from app.models.participants import Participant
from app.models.poffenberger import PoffenbergerRun
from app.models.sessions import Session
from app.routers.ihtt_poffenberger import (
    generate_production_manifest,
    router,
    start_poffenberger_session,
)
from app.schemas.poffenberger import PoffenbergerStartRequest, PoffenbergerStartResponse

_PARTICIPANT_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_SESSION_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
_RUN_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
_MEMBER_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
_NOW = datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc)


class _ScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one(self) -> Any:
        return self._value


class _FakeDB:
    def __init__(self, current_max_participant_number: int | None = None) -> None:
        self.current_max_participant_number = current_max_participant_number
        self.added: list[Any] = []
        self.flushed = 0
        self.committed = False
        self.refreshed: list[Any] = []

    async def execute(self, stmt: object) -> _ScalarResult:  # noqa: ARG002
        return _ScalarResult(self.current_max_participant_number)

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flushed += 1
        for obj in self.added:
            if isinstance(obj, Participant) and obj.participant_uuid is None:
                obj.participant_uuid = _PARTICIPANT_UUID
            if isinstance(obj, Session) and obj.session_id is None:
                obj.session_id = _SESSION_ID
                obj.created_at = _NOW
                obj.completed_at = None
            if isinstance(obj, PoffenbergerRun) and obj.run_id is None:
                obj.run_id = _RUN_ID

    async def commit(self) -> None:
        self.committed = True
        await self.flush()

    async def refresh(self, obj: object) -> None:
        self.refreshed.append(obj)


def _start_payload() -> PoffenbergerStartRequest:
    return PoffenbergerStartRequest(
        age_band="18-24",
        gender="Woman",
        origin="Class",
        commute_method="Walk",
        time_outside="Sometimes (61 minutes - 90 minutes)",
    )


def _auth_token(*, role: str = "ra", lab_name: str = "ihtt") -> str:
    return jwt.encode(
        {
            "sub": str(_MEMBER_ID),
            "email": "ra@lab.test",
            "app_metadata": {"role": role, "lab_name": lab_name},
        },
        "test-secret",
        algorithm="HS256",
    )


def _route_client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_start_route_is_registered_with_ihtt_ra_dependency() -> None:
    route = next(
        route
        for route in router.routes
        if isinstance(route, APIRoute)
        and route.path == "/ihtt/poffenberger/start"
        and "POST" in (route.methods or set())
    )

    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert route.status_code == 201
    assert any(
        getattr(call, "__qualname__", "") == "get_current_ra_for_lab.<locals>._dependency"
        for call in dependency_calls
    )
    assert route.response_model is PoffenbergerStartResponse


def _iter_api_routes(routes: Any) -> Any:
    """Yield every APIRoute reachable from ``routes``.

    Starlette 1.x mounts included routers as nested ``_IncludedRouter`` objects
    instead of flattening their routes onto ``app.routes``, so a top-level scan
    no longer sees router endpoints. Descend into nested routers (via ``routes``
    or the ``_IncludedRouter.original_router`` it wraps) to stay version-robust.
    """
    for route in routes:
        if isinstance(route, APIRoute):
            yield route
        nested = getattr(route, "routes", None) or getattr(
            getattr(route, "original_router", None), "routes", None
        )
        if nested:
            yield from _iter_api_routes(nested)


def test_main_app_includes_ihtt_poffenberger_start_route() -> None:
    from app.main import app

    assert any(
        route.path == "/ihtt/poffenberger/start" and "POST" in (route.methods or set())
        for route in _iter_api_routes(app.routes)
    )


def test_start_route_requires_auth_and_rejects_non_ihtt_non_admin() -> None:
    client = _route_client()
    body = _start_payload().model_dump()

    missing = client.post("/ihtt/poffenberger/start", json=body)
    assert missing.status_code == 401

    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "test-secret"}):
        wrong_lab = client.post(
            "/ihtt/poffenberger/start",
            json=body,
            headers={"Authorization": f"Bearer {_auth_token(lab_name='ww')}"},
        )

    assert wrong_lab.status_code == 403


def test_manifest_generation_meets_production_constraints() -> None:
    manifest = generate_production_manifest(random.Random(7))

    assert len(manifest.practice_trials) == 10
    assert {trial.response_hand for trial in manifest.practice_trials} == {"right"}
    assert {trial.expected_key for trial in manifest.practice_trials} == {"j"}
    assert sorted(trial.visual_field for trial in manifest.practice_trials) == (
        ["lvf"] * 5 + ["rvf"] * 5
    )
    assert all(1000 <= trial.jitter_ms <= 2000 for trial in manifest.practice_trials)

    assert len(manifest.blocks) == 12
    assert [block.block_number for block in manifest.blocks] == list(range(1, 13))
    assert [block.response_hand for block in manifest.blocks].count("left") == 6
    assert [block.response_hand for block in manifest.blocks].count("right") == 6

    global_numbers: list[int] = []
    for block in manifest.blocks:
        assert block.expected_key == ("f" if block.response_hand == "left" else "j")
        assert len(block.trials) == 50
        assert [trial.trial_number for trial in block.trials] == list(range(1, 51))
        assert [trial.visual_field for trial in block.trials].count("lvf") == 25
        assert [trial.visual_field for trial in block.trials].count("rvf") == 25
        assert all(1000 <= trial.jitter_ms <= 2000 for trial in block.trials)
        global_numbers.extend(trial.global_trial_number for trial in block.trials)

    assert global_numbers == list(range(1, 601))


class PoffenbergerStartTests(IsolatedAsyncioTestCase):
    async def test_start_creates_participant_session_and_run(self) -> None:
        db = _FakeDB(current_max_participant_number=41)
        member = LabMember(
            id=_MEMBER_ID,
            email="ra@lab.test",
            role="ra",
            lab_name="ihtt",
        )

        with patch(
            "app.routers.ihtt_poffenberger.compute_daylight_exposure_minutes",
            return_value=123,
        ):
            response = await start_poffenberger_session(
                payload=_start_payload(),
                _member=member,
                db=db,
            )

        participant = db.added[0]
        session = db.added[1]
        run = db.added[2]

        assert isinstance(participant, Participant)
        assert participant.participant_number == 42
        assert participant.age_band == "18-24"
        assert participant.gender == "Woman"
        assert participant.origin == "Class"
        assert participant.commute_method == "Walk"
        assert participant.time_outside == "Sometimes (61 minutes - 90 minutes)"
        assert participant.daylight_exposure_minutes == 123

        assert isinstance(session, Session)
        assert session.participant_uuid == _PARTICIPANT_UUID
        assert session.status == "active"

        assert isinstance(run, PoffenbergerRun)
        assert run.session_id == _SESSION_ID
        assert run.participant_uuid == _PARTICIPANT_UUID
        assert run.total_practice_trials == 10
        assert run.total_experimental_trials == 600
        assert run.manifest_json["practice_trials"]
        assert len(run.manifest_json["blocks"]) == 12

        assert response.run_id == _RUN_ID
        assert response.session_id == _SESSION_ID
        assert response.participant_uuid == _PARTICIPANT_UUID
        assert response.start_path == f"/ihtt/poffenberger/{_RUN_ID}"
        assert len(response.manifest.blocks) == 12
        assert db.committed
