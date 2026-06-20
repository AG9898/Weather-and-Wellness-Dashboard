"""Privacy-sanitized web research tool for the RA chatbot.

The tool is intentionally narrow: it accepts a public-research query, rejects
anything that looks like participant/session data or credentials before any
network call, and returns compact cited source metadata for the coordinator to
narrate. The search provider key is server-only and optional; leaving it unset
disables the tool cleanly.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from app.services.chat_tools import ChatAggregateToolResult

TOOL_NAME = "web_research"
_SEARCH_URL = "https://api.tavily.com/search"
_USER_AGENT_TITLE = "UBC Psychology Research Platform"
_MAX_RESULTS = 5
_MAX_SUMMARY_CHARS = 320

_UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b",
    re.IGNORECASE,
)
_JWT_PATTERN = re.compile(
    r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"
)
_SECRET_PATTERN = re.compile(
    r"\b(?:api[_-]?key|service[_-]?role|anon[_-]?key|jwt|bearer|authorization|"
    r"password|passwd|secret|token|credential|supabase[_-]?(?:url|anon[_-]?key|"
    r"service[_-]?role[_-]?key|jwt[_-]?secret)|openrouter[_-]?api[_-]?key|"
    r"chat[_-]?web[_-]?search[_-]?api[_-]?key)\b",
    re.IGNORECASE,
)
_PARTICIPANT_IDENTIFIER_PATTERN = re.compile(
    r"\b(?:participant[_\s-]?(?:uuid|id|number)|session[_\s-]?id|"
    r"participant\s*#|session\s*#)\b",
    re.IGNORECASE,
)
_PARTICIPANT_ROW_PATTERN = re.compile(
    r"\b(?:participant|session|survey|digitspan|weather|study[_\s-]?day)s?"
    r"\s+(?:row|rows|record|records|table|tables|dump|export)\b",
    re.IGNORECASE,
)
_RAW_DATA_PATTERN = re.compile(
    r"\b(?:raw|private|sensitive)\s+(?:lab|study|participant|session|survey)\s+data\b",
    re.IGNORECASE,
)
_TABLE_NAME_PATTERN = re.compile(
    r"\b(?:participants|sessions|survey_uls8|survey_cesd10|survey_gad7|"
    r"survey_cogfunc8a|digitspan_runs|digitspan_trials|weather_daily|"
    r"study_days|imported_session_measures)\b",
    re.IGNORECASE,
)
_PARTICIPANT_SCORE_PATTERN = re.compile(
    r"\b(?:participant|session)\b.{0,40}\b(?:gad-?7|ces-?d|uls-?8|"
    r"cogfunc|digit\s*span|score|total_score)\b.{0,30}\b\d+\b",
    re.IGNORECASE | re.DOTALL,
)
_JSON_ROW_HINT_PATTERN = re.compile(
    r"[{}\[\]].*\b(?:participant|session|survey|total_score|participant_uuid|"
    r"session_id)\b",
    re.IGNORECASE | re.DOTALL,
)


class WebResearchQueryRejected(ValueError):
    """Raised when a query cannot be sent to an external provider safely."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


@dataclass(frozen=True)
class WebResearchConfig:
    """Server-only configuration for the web research provider."""

    api_key: str
    search_url: str = _SEARCH_URL


def get_web_research_config() -> WebResearchConfig | None:
    """Return web research config, or ``None`` when the tool is disabled."""

    api_key = (os.getenv("CHAT_WEB_SEARCH_API_KEY") or "").strip()
    if not api_key:
        return None
    return WebResearchConfig(api_key=api_key)


