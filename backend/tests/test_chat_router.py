from __future__ import annotations

import uuid

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.auth import LabMember, get_current_lab_member
from app.db import get_session
from app.main import app as backend_app
from app.routers.chat import router
from app.schemas.chat import RAChatResponse, RAChatToolResult


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
    app_route = next(
        route
        for route in backend_app.routes
        if isinstance(route, APIRoute) and route.path == "/chat"
    )

    assert app_route.methods == {"POST"}
    assert app_route.response_model is RAChatResponse


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
