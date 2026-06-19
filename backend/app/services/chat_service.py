from __future__ import annotations

import re
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember
from app.schemas.chat import RAChatRequest, RAChatResponse, RAChatToolResult
from app.services.chat_tools import run_scoped_aggregate_tools


_TOOL_UNAVAILABLE_MODEL = "tool-unavailable"
_AGGREGATE_TOOLS_MODEL = "aggregate-tools"
_DATA_TOOLS_UNAVAILABLE_REASON = "data_tools_unavailable"
_DISALLOWED_DATA_ACCESS_REASON = "disallowed_data_access_request"

_RAW_SQL_PATTERNS = (
    re.compile(r"\bselect\b.+\bfrom\b", re.IGNORECASE | re.DOTALL),
    re.compile(r"\binsert\s+into\b", re.IGNORECASE),
    re.compile(r"\bupdate\b.+\bset\b", re.IGNORECASE | re.DOTALL),
    re.compile(r"\bdelete\s+from\b", re.IGNORECASE),
    re.compile(r"\bdrop\s+table\b", re.IGNORECASE),
    re.compile(r"\balter\s+table\b", re.IGNORECASE),
    re.compile(r"\btruncate\s+table\b", re.IGNORECASE),
)

_RAW_TABLE_PATTERNS = (
    re.compile(r"\bparticipants?\s+table\b", re.IGNORECASE),
    re.compile(r"\bsessions?\s+table\b", re.IGNORECASE),
    re.compile(r"\b(?:survey|surveys|digitspan|weather|study_days?)\s+table\b", re.IGNORECASE),
    re.compile(
        r"\b(?:survey_uls8|survey_cesd10|survey_gad7|survey_cogfunc8a|"
        r"digitspan_runs|digitspan_trials|weather_daily|study_days|"
        r"imported_session_measures)\b",
        re.IGNORECASE,
    ),
)


def build_ra_chat_system_prompt(lab_member: LabMember) -> str:
    """Build the stable coordinator prompt contract for future model calls."""

    is_admin = (lab_member.role or "").strip().lower() == "admin"
    lab_scope = (
        "all labs (admin)"
        if is_admin
        else (lab_member.lab_name or "unassigned")
    )
    return "\n".join(
        [
            "You are an RA-facing research data assistant for UBC Psychology lab workflows.",
            f"The authenticated user's lab scope is {lab_scope}.",
            "Use only approved backend tools supplied by FastAPI.",
            "Do not run SQL, inspect arbitrary table names, write data, export files, or reveal credentials.",
            "Separate retrieved study data, statistical summaries, interpretation, and public research context.",
            "State when data tools are unavailable or insufficient.",
        ]
    )


def _contains_disallowed_data_access_request(request: RAChatRequest) -> bool:
    parts = [request.message]
    parts.extend(message.content for message in request.history)
    text = "\n".join(parts)

    return any(pattern.search(text) for pattern in (*_RAW_SQL_PATTERNS, *_RAW_TABLE_PATTERNS))


async def coordinate_ra_chat(
    request: RAChatRequest,
    *,
    lab_member: LabMember,
    db: AsyncSession,
) -> RAChatResponse:
    """Coordinate an authenticated RA chat request.

    The aggregate data-tool layer is intentionally deterministic while the
    narrative model gateway is still separate work. The coordinator returns
    scoped tool summaries only, never ungrounded model claims.
    """

    conversation_id = request.conversation_id or uuid4()
    _ = build_ra_chat_system_prompt(lab_member)

    if _contains_disallowed_data_access_request(request):
        return RAChatResponse(
            conversation_id=conversation_id,
            message=(
                "I cannot run SQL, inspect raw database tables, or accept table-name "
                "instructions. Ask for a bounded summary in natural language after "
                "approved read-only data tools are available."
            ),
            model=_TOOL_UNAVAILABLE_MODEL,
            tool_results=[],
            blocked_reason=_DISALLOWED_DATA_ACCESS_REASON,
        )

    aggregate_results = await run_scoped_aggregate_tools(
        db,
        lab_member=lab_member,
        chat_scope=request.scope,
    )
    tool_results = [
        RAChatToolResult(
            tool_name=result.tool_name,
            summary=result.response_summary(),
        )
        for result in aggregate_results
    ]
    ready_count = sum(1 for result in aggregate_results if result.status == "ready")
    blocked_reason = None
    if ready_count == 0:
        blocked_reason = aggregate_results[0].status if aggregate_results else _DATA_TOOLS_UNAVAILABLE_REASON

    return RAChatResponse(
        conversation_id=conversation_id,
        message=(
            "Approved read-only aggregate tools ran for the authenticated lab scope. "
            "The narrative model layer is not connected in this backend task, so this "
            "response includes bounded tool summaries only."
        ),
        model=_AGGREGATE_TOOLS_MODEL,
        tool_results=tool_results,
        blocked_reason=blocked_reason,
    )


__all__ = [
    "build_ra_chat_system_prompt",
    "coordinate_ra_chat",
]
