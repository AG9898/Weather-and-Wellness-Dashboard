from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from app.auth import LabMember, get_current_admin
from app.db import get_session
from app.models.sessions import Session
from app.routers.admin import (
    delete_admin_session,
    restore_admin_session,
    router,
    void_admin_session,
)
from app.schemas.admin import AdminVoidSessionRequest
from app.services.data_quality import SessionDataQualityRow


SESSION_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
PARTICIPANT_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
ADMIN_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
NOW = datetime(2026, 7, 12, 18, 0, tzinfo=timezone.utc)


def _admin() -> LabMember:
    return LabMember(
        id=ADMIN_ID,
        email="admin@lab.test",
        role="admin",
        lab_name="ww",
    )


def _session() -> Session:
    return Session(
        session_id=SESSION_ID,
        participant_uuid=PARTICIPANT_ID,
        status="active",
        created_at=NOW,
    )


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _MutableSessionDB:
    def __init__(self) -> None:
        self.session = _session()
        self.executed_sql: list[str] = []
        self.commit_count = 0

    async def execute(self, statement: object) -> _ScalarResult:
        sql = str(statement)
        self.executed_sql.append(sql)
        if sql.lstrip().upper().startswith("SELECT"):
            return _ScalarResult(self.session)
        return _ScalarResult(None)

    async def commit(self) -> None:
        self.commit_count += 1


def test_admin_flagged_session_routes_reject_ra_role() -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_session] = lambda: object()
    client = TestClient(app)
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "ra@lab.test",
            "app_metadata": {"role": "ra", "lab_name": "ww"},
        },
        "test-secret",
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token}"}

    requests = (
        ("get", "/admin/flagged-sessions", None),
        ("post", f"/admin/sessions/{SESSION_ID}/void", {"reason": "invalid"}),
        ("post", f"/admin/sessions/{SESSION_ID}/restore", None),
        ("delete", f"/admin/sessions/{SESSION_ID}", None),
    )
    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "test-secret"}):
        for method, path, body in requests:
            response = client.request(method, path, headers=headers, json=body)
            assert response.status_code == 403


def test_admin_flagged_sessions_list_shape_and_filter() -> None:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_admin] = _admin
    app.dependency_overrides[get_session] = lambda: object()
    client = TestClient(app)
    rows = [
        SessionDataQualityRow(
            study="weather",
            lab="ww",
            participant_number=7,
            session_id=SESSION_ID,
            run_id=None,
            created_at=NOW,
            activated_at=NOW,
            completed_at=None,
            classification="partial",
            demographics_missing=False,
        ),
        SessionDataQualityRow(
            study="poffenberger",
            lab="ihtt",
            participant_number=8,
            session_id=uuid.uuid4(),
            run_id=uuid.uuid4(),
            created_at=NOW,
            activated_at=NOW,
            completed_at=NOW,
            classification="complete",
            demographics_missing=True,
        ),
    ]

    with patch(
        "app.routers.admin.get_session_data_quality_rows",
        new=AsyncMock(return_value=rows),
    ):
        flagged = client.get("/admin/flagged-sessions")
        all_rows = client.get("/admin/flagged-sessions?include_valid=true")

    assert flagged.status_code == 200
    assert flagged.json() == [
        {
            "study": "weather",
            "lab": "ww",
            "participant_number": 7,
            "session_id": str(SESSION_ID),
            "run_id": None,
            "created_at": "2026-07-12T18:00:00Z",
            "activated_at": "2026-07-12T18:00:00Z",
            "completed_at": None,
            "classification": "partial",
            "demographics_missing": False,
        }
    ]
    assert all_rows.status_code == 200
    assert len(all_rows.json()) == 2


class AdminSessionMutationTests(IsolatedAsyncioTestCase):
    async def test_admin_void_then_restore_round_trip(self) -> None:
        db = _MutableSessionDB()

        voided = await void_admin_session(
            SESSION_ID,
            AdminVoidSessionRequest(reason="  duplicate run  "),
            _admin(),
            db,  # type: ignore[arg-type]
        )
        assert voided.session_id == SESSION_ID
        assert voided.voided_at is not None
        assert voided.void_reason == "duplicate run"

        restored = await restore_admin_session(
            SESSION_ID,
            _admin(),
            db,  # type: ignore[arg-type]
        )
        assert restored.voided_at is None
        assert restored.void_reason is None
        assert db.session.voided_at is None
        assert db.session.void_reason is None
        assert db.commit_count == 2

    async def test_admin_session_hard_delete_removes_all_dependent_rows(self) -> None:
        db = _MutableSessionDB()

        response = await delete_admin_session(
            SESSION_ID,
            _admin(),
            db,  # type: ignore[arg-type]
        )

        deleted_sql = " ".join(db.executed_sql).lower()
        for table in (
            "digitspan_trials",
            "digitspan_runs",
            "stroop_trials",
            "stroop_runs",
            "card_sorting_trials",
            "card_sorting_runs",
            "survey_uls8",
            "survey_cesd10",
            "survey_gad7",
            "survey_cogfunc8a",
            "imported_session_measures",
            "misokinesia_mkaq_responses",
            "misokinesia_gad7_responses",
            "misokinesia_maq_responses",
            "misokinesia_trial_responses",
            "misokinesia_participants",
            "ihtt_poffenberger_trials",
            "ihtt_poffenberger_runs",
            "sessions",
        ):
            assert f"delete from {table}" in deleted_sql
        assert response.session_id == SESSION_ID
        assert response.deleted is True
        assert db.commit_count == 1
