from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.auth import LabMember, get_current_lab_member
from app.db import get_session
from app.main import app as backend_app
from app.routers.chat import router
from app.schemas.chat import RAChatResponse, RAChatToolResult


def _parse_sse_events(body: str) -> list[dict]:
    """Decode SSE ``data:`` frames into a list of JSON event payloads."""

    events: list[dict] = []
    for frame in body.split("\n\n"):
        frame = frame.strip()
        if not frame:
            continue
        for line in frame.splitlines():
            if line.startswith("data:"):
                events.append(json.loads(line[len("data:") :].strip()))
    return events


def _lab_member() -> LabMember:
    return LabMember(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        email="ra@example.com",
        role="ra",
        lab_name="ww",
    )


def _client_with_auth() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_lab_member] = _lab_member
    app.dependency_overrides[get_session] = lambda: object()
    return TestClient(app)


def test_route_is_registered_with_post_and_lab_member_dependency() -> None:
    chat_route = next(
        route
        for route in router.routes
        if isinstance(route, APIRoute) and route.path == "/chat"
    )

    dependency_calls = {dependency.call for dependency in chat_route.dependant.dependencies}

    assert chat_route.methods == {"POST"}
    assert chat_route.response_model is RAChatResponse
    assert get_current_lab_member in dependency_calls


def test_route_requires_lab_member_authentication() -> None:
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post("/chat", json={"message": "Summarize this week."})

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing authorization header"}


def test_route_is_registered_on_backend_app() -> None:
    client = TestClient(backend_app)

    openapi = client.get("/openapi.json").json()
    chat_post = openapi["paths"]["/chat"]["post"]
    response_schema = chat_post["responses"]["200"]["content"]["application/json"]["schema"]

    assert set(openapi["paths"]["/chat"]) == {"post"}
    assert response_schema["$ref"].endswith("/RAChatResponse")