def sanitize_web_research_query(query: str) -> str:
    """Normalize a public-research query or reject private/sensitive content."""

    normalized = " ".join(query.strip().split())
    if not normalized:
        raise WebResearchQueryRejected("query is blank")
    if len(normalized) > 240:
        raise WebResearchQueryRejected("query is too long")

    checks: tuple[tuple[re.Pattern[str], str], ...] = (
        (_UUID_PATTERN, "participant or session UUID"),
        (_JWT_PATTERN, "JWT"),
        (_SECRET_PATTERN, "credential or secret"),
        (_PARTICIPANT_IDENTIFIER_PATTERN, "participant/session identifier"),
        (_PARTICIPANT_ROW_PATTERN, "participant/session row data"),
        (_RAW_DATA_PATTERN, "sensitive lab data"),
        (_TABLE_NAME_PATTERN, "private database table"),
        (_PARTICIPANT_SCORE_PATTERN, "participant-level score data"),
        (_JSON_ROW_HINT_PATTERN, "structured participant/session row"),
    )
    for pattern, reason in checks:
        if pattern.search(normalized):
            raise WebResearchQueryRejected(reason)

    return normalized


def _compact_summary(value: object) -> str:
    text = " ".join(str(value or "").strip().split())
    if len(text) <= _MAX_SUMMARY_CHARS:
        return text
    return f"{text[: _MAX_SUMMARY_CHARS - 3].rstrip()}..."


def _source_from_provider_result(
    raw: dict[str, Any], *, retrieved_at_utc: datetime
) -> dict[str, str]:
    return {
        "title": _compact_summary(raw.get("title")) or "Untitled source",
        "url": str(raw.get("url") or ""),
        "retrieved_date": retrieved_at_utc.date().isoformat(),
        "summary": _compact_summary(raw.get("content") or raw.get("snippet")),
    }


def run_web_research(
    query: str,
    *,
    max_results: int = 3,
    config: WebResearchConfig | None = None,
) -> ChatAggregateToolResult:
    """Search public web sources after privacy sanitization.

    Sanitization runs before config lookup and before any provider call. This
    keeps accidental participant data or credentials from leaving FastAPI even
    when the web tool is enabled.
    """

    try:
        sanitized_query = sanitize_web_research_query(query)
    except WebResearchQueryRejected as exc:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="invalid_scope",
            message="Web research query was rejected before any external call.",
            data={"blocked_reason": exc.reason},
        )

    resolved_config = config if config is not None else get_web_research_config()
    if resolved_config is None:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="insufficient_data",
            message=(
                "Web research is disabled because CHAT_WEB_SEARCH_API_KEY is unset."
            ),
            data={"enabled": False, "sources": []},
        )

    bounded_max_results = min(max(1, max_results), _MAX_RESULTS)
    try:
        response = httpx.post(
            resolved_config.search_url,
            headers={
                "Content-Type": "application/json",
                "X-Title": _USER_AGENT_TITLE,
            },
            json={
                "api_key": resolved_config.api_key,
                "query": sanitized_query,
                "max_results": bounded_max_results,
                "search_depth": "basic",
                "include_answer": False,
                "include_raw_content": False,
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="insufficient_data",
            message="Web research provider was unavailable.",
            data={"enabled": True, "error": type(exc).__name__, "sources": []},
        )

    retrieved_at_utc = datetime.now(UTC)
    raw_results = payload.get("results") if isinstance(payload, dict) else None
    sources = [
        source
        for source in (
            _source_from_provider_result(raw, retrieved_at_utc=retrieved_at_utc)
            for raw in (raw_results or [])
            if isinstance(raw, dict)
        )
        if source["url"]
    ][:bounded_max_results]

    if not sources:
        return ChatAggregateToolResult(
            tool_name=TOOL_NAME,
            status="insufficient_data",
            message="Web research returned no citeable sources.",
            data={"enabled": True, "sources": []},
        )

    return ChatAggregateToolResult(
        tool_name=TOOL_NAME,
        status="ready",
        message=f"Web research returned {len(sources)} citeable source(s).",
        data={
            "enabled": True,
            "query": sanitized_query,
            "retrieved_at_utc": retrieved_at_utc.isoformat(),
            "sources": sources,
        },
    )


__all__ = [
    "TOOL_NAME",
    "WebResearchConfig",
    "WebResearchQueryRejected",
    "get_web_research_config",
    "run_web_research",
    "sanitize_web_research_query",
]
