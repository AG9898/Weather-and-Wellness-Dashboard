from __future__ import annotations

import json
import re
from collections.abc import Callable, Mapping, Sequence
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember
from app.schemas.chat import RAChatRequest, RAChatResponse, RAChatToolResult
from app.services.chat_tool_registry import (
    UnknownChatToolError,
    chat_tool_specs,
    dispatch_tool,
)
from app.services.openrouter_client import (
    OpenRouterChatResult,
    OpenRouterClient,
    OpenRouterUnavailableError,
)


_TOOL_UNAVAILABLE_MODEL = "tool-unavailable"
_DISALLOWED_DATA_ACCESS_REASON = "disallowed_data_access_request"
_PRIVACY_UNAVAILABLE_REASON = "model_unavailable"
_LOOP_CAP_REASON = "tool_round_cap_reached"

# Bound the agentic loop so a turn cannot fan out into unbounded tool calls.
MAX_TOOL_CALL_ROUNDS = 4

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

# Type of the factory the coordinator uses to obtain a configured client. It is
# injectable so tests can supply a fake without env/network, but defaults to the
# fail-closed env factory in production.
ClientFactory = Callable[[], OpenRouterClient]


def build_ra_chat_system_prompt(lab_member: LabMember) -> str:
    """Build the stable coordinator prompt contract for model calls."""

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
            "Answer ordinary conversational or general-knowledge questions directly "
            "without calling any tool.",
            "Call an approved data tool only when you need this lab's actual study "
            "data. FastAPI injects the authenticated lab scope into every tool call; "
            "never ask for, supply, or assume a lab_id or lab_name.",
            "Call get_data_coverage to anchor date windows to where data exists "
            "before guessing a range.",
            "Use only approved backend tools supplied by FastAPI. Do not run SQL, "
            "inspect arbitrary table names, write data, export files, or reveal "
            "credentials.",
            "Tool results carry a status (ready / insufficient_data / "
            "permission_denied / invalid_scope). Narrate these into plain language "
            "for the RA; never surface the raw status line.",
            "Separate retrieved study data, statistical summaries, interpretation, "
            "and public research context. State when data is insufficient or tools "
            "are unavailable. Prefer anonymous participant_number over raw UUIDs.",
        ]
    )


def _contains_disallowed_data_access_request(request: RAChatRequest) -> bool:
    parts = [request.message]
    parts.extend(message.content for message in request.history)
    text = "\n".join(parts)

    return any(pattern.search(text) for pattern in (*_RAW_SQL_PATTERNS, *_RAW_TABLE_PATTERNS))


def _build_messages(
    request: RAChatRequest, *, lab_member: LabMember
) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": build_ra_chat_system_prompt(lab_member)}
    ]
    for turn in request.history:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": request.message})
    return messages


def _parse_tool_call_arguments(raw_arguments: Any) -> dict[str, Any]:
    """Parse the JSON arguments string a model returns for a tool call.

    Models return ``arguments`` as a JSON-encoded string. Malformed or non-object
    arguments degrade to an empty params dict, which the registry then validates
    (and rejects with a typed ``invalid_scope`` result) rather than crashing.
    """

    if isinstance(raw_arguments, Mapping):
        return dict(raw_arguments)
    if not raw_arguments:
        return {}
    try:
        parsed = json.loads(raw_arguments)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def _run_tool_calls(
    tool_calls: Sequence[Mapping[str, Any]],
    *,
    lab_member: LabMember,
    db: AsyncSession,
    tool_results: list[RAChatToolResult],
) -> list[dict[str, Any]]:
    """Execute the model's requested tool calls and build tool-role messages.

    Scope is injected server-side by ``dispatch_tool``. Each tool's compact
    status summary is appended to ``tool_results`` for the typed response and the
    full JSON payload is fed back to the model as a ``tool`` message keyed by the
    originating ``tool_call_id``.
    """

    tool_messages: list[dict[str, Any]] = []
    for call in tool_calls:
        call_id = call.get("id") or ""
        function = call.get("function") or {}
        tool_name = function.get("name") or ""
        params = _parse_tool_call_arguments(function.get("arguments"))

        try:
            result = await dispatch_tool(
                db,
                lab_member=lab_member,
                tool_name=tool_name,
                params=params,
            )
        except UnknownChatToolError as exc:
            tool_results.append(
                RAChatToolResult(
                    tool_name=tool_name or "unknown",
                    summary="invalid_scope: requested tool is not approved.",
                )
            )
            tool_messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "name": tool_name or "unknown",
                    "content": json.dumps(
                        {"status": "invalid_scope", "error": str(exc)}
                    ),
                }
            )
            continue

        tool_results.append(
            RAChatToolResult(
                tool_name=result.tool_name,
                summary=result.response_summary(),
            )
        )
        tool_messages.append(
            {
                "role": "tool",
                "tool_call_id": call_id,
                "name": result.tool_name,
                "content": json.dumps(result.to_json()),
            }
        )
    return tool_messages