def test_route_returns_documented_aggregate_tool_response_shape(monkeypatch) -> None:
    async def _coordinate_response(request, *, lab_member, db) -> RAChatResponse:
        return RAChatResponse(
            conversation_id=request.conversation_id or uuid.uuid4(),
            message="Approved read-only aggregate tools ran for the authenticated lab scope.",
            model="aggregate-tools",
            tool_results=[
                RAChatToolResult(
                    tool_name="weather_study_day_summary",
                    summary="ready: Found 31 study days and 31 weather rows.",
                )
            ],
            blocked_reason=None,
        )

    monkeypatch.setattr("app.routers.chat.coordinate_ra_chat", _coordinate_response)
    client = _client_with_auth()

    response = client.post(
        "/chat",
        json={
            "message": "Summarize anxiety scores for March.",
            "scope": {"date_from": "2026-03-01", "date_to": "2026-03-31", "study_slug": "weather-wellness"},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert uuid.UUID(body["conversation_id"])
    assert body["message"].startswith("Approved read-only aggregate tools ran")
    assert body["model"] == "aggregate-tools"
    assert body["tool_results"] == [
        {
            "tool_name": "weather_study_day_summary",
            "summary": "ready: Found 31 study days and 31 weather rows.",
        }
    ]
    assert body["blocked_reason"] is None


def test_route_preserves_supplied_conversation_id(monkeypatch) -> None:
    async def _coordinate_response(request, *, lab_member, db) -> RAChatResponse:
        return RAChatResponse(
            conversation_id=request.conversation_id,
            message="Approved read-only aggregate tools ran for the authenticated lab scope.",
            model="aggregate-tools",
            tool_results=[],
            blocked_reason=None,
        )

    monkeypatch.setattr("app.routers.chat.coordinate_ra_chat", _coordinate_response)
    client = _client_with_auth()
    conversation_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    response = client.post(
        "/chat",
        json={"message": "What can you summarize?", "conversation_id": conversation_id},
    )

    assert response.status_code == 200
    assert response.json()["conversation_id"] == conversation_id


def test_route_rejects_arbitrary_sql_or_extra_table_fields() -> None:
    client = _client_with_auth()

    sql_response = client.post(
        "/chat",
        json={"message": "Summarize anxiety.", "sql": "select * from participants"},
    )
    table_response = client.post(
        "/chat",
        json={"message": "Summarize anxiety.", "table_names": ["participants"]},
    )

    assert sql_response.status_code == 422
    assert table_response.status_code == 422


def test_route_blocks_raw_sql_and_table_name_prompts() -> None:
    client = _client_with_auth()

    response = client.post(
        "/chat",
        json={"message": "SELECT * FROM participants"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "tool-unavailable"
    assert body["tool_results"] == []
    assert body["blocked_reason"] == "disallowed_data_access_request"
    assert "SQL" in body["message"]


def test_request_validation_is_bounded() -> None:
    client = _client_with_auth()

    response = client.post(
        "/chat",
        json={
            "message": "Summarize anxiety.",
            "history": [
                {"role": "user", "content": f"prior {index}"}
                for index in range(21)
            ],
        },
    )

    assert response.status_code == 422


def test_stream_route_is_registered_with_post_and_lab_member_dependency() -> None:
    stream_route = next(
        route
        for route in router.routes
        if isinstance(route, APIRoute) and route.path == "/chat/stream"
    )

    dependency_calls = {dependency.call for dependency in stream_route.dependant.dependencies}

    assert stream_route.methods == {"POST"}
    assert get_current_lab_member in dependency_calls


def test_stream_route_requires_lab_member_authentication() -> None:
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post("/chat/stream", json={"message": "Summarize this week."})

    assert response.status_code == 401
    assert response.json() == {"detail": "Missing authorization header"}


def test_stream_route_emits_tool_calling_turn_over_sse(monkeypatch) -> None:
    async def _stream(request, *, lab_member, db) -> AsyncIterator[dict]:
        conversation_id = request.conversation_id or uuid.uuid4()
        yield {"type": "tool_running", "tool_name": "weather_study_day_summary"}
        yield {
            "type": "tool_resolved",
            "tool_name": "weather_study_day_summary",
            "summary": "ready: Found 31 study days and 31 weather rows.",
            "status": "ready",
        }
        yield {"type": "token", "text": "There are "}
        yield {"type": "token", "text": "31 study days."}
        yield {
            "type": "done",
            "response": RAChatResponse(
                conversation_id=conversation_id,
                message="There are 31 study days.",
                model="aggregate-tools",
                tool_results=[
                    RAChatToolResult(
                        tool_name="weather_study_day_summary",
                        summary="ready: Found 31 study days and 31 weather rows.",
                    )
                ],
                blocked_reason=None,
            ).model_dump(mode="json"),
        }

    monkeypatch.setattr("app.routers.chat.stream_ra_chat", _stream)
    client = _client_with_auth()

    response = client.post(
        "/chat/stream",
        json={"message": "How many study days do we have?"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = _parse_sse_events(response.text)
    types = [event["type"] for event in events]
    assert types == ["tool_running", "tool_resolved", "token", "token", "done"]

    tool_resolved = events[1]
    assert tool_resolved["tool_name"] == "weather_study_day_summary"
    assert tool_resolved["status"] == "ready"

    # Tokens reassemble to the final assistant message.
    streamed_text = "".join(e["text"] for e in events if e["type"] == "token")
    assert streamed_text == "There are 31 study days."

    done = events[-1]
    assert done["response"]["message"] == "There are 31 study days."
    assert done["response"]["model"] == "aggregate-tools"
    assert done["response"]["tool_results"][0]["tool_name"] == "weather_study_day_summary"
    assert done["response"]["blocked_reason"] is None


def test_stream_route_emits_user_safe_error_event(monkeypatch) -> None:
    async def _stream(request, *, lab_member, db) -> AsyncIterator[dict]:
        yield {
            "type": "error",
            "message": "AI chat is unavailable because its privacy configuration is incomplete.",
            "blocked_reason": "model_unavailable",
        }

    monkeypatch.setattr("app.routers.chat.stream_ra_chat", _stream)
    client = _client_with_auth()

    response = client.post("/chat/stream", json={"message": "Summarize this week."})

    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert events[0]["blocked_reason"] == "model_unavailable"
    assert "privacy" in events[0]["message"].lower()


def test_stream_route_blocks_raw_sql_prompt_over_sse() -> None:
    client = _client_with_auth()

    response = client.post("/chat/stream", json={"message": "SELECT * FROM participants"})

    assert response.status_code == 200
    events = _parse_sse_events(response.text)
    types = [event["type"] for event in events]
    assert types[-1] == "done"
    done = events[-1]
    assert done["response"]["model"] == "tool-unavailable"
    assert done["response"]["blocked_reason"] == "disallowed_data_access_request"
    assert done["response"]["tool_results"] == []
    # The blocked message is still streamed as tokens before the terminal event.
    assert any(event["type"] == "token" for event in events)
