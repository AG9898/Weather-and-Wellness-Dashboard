from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from app.schemas.weather import WeatherDailyResponse
from app.services.weather_read_service import read_weather_daily


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self._value = value

    def scalar_one_or_none(self) -> object:
        return self._value


class _ScalarListResult:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def scalars(self) -> "_ScalarListResult":
        return self

    def all(self) -> list[object]:
        return self._rows


class _MappingListResult:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def mappings(self) -> "_MappingListResult":
        return self

    def all(self) -> list[dict[str, object]]:
        return self._rows


class _FakeReadSession:
    def __init__(
        self,
        *,
        weather_rows: object,
        latest_run: object | None,
    ) -> None:
        self.weather_rows = weather_rows
        self.latest_run = latest_run
        self.statements: list[object] = []

    async def execute(self, statement: object, params: object | None = None) -> object:
        del params
        self.statements.append(statement)
        if len(self.statements) == 1:
            return self.weather_rows
        if len(self.statements) == 2:
            return _ScalarResult(self.latest_run)
        raise AssertionError("Unexpected extra execute() call")


class WeatherReadServiceTests(IsolatedAsyncioTestCase):
    async def test_read_weather_daily_returns_full_items_with_forecast_periods(self) -> None:
        source_run_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        study_day_id = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
        latest_run_id = uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
        now = datetime(2026, 3, 11, 18, 0, tzinfo=timezone.utc)

        db = _FakeReadSession(
            weather_rows=_ScalarListResult(
                [
                    SimpleNamespace(
                        station_id=3510,
                        study_day_id=study_day_id,
                        date_local=date(2026, 3, 11),
                        source_run_id=source_run_id,
                        updated_at=now,
                        current_temp_c=7.2,
                        current_precip_today_mm=1.2,
                        forecast_high_c=9.0,
                        forecast_low_c=4.0,
                        forecast_condition_text="Cloudy",
                        forecast_periods=[{"label": "Morning"}],
                        sunshine_duration_hours=6.5,
                    )
                ]
            ),
            latest_run=SimpleNamespace(
                run_id=latest_run_id,
                ingested_at=now,
                parse_status="success",
            ),
        )

        response = await read_weather_daily(
            db,
            start=date(2026, 3, 11),
            end=date(2026, 3, 11),
            station_id=3510,
            include_forecast_periods=True,
            include_latest_run=True,
        )

        assert isinstance(response, WeatherDailyResponse)
        assert len(response.items) == 1
        assert response.items[0].forecast_periods == [{"label": "Morning"}]
        assert response.items[0].sunshine_duration_hours == 6.5
        assert response.latest_run is not None
        assert response.latest_run.run_id == latest_run_id

    async def test_read_weather_daily_returns_lean_items_without_forecast_periods(self) -> None:
        source_run_id = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        study_day_id = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
        now = datetime(2026, 3, 11, 18, 0, tzinfo=timezone.utc)

        db = _FakeReadSession(
            weather_rows=_MappingListResult(
                [
                    {
                        "station_id": 3510,
                        "study_day_id": study_day_id,
                        "date_local": date(2026, 3, 11),
                        "source_run_id": source_run_id,
                        "updated_at": now,
                        "current_temp_c": 7.2,
                        "current_precip_today_mm": 1.2,
                        "forecast_high_c": 9.0,
                        "forecast_low_c": 4.0,
                        "forecast_condition_text": "Cloudy",
                        "sunshine_duration_hours": 6.5,
                    }
                ]
            ),
            latest_run=None,
        )

        response = await read_weather_daily(
            db,
            start=date(2026, 3, 11),
            end=date(2026, 3, 11),
            station_id=3510,
            include_forecast_periods=False,
            include_latest_run=False,
        )

        assert response.items[0].forecast_periods == []
        assert response.items[0].forecast_condition_text == "Cloudy"
        assert response.latest_run is None
        assert len(db.statements) == 1