def _assistant_message_from_completion(
    completion: OpenRouterChatResult,
) -> dict[str, Any]:
    message: dict[str, Any] = {
        "role": "assistant",
        "content": completion.content or "",
    }
    if completion.tool_calls:
        message["tool_calls"] = completion.tool_calls
    return message


async def coordinate_ra_chat(
    request: RAChatRequest,
    *,
    lab_member: LabMember,
    db: AsyncSession,
    client_factory: ClientFactory = OpenRouterClient.from_env,
) -> RAChatResponse:
    """Coordinate an authenticated RA chat request via a bounded agentic loop.

    OpenRouter receives the system prompt, conversation history, and approved
    tool schemas. The model chooses which tools (if any) to call with derived
    params; FastAPI injects the authenticated lab scope and executes the tools
    through the registry, feeding results back. The loop is capped at
    ``MAX_TOOL_CALL_ROUNDS`` per turn. Tool statuses are narrated by the model,
    not surfaced raw. The disallowed-raw-SQL/table gate is preserved, and a
    privacy-unavailable model configuration returns a user-safe response.
    """

    conversation_id = request.conversation_id or uuid4()

    if _contains_disallowed_data_access_request(request):
        return RAChatResponse(
            conversation_id=conversation_id,
            message=(
                "I cannot run SQL, inspect raw database tables, or accept table-name "
                "instructions. Ask for a bounded summary in natural language and I "
                "will use the approved read-only data tools."
            ),
            model=_TOOL_UNAVAILABLE_MODEL,
            tool_results=[],
            blocked_reason=_DISALLOWED_DATA_ACCESS_REASON,
        )

    try:
        client = client_factory()
    except OpenRouterUnavailableError as exc:
        return RAChatResponse(
            conversation_id=conversation_id,
            message=exc.public_message,
            model=_TOOL_UNAVAILABLE_MODEL,
            tool_results=[],
            blocked_reason=_PRIVACY_UNAVAILABLE_REASON,
        )

    messages = _build_messages(request, lab_member=lab_member)
    tool_specs = chat_tool_specs()
    tool_results: list[RAChatToolResult] = []
    served_model = ""
    blocked_reason: str | None = None

    try:
        for round_index in range(MAX_TOOL_CALL_ROUNDS):
            completion = client.create_chat_completion(messages, tools=tool_specs)
            served_model = completion.served_model
            messages.append(_assistant_message_from_completion(completion))

            if not completion.tool_calls:
                return RAChatResponse(
                    conversation_id=conversation_id,
                    message=completion.content
                    or "I do not have anything to add for that request.",
                    model=served_model,
                    tool_results=tool_results,
                    blocked_reason=None,
                )

            tool_messages = await _run_tool_calls(
                completion.tool_calls,
                lab_member=lab_member,
                db=db,
                tool_results=tool_results,
            )
            messages.extend(tool_messages)

        # Round cap reached: ask the model to answer from what it has, with no
        # further tool calls allowed.
        final = client.create_chat_completion(messages, tools=tool_specs, tool_choice="none")
        served_model = final.served_model
        blocked_reason = _LOOP_CAP_REASON
        final_message = (
            final.content
            or "I reached the tool-call limit for this turn. Here is what I gathered."
        )
    except OpenRouterUnavailableError as exc:
        return RAChatResponse(
            conversation_id=conversation_id,
            message=exc.public_message,
            model=_TOOL_UNAVAILABLE_MODEL,
            tool_results=tool_results,
            blocked_reason=_PRIVACY_UNAVAILABLE_REASON,
        )

    return RAChatResponse(
        conversation_id=conversation_id,
        message=final_message,
        model=served_model,
        tool_results=tool_results,
        blocked_reason=blocked_reason,
    )


__all__ = [
    "MAX_TOOL_CALL_ROUNDS",
    "build_ra_chat_system_prompt",
    "coordinate_ra_chat",
]
