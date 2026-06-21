from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from unittest import IsolatedAsyncioTestCase

from fastapi import HTTPException
from fastapi.routing import APIRoute

from app.models.poffenberger import PoffenbergerRun, PoffenbergerTrial
from app.models.sessions import Session
from app.routers.ihtt_poffenberger import (
    generate_production_manifest,
    router,
    submit_poffenberger_run,
)
from app.schemas.poffenberger import (
    PoffenbergerManifest,
    PoffenbergerSubmittedTrial,
    PoffenbergerSubmitRequest,
    PoffenbergerSubmitResponse,
)
from app.scoring.poffenberger import TrialInput, score

_PARTICIPANT_UUID = uuid.UUID("11111111-1111-1111-1111-111111111111")
_SESSION_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
_RUN_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")

_RT_BY_CONDITION = {
    "lh_lvf": 300,
    "lh_rvf": 330,
    "rh_lvf": 350,
    "rh_rvf": 310,
}


class _ScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def scalar_one_or_none(self) -> Any:
        return self._value


class _FakeDB:
    def __init__(self, *execute_scalars: Any) -> None:
        self.execute_scalars = list(execute_scalars)
        self.added: list[Any] = []
        self.committed = False
        self.refreshed: list[Any] = []

    async def execute(self, stmt: object) -> _ScalarResult:  # noqa: ARG002
        return _ScalarResult(self.execute_scalars.pop(0))

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj: object) -> None:
        self.refreshed.append(obj)


def _condition_key(response_hand: str, visual_field: str) -> str:
    return ("lh" if response_hand == "left" else "rh") + "_" + visual_field


def _manifest() -> PoffenbergerManifest:
    return generate_production_manifest(random.Random(17))


def _submitted_trials(
    manifest: PoffenbergerManifest,
    *,
    include_practice: bool = True,
) -> list[PoffenbergerSubmittedTrial]:
    trials: list[PoffenbergerSubmittedTrial] = []
    if include_practice:
        for trial in manifest.practice_trials:
            trials.append(
                PoffenbergerSubmittedTrial(
                    block_number=0,
                    trial_number=trial.trial_number,
                    global_trial_number=trial.trial_number,
                    response_hand=trial.response_hand,
                    visual_field=trial.visual_field,
                    expected_key=trial.expected_key,
                    pressed_key=trial.expected_key,
                    reaction_time_ms=250,
                    is_timeout=False,
                    is_practice=True,
                )
            )

    practice_count = len(manifest.practice_trials)
    for block in manifest.blocks:
        for trial in block.trials:
            condition_key = _condition_key(block.response_hand, trial.visual_field)
            trials.append(
                PoffenbergerSubmittedTrial(
                    block_number=block.block_number,
                    trial_number=trial.trial_number,
                    global_trial_number=practice_count + trial.global_trial_number,
                    response_hand=block.response_hand,
                    visual_field=trial.visual_field,
                    expected_key=block.expected_key,
                    pressed_key=block.expected_key,
                    reaction_time_ms=_RT_BY_CONDITION[condition_key],
                    is_timeout=False,
                    is_practice=False,
                )
            )
    return trials


def _trial_inputs(trials: list[PoffenbergerSubmittedTrial]) -> list[TrialInput]:
    return [
        TrialInput(
            block_number=trial.block_number,
            trial_number=trial.trial_number,
            global_trial_number=trial.global_trial_number,
            response_hand=trial.response_hand,
            visual_field=trial.visual_field,
            expected_key=trial.expected_key,
            pressed_key=trial.pressed_key,
            reaction_time_ms=trial.reaction_time_ms,
            is_timeout=trial.is_timeout,
            is_practice=trial.is_practice,
            client_trial_started_at_ms=trial.client_trial_started_at_ms,
            client_stimulus_onset_ms=trial.client_stimulus_onset_ms,
            client_response_at_ms=trial.client_response_at_ms,
            client_trial_ended_at_ms=trial.client_trial_ended_at_ms,
        )
        for trial in trials
    ]


def _run(
    manifest: PoffenbergerManifest,
    *,
    is_complete: bool = False,
) -> PoffenbergerRun:
    return PoffenbergerRun(
        run_id=_RUN_ID,
        session_id=_SESSION_ID,
        participant_uuid=_PARTICIPANT_UUID,
        manifest_json=manifest.model_dump(mode="json"),
        total_practice_trials=10,
        total_experimental_trials=600,
        is_complete=is_complete,
        completed_at=datetime.now(timezone.utc) if is_complete else None,
    )


def _session(*, status: str = "active") -> Session:
    return Session(
        session_id=_SESSION_ID,
        participant_uuid=_PARTICIPANT_UUID,
        status=status,
    )


def _submit_request(
    manifest: PoffenbergerManifest,
    *,
    include_practice: bool = True,
) -> PoffenbergerSubmitRequest:
    return PoffenbergerSubmitRequest(
        run_id=_RUN_ID,
        session_id=_SESSION_ID,
        trials=_submitted_trials(manifest, include_practice=include_practice),
    )


def test_submit_route_is_registered_without_auth_dependency() -> None:
    route = next(
        route
        for route in router.routes
        if isinstance(route, APIRoute)
        and route.path == "/ihtt/poffenberger/runs/{run_id}/submit"
        and "POST" in (route.methods or set())
    )

    assert route.status_code == 201
    assert route.response_model is PoffenbergerSubmitResponse
    dependency_names = {
        getattr(dependency.call, "__name__", "")
        for dependency in route.dependant.dependencies
    }
    assert "get_session" in dependency_names
    assert "get_current_lab_member" not in dependency_names


