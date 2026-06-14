from __future__ import annotations

import uuid
from typing import Any
from unittest import IsolatedAsyncioTestCase

from fastapi import HTTPException
from fastapi.routing import APIRoute

from app.auth import get_current_lab_member
from app.routers.card_sorting import create_card_sorting_run, router
from app.schemas.cognitive import CardSortingRunCreate
from app.scoring.card_sorting import TrialInput, score

_SESSION_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
_PARTICIPANT_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_EXISTING_RUN_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

# Non-recurring six-block schedule: color first, each dimension twice, no
# adjacent duplicates, and not color->shape->number->color->shape->number.
_RULE_ORDER = ["color", "shape", "number", "shape", "color", "number"]

# Canonical reference card values per index (1-4).
_COLOR_BY_INDEX = {1: "red", 2: "green", 3: "yellow", 4: "blue"}
_SHAPE_BY_INDEX = {1: "triangle", 2: "star", 3: "cross", 4: "circle"}


def _card(
    n: int,
    *,
    color_idx: int,
    shape_idx: int,
    number: int,
    selected: int,
    rt: int | None = 1000,
) -> TrialInput:
    return TrialInput(
        trial_number=n,
        card_color=_COLOR_BY_INDEX[color_idx],
        card_shape=_SHAPE_BY_INDEX[shape_idx],
        card_number=number,
        selected_reference_index=selected,
        reaction_time_ms=rt,
    )


def _correct_under_color(n: int) -> TrialInput:
    # Card color index 2 (green); correct choice under `color` rule is index 2.
    return _card(n, color_idx=2, shape_idx=3, number=4, selected=2)


class CardSortingScoringTests(IsolatedAsyncioTestCase):
    def test_all_correct_completes_categories_and_shifts(self) -> None:
        # 20 consecutive color-correct responses: 10 complete category 1 and
        # shift to `shape`; the next 10 are scored under `shape`. Card color
        # index 2 == reference 2 under color, but under shape the same card has
        # shape index 3 -> reference 3, so selecting 2 is now incorrect.
        trials = [_correct_under_color(i) for i in range(1, 11)]
        # After shift to `shape`, keep selecting 2 -> wrong under shape.
        trials += [_correct_under_color(i) for i in range(11, 13)]
        result = score(trials, _RULE_ORDER)

        assert result.total_trials == 12
        # First 10 correct under color; category completes at trial 10.
        assert result.categories_completed == 1
        assert result.trials_to_first_category == 10
        assert result.total_correct == 10
        # trials 11,12 are perseverative (would be correct under prior color rule)
        assert result.trials[10].active_rule == "shape"
        assert result.trials[10].previous_rule == "color"
        assert result.trials[10].correct is False
        assert result.trials[10].perseverative_response is True
        assert result.trials[10].perseverative_error is True
        assert result.perseverative_errors == 2

    def test_streak_resets_on_error(self) -> None:
        trials = [_correct_under_color(i) for i in range(1, 10)]  # 9 correct
        # error: select wrong index under color
        trials.append(_card(10, color_idx=2, shape_idx=1, number=1, selected=1))
        # next correct restarts streak at 1
        trials.append(_correct_under_color(11))
        result = score(trials, _RULE_ORDER)

        assert result.categories_completed == 0
        assert result.trials[9].correct is False
        assert result.trials[9].streak_before == 9
        assert result.trials[9].streak_after == 0
        # failure to maintain set: error after 5-9 consecutive correct
        assert result.failure_to_maintain_set_count == 1
        assert result.trials[10].streak_before == 0
        assert result.trials[10].streak_after == 1

    def test_no_early_stop_and_category_cap(self) -> None:
        # 64 perfect color-then-following-rule responses are hard to craft, so
        # instead verify categories cap at 6 with a long all-correct run by
        # always selecting the index matching the active rule.
        trials: list[TrialInput] = []
        # Build 64 trials where the participant always picks the active rule's
        # correct reference. Use a card whose three dimension indices differ so
        # rule shifts change the correct answer.
        rule_seq: list[str] = []
        cat = 0
        streak = 0
        for n in range(1, 65):
            active = _RULE_ORDER[min(cat, len(_RULE_ORDER) - 1)]
            rule_seq.append(active)
            # card with color idx1, shape idx2, number 3
            if active == "color":
                sel = 1
            elif active == "shape":
                sel = 2
            else:
                sel = 3
            trials.append(
                _card(n, color_idx=1, shape_idx=2, number=3, selected=sel)
            )
            streak += 1
            if streak == 10:
                streak = 0
                cat += 1
        result = score(trials, _RULE_ORDER)
        assert result.total_trials == 64
        assert result.total_correct == 64
        assert result.categories_completed == 6  # capped at 6


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
        for obj in self.added:
            if getattr(obj, "run_id", None) is None:
                obj.run_id = uuid.uuid4()

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj: object) -> None:  # noqa: ARG002
        pass


