from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from jose import jwt

from app.routers.ihtt_poffenberger import get_poffenberger_dashboard, router
from app.schemas.poffenberger import PoffenbergerDashboardResponse

_MEMBER_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")
_NOW = datetime(2026, 6, 21, 12, 0, tzinfo=timezone.utc)


class _MappingRows:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def all(self) -> list[dict[str, Any]]:
        return self._rows


class _MappingResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def mappings(self) -> _MappingRows:
        return _MappingRows(self._rows)


class _DashboardDB:
    """Returns queued mapping results in execute() call order (agg, then recent)."""

    def __init__(self, results: list[list[dict[str, Any]]]) -> None:
        self._results = list(results)
        self.execute_calls = 0

    async def execute(self, stmt: object) -> _MappingResult:  # noqa: ARG002
        rows = self._results[self.execute_calls] if self.execute_calls < len(self._results) else []
        self.execute_calls += 1
        return _MappingResult(rows)


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


def test_dashboard_route_is_registered_with_ihtt_ra_dependency() -> None:
    route = next(
        route
        for route in router.routes
        if isinstance(route, APIRoute)
        and route.path == "/ihtt/poffenberger/dashboard"
        and "GET" in (route.methods or set())
    )

    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert route.status_code == 200
    assert route.response_model is PoffenbergerDashboardResponse
    assert any(
        getattr(call, "__qualname__", "") == "get_current_ra_for_lab.<locals>._dependency"
        for call in dependency_calls
    )


def test_dashboard_route_requires_auth_and_rejects_non_ihtt_non_admin() -> None:
    client = _route_client()

    missing = client.get("/ihtt/poffenberger/dashboard")
    assert missing.status_code == 401

    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "test-secret"}):
        wrong_lab = client.get(
            "/ihtt/poffenberger/dashboard",
            headers={"Authorization": f"Bearer {_auth_token(lab_name='ww')}"},
        )

    assert wrong_lab.status_code == 403


def test_export_route_is_registered_with_ihtt_ra_dependency() -> None:
    route = next(
        route
        for route in router.routes
        if isinstance(route, APIRoute)
        and route.path == "/ihtt/poffenberger/export.xlsx"
        and "GET" in (route.methods or set())
    )

    dependency_calls = {dependency.call for dependency in route.dependant.dependencies}

    assert route.response_class.__name__ == "Response"
    assert any(
        getattr(call, "__qualname__", "") == "get_current_ra_for_lab.<locals>._dependency"
        for call in dependency_calls
    )


def test_export_route_requires_auth_and_rejects_non_ihtt_non_admin() -> None:
    client = _route_client()

    missing = client.get("/ihtt/poffenberger/export.xlsx")
    assert missing.status_code == 401

    with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "test-secret"}):
        wrong_lab = client.get(
            "/ihtt/poffenberger/export.xlsx",
            headers={"Authorization": f"Bearer {_auth_token(lab_name='ww')}"},
        )

    assert wrong_lab.status_code == 403


class PoffenbergerDashboardHandlerTests(IsolatedAsyncioTestCase):
    async def test_returns_counts_average_and_recent_runs(self) -> None:
        agg_row = {
            "total_runs": 3,
            "completed_runs": 2,
            "avg_ihtt_difference_ms": Decimal("3.50"),
        }
        recent_rows = [
            {
                "participant_number": 42,
                "started_at": _NOW,
                "completed_at": None,
                "is_complete": False,
                "age_band": "18-24",
                "gender": "Woman",
                "handedness": "Right-handed",
                "ihtt_difference_ms": None,
            },
            {
                "participant_number": 41,
                "started_at": _NOW,
                "completed_at": _NOW,
                "is_complete": True,
                "age_band": "25-31",
                "gender": "Man",
                "handedness": "Left-handed",
                "ihtt_difference_ms": Decimal("2.80"),
            },
        ]
        db = _DashboardDB([[agg_row], recent_rows])

        result = await get_poffenberger_dashboard(db=db)

        assert result.total_runs == 3
        assert result.completed_runs == 2
        assert result.avg_ihtt_difference_ms == Decimal("3.50")
        assert len(result.recent_runs) == 2
        assert result.recent_runs[0].participant_number == 42
        assert result.recent_runs[0].is_complete is False
        assert result.recent_runs[0].ihtt_difference_ms is None
        assert result.recent_runs[1].is_complete is True
        assert result.recent_runs[1].ihtt_difference_ms == Decimal("2.80")

    async def test_returns_zeros_when_no_runs(self) -> None:
        agg_row = {
            "total_runs": 0,
            "completed_runs": 0,
            "avg_ihtt_difference_ms": None,
        }
        db = _DashboardDB([[agg_row], []])

        result = await get_poffenberger_dashboard(db=db)

        assert result.total_runs == 0
        assert result.completed_runs == 0
        assert result.avg_ihtt_difference_ms is None
        assert result.recent_runs == []
