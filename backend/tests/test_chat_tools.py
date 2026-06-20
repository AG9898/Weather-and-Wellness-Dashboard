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
    get_data_coverage,
    get_weather_study_day_summary,
    run_scoped_aggregate_tools,
)
from app.services.chat_tool_registry import dispatch_tool, get_chat_tool


def _lab_member(lab_name: str = "ww", role: str = "ra") -> LabMember:
    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role=role,
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

    def scalar_one(self):
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
        assert len(results) == 5
        assert db.statements == []

    async def test_admin_bypasses_lab_allowlist_for_whole_db_access(self) -> None:
        db = _FakeDb(
            _FakeResult(rows=[{"study_day_count": 1}]),
            _FakeResult(
                rows=[
                    {
                        "weather_day_count": 1,
                        "mean_temperature_c": Decimal("6.0"),
                        "min_temperature_c": Decimal("6.0"),
                        "max_temperature_c": Decimal("6.0"),
                        "mean_precip_today_mm": Decimal("0.0"),
                        "total_precip_today_mm": Decimal("0.0"),
                        "mean_sunshine_duration_hours": Decimal("2.0"),
                    }
                ]
            ),
        )

        result = await get_weather_study_day_summary(
            db,
            lab_member=_lab_member(lab_name="other-lab", role="admin"),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 1),
            ),
        )

        assert result.status == "ready"
        assert result.data["admin_all_labs"] is True
        assert db.statements != []

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


class DataCoverageToolTests(IsolatedAsyncioTestCase):
    async def test_coverage_reports_real_range_for_populated_scope(self) -> None:
        db = _FakeDb(
            _FakeResult(scalar=12),
            _FakeResult(
                rows=[
                    {
                        "linked_session_count": 34,
                        "participants_with_sessions": 10,
                        "earliest_data_date": date(2026, 1, 5),
                        "latest_data_date": date(2026, 4, 18),
                    }
                ]
            ),
        )

        result = await get_data_coverage(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(),
        )

        payload = result.to_json()
        assert result.status == "ready"
        assert result.tool_name == "get_data_coverage"
        assert payload["data"]["participant_count"] == 12
        assert payload["data"]["linked_session_count"] == 34
        assert payload["data"]["earliest_data_date"] == "2026-01-05"
        assert payload["data"]["latest_data_date"] == "2026-04-18"
        # Bounded summary only: no participant rows leaked.
        assert "sessions" not in payload["data"]
        json.dumps(payload)

    async def test_coverage_reports_insufficient_data_for_empty_scope(self) -> None:
        db = _FakeDb(
            _FakeResult(scalar=0),
            _FakeResult(
                rows=[
                    {
                        "linked_session_count": 0,
                        "participants_with_sessions": 0,
                        "earliest_data_date": None,
                        "latest_data_date": None,
                    }
                ]
            ),
        )

        result = await get_data_coverage(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(),
        )

        assert result.status == "insufficient_data"
        assert result.data["participant_count"] == 0
        assert result.data["earliest_data_date"] is None

    async def test_coverage_rejects_unsupported_lab_without_querying(self) -> None:
        db = _FakeDb()

        result = await get_data_coverage(
            db,
            lab_member=_lab_member("other-lab"),
            chat_scope=RAChatScope(),
        )

        assert result.status == "permission_denied"
        assert db.statements == []

    async def test_coverage_handles_participants_without_linked_sessions(self) -> None:
        db = _FakeDb(
            _FakeResult(scalar=5),
            _FakeResult(
                rows=[
                    {
                        "linked_session_count": 0,
                        "participants_with_sessions": 0,
                        "earliest_data_date": None,
                        "latest_data_date": None,
                    }
                ]
            ),
        )

        result = await get_data_coverage(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(),
        )

        assert result.status == "ready"
        assert "no dated data window" in result.message

    async def test_coverage_is_registered_and_invocable_via_dispatch(self) -> None:
        assert get_chat_tool("get_data_coverage").name == "get_data_coverage"

        db = _FakeDb(
            _FakeResult(scalar=3),
            _FakeResult(
                rows=[
                    {
                        "linked_session_count": 7,
                        "participants_with_sessions": 3,
                        "earliest_data_date": date(2026, 2, 1),
                        "latest_data_date": date(2026, 2, 20),
                    }
                ]
            ),
        )

        result = await dispatch_tool(
            db,
            lab_member=_lab_member(),
            tool_name="get_data_coverage",
            params={},
        )

        assert result.status == "ready"
        assert result.data["participant_count"] == 3

    async def test_coverage_rejects_lab_identity_params_via_dispatch(self) -> None:
        db = _FakeDb()

        result = await dispatch_tool(
            db,
            lab_member=_lab_member(),
            tool_name="get_data_coverage",
            params={"lab_name": "other-lab"},
        )

        assert result.status == "invalid_scope"
        assert db.statements == []
