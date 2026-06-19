from __future__ import annotations

import json
import uuid
from datetime import date, timedelta
from decimal import Decimal
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from app.auth import LabMember
from app.schemas.chat import RAChatScope
from app.services.chat_tools import (
    MAX_CHAT_TOOL_WINDOW_DAYS,
    get_dashboard_analytics_summary,
    get_weather_study_day_summary,
    run_scoped_aggregate_tools,
)


def _lab_member(lab_name: str = "ww") -> LabMember:
    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role="ra",
        lab_name=lab_name,
    )


class _FakeResult:
    def __init__(self, *, rows: list[dict] | None = None, scalar=None) -> None:
        self._rows = rows or []
        self._scalar = scalar

    def mappings(self) -> "_FakeResult":
        return self

    def one(self) -> dict:
        return self._rows[0]

    def all(self) -> list[dict]:
        return self._rows

    def scalar_one_or_none(self):
        return self._scalar


class _FakeDb:
    def __init__(self, *results: _FakeResult) -> None:
        self._results = list(results)
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        if not self._results:
            raise AssertionError("unexpected query")
        return self._results.pop(0)


class ChatAggregateToolsTests(IsolatedAsyncioTestCase):
    async def test_aggregate_tools_reject_unsupported_lab_without_querying(self) -> None:
        db = _FakeDb()

        results = await run_scoped_aggregate_tools(
            db,
            lab_member=_lab_member("other-lab"),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 31),
            ),
        )

        assert {result.status for result in results} == {"permission_denied"}
        assert len(results) == 4
        assert db.statements == []

    async def test_aggregate_tools_reject_unbounded_date_ranges(self) -> None:
        db = _FakeDb()

        results = await run_scoped_aggregate_tools(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(
                date_from=date(2025, 1, 1),
                date_to=date(2025, 1, 1) + timedelta(days=MAX_CHAT_TOOL_WINDOW_DAYS),
            ),
        )

        assert {result.status for result in results} == {"invalid_scope"}
        assert "capped" in results[0].message
        assert db.statements == []

    async def test_default_scope_returns_insufficient_data_when_no_study_days(self) -> None:
        db = _FakeDb(_FakeResult(scalar=None))

        results = await run_scoped_aggregate_tools(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(),
        )

        assert {result.status for result in results} == {"insufficient_data"}
        assert "No study days" in results[0].message
        assert len(db.statements) == 1

    async def test_weather_summary_returns_bounded_json_serializable_data(self) -> None:
        db = _FakeDb(
            _FakeResult(rows=[{"study_day_count": 2}]),
            _FakeResult(
                rows=[
                    {
                        "weather_day_count": 2,
                        "mean_temperature_c": Decimal("7.25"),
                        "min_temperature_c": Decimal("4.5"),
                        "max_temperature_c": Decimal("10.0"),
                        "mean_precip_today_mm": Decimal("1.25"),
                        "total_precip_today_mm": Decimal("2.5"),
                        "mean_sunshine_duration_hours": Decimal("3.75"),
                    }
                ]
            ),
        )

        result = await get_weather_study_day_summary(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 2),
            ),
        )

        payload = result.to_json()
        assert result.status == "ready"
        assert payload["data"]["date_from"] == "2026-03-01"
        assert payload["data"]["mean_temperature_c"] == 7.25
        json.dumps(payload)

    async def test_dashboard_summary_returns_typed_insufficient_data_message(self) -> None:
        db = _FakeDb()

        with patch(
            "app.services.chat_tools.read_dashboard_analytics_snapshot",
            new=AsyncMock(return_value=None),
        ):
            result = await get_dashboard_analytics_summary(
                db,
                lab_member=_lab_member(),
                chat_scope=RAChatScope(
                    date_from=date(2026, 3, 1),
                    date_to=date(2026, 3, 31),
                ),
            )

        assert result.status == "insufficient_data"
        assert result.tool_name == "dashboard_analytics_summary"
        assert "No dashboard analytics snapshot" in result.message
