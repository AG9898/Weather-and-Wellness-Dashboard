from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from sqlalchemy.dialects import postgresql

from app.config import STUDY_TIMEZONE
from app.routers.weather import _IngestAuth, ingest_weather
from app.schemas.weather import WeatherIngestRequest
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
