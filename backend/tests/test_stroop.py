from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any
from unittest import IsolatedAsyncioTestCase

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from pydantic import ValidationError

from app.auth import get_current_lab_member
from app.routers.stroop import create_stroop_run, router
from app.schemas.cognitive import StroopRunCreate
from app.scoring.stroop import TrialInput, score

_SESSION_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
_PARTICIPANT_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_EXISTING_RUN_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")


def _trial(
    n: int,
    condition: str,
    *,
    ink: str,
    response: str | None,
    rt: int | None,
    timed_out: bool = False,
    key: str | None = "x",
) -> TrialInput:
    return TrialInput(
        trial_number=n,
        condition=condition,
        word=ink.upper(),
        ink_color=ink,
        response_key=key if not timed_out else None,
        response_color=response,
        reaction_time_ms=rt,
        timed_out=timed_out,
    )


class StroopScoringTests(IsolatedAsyncioTestCase):
    def test_correctness_accuracy_and_interference(self) -> None:
        trials = [
            # congruent: 2 correct, 1 error
            _trial(1, "congruent", ink="red", response="red", rt=600),
            _trial(2, "congruent", ink="blue", response="blue", rt=700),
            _trial(3, "congruent", ink="green", response="red", rt=900),
            # incongruent: 2 correct, 1 timeout
            _trial(4, "incongruent", ink="red", response="red", rt=800),
            _trial(5, "incongruent", ink="blue", response="blue", rt=900),
            _trial(6, "incongruent", ink="green", response=None, rt=None, timed_out=True),
        ]
        result = score(trials)

        assert result.total_trials == 6
        assert result.correct_trials == 4
        assert result.error_trials == 1
        assert result.timeout_trials == 1
        assert result.overall_accuracy == Decimal("0.6667")
        # congruent: 2/3
        assert result.congruent_accuracy == Decimal("0.6667")
        # incongruent: 2/3 (timeout counts in total)
        assert result.incongruent_accuracy == Decimal("0.6667")
        assert result.mean_rt_congruent_ms == Decimal("650.00")
        assert result.mean_rt_incongruent_ms == Decimal("850.00")
        assert result.stroop_interference_ms == Decimal("200.00")

    def test_timeout_excluded_from_means_and_never_correct(self) -> None:
        trials = [
            _trial(1, "congruent", ink="red", response=None, rt=None, timed_out=True),
        ]
        result = score(trials)
        assert result.timeout_trials == 1
        assert result.correct_trials == 0
        assert result.error_trials == 0
        assert result.trials[0].correct is False
        assert result.trials[0].reaction_time_ms is None
        # no correct congruent trials -> mean is None, interference None
        assert result.mean_rt_congruent_ms is None
        assert result.stroop_interference_ms is None

    def test_case_insensitive_color_match(self) -> None:
        trials = [_trial(1, "congruent", ink="Red", response="RED ", rt=500)]
        result = score(trials)
        assert result.correct_trials == 1
        assert result.trials[0].correct is True

    def test_interference_null_when_a_condition_missing(self) -> None:
        trials = [_trial(1, "congruent", ink="red", response="red", rt=500)]
        result = score(trials)
        assert result.mean_rt_incongruent_ms is None
        assert result.stroop_interference_ms is None


class _ScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class _FakeDB:
    def __init__(self, execute_returns: list[Any]) -> None:
        self._returns = list(execute_returns)
        self._index = 0
        self.added: list[Any] = []
        self.committed = False
        self.flushed = False

    async def execute(self, stmt: object) -> _ScalarResult:  # noqa: ARG002
        value = self._returns[self._index] if self._index < len(self._returns) else None
        self._index += 1
        return _ScalarResult(value)

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        self.flushed = True
        # emulate server-side default PK assignment for the run
        for obj in self.added:
            if getattr(obj, "run_id", None) is None:
                obj.run_id = uuid.uuid4()

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj: object) -> None:  # noqa: ARG002
        pass


class _FakeSession:
    def __init__(self, status: str = "active") -> None:
        self.session_id = _SESSION_ID
        self.participant_uuid = _PARTICIPANT_UUID
        self.status = status


def _payload(trials: list[dict[str, Any]]) -> StroopRunCreate:
    return StroopRunCreate(session_id=_SESSION_ID, trials=trials)


def _valid_trials() -> list[dict[str, Any]]:
    return [
        {
            "trial_number": 1,
            "condition": "congruent",
            "word": "RED",
            "ink_color": "red",
            "response_key": "r",
            "response_color": "red",
            "reaction_time_ms": 600,
            "timed_out": False,
        },
        {
            "trial_number": 2,
            "condition": "incongruent",
            "word": "BLUE",
            "ink_color": "red",
            "response_key": "r",
            "response_color": "red",
            "reaction_time_ms": 800,
            "timed_out": False,
        },
        {
            "trial_number": 3,
            "condition": "incongruent",
            "word": "GREEN",
            "ink_color": "blue",
            "response_key": None,
            "response_color": None,
            "reaction_time_ms": None,
            "timed_out": True,
        },
    ]


class StroopRouterTests(IsolatedAsyncioTestCase):
    async def test_success_persists_run_and_trials(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(), None])
        response = await create_stroop_run(payload=_payload(_valid_trials()), db=db)

        assert db.flushed and db.committed
        # 1 run + 3 trials added
        assert len(db.added) == 4
        run = db.added[0]
        assert run.participant_uuid == _PARTICIPANT_UUID
        assert run.total_trials == 3
        assert run.correct_trials == 2
        assert run.timeout_trials == 1
        assert response.total_trials == 3
        assert response.correct_trials == 2

    async def test_missing_session_404(self) -> None:
        db = _FakeDB(execute_returns=[None])
        with self.assertRaises(HTTPException) as ctx:
            await create_stroop_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 404

    async def test_inactive_session_409(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(status="complete")])
        with self.assertRaises(HTTPException) as ctx:
            await create_stroop_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 409
        assert not db.committed

    async def test_duplicate_run_409(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(), _EXISTING_RUN_ID])
        with self.assertRaises(HTTPException) as ctx:
            await create_stroop_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 409
        assert not db.committed

    def test_invalid_condition_rejected(self) -> None:
        trials = _valid_trials()
        trials[0]["condition"] = "neutral"
        with pytest.raises(ValidationError):
            _payload(trials)

    def test_duplicate_trial_numbers_rejected(self) -> None:
        trials = _valid_trials()
        trials[1]["trial_number"] = 1
        with pytest.raises(ValidationError):
            _payload(trials)

    def test_non_timeout_without_response_color_rejected(self) -> None:
        trials = _valid_trials()
        trials[0]["response_color"] = None
        with pytest.raises(ValidationError):
            _payload(trials)

    def test_route_has_no_lab_member_dependency(self) -> None:
        route = next(
            r
            for r in router.routes
            if isinstance(r, APIRoute)
            and r.path == "/stroop/runs"
            and "POST" in (r.methods or set())
        )
        deps = {dep.call for dep in route.dependant.dependencies}
        assert get_current_lab_member not in deps