class _FakeSession:
    def __init__(
        self, status: str = "active", rule_order: list[str] | None = None
    ) -> None:
        self.session_id = _SESSION_ID
        self.participant_uuid = _PARTICIPANT_UUID
        self.status = status
        self.card_sorting_rule_order = (
            rule_order if rule_order is not None else list(_RULE_ORDER)
        )


def _valid_trials() -> list[dict[str, Any]]:
    return [
        {
            "trial_number": 1,
            "card_color": "green",
            "card_shape": "cross",
            "card_number": 4,
            "selected_reference_index": 2,
            "reaction_time_ms": 1200,
        },
        {
            "trial_number": 2,
            "card_color": "red",
            "card_shape": "star",
            "card_number": 1,
            "selected_reference_index": 3,
            "reaction_time_ms": 900,
        },
    ]


def _payload(trials: list[dict[str, Any]]) -> CardSortingRunCreate:
    return CardSortingRunCreate(session_id=_SESSION_ID, trials=trials)


class CardSortingRouterTests(IsolatedAsyncioTestCase):
    async def test_success_persists_run_and_trials(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(), None])
        response = await create_card_sorting_run(payload=_payload(_valid_trials()), db=db)

        assert db.flushed and db.committed
        # 1 run + 2 trials
        assert len(db.added) == 3
        run = db.added[0]
        assert run.participant_uuid == _PARTICIPANT_UUID
        assert run.rule_order == _RULE_ORDER
        assert run.total_trials == 2
        # trial 1 correct under color (green->2); trial 2 wrong under color
        assert run.total_correct == 1
        assert response.total_trials == 2
        assert response.total_correct == 1

    async def test_uses_stored_non_recurring_rule_order(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(), None])
        await create_card_sorting_run(payload=_payload(_valid_trials()), db=db)
        run = db.added[0]
        assert run.rule_order == _RULE_ORDER
        # not the predictable recurring sequence
        assert run.rule_order != ["color", "shape", "number", "color", "shape", "number"]

    async def test_missing_session_404(self) -> None:
        db = _FakeDB(execute_returns=[None])
        with self.assertRaises(HTTPException) as ctx:
            await create_card_sorting_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 404

    async def test_inactive_session_409(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(status="complete")])
        with self.assertRaises(HTTPException) as ctx:
            await create_card_sorting_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 409
        assert not db.committed

    async def test_missing_rule_order_409(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(rule_order=[])])
        with self.assertRaises(HTTPException) as ctx:
            await create_card_sorting_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 409
        assert not db.committed

    async def test_duplicate_run_409(self) -> None:
        db = _FakeDB(execute_returns=[_FakeSession(), _EXISTING_RUN_ID])
        with self.assertRaises(HTTPException) as ctx:
            await create_card_sorting_run(payload=_payload(_valid_trials()), db=db)
        assert ctx.exception.status_code == 409
        assert not db.committed

    async def test_uncanonical_card_value_422(self) -> None:
        trials = _valid_trials()
        trials[0]["card_color"] = "purple"  # not a reference card color
        db = _FakeDB(execute_returns=[_FakeSession(), None])
        with self.assertRaises(HTTPException) as ctx:
            await create_card_sorting_run(payload=_payload(trials), db=db)
        assert ctx.exception.status_code == 422
        assert not db.committed

    def test_route_has_no_lab_member_dependency(self) -> None:
        route = next(
            r
            for r in router.routes
            if isinstance(r, APIRoute)
            and r.path == "/card-sorting/runs"
            and "POST" in (r.methods or set())
        )
        deps = {dep.call for dep in route.dependant.dependencies}
        assert get_current_lab_member not in deps
