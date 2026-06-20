"""Tests for the agentic coordinator loop in app/services/chat_service.py."""
from __future__ import annotations

import json
import uuid
from typing import Any
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from app.auth import LabMember
from app.schemas.chat import RAChatRequest
from app.services.chat_service import (
    MAX_TOOL_CALL_ROUNDS,
    coordinate_ra_chat,
)
from app.services.chat_tool_registry import UnknownChatToolError
from app.services.chat_tools import ChatAggregateToolResult
from app.services.openrouter_client import (
    ROUTE_PRIMARY,
    OpenRouterChatResult,
    OpenRouterUnavailableError,
)


def _lab_member() -> LabMember:
    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role="ra",
        lab_name="ww",
    )


def _completion(
    content: str = "",
    tool_calls: list[dict[str, Any]] | None = None,
    *,
    served_model: str = "openrouter/test-model",
) -> OpenRouterChatResult:
    return OpenRouterChatResult(
        content=content,
        model=served_model,
        served_route=ROUTE_PRIMARY,
        served_model=served_model,
        raw_response={},
        tool_calls=tool_calls or [],
    )


def _tool_call(
    tool_name: str, arguments: dict[str, Any], call_id: str = "call_1"
) -> dict[str, Any]:
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": tool_name, "arguments": json.dumps(arguments)},
    }


class _FakeClient:
    """Records the messages it is sent and replays scripted completions."""

    def __init__(self, completions: list[OpenRouterChatResult]) -> None:
        self._completions = list(completions)
        self.calls: list[dict[str, Any]] = []

    def create_chat_completion(self, messages, *, tools=None, tool_choice=None, **_):
        self.calls.append({"messages": list(messages), "tool_choice": tool_choice})
        return self._completions.pop(0)


def _factory(client: _FakeClient):
    return lambda: client


class CoordinatorLoopTests(IsolatedAsyncioTestCase):
    async def test_no_tool_turn_answers_conversationally(self) -> None:
        client = _FakeClient(
            [_completion("A high GAD-7 generally indicates more anxiety.")]
        )
        request = RAChatRequest(message="What does a high GAD-7 mean in general?")

        response = await coordinate_ra_chat(
            request,
            lab_member=_lab_member(),
            db=object(),
            client_factory=_factory(client),
        )

        self.assertEqual(
            response.message, "A high GAD-7 generally indicates more anxiety."
        )
        self.assertEqual(response.tool_results, [])
        self.assertIsNone(response.blocked_reason)
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0]["messages"][0]["role"], "system")

    async def test_tool_calling_turn_dispatches_and_narrates(self) -> None:
        dispatched: list[dict[str, Any]] = []

        async def _fake_dispatch(db, *, lab_member, tool_name, params):
            dispatched.append({"tool_name": tool_name, "params": params})
            return ChatAggregateToolResult(
                tool_name=tool_name,
                status="ready",
                message="Found 31 study days.",
                data={"study_days": 31},
            )

        client = _FakeClient(
            [
                _completion(
                    tool_calls=[
                        _tool_call("weather_study_day_summary", {"study_slug": "ww"})
                    ]
                ),
                _completion("There are 31 study days in range."),
            ]
        )
        request = RAChatRequest(message="How many study days do we have?")

        with patch(
            "app.services.chat_service.dispatch_tool", _fake_dispatch
        ):
            response = await coordinate_ra_chat(
                request,
                lab_member=_lab_member(),
                db=object(),
                client_factory=_factory(client),
            )

        self.assertEqual(response.message, "There are 31 study days in range.")
        self.assertIsNone(response.blocked_reason)
        self.assertEqual(len(response.tool_results), 1)
        self.assertEqual(
            response.tool_results[0].tool_name, "weather_study_day_summary"
        )
        self.assertTrue(response.tool_results[0].summary.startswith("ready:"))
        self.assertEqual(
            dispatched,
            [{"tool_name": "weather_study_day_summary", "params": {"study_slug": "ww"}}],
        )
        second_call_roles = [m["role"] for m in client.calls[1]["messages"]]
        self.assertIn("tool", second_call_roles)

    async def test_round_cap_stops_the_loop(self) -> None:
        async def _fake_dispatch(db, *, lab_member, tool_name, params):
            return ChatAggregateToolResult(
                tool_name=tool_name,
                status="ready",
                message="ok",
                data={},
            )

        completions = [
            _completion(tool_calls=[_tool_call("get_data_coverage", {}, call_id=f"c{i}")])
            for i in range(MAX_TOOL_CALL_ROUNDS)
        ]
        completions.append(
            _completion("I hit the tool-call limit; here is what I found.")
        )
        client = _FakeClient(completions)
        request = RAChatRequest(message="Keep digging.")

        with patch("app.services.chat_service.dispatch_tool", _fake_dispatch):
            response = await coordinate_ra_chat(
                request,
                lab_member=_lab_member(),
                db=object(),
                client_factory=_factory(client),
            )

        self.assertEqual(response.blocked_reason, "tool_round_cap_reached")
        self.assertEqual(
            response.message, "I hit the tool-call limit; here is what I found."
        )
        self.assertEqual(len(client.calls), MAX_TOOL_CALL_ROUNDS + 1)
        self.assertEqual(client.calls[-1]["tool_choice"], "none")
        self.assertEqual(len(response.tool_results), MAX_TOOL_CALL_ROUNDS)

    async def test_privacy_unavailable_config_returns_user_safe_response(self) -> None:
        def _failing_factory():
            raise OpenRouterUnavailableError("missing provider allowlist for ZDR")

        request = RAChatRequest(message="Summarize this week.")

        response = await coordinate_ra_chat(
            request,
            lab_member=_lab_member(),
            db=object(),
            client_factory=_failing_factory,
        )

        self.assertEqual(response.blocked_reason, "model_unavailable")
        self.assertEqual(response.model, "tool-unavailable")
        self.assertIn("privacy", response.message.lower())
        self.assertNotIn("allowlist", response.message.lower())

    async def test_raw_sql_request_remains_blocked(self) -> None:
        request = RAChatRequest(message="SELECT * FROM participants")

        def _unreachable_factory():
            raise AssertionError(
                "client should not be constructed for blocked requests"
            )

        response = await coordinate_ra_chat(
            request,
            lab_member=_lab_member(),
            db=object(),
            client_factory=_unreachable_factory,
        )

        self.assertEqual(response.blocked_reason, "disallowed_data_access_request")
        self.assertEqual(response.model, "tool-unavailable")
        self.assertEqual(response.tool_results, [])
        self.assertIn("SQL", response.message)

    async def test_unknown_tool_is_narrated_not_crashed(self) -> None:
        async def _raising_dispatch(db, *, lab_member, tool_name, params):
            raise UnknownChatToolError(tool_name)

        client = _FakeClient(
            [
                _completion(tool_calls=[_tool_call("definitely_not_a_tool", {})]),
                _completion(
                    "That tool isn't available, but I can summarize differently."
                ),
            ]
        )
        request = RAChatRequest(message="Use a secret tool.")

        with patch("app.services.chat_service.dispatch_tool", _raising_dispatch):
            response = await coordinate_ra_chat(
                request,
                lab_member=_lab_member(),
                db=object(),
                client_factory=_factory(client),
            )

        self.assertTrue(response.message.startswith("That tool isn't available"))
        self.assertEqual(len(response.tool_results), 1)
        self.assertEqual(
            response.tool_results[0].tool_name, "definitely_not_a_tool"
        )
        self.assertIn("invalid_scope", response.tool_results[0].summary)
