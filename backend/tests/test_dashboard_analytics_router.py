from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.routing import APIRoute

from app.auth import get_current_lab_member
from app.routers.dashboard import get_dashboard_analytics_route, router
from app.schemas.analytics import (
    AnalyticsDatasetMetadataResponse,
    AnalyticsSnapshotMetadataResponse,
    DashboardAnalyticsResponse,
)


def _build_response(*, status: str = "ready") -> DashboardAnalyticsResponse:
    generated_at = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)
    return DashboardAnalyticsResponse(
        status=status,
        snapshot=AnalyticsSnapshotMetadataResponse(
            mode="live" if status != "ready" else "snapshot",
            generated_at=generated_at,
            is_stale=status in {"stale", "recomputing"},
            recompute_started_at=generated_at if status != "ready" else None,
            recompute_finished_at=generated_at if status == "stale" else None,
        ),
        dataset=AnalyticsDatasetMetadataResponse(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            included_sessions=24,
            included_days=8,
            native_rows=20,
            imported_rows=4,
            excluded_rows=2,
            exclusion_reasons=[],
            generated_at=generated_at,
        ),
        models=[],
    )


class DashboardAnalyticsRouterTests(IsolatedAsyncioTestCase):
    def test_route_is_registered_with_get_and_lab_member_dependency(self) -> None:
        analytics_route = next(
            route
            for route in router.routes
            if isinstance(route, APIRoute) and route.path == "/dashboard/analytics"
        )

        dependency_calls = {dependency.call for dependency in analytics_route.dependant.dependencies}

        assert analytics_route.methods == {"GET"}
        assert analytics_route.response_model is DashboardAnalyticsResponse
        assert get_current_lab_member in dependency_calls

    async def test_route_rejects_inverted_date_range(self) -> None:
        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(),
        ) as analytics_mock:
            with self.assertRaises(HTTPException) as exc_info:
                await get_dashboard_analytics_route(
                    date_from=date(2026, 3, 9),
                    date_to=date(2026, 3, 8),
                    mode="snapshot",
                    lab_member=_lab_member(),
                    db=object(),
                )

        assert exc_info.exception.status_code == 422
        assert exc_info.exception.detail == "date_from must not be after date_to"
        analytics_mock.assert_not_awaited()

    async def test_route_returns_snapshot_payload_in_snapshot_mode(self) -> None:
        db = object()
        expected_response = _build_response(status="ready")

        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(return_value=expected_response),
        ) as analytics_mock:
            response = await get_dashboard_analytics_route(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                mode="snapshot",
                lab_member=_lab_member(),
                db=db,
            )

        assert response == expected_response
        analytics_mock.assert_awaited_once_with(
            db,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            mode="snapshot",
            triggered_by_lab_member_id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        )

    async def test_route_returns_404_when_snapshot_mode_has_no_saved_snapshot(self) -> None:
        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(return_value=None),
        ) as analytics_mock:
            with self.assertRaises(HTTPException) as exc_info:
                await get_dashboard_analytics_route(
                    date_from=date(2026, 3, 1),
                    date_to=date(2026, 3, 8),
                    mode="snapshot",
                    lab_member=_lab_member(),
                    db=object(),
                )

        assert exc_info.exception.status_code == 404
        assert exc_info.exception.detail == "No analytics snapshot exists for the requested range"
        analytics_mock.assert_awaited_once()

    async def test_route_passes_live_mode_to_recompute_service(self) -> None:
        db = object()
        expected_response = _build_response(status="stale")

        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(return_value=expected_response),
        ) as analytics_mock:
            response = await get_dashboard_analytics_route(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                mode="live",
                lab_member=_lab_member(),
                db=db,
            )

        assert response.status == "stale"
        assert response.snapshot.mode == "live"
        analytics_mock.assert_awaited_once_with(
            db,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            mode="live",
            triggered_by_lab_member_id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        )


def _lab_member() -> object:
    from app.auth import LabMember

    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
    )