def test_score_computes_condition_and_crossed_summaries() -> None:
    manifest = _manifest()
    scored = score(_trial_inputs(_submitted_trials(manifest)), manifest)

    assert len(scored.trials) == 610
    assert sum(1 for trial in scored.trials if trial.is_practice) == 10

    lh_lvf = scored.condition_summaries["lh_lvf"]
    assert lh_lvf.total_trials == 150
    assert lh_lvf.valid_rt_trials == 150
    assert lh_lvf.accurate_trials == 150
    assert lh_lvf.accuracy == Decimal("1.0000")
    assert lh_lvf.mean_rt_ms == Decimal("300.00")
    assert lh_lvf.median_rt_ms == Decimal("300.00")
    assert lh_lvf.sd_rt_ms == Decimal("0.00")

    assert scored.mean_rt_crossed_ms == Decimal("340.00")
    assert scored.mean_rt_uncrossed_ms == Decimal("305.00")
    assert scored.ihtt_difference_ms == Decimal("35.00")
    assert scored.accuracy_crossed == Decimal("1.0000")
    assert scored.accuracy_uncrossed == Decimal("1.0000")


def test_score_excludes_timeout_late_and_invalid_key_trials_from_rt_means() -> None:
    manifest = _manifest()
    trials = _submitted_trials(manifest, include_practice=False)
    lh_lvf_indexes = [
        index
        for index, trial in enumerate(trials)
        if _condition_key(trial.response_hand, trial.visual_field) == "lh_lvf"
    ]
    trials[lh_lvf_indexes[0]] = trials[lh_lvf_indexes[0]].model_copy(
        update={"pressed_key": None, "reaction_time_ms": None, "is_timeout": True}
    )
    trials[lh_lvf_indexes[1]] = trials[lh_lvf_indexes[1]].model_copy(
        update={"reaction_time_ms": 2501}
    )
    trials[lh_lvf_indexes[2]] = trials[lh_lvf_indexes[2]].model_copy(
        update={"pressed_key": "x", "reaction_time_ms": 300}
    )
    trials[lh_lvf_indexes[3]] = trials[lh_lvf_indexes[3]].model_copy(
        update={"pressed_key": "j", "reaction_time_ms": 300}
    )

    scored = score(_trial_inputs(trials), manifest)

    summary = scored.condition_summaries["lh_lvf"]
    assert summary.total_trials == 150
    assert summary.timeout_trials == 2
    assert summary.invalid_trials == 1
    assert summary.valid_rt_trials == 147
    assert summary.accurate_trials == 146
    assert summary.accuracy == Decimal("0.9733")
    assert summary.mean_rt_ms == Decimal("300.00")


class PoffenbergerSubmitRouteTests(IsolatedAsyncioTestCase):
    async def test_submit_persists_scored_trials_and_marks_run_complete(self) -> None:
        manifest = _manifest()
        run = _run(manifest)
        session = _session()
        db = _FakeDB(run, session)

        response = await submit_poffenberger_run(
            run_id=_RUN_ID,
            payload=_submit_request(manifest),
            db=db,
        )

        assert response.run_id == _RUN_ID
        assert response.session_id == _SESSION_ID
        assert response.is_complete is True
        assert response.condition_summaries["rh_lvf"].mean_rt_ms == Decimal("350.00")
        assert run.is_complete is True
        assert run.completed_at is not None
        assert session.status == "complete"
        assert session.completed_at == run.completed_at
        assert len(db.added) == 610
        assert all(isinstance(trial, PoffenbergerTrial) for trial in db.added)
        assert sum(1 for trial in db.added if trial.is_practice) == 10
        assert sum(1 for trial in db.added if trial.is_scored) == 600
        assert db.committed

    async def test_submit_rejects_duplicate_completed_run(self) -> None:
        manifest = _manifest()
        db = _FakeDB(_run(manifest, is_complete=True))

        with self.assertRaises(HTTPException) as ctx:
            await submit_poffenberger_run(
                run_id=_RUN_ID,
                payload=_submit_request(manifest),
                db=db,
            )

        assert ctx.exception.status_code == 409

    async def test_submit_rejects_inactive_session(self) -> None:
        manifest = _manifest()
        db = _FakeDB(_run(manifest), _session(status="complete"))

        with self.assertRaises(HTTPException) as ctx:
            await submit_poffenberger_run(
                run_id=_RUN_ID,
                payload=_submit_request(manifest),
                db=db,
            )

        assert ctx.exception.status_code == 409

    async def test_submit_rejects_manifest_mismatch(self) -> None:
        manifest = _manifest()
        payload = _submit_request(manifest)
        first_experimental_index = next(
            index
            for index, trial in enumerate(payload.trials)
            if not trial.is_practice
        )
        original_visual_field = payload.trials[first_experimental_index].visual_field
        mismatched_visual_field = (
            "rvf" if original_visual_field == "lvf" else "lvf"
        )
        payload.trials[first_experimental_index] = payload.trials[
            first_experimental_index
        ].model_copy(update={"visual_field": mismatched_visual_field})
        db = _FakeDB(_run(manifest), _session())

        with self.assertRaises(HTTPException) as ctx:
            await submit_poffenberger_run(
                run_id=_RUN_ID,
                payload=payload,
                db=db,
            )

        assert ctx.exception.status_code == 422
        assert "visual_field" in str(ctx.exception.detail)
