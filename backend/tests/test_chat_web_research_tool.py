from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services.chat_tool_registry import chat_tool_specs, dispatch_tool, get_chat_tool
from app.services.chat_web_research_tool import (
    WebResearchConfig,
    WebResearchQueryRejected,
    run_web_research,
    sanitize_web_research_query,
)


def _mock_response(json_data: object) -> MagicMock:
    response = MagicMock(spec=httpx.Response)
    response.raise_for_status.return_value = None
    response.json.return_value = json_data
    return response


@pytest.mark.parametrize(
    "query",
    [
        "participant_uuid aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa GAD-7 score",
        "session_id 123 and participant_number 7 anxiety data",
        "Bearer eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb",
        "search these participant rows for interpretation",
        '{"participant_uuid": "x", "total_score": 12}',
        "participant 7 GAD-7 score 14 what does this mean",
        "SUPABASE_SERVICE_ROLE_KEY is abc",
    ],
)
def test_sanitizer_rejects_private_identifiers_rows_and_credentials(
    query: str,
) -> None:
    with pytest.raises(WebResearchQueryRejected):
        sanitize_web_research_query(query)


def test_sanitizer_allows_public_research_query() -> None:
    query = sanitize_web_research_query(
        "  longitudinal weather exposure and depression symptoms meta analysis  "
    )

    assert query == "longitudinal weather exposure and depression symptoms meta analysis"


def test_rejected_query_never_calls_provider() -> None:
    with patch("httpx.post") as mock_post:
        result = run_web_research(
            "participant_uuid aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            config=WebResearchConfig(api_key="secret"),
        )

    assert result.status == "invalid_scope"
    assert "blocked_reason" in result.data
    mock_post.assert_not_called()


def test_web_research_disabled_cleanly_when_key_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CHAT_WEB_SEARCH_API_KEY", raising=False)

    with patch("httpx.post") as mock_post:
        result = run_web_research("public GAD-7 scoring guidance")

    assert result.status == "insufficient_data"
    assert result.data == {"enabled": False, "sources": []}
    assert "disabled" in result.message
    mock_post.assert_not_called()


def test_web_research_returns_cited_compact_sources() -> None:
    response = _mock_response(
        {
            "results": [
                {
                    "title": "GAD-7 validation study",
                    "url": "https://example.org/gad7",
                    "content": "A compact public summary of the validation study.",
                },
                {
                    "title": "Depression and weather review",
                    "url": "https://example.org/weather-mood",
                    "content": "A review of links between weather and mood.",
                },
            ]
        }
    )

    with patch("httpx.post", return_value=response) as mock_post:
        result = run_web_research(
            "GAD-7 validation study public source",
            max_results=2,
            config=WebResearchConfig(api_key="secret"),
        )

    assert result.status == "ready"
    assert result.data["query"] == "GAD-7 validation study public source"
    assert len(result.data["sources"]) == 2
    assert result.data["sources"][0] == {
        "title": "GAD-7 validation study",
        "url": "https://example.org/gad7",
        "retrieved_date": result.data["sources"][0]["retrieved_date"],
        "summary": "A compact public summary of the validation study.",
    }
    assert result.data["sources"][0]["retrieved_date"]
    call = mock_post.call_args.kwargs
    assert call["json"]["api_key"] == "secret"
    assert call["json"]["query"] == "GAD-7 validation study public source"
    assert call["json"]["max_results"] == 2


def test_web_research_tool_is_registered_and_dispatchable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CHAT_WEB_SEARCH_API_KEY", raising=False)

    tool = get_chat_tool("web_research")
    schema = tool.input_schema()
    assert schema["properties"]["query"]["type"] == "string"
    assert "lab_name" not in schema["properties"]
    assert any(spec["function"]["name"] == "web_research" for spec in chat_tool_specs())

    result = asyncio.run(
        dispatch_tool(
            object(),
            lab_member=object(),
            tool_name="web_research",
            params={"query": "public literature on misokinesia measurement"},
        )
    )

    assert result.status == "insufficient_data"
    assert result.data["enabled"] is False
