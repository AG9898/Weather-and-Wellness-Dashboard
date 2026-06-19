from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest import IsolatedAsyncioTestCase

from app.auth import LabMember
from app.schemas.chat import RAChatScope
from app.services.chat_tools import (
    MAX_CHAT_TOOL_SESSION_ROWS,
    get_participant_session_summaries,
)


def _lab_member(lab_name: str = "ww") -> LabMember:
    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role="ra",
        lab_name=lab_name,
    )


class _FakeResult:
    def __init__(self, *, rows: list[dict] | None = None) -> None:
        self._rows = rows or []

    def mappings(self) -> "_FakeResult":
        return self

    def all(self) -> list[dict]:
        return self._rows


class _FakeDb:
    def __init__(self, *results: _FakeResult) -> None:
        self._results = list(results)
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        if not self._results:
            raise AssertionError("unexpected query")
        return self._results.pop(0)


def _session_row(participant_number: int) -> dict:
    return {
        "participant_number": participant_number,
        "age_band": "18-24",
        "gender": "Prefer not to say",
        "origin": "Class",
        "commute_method": "Transit",
        "time_outside": "Sometimes (61 minutes - 90 minutes)",
        "daylight_exposure_minutes": 120,
        "session_status": "complete",
        "session_created_at": datetime(2026, 3, 4, 18, 0, tzinfo=timezone.utc),
        "session_completed_at": datetime(2026, 3, 4, 19, 0, tzinfo=timezone.utc),
        "date_local": date(2026, 3, 4),
        "uls8_score_0_100": Decimal("25.50"),
        "uls8_legacy_mean_1_4": None,
        "cesd10_total_score": 8,
        "cesd10_legacy_mean_1_4": None,
        "gad7_total_score": 7,
        "gad7_severity_band": "mild",
        "gad7_legacy_mean_1_4": None,
        "cogfunc8a_mean_score": Decimal("3.7500"),
        "cogfunc8a_legacy_mean_1_5": None,
        "digitspan_total_correct": 11,
        "digitspan_max_span": 7,
        "digitspan_data_source": "native",
    }


def _contains_key(value, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(_contains_key(item, key) for item in value.values())
    if isinstance(value, list):
        return any(_contains_key(item, key) for item in value)
    return False


class ChatParticipantSessionToolTests(IsolatedAsyncioTestCase):
    async def test_participant_session_tool_rejects_cross_lab_without_querying(self) -> None:
        db = _FakeDb()

        result = await get_participant_session_summaries(
            db,
            lab_member=_lab_member("other-lab"),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 31),
            ),
            participant_number=42,
        )

        assert result.status == "permission_denied"
        assert result.tool_name == "participant_session_summaries"
        assert db.statements == []

    async def test_participant_session_tool_bounds_rows_and_omits_raw_uuids(self) -> None:
        rows = [_session_row(1000 + index) for index in range(25)]
        db = _FakeDb(_FakeResult(rows=rows))

        result = await get_participant_session_summaries(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 31),
            ),
            limit=999,
        )

        payload = result.to_json()
        json.dumps(payload)

        assert result.status == "ready"
        assert payload["data"]["returned_sessions"] == MAX_CHAT_TOOL_SESSION_ROWS
        assert len(payload["data"]["sessions"]) == MAX_CHAT_TOOL_SESSION_ROWS
        assert payload["data"]["sessions"][0]["participant_number"] == 1000
        assert payload["data"]["sessions"][0]["survey_scores"]["gad7_total_score"] == 7
        assert payload["data"]["sessions"][0]["digit_span"]["max_span"] == 7
        assert not _contains_key(payload, "participant_uuid")
        assert not _contains_key(payload, "session_id")

    async def test_participant_number_lookup_filters_to_anonymous_session_summary(self) -> None:
        db = _FakeDb(_FakeResult(rows=[_session_row(42)]))

        result = await get_participant_session_summaries(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 31),
            ),
            participant_number=42,
        )

        payload = result.to_json()

        assert result.status == "ready"
        assert payload["data"]["participant_number"] == 42
        assert payload["data"]["sessions"] == [
            {
                "participant_number": 42,
                "date_local": "2026-03-04",
                "session": {
                    "status": "complete",
                    "created_at": "2026-03-04T18:00:00+00:00",
                    "completed_at": "2026-03-04T19:00:00+00:00",
                },
                "demographics": {
                    "age_band": "18-24",
                    "gender": "Prefer not to say",
                    "origin": "Class",
                    "commute_method": "Transit",
                    "time_outside": "Sometimes (61 minutes - 90 minutes)",
                    "daylight_exposure_minutes": 120,
                },
                "survey_scores": {
                    "uls8_score_0_100": 25.5,
                    "uls8_legacy_mean_1_4": None,
                    "cesd10_total_score": 8,
                    "cesd10_legacy_mean_1_4": None,
                    "gad7_total_score": 7,
                    "gad7_severity_band": "mild",
                    "gad7_legacy_mean_1_4": None,
                    "cogfunc8a_mean_score": 3.75,
                    "cogfunc8a_legacy_mean_1_5": None,
                },
                "digit_span": {
                    "total_correct": 11,
                    "max_span": 7,
                    "data_source": "native",
                },
            }
        ]

    async def test_participant_session_tool_rejects_invalid_participant_number(self) -> None:
        db = _FakeDb()

        result = await get_participant_session_summaries(
            db,
            lab_member=_lab_member(),
            chat_scope=RAChatScope(
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 31),
            ),
            participant_number=0,
        )

        assert result.status == "invalid_scope"
        assert "positive integer" in result.message
        assert db.statements == []
