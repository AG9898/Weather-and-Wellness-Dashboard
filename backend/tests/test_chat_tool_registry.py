from __future__ import annotations

import uuid
from datetime import date
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from app.auth import LabMember
from app.services.chat_tool_registry import (
    ChatTool,
    UnknownChatToolError,
    chat_tool_specs,
    dispatch_tool,
    get_chat_tool,
    list_chat_tools,
)
from app.services.chat_tools import ChatAggregateToolResult


def _lab_member(lab_name: str = "ww", role: str = "ra") -> LabMember:
    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role=role,
        lab_name=lab_name,
    )


class _NoQueryDb:
    """A DB stub that fails if any query is executed."""

    def __init__(self) -> None:
        self.statements: list = []

    async def execute(self, statement):  # pragma: no cover - should not run
        self.statements.append(statement)
        raise AssertionError("dispatch should not query the database here")


APPROVED_TOOL_NAMES = {
    "get_data_coverage",
    "dashboard_analytics_summary",
    "study_window_session_counts",
    "survey_score_summary",
    "weather_study_day_summary",
    "participant_session_summaries",
}


class RegistryShapeTests(IsolatedAsyncioTestCase):
    def test_registry_exposes_each_approved_tool_with_schema(self) -> None:
        tools = list_chat_tools()
        names = {tool.name for tool in tools}
        assert names == APPROVED_TOOL_NAMES
        for tool in tools:
            assert isinstance(tool, ChatTool)
            schema = tool.input_schema()
            assert schema["type"] == "object"
            # No lab identity field is ever exposed to the model.
            props = schema.get("properties", {})
            assert "lab_id" not in props
            assert "lab_name" not in props

    def test_tool_specs_are_openrouter_function_shaped(self) -> None:
        specs = chat_tool_specs()
        assert len(specs) == len(APPROVED_TOOL_NAMES)
        for spec in specs:
            assert spec["type"] == "function"
            fn = spec["function"]
            assert fn["name"] in APPROVED_TOOL_NAMES
            assert isinstance(fn["description"], str) and fn["description"]
            assert fn["parameters"]["type"] == "object"

    def test_get_chat_tool_rejects_unknown_name(self) -> None:
        with self.assertRaises(UnknownChatToolError):
            get_chat_tool("run_raw_sql")


class DispatchTests(IsolatedAsyncioTestCase):
    async def test_unknown_tool_rejected_without_db_access(self) -> None:
        db = _NoQueryDb()
        with self.assertRaises(UnknownChatToolError):
            await dispatch_tool(
                db,
                lab_member=_lab_member(),
                tool_name="export_everything",
                params={},
            )
        assert db.statements == []

    async def test_model_supplied_lab_scope_is_ignored(self) -> None:
        # The model tries to smuggle a lab identity in the params; extra fields
        # are forbidden, so validation fails closed rather than honoring it.
        db = _NoQueryDb()
        result = await dispatch_tool(
            db,
            lab_member=_lab_member(),
            tool_name="study_window_session_counts",
            params={"lab_name": "other-lab", "lab_id": "x"},
        )
        assert result.status == "invalid_scope"
        assert result.tool_name == "study_window_session_counts"
        assert db.statements == []

    async def test_dispatch_injects_authenticated_scope(self) -> None:
        captured: dict = {}

        async def _fake(db, *, lab_member, chat_scope):
            captured["lab_member"] = lab_member
            captured["chat_scope"] = chat_scope
            return ChatAggregateToolResult(
                tool_name="weather_study_day_summary",
                status="ready",
                message="ok",
                data={"lab_name": lab_member.lab_name},
            )

        member = _lab_member(lab_name="ww")
        with patch(
            "app.services.chat_tool_registry.get_weather_study_day_summary",
            new=AsyncMock(side_effect=_fake),
        ):
            result = await dispatch_tool(
                _NoQueryDb(),
                lab_member=member,
                tool_name="weather_study_day_summary",
                params={"date_from": "2026-03-01", "date_to": "2026-03-02"},
            )

        assert result.status == "ready"
        # The authenticated member object is what reaches the query layer.
        assert captured["lab_member"] is member
        # Scope carries only model-allowed fields; lab identity comes from member.
        assert captured["chat_scope"].date_from == date(2026, 3, 1)
        assert captured["chat_scope"].date_to == date(2026, 3, 2)

    async def test_permission_denied_status_preserved(self) -> None:
        # An unsupported non-admin lab returns permission_denied from the tool
        # layer; the registry must pass it through unchanged.
        db = _NoQueryDb()
        result = await dispatch_tool(
            db,
            lab_member=_lab_member(lab_name="other-lab"),
            tool_name="survey_score_summary",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
        )
        assert result.status == "permission_denied"
        # Scope rejection happens before any query.
        assert db.statements == []

    async def test_invalid_params_return_invalid_scope(self) -> None:
        db = _NoQueryDb()
        result = await dispatch_tool(
            db,
            lab_member=_lab_member(),
            tool_name="study_window_session_counts",
            params={"date_from": "2026-03-31", "date_to": "2026-03-01"},
        )
        assert result.status == "invalid_scope"
        assert db.statements == []

    async def test_participant_summaries_forwards_extra_params(self) -> None:
        captured: dict = {}

        async def _fake(db, *, lab_member, chat_scope, participant_number, limit):
            captured["participant_number"] = participant_number
            captured["limit"] = limit
            return ChatAggregateToolResult(
                tool_name="participant_session_summaries",
                status="ready",
                message="ok",
                data={},
            )

        with patch(
            "app.services.chat_tool_registry.get_participant_session_summaries",
            new=AsyncMock(side_effect=_fake),
        ):
            result = await dispatch_tool(
                _NoQueryDb(),
                lab_member=_lab_member(),
                tool_name="participant_session_summaries",
                params={"participant_number": 7, "limit": 5},
            )

        assert result.status == "ready"
        assert captured["participant_number"] == 7
        assert captured["limit"] == 5
