from __future__ import annotations

import re
from uuid import uuid4

from app.auth import LabMember
from app.schemas.chat import RAChatRequest, RAChatResponse


_TOOL_UNAVAILABLE_MODEL = "tool-unavailable"
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

    lab_scope = lab_member.lab_name or "unassigned"
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


def coordinate_ra_chat(
    request: RAChatRequest,
    *,
    lab_member: LabMember,
) -> RAChatResponse:
    """Coordinate an authenticated RA chat request.

    Real data tools are intentionally not attached yet. Until they are, the
    coordinator fails closed with a typed unavailable response instead of
    letting a model infer answers from ungrounded lab data.
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

    return RAChatResponse(
        conversation_id=conversation_id,
        message=(
            "AI chat is not connected to approved read-only lab data tools yet, "
            "so no study data was queried. The backend route is available for "
            "authenticated RA requests and will answer once scoped data tools are attached."
        ),
        model=_TOOL_UNAVAILABLE_MODEL,
        tool_results=[],
        blocked_reason=_DATA_TOOLS_UNAVAILABLE_REASON,
    )


__all__ = [
    "build_ra_chat_system_prompt",
    "coordinate_ra_chat",
]
