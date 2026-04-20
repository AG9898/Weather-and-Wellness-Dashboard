"""Tests for misokinesia router endpoints (T108).

Covers:
- POST /misokinesia/start: valid manifest response, auth requirement, clip ordering
- GET /misokinesia/trial-manifest: read-only trial clip sampling, auth requirement,
  insufficient-stimuli 409, randomized subset behavior
- misokinesia_participant_number increments across successive start calls
- POST /misokinesia/participants/{id}/responses: happy path, no-auth requirement,
  duplicate 409, wrong test-set 422, out-of-range qN 422, completed_at auto-set,
  post-completion 409
- PATCH /misokinesia/participants/{id}/end-of-task: valid payload 200,
  completed_at null 409, stronger_responses_timing/stronger_responses mismatch 422
- Schema: router registered at correct paths with correct auth dependencies
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from unittest import IsolatedAsyncioTestCase

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from pydantic import ValidationError
from sqlalchemy import exc as sa_exc

from app.auth import get_current_lab_member
from app.routers.misokinesia import (
    get_trial_manifest,
    router,
    start_misokinesia_session,
    submit_end_of_task,
    submit_mkaq,
    submit_trial_response,
)
from app.schemas.misokinesia import (
    MisokinesiaAqCreate,
    MisokinesiaEndOfTaskCreate,
    MisokinesiaTrialResponseCreate,
)

# ---------------------------------------------------------------------------
# Shared IDs
# ---------------------------------------------------------------------------

_TEST_SET_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
_PARTICIPANT_UUID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
_SESSION_ID = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
_MISO_PARTICIPANT_ID = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
_STIMULUS_ID_1 = uuid.UUID("11111111-1111-1111-1111-111111111111")
_STIMULUS_ID_2 = uuid.UUID("22222222-2222-2222-2222-222222222222")
_STIMULUS_ID_3 = uuid.UUID("33333333-3333-3333-3333-333333333333")
_STIMULUS_ID_4 = uuid.UUID("44444444-4444-4444-4444-444444444444")
_STIMULUS_ID_5 = uuid.UUID("55555555-5555-5555-5555-555555555555")
_STIMULUS_ID_6 = uuid.UUID("66666666-6666-6666-6666-666666666666")
_RESPONSE_ID = uuid.UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
_NOW = datetime(2026, 3, 17, 12, 0, tzinfo=timezone.utc)

# ---------------------------------------------------------------------------
# Fake ORM objects (SimpleNamespace-style)
# ---------------------------------------------------------------------------


class _FakeTestSet:
    test_set_id = _TEST_SET_ID
    active = True


class _FakeStimulus:
    def __init__(
        self,
        stimulus_id: uuid.UUID = _STIMULUS_ID_1,
        sort_order: int = 1,
        storage_path: str = "clip_01.mp4",
        duration_ms: int = 15000,
        test_set_id: uuid.UUID = _TEST_SET_ID,
        active: bool = True,
    ) -> None:
        self.stimulus_id = stimulus_id
        self.test_set_id = test_set_id
        self.storage_path = storage_path
        self.duration_ms = duration_ms
        self.sort_order = sort_order
        self.active = active


class _FakeMisoParticipant:
    def __init__(
        self,
        completed_at: datetime | None = None,
        miso_participant_number: int = 1,
        mkaq_administration: str = "pre",
    ) -> None:
        self.misokinesia_participant_id = _MISO_PARTICIPANT_ID
        self.session_id = _SESSION_ID
        self.participant_uuid = _PARTICIPANT_UUID
        self.test_set_id = _TEST_SET_ID
        self.misokinesia_participant_number = miso_participant_number
        self.started_at = _NOW
        self.completed_at = completed_at
        self.created_at = _NOW
        self.mkaq_administration = mkaq_administration
        self.end_fidgeting_text: str | None = None
        self.end_emotions_text: str | None = None
        self.stronger_responses: bool | None = None
        self.stronger_responses_timing: str | None = None


class _FakeParticipant:
    participant_uuid = _PARTICIPANT_UUID
    participant_number = 1


class _FakeSession:
    session_id = _SESSION_ID
    participant_uuid = _PARTICIPANT_UUID
    status = "active"


class _FakeResponseRow:
    response_id = _RESPONSE_ID
    session_id = _SESSION_ID
    created_at = _NOW


_MKAQ_RESPONSE_ID = uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")


class _FakeMkaqResponseRow:
    response_id = _MKAQ_RESPONSE_ID
    misokinesia_participant_id = _MISO_PARTICIPANT_ID
    session_id = _SESSION_ID
    administration = "pre"
    total_score = 21
    created_at = _NOW


# ---------------------------------------------------------------------------
# Fake AsyncSession helpers
# ---------------------------------------------------------------------------


class _ScalarResult:
    def __init__(self, value: Any) -> None:
        self._value = value

    def first(self) -> Any:
        return self._value

    def scalar_one(self) -> Any:
        return self._value

    def scalar_one_or_none(self) -> Any:
        return self._value

    def scalars(self) -> "_ScalarResult":
        return self

    def all(self) -> list:
        if isinstance(self._value, list):
            return self._value
        return [self._value] if self._value is not None else []


class _SequencedDB:
    """Fake AsyncSession that returns preconfigured values per execute() call.

    execute_returns: list of values to return, consumed in order.
    Special sentinels:
      'INTEGRITY_ERROR' → raises sa_exc.IntegrityError on flush()
    """

    def __init__(
        self,
        execute_returns: list,
        raise_integrity_on_flush: bool = False,
    ) -> None:
        self._returns = list(execute_returns)
        self._index = 0
        self._raise_integrity = raise_integrity_on_flush
        self._added: list[Any] = []
        self.committed = False

    async def execute(self, stmt: object) -> _ScalarResult:  # noqa: ARG002
        value = self._returns[self._index] if self._index < len(self._returns) else None
        self._index += 1
        return _ScalarResult(value)

    def add(self, obj: object) -> None:
        self._added.append(obj)

    async def flush(self) -> None:
        if self._raise_integrity:
            raise sa_exc.IntegrityError("unique", {}, Exception())

    async def rollback(self) -> None:
        pass

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, obj: object) -> None:
        pass


# ---------------------------------------------------------------------------
# Class 1 — start_misokinesia_session
# ---------------------------------------------------------------------------


class StartMisokinesiaSessionTests(IsolatedAsyncioTestCase):
    def _db_for_start(
        self,
        test_set: _FakeTestSet | None = None,
        max_participant_number: int | None = None,
        stimuli: list | None = None,
    ) -> _SequencedDB:
        """Build a fake DB for the start endpoint.

        execute() is called in this order:
          0. select(MisokinesiaTestSet)          → test_set (or None)
          1. select(func.max(participant_number)) → int or None
          2. select(MisokinesiaStimulus)          → list of stimuli
        """
        if stimuli is None:
            stimuli = [_FakeStimulus()]
        return _SequencedDB(
            execute_returns=[
                test_set if test_set is not None else _FakeTestSet(),
                max_participant_number,
                stimuli,
            ]
        )

    async def test_returns_manifest_with_clips_and_ids(self) -> None:
        stimuli = [
            _FakeStimulus(stimulus_id=_STIMULUS_ID_1, sort_order=1),
            _FakeStimulus(stimulus_id=_STIMULUS_ID_2, sort_order=2),
        ]
        db = self._db_for_start(stimuli=stimuli)

        import os
        os.environ["SUPABASE_URL"] = "https://test.supabase.co"

        # Patch participant/session model constructors to return fakes
        from unittest.mock import patch, MagicMock

        fake_participant = _FakeParticipant()
        fake_session = _FakeSession()
        fake_miso = _FakeMisoParticipant(miso_participant_number=1)

        with patch("app.routers.misokinesia.Participant", return_value=fake_participant), \
             patch("app.routers.misokinesia.SessionModel", return_value=fake_session), \
             patch("app.routers.misokinesia.MisokinesiaParticipant", return_value=fake_miso), \
             patch("app.routers.misokinesia._shuffle_stimuli", side_effect=lambda xs: xs):
            result = await start_misokinesia_session(db=db)

        self.assertEqual(result.misokinesia_participant_id, _MISO_PARTICIPANT_ID)
        self.assertEqual(result.misokinesia_participant_number, 1)
        self.assertEqual(result.session_id, _SESSION_ID)
        self.assertIn(result.mkaq_administration, ("pre", "post"))
        self.assertEqual(len(result.clips), 2)
        self.assertEqual(result.clips[0].sort_order, 1)
        self.assertEqual(result.clips[1].sort_order, 2)
        self.assertTrue(db.committed)

    async def test_clips_contain_public_supabase_url(self) -> None:
        import os
        from unittest.mock import patch

        os.environ["SUPABASE_URL"] = "https://test.supabase.co"
        stimuli = [_FakeStimulus(storage_path="clip_01.mp4")]
        db = self._db_for_start(stimuli=stimuli)

        fake_participant = _FakeParticipant()
        fake_session = _FakeSession()
        fake_miso = _FakeMisoParticipant()

        with patch("app.routers.misokinesia.Participant", return_value=fake_participant), \
             patch("app.routers.misokinesia.SessionModel", return_value=fake_session), \
             patch("app.routers.misokinesia.MisokinesiaParticipant", return_value=fake_miso), \
             patch("app.routers.misokinesia._shuffle_stimuli", side_effect=lambda xs: xs):
            result = await start_misokinesia_session(db=db)

        expected_url = "https://test.supabase.co/storage/v1/object/public/misokinesia-stimuli/clip_01.mp4"
        self.assertEqual(result.clips[0].public_url, expected_url)

    async def test_raises_404_when_no_active_test_set(self) -> None:
        # first execute returns None → no active test set
        db = _SequencedDB(execute_returns=[None])

        with self.assertRaises(HTTPException) as ctx:
            await start_misokinesia_session(db=db)
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_participant_number_uses_max_plus_one(self) -> None:
        """When max participant_number = 5, next should be 6."""
        import os
        from unittest.mock import patch

        os.environ["SUPABASE_URL"] = "https://test.supabase.co"
        db = self._db_for_start(max_participant_number=5)

        fake_participant = _FakeParticipant()
        fake_session = _FakeSession()
        fake_miso = _FakeMisoParticipant(miso_participant_number=2)
        added_participants: list = []

        original_add = db.add

        def tracking_add(obj: object) -> None:
            added_participants.append(obj)
            original_add(obj)

        db.add = tracking_add  # type: ignore[method-assign]

        with patch("app.routers.misokinesia.Participant") as MockParticipant, \
             patch("app.routers.misokinesia.SessionModel", return_value=fake_session), \
             patch("app.routers.misokinesia.MisokinesiaParticipant", return_value=fake_miso), \
             patch("app.routers.misokinesia._shuffle_stimuli", side_effect=lambda xs: xs):
            MockParticipant.return_value = fake_participant
            await start_misokinesia_session(db=db)
            # Verify Participant was called with participant_number=6
            MockParticipant.assert_called_once_with(participant_number=6)

    async def test_manifest_clip_order_is_randomized_per_session(self) -> None:
        import os
        from unittest.mock import patch

        os.environ["SUPABASE_URL"] = "https://test.supabase.co"
        stimuli = [
            _FakeStimulus(stimulus_id=_STIMULUS_ID_1, sort_order=1, storage_path="ankleWagging.mp4"),
            _FakeStimulus(stimulus_id=_STIMULUS_ID_2, sort_order=2, storage_path="armRubbing.mp4"),
        ]
        db = self._db_for_start(stimuli=stimuli)

        fake_participant = _FakeParticipant()
        fake_session = _FakeSession()
        fake_miso = _FakeMisoParticipant()

        with patch("app.routers.misokinesia.Participant", return_value=fake_participant), \
             patch("app.routers.misokinesia.SessionModel", return_value=fake_session), \
             patch("app.routers.misokinesia.MisokinesiaParticipant", return_value=fake_miso), \
             patch("app.routers.misokinesia._shuffle_stimuli", side_effect=lambda xs: list(reversed(xs))):
            result = await start_misokinesia_session(db=db)

        self.assertEqual(result.clips[0].stimulus_id, _STIMULUS_ID_2)
        self.assertEqual(result.clips[0].sort_order, 2)
        self.assertEqual(result.clips[1].stimulus_id, _STIMULUS_ID_1)
        self.assertEqual(result.clips[1].sort_order, 1)

    async def test_start_route_requires_lab_member_auth(self) -> None:
        """The /start route must declare Depends(get_current_lab_member)."""
        route = next(
            (
                r
                for r in router.routes
                if isinstance(r, APIRoute)
                and r.path == "/misokinesia/start"
                and "POST" in (r.methods or set())
            ),
            None,
        )
        self.assertIsNotNone(route, "POST /misokinesia/start route not registered")
        assert route is not None
        dep_calls = {d.call for d in route.dependant.dependencies}
        self.assertIn(
            get_current_lab_member,
            dep_calls,
            "POST /misokinesia/start must depend on get_current_lab_member",
        )


# ---------------------------------------------------------------------------
# Class 2 — get_trial_manifest
# ---------------------------------------------------------------------------


class GetTrialManifestTests(IsolatedAsyncioTestCase):
    def _make_stimuli(self, total: int = 6) -> list[_FakeStimulus]:
        stimulus_ids = [
            _STIMULUS_ID_1,
            _STIMULUS_ID_2,
            _STIMULUS_ID_3,
            _STIMULUS_ID_4,
            _STIMULUS_ID_5,
            _STIMULUS_ID_6,
        ][:total]
        return [
            _FakeStimulus(
                stimulus_id=stimulus_id,
                sort_order=index + 1,
                storage_path=f"clip_{index + 1:02d}.mp4",
                duration_ms=15000 + (index * 1000),
            )
            for index, stimulus_id in enumerate(stimulus_ids)
        ]

    def _db_for_trial_manifest(
        self,
        test_set: _FakeTestSet | None = None,
        stimuli: list[_FakeStimulus] | None = None,
    ) -> _SequencedDB:
        if stimuli is None:
            stimuli = self._make_stimuli()
        return _SequencedDB(
            execute_returns=[
                test_set if test_set is not None else _FakeTestSet(),
                stimuli,
            ]
        )

    async def test_trial_manifest_route_requires_lab_member_auth(self) -> None:
        route = next(
            (
                r
                for r in router.routes
                if isinstance(r, APIRoute)
                and r.path == "/misokinesia/trial-manifest"
                and "GET" in (r.methods or set())
            ),
            None,
        )
        self.assertIsNotNone(route, "GET /misokinesia/trial-manifest route not registered")
        assert route is not None
        dep_calls = {d.call for d in route.dependant.dependencies}
        self.assertIn(
            get_current_lab_member,
            dep_calls,
            "GET /misokinesia/trial-manifest must depend on get_current_lab_member",
        )

    async def test_raises_404_when_no_active_test_set(self) -> None:
        db = _SequencedDB(execute_returns=[None])
        with self.assertRaises(HTTPException) as ctx:
            await get_trial_manifest(db=db)
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_raises_409_when_fewer_than_five_active_stimuli_exist(self) -> None:
        db = self._db_for_trial_manifest(stimuli=self._make_stimuli(total=4))
        with self.assertRaises(HTTPException) as ctx:
            await get_trial_manifest(db=db)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("At least 5 active misokinesia stimuli", str(ctx.exception.detail))

    async def test_returns_five_sampled_clips_with_public_urls_and_no_writes(self) -> None:
        import os
        from unittest.mock import patch

        os.environ["SUPABASE_URL"] = "https://test.supabase.co"
        stimuli = self._make_stimuli(total=6)
        sampled = [stimuli[5], stimuli[4], stimuli[3], stimuli[2], stimuli[1]]
        db = self._db_for_trial_manifest(stimuli=stimuli)

        with patch("app.routers.misokinesia._sample_trial_stimuli", return_value=sampled):
            result = await get_trial_manifest(db=db)

        self.assertEqual(len(result.clips), 5)
        self.assertEqual(result.clips[0].stimulus_id, _STIMULUS_ID_6)
        self.assertEqual(result.clips[0].sort_order, 6)
        self.assertEqual(
            result.clips[0].public_url,
            "https://test.supabase.co/storage/v1/object/public/misokinesia-stimuli/clip_06.mp4",
        )
        self.assertEqual(result.clips[0].duration_ms, 20000)
        self.assertFalse(db.committed, "Trial manifest endpoint must not perform writes")

    async def test_repeated_calls_can_return_different_subset_or_order(self) -> None:
        import os
        from unittest.mock import patch

        os.environ["SUPABASE_URL"] = "https://test.supabase.co"
        stimuli = self._make_stimuli(total=6)
        db_first = self._db_for_trial_manifest(stimuli=stimuli)
        db_second = self._db_for_trial_manifest(stimuli=stimuli)

        first_sample = [stimuli[0], stimuli[1], stimuli[2], stimuli[3], stimuli[4]]
        second_sample = [stimuli[1], stimuli[2], stimuli[3], stimuli[4], stimuli[5]]

        with patch(
            "app.routers.misokinesia._sample_trial_stimuli",
            side_effect=[first_sample, second_sample],
        ):
            first_result = await get_trial_manifest(db=db_first)
            second_result = await get_trial_manifest(db=db_second)

        first_ids = [clip.stimulus_id for clip in first_result.clips]
        second_ids = [clip.stimulus_id for clip in second_result.clips]
        self.assertNotEqual(first_ids, second_ids)


# ---------------------------------------------------------------------------
# Class 3 — submit_trial_response
# ---------------------------------------------------------------------------


class SubmitTrialResponseTests(IsolatedAsyncioTestCase):
    def _valid_payload(
        self, stimulus_id: uuid.UUID = _STIMULUS_ID_1
    ) -> MisokinesiaTrialResponseCreate:
        return MisokinesiaTrialResponseCreate(
            stimulus_id=stimulus_id,
            display_order=1,
            q1=3,
            q2=2,
            q3=4,
            q4=1,
        )

    def _db_for_response(
        self,
        miso_participant: _FakeMisoParticipant | None = None,
        stimulus: _FakeStimulus | None = None,
        total_stimuli: int = 2,
        submitted_count: int = 1,
        raise_integrity_on_flush: bool = False,
        mkaq_row: Any = "_DEFAULT_",
    ) -> _SequencedDB:
        """Build fake DB for submit_trial_response.

        execute() call order for pre participants:
          0. select(MisokinesiaParticipant)              → miso_participant or None
          1. select(MisokinesiaAqResponseModel)           → mkaq_row (pre guard)
          2. select(MisokinesiaStimulus)                  → stimulus or None
          3. select(func.count(MisokinesiaStimulus))      → total_stimuli
          4. select(func.count(MisokinesiaTrialResponse)) → submitted_count

        For non-pre participants, call 1 (mkaq guard) is skipped.
        mkaq_row defaults to a fake non-None row (MkAQ already submitted).
        Pass mkaq_row=None to test the guard-failure path.
        """
        if miso_participant is None:
            miso_participant = _FakeMisoParticipant()
        if stimulus is None:
            stimulus = _FakeStimulus()
        if mkaq_row == "_DEFAULT_":
            mkaq_row = _FakeMkaqResponseRow()

        execute_returns: list[Any] = [miso_participant]
        if getattr(miso_participant, "mkaq_administration", None) == "pre":
            execute_returns.append(mkaq_row)
        execute_returns.extend([stimulus, total_stimuli, submitted_count])

        return _SequencedDB(
            execute_returns=execute_returns,
            raise_integrity_on_flush=raise_integrity_on_flush,
        )

    async def test_valid_response_returns_201_with_response_id(self) -> None:
        db = self._db_for_response(total_stimuli=2, submitted_count=1)
        fake_response = _FakeResponseRow()

        from unittest.mock import patch

        with patch(
            "app.routers.misokinesia.MisokinesiaTrialResponse",
            return_value=fake_response,
        ):
            result = await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )

        self.assertEqual(result.response_id, _RESPONSE_ID)
        self.assertEqual(result.session_id, _SESSION_ID)
        self.assertFalse(result.is_complete)
        self.assertTrue(db.committed)

    async def test_no_auth_dependency_on_responses_route(self) -> None:
        """POST /participants/{id}/responses must not declare get_current_lab_member."""
        route = next(
            (
                r
                for r in router.routes
                if isinstance(r, APIRoute)
                and "/responses" in (r.path or "")
                and "POST" in (r.methods or set())
            ),
            None,
        )
        self.assertIsNotNone(route, "POST /responses route not registered")
        assert route is not None
        dep_calls = {d.call for d in route.dependant.dependencies}
        self.assertNotIn(
            get_current_lab_member,
            dep_calls,
            "Responses endpoint should not require lab-member auth",
        )

    async def test_raises_404_when_participant_not_found(self) -> None:
        # first execute returns None → no participant
        db = _SequencedDB(execute_returns=[None])
        with self.assertRaises(HTTPException) as ctx:
            await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_raises_409_when_participant_already_complete(self) -> None:
        miso = _FakeMisoParticipant(completed_at=_NOW)
        db = _SequencedDB(execute_returns=[miso])
        with self.assertRaises(HTTPException) as ctx:
            await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    async def test_raises_422_when_stimulus_not_in_test_set(self) -> None:
        miso = _FakeMisoParticipant()  # mkaq_administration="pre"
        # [0]=participant, [1]=mkaq guard (submitted), [2]=None → stimulus not in test set
        db = _SequencedDB(execute_returns=[miso, _FakeMkaqResponseRow(), None])
        with self.assertRaises(HTTPException) as ctx:
            await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 422)

    async def test_raises_409_on_duplicate_response(self) -> None:
        db = self._db_for_response(raise_integrity_on_flush=True)
        from unittest.mock import patch

        with patch("app.routers.misokinesia.MisokinesiaTrialResponse", return_value=_FakeResponseRow()):
            with self.assertRaises(HTTPException) as ctx:
                await submit_trial_response(
                    participant_id=_MISO_PARTICIPANT_ID,
                    payload=self._valid_payload(),
                    db=db,
                )
        self.assertEqual(ctx.exception.status_code, 409)

    async def test_is_complete_true_on_final_response(self) -> None:
        """After the Nth (final) response, is_complete must be True and completed_at set."""
        miso = _FakeMisoParticipant()
        db = self._db_for_response(
            miso_participant=miso,
            total_stimuli=2,
            submitted_count=2,  # this submission brings count == total
        )
        fake_response = _FakeResponseRow()

        from unittest.mock import patch

        with patch(
            "app.routers.misokinesia.MisokinesiaTrialResponse",
            return_value=fake_response,
        ):
            result = await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )

        self.assertTrue(result.is_complete)
        # completed_at was set on the ORM object (func.now() sentinel)
        self.assertIsNotNone(miso.completed_at)

    async def test_q_values_out_of_range_rejected_by_schema(self) -> None:
        """q values outside 1–5 must raise Pydantic ValidationError."""
        with self.assertRaises(ValidationError):
            MisokinesiaTrialResponseCreate(
                stimulus_id=_STIMULUS_ID_1,
                display_order=1,
                q1=0,  # below minimum
                q2=3,
                q3=3,
                q4=3,
            )

        with self.assertRaises(ValidationError):
            MisokinesiaTrialResponseCreate(
                stimulus_id=_STIMULUS_ID_1,
                display_order=1,
                q1=6,  # above maximum
                q2=3,
                q3=3,
                q4=3,
            )


# ---------------------------------------------------------------------------
# Class 4 — submit_end_of_task
# ---------------------------------------------------------------------------


class SubmitEndOfTaskTests(IsolatedAsyncioTestCase):
    def _db_for_eot(
        self,
        completed_at: datetime | None = _NOW,
    ) -> _SequencedDB:
        miso = _FakeMisoParticipant(completed_at=completed_at)
        return _SequencedDB(execute_returns=[miso])

    async def test_valid_payload_returns_200(self) -> None:
        db = self._db_for_eot(completed_at=_NOW)
        payload = MisokinesiaEndOfTaskCreate(
            end_fidgeting_text="tapping",
            end_emotions_text="anxious",
            stronger_responses=True,
            stronger_responses_timing="After 5 seconds",
        )
        result = await submit_end_of_task(
            participant_id=_MISO_PARTICIPANT_ID,
            payload=payload,
            db=db,
        )
        self.assertEqual(result.misokinesia_participant_id, _MISO_PARTICIPANT_ID)
        self.assertEqual(result.end_fidgeting_text, "tapping")
        self.assertEqual(result.end_emotions_text, "anxious")
        self.assertTrue(result.stronger_responses)
        self.assertEqual(result.stronger_responses_timing, "After 5 seconds")
        self.assertTrue(db.committed)

    async def test_null_fields_accepted(self) -> None:
        db = self._db_for_eot(completed_at=_NOW)
        payload = MisokinesiaEndOfTaskCreate()  # all fields None
        result = await submit_end_of_task(
            participant_id=_MISO_PARTICIPANT_ID,
            payload=payload,
            db=db,
        )
        self.assertIsNone(result.end_fidgeting_text)
        self.assertIsNone(result.stronger_responses)
        self.assertIsNone(result.stronger_responses_timing)

    async def test_raises_404_when_participant_not_found(self) -> None:
        db = _SequencedDB(execute_returns=[None])
        with self.assertRaises(HTTPException) as ctx:
            await submit_end_of_task(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=MisokinesiaEndOfTaskCreate(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_raises_409_when_completed_at_is_null(self) -> None:
        db = self._db_for_eot(completed_at=None)
        with self.assertRaises(HTTPException) as ctx:
            await submit_end_of_task(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=MisokinesiaEndOfTaskCreate(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    async def test_stronger_responses_timing_without_stronger_true_raises_422(
        self,
    ) -> None:
        """stronger_responses_timing set when stronger_responses is false → ValidationError."""
        with self.assertRaises(ValidationError):
            MisokinesiaEndOfTaskCreate(
                stronger_responses=False,
                stronger_responses_timing="Immediately",
            )

    async def test_stronger_responses_timing_without_stronger_set_raises_422(
        self,
    ) -> None:
        """stronger_responses_timing set when stronger_responses is None → ValidationError."""
        with self.assertRaises(ValidationError):
            MisokinesiaEndOfTaskCreate(
                stronger_responses=None,
                stronger_responses_timing="After 10 seconds",
            )

    async def test_end_of_task_route_has_no_auth_dependency(self) -> None:
        """PATCH /participants/{id}/end-of-task must not require lab-member auth."""
        route = next(
            (
                r
                for r in router.routes
                if isinstance(r, APIRoute)
                and "end-of-task" in (r.path or "")
                and "PATCH" in (r.methods or set())
            ),
            None,
        )
        self.assertIsNotNone(route, "PATCH /end-of-task route not registered")
        assert route is not None
        dep_calls = {d.call for d in route.dependant.dependencies}
        self.assertNotIn(
            get_current_lab_member,
            dep_calls,
            "End-of-task endpoint should not require lab-member auth",
        )

    async def test_raises_409_for_post_participant_without_mkaq(self) -> None:
        """Post-assigned participants must have MkAQ submitted before end-of-task."""
        miso = _FakeMisoParticipant(completed_at=_NOW, mkaq_administration="post")
        # [0]=participant, [1]=mkaq guard → None (not submitted)
        db = _SequencedDB(execute_returns=[miso, None])
        with self.assertRaises(HTTPException) as ctx:
            await submit_end_of_task(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=MisokinesiaEndOfTaskCreate(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("MkAQ", ctx.exception.detail)

    async def test_post_participant_with_mkaq_can_submit_end_of_task(self) -> None:
        """Post-assigned participant with MkAQ submitted can proceed."""
        miso = _FakeMisoParticipant(completed_at=_NOW, mkaq_administration="post")
        # [0]=participant, [1]=mkaq guard → found
        db = _SequencedDB(execute_returns=[miso, _FakeMkaqResponseRow()])
        result = await submit_end_of_task(
            participant_id=_MISO_PARTICIPANT_ID,
            payload=MisokinesiaEndOfTaskCreate(),
            db=db,
        )
        self.assertEqual(result.misokinesia_participant_id, _MISO_PARTICIPANT_ID)
        self.assertTrue(db.committed)


# ---------------------------------------------------------------------------
# Class 5 — submit_trial_response: pre-MkAQ guard
# ---------------------------------------------------------------------------


class SubmitTrialResponsePreGuardTests(IsolatedAsyncioTestCase):
    def _valid_payload(self) -> MisokinesiaTrialResponseCreate:
        return MisokinesiaTrialResponseCreate(
            stimulus_id=_STIMULUS_ID_1,
            display_order=1,
            q1=3,
            q2=2,
            q3=4,
            q4=1,
        )

    async def test_raises_409_for_pre_participant_without_mkaq(self) -> None:
        """Pre-assigned participants must submit MkAQ before per-clip responses."""
        miso = _FakeMisoParticipant(mkaq_administration="pre")
        # [0]=participant, [1]=mkaq guard → None (not submitted)
        db = _SequencedDB(execute_returns=[miso, None])
        with self.assertRaises(HTTPException) as ctx:
            await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("MkAQ", ctx.exception.detail)

    async def test_post_participant_can_submit_responses_without_mkaq(self) -> None:
        """Post-assigned participants can submit per-clip responses before MkAQ."""
        miso = _FakeMisoParticipant(mkaq_administration="post")
        stimulus = _FakeStimulus()
        fake_response = _FakeResponseRow()
        # [0]=participant (post, no mkaq guard), [1]=stimulus, [2]=total, [3]=submitted
        db = _SequencedDB(execute_returns=[miso, stimulus, 2, 1])

        from unittest.mock import patch

        with patch(
            "app.routers.misokinesia.MisokinesiaTrialResponse",
            return_value=fake_response,
        ):
            result = await submit_trial_response(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertFalse(result.is_complete)
        self.assertTrue(db.committed)


# ---------------------------------------------------------------------------
# Class 6 — submit_mkaq
# ---------------------------------------------------------------------------


class SubmitMkaqTests(IsolatedAsyncioTestCase):
    def _valid_payload(self) -> MisokinesiaAqCreate:
        return MisokinesiaAqCreate(**{f"q{i}": i % 4 for i in range(1, 22)})

    def _db_for_mkaq(
        self,
        miso_participant: _FakeMisoParticipant | None = None,
        raise_integrity_on_flush: bool = False,
    ) -> _SequencedDB:
        if miso_participant is None:
            miso_participant = _FakeMisoParticipant()
        return _SequencedDB(
            execute_returns=[miso_participant],
            raise_integrity_on_flush=raise_integrity_on_flush,
        )

    async def test_happy_path_returns_201_with_correct_fields(self) -> None:
        db = self._db_for_mkaq()
        fake_mkaq_row = _FakeMkaqResponseRow()

        from unittest.mock import patch

        with patch(
            "app.routers.misokinesia.MisokinesiaAqResponseModel",
            return_value=fake_mkaq_row,
        ):
            result = await submit_mkaq(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )

        self.assertEqual(result.response_id, _MKAQ_RESPONSE_ID)
        self.assertEqual(result.misokinesia_participant_id, _MISO_PARTICIPANT_ID)
        self.assertEqual(result.session_id, _SESSION_ID)
        self.assertEqual(result.administration, "pre")
        self.assertIsInstance(result.total_score, int)
        self.assertTrue(db.committed)

    async def test_raises_404_when_participant_not_found(self) -> None:
        db = _SequencedDB(execute_returns=[None])
        with self.assertRaises(HTTPException) as ctx:
            await submit_mkaq(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 404)

    async def test_raises_409_on_duplicate_mkaq_submission(self) -> None:
        db = self._db_for_mkaq(raise_integrity_on_flush=True)
        from unittest.mock import patch

        with patch(
            "app.routers.misokinesia.MisokinesiaAqResponseModel",
            return_value=_FakeMkaqResponseRow(),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await submit_mkaq(
                    participant_id=_MISO_PARTICIPANT_ID,
                    payload=self._valid_payload(),
                    db=db,
                )
        self.assertEqual(ctx.exception.status_code, 409)

    async def test_raises_409_when_no_mkaq_administration_assigned(self) -> None:
        """Participant with mkaq_administration=None should receive 409."""
        miso = _FakeMisoParticipant(mkaq_administration=None)
        db = _SequencedDB(execute_returns=[miso])
        with self.assertRaises(HTTPException) as ctx:
            await submit_mkaq(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=self._valid_payload(),
                db=db,
            )
        self.assertEqual(ctx.exception.status_code, 409)

    async def test_q_values_outside_0_3_rejected_by_schema(self) -> None:
        base = {f"q{i}": 1 for i in range(1, 22)}

        with self.assertRaises(ValidationError):
            MisokinesiaAqCreate(**{**base, "q1": -1})

        with self.assertRaises(ValidationError):
            MisokinesiaAqCreate(**{**base, "q1": 4})

    async def test_total_score_computed_server_side(self) -> None:
        """total_score is computed in FastAPI as sum of q1–q21; not accepted from client."""
        db = self._db_for_mkaq()
        payload = MisokinesiaAqCreate(**{f"q{i}": 2 for i in range(1, 22)})
        expected_score = 2 * 21  # all items = 2

        captured: dict = {}
        from unittest.mock import patch, MagicMock

        def capture_mkaq_row(**kwargs: Any) -> _FakeMkaqResponseRow:
            captured["total_score"] = kwargs.get("total_score")
            row = _FakeMkaqResponseRow()
            row.total_score = kwargs.get("total_score", 0)
            return row

        with patch(
            "app.routers.misokinesia.MisokinesiaAqResponseModel",
            side_effect=capture_mkaq_row,
        ):
            await submit_mkaq(
                participant_id=_MISO_PARTICIPANT_ID,
                payload=payload,
                db=db,
            )

        self.assertEqual(captured["total_score"], expected_score)

    async def test_mkaq_route_has_no_auth_dependency(self) -> None:
        """POST /participants/{id}/mkaq must not require lab-member auth."""
        route = next(
            (
                r
                for r in router.routes
                if isinstance(r, APIRoute)
                and "/mkaq" in (r.path or "")
                and "POST" in (r.methods or set())
            ),
            None,
        )
        self.assertIsNotNone(route, "POST /mkaq route not registered")
        assert route is not None
        dep_calls = {d.call for d in route.dependant.dependencies}
        self.assertNotIn(
            get_current_lab_member,
            dep_calls,
            "MkAQ endpoint should not require lab-member auth",
        )
