from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks, HTTPException
from fastapi.routing import APIRoute

from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.auth import get_current_lab_member
from app.routers.dashboard import (
    get_dashboard_analytics_route,
    get_dashboard_study_window_route,
    router,
)
from app.schemas.analytics import (
    AnalyticsDatasetMetadataResponse,
    AnalyticsSnapshotMetadataResponse,
    DashboardAnalyticsResponse,
)
from app.analytics.temperature_summary import build_temperature_summary
from app.schemas.weather import LatestStudyDayResponse
from app.services.analytics_service import AnalyticsRefreshRequestResult


def _build_temperature_summary():
    generated_at = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)
    dataset = AnalyticsDatasetBuildResult(
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 2),
        generated_at=generated_at,
        rows=(
            AnalyticsDatasetRow(
                session_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
                participant_uuid=uuid.UUID("22222222-2222-2222-2222-222222222222"),
                date_local=date(2026, 3, 1),
                date_bin=1,
                temperature=2.0,
                precipitation=0.0,
                daylight_hours=9.0,
                anxiety=1.0,
                depression=1.0,
                loneliness=1.0,
                self_report=1.0,
                digit_span_score=1,
                imported_fields=(),
            ),
            AnalyticsDatasetRow(
                session_id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
                participant_uuid=uuid.UUID("44444444-4444-4444-4444-444444444444"),
                date_local=date(2026, 3, 2),
                date_bin=2,
                temperature=8.0,
                precipitation=0.0,
                daylight_hours=9.5,
                anxiety=1.0,
                depression=1.0,
                loneliness=1.0,
                self_report=1.0,
                digit_span_score=1,
                imported_fields=(),
            ),
        ),
        excluded_rows=(),
    )
    return build_temperature_summary(dataset)


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
        temperature_summary=_build_temperature_summary(),
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

    def test_study_window_route_is_registered_with_get_and_lab_member_dependency(self) -> None:
        study_window_route = next(
            route
            for route in router.routes
            if isinstance(route, APIRoute) and route.path == "/dashboard/study-window"
        )

        dependency_calls = {dependency.call for dependency in study_window_route.dependant.dependencies}

        assert study_window_route.methods == {"GET"}
        assert study_window_route.response_model is LatestStudyDayResponse
        assert get_current_lab_member in dependency_calls

    async def test_route_rejects_inverted_date_range(self) -> None:
        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(),
        ) as analytics_mock:
            background_tasks = BackgroundTasks()
            with self.assertRaises(HTTPException) as exc_info:
                await get_dashboard_analytics_route(
                    background_tasks=background_tasks,
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
        background_tasks = BackgroundTasks()

        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(return_value=expected_response),
        ) as analytics_mock:
            response = await get_dashboard_analytics_route(
                background_tasks=background_tasks,
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
        assert response.temperature_summary.windows[0].day_count == 2

    async def test_route_returns_404_when_snapshot_mode_has_no_saved_snapshot(self) -> None:
        with patch(
            "app.routers.dashboard.get_dashboard_analytics",
            new=AsyncMock(return_value=None),
        ) as analytics_mock:
            background_tasks = BackgroundTasks()
            with self.assertRaises(HTTPException) as exc_info:
                await get_dashboard_analytics_route(
                    background_tasks=background_tasks,
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
        background_tasks = BackgroundTasks()

        with patch(
            "app.routers.dashboard.request_dashboard_analytics_refresh",
            new=AsyncMock(
                return_value=AnalyticsRefreshRequestResult(
                    response=expected_response,
                    run_id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                )
            ),
        ) as refresh_mock:
            response = await get_dashboard_analytics_route(
                background_tasks=background_tasks,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                mode="live",
                lab_member=_lab_member(),
                db=db,
            )

        assert response.status == "stale"
        assert response.snapshot.mode == "live"
        assert response.temperature_summary.windows[0].day_count == 2
        assert len(background_tasks.tasks) == 1
        refresh_mock.assert_awaited_once_with(
            db,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            triggered_by_lab_member_id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        )

    async def test_study_window_route_returns_latest_study_day(self) -> None:
        expected_response = LatestStudyDayResponse(
            latest_study_day=date(2026, 3, 11)
        )

        with patch(
            "app.routers.dashboard.read_latest_study_day",
            new=AsyncMock(return_value=expected_response),
        ) as study_window_mock:
            response = await get_dashboard_study_window_route(
                _lab_member=_lab_member(),
                db=object(),
            )

        assert response == expected_response
        study_window_mock.assert_awaited_once()

    async def test_study_window_route_propagates_null_latest_day(self) -> None:
        expected_response = LatestStudyDayResponse(latest_study_day=None)

        with patch(
            "app.routers.dashboard.read_latest_study_day",
            new=AsyncMock(return_value=expected_response),
        ):
            response = await get_dashboard_study_window_route(
                _lab_member=_lab_member(),
                db=object(),
            )

        assert response.latest_study_day is None


def _lab_member() -> object:
    from app.auth import LabMember

    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role="ra",
        lab_name="ww",
    )
