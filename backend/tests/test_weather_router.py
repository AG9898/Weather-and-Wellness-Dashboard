from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.routing import APIRoute
from sqlalchemy.dialects import postgresql

from app.auth import get_current_lab_member
from app.config import STUDY_TIMEZONE
from app.routers.weather import _IngestAuth, get_weather_daily, ingest_weather, router
from app.schemas.weather import WeatherDailyResponse, LatestRunInfo, WeatherDailyItem, WeatherIngestRequest
from app.services.weather_parser import PARSER_VERSION, ParseResult


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object:
        return self._value

    def scalar_one(self) -> object:
        return self._value


class _FakeAsyncSession:
    def __init__(self, study_day_id: uuid.UUID) -> None:
        self.study_day_id = study_day_id
        self.commit_count = 0
        self.statements: list[object] = []

    async def execute(self, statement: object, params: object | None = None) -> _ScalarResult:
        self.statements.append(statement)
        call_number = len(self.statements)

        if call_number == 1:
            return _ScalarResult(None)
        if call_number == 2:
            return _ScalarResult(True)
        if call_number == 4:
            return _ScalarResult(self.study_day_id)
        return _ScalarResult(None)

    async def commit(self) -> None:
        self.commit_count += 1


def _build_parse_result() -> ParseResult:
    return ParseResult(
        source_primary_url="https://example.com/primary",
        source_secondary_url="https://example.com/secondary",
        http_primary_status=200,
        http_secondary_status=200,
        raw_html_primary="<html></html>",
        raw_html_secondary="<html></html>",
        raw_html_primary_sha256="a" * 64,
        raw_html_secondary_sha256="b" * 64,
        parsed_json={"current": {}, "forecast_summary": {}, "forecast_periods": []},
        parse_status="partial",
        parse_errors=[],
        parser_version=PARSER_VERSION,
        date_local=date(2026, 3, 11),
        current_observed_at=datetime(2026, 3, 11, 14, 0, tzinfo=timezone.utc),
        current_temp_c=7.2,
        current_relative_humidity_pct=80,
        current_wind_speed_kmh=5.0,
        current_wind_gust_kmh=None,
        current_wind_dir_deg=180,
        current_pressure_kpa=101.3,
        current_precip_today_mm=1.2,
        forecast_high_c=9.0,
        forecast_low_c=4.0,
        forecast_precip_prob_pct=None,
        forecast_precip_mm=2.5,
        forecast_condition_text="Cloudy",
        forecast_periods=[{"start": "2026-03-11T09:00", "temp_c": 7.2}],
    )


class WeatherIngestRouterTests(IsolatedAsyncioTestCase):
    async def test_study_day_upsert_keeps_vancouver_timezone_on_conflict(self) -> None:
        study_day_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        db = _FakeAsyncSession(study_day_id=study_day_id)

        with patch(
            "app.routers.weather.fetch_and_parse",
            new=AsyncMock(return_value=_build_parse_result()),
        ):
            response = await ingest_weather(
                payload=WeatherIngestRequest(station_id=3510),
                auth=_IngestAuth(
                    requested_via="github_actions",
                    lab_member_id=None,
                ),
                db=db,
            )

        study_day_stmt = db.statements[3]
        compiled = study_day_stmt.compile(dialect=postgresql.dialect())

        assert compiled.params["tz_name"] == STUDY_TIMEZONE
        assert compiled.params["param_1"] == STUDY_TIMEZONE
        assert "America/Edmonton" not in compiled.params.values()
        assert response.parse_status == "partial"
        assert response.upserted_days == 1
        assert db.commit_count == 1


class WeatherDailyRouterTests(IsolatedAsyncioTestCase):
    def test_daily_route_is_registered_with_get_and_lab_member_dependency(self) -> None:
        daily_route = next(
            route
            for route in router.routes
            if isinstance(route, APIRoute) and route.path == "/weather/daily"
        )

        dependency_calls = {dependency.call for dependency in daily_route.dependant.dependencies}

        assert daily_route.methods == {"GET"}
        assert daily_route.response_model is WeatherDailyResponse
        assert get_current_lab_member in dependency_calls

    async def test_daily_route_rejects_inverted_date_range(self) -> None:
        with patch(
            "app.routers.weather.read_weather_daily",
            new=AsyncMock(),
        ) as read_mock:
            with self.assertRaises(HTTPException) as exc_info:
                await get_weather_daily(
                    start=date(2026, 3, 12),
                    end=date(2026, 3, 11),
                    station_id=3510,
                    include_forecast_periods=False,
                    include_latest_run=True,
                    _=object(),
                    db=object(),
                )

        assert exc_info.exception.status_code == 422
        assert exc_info.exception.detail == "start must not be after end"
        read_mock.assert_not_awaited()

    async def test_daily_route_delegates_to_weather_read_service(self) -> None:
        expected_response = WeatherDailyResponse(
            items=[
                WeatherDailyItem(
                    station_id=3510,
                    study_day_id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                    date_local=date(2026, 3, 11),
                    source_run_id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                    updated_at=datetime(2026, 3, 11, 18, 0, tzinfo=timezone.utc),
                    current_temp_c=7.2,
                    current_precip_today_mm=1.2,
                    forecast_high_c=9.0,
                    forecast_low_c=4.0,
                    forecast_condition_text="Cloudy",
                    forecast_periods=[],
                    sunshine_duration_hours=6.5,
                )
            ],
            latest_run=LatestRunInfo(
                run_id=uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
                ingested_at=datetime(2026, 3, 11, 18, 5, tzinfo=timezone.utc),
                parse_status="success",
            ),
        )
        db = object()

        with patch(
            "app.routers.weather.read_weather_daily",
            new=AsyncMock(return_value=expected_response),
        ) as read_mock:
            response = await get_weather_daily(
                start=date(2026, 3, 10),
                end=date(2026, 3, 11),
                station_id=3510,
                include_forecast_periods=False,
                include_latest_run=False,
                _=object(),
                db=db,
            )

        assert response == expected_response
        read_mock.assert_awaited_once_with(
            db,
            start=date(2026, 3, 10),
            end=date(2026, 3, 11),
            station_id=3510,
            include_forecast_periods=False,
            include_latest_run=False,
        )
