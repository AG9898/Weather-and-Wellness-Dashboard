"""Tool dispatch registry for the RA data chatbot agentic loop.

This module exposes each approved read-only chat data tool as an individually
invocable unit with:

- a fixed tool name,
- a typed JSON input schema (Pydantic model -> JSON Schema) for model
  tool-calling, and
- a dispatch coroutine that validates the model-supplied params and injects the
  authenticated lab scope **server-side**.

The model never supplies ``lab_id`` / ``lab_name``: the authenticated
``LabMember`` is resolved from the JWT by FastAPI and passed to ``dispatch_tool``
out-of-band. Any scope-bearing identity in model params is structurally
impossible because the param models only expose date/study/participant fields,
not lab identity. Disallowed or unknown tool names are rejected safely without
touching the database.

Query logic is unchanged: dispatch delegates to the existing functions in
``app.services.chat_tools`` which own scope resolution and the
``ready`` / ``insufficient_data`` / ``invalid_scope`` / ``permission_denied``
status contract.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Awaitable, Callable

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember
from app.schemas.chat import RAChatScope
from app.services.chat_tools import (
    MAX_CHAT_TOOL_SESSION_ROWS,
    ChatAggregateToolResult,
    get_dashboard_analytics_summary,
    get_participant_session_summaries,
    get_study_window_session_counts,
    get_survey_score_summary,
    get_weather_study_day_summary,
)


class UnknownChatToolError(LookupError):
    """Raised when a tool name is not in the approved registry."""

    def __init__(self, tool_name: str) -> None:
        self.tool_name = tool_name
        super().__init__(f"Unknown or disallowed chat tool: {tool_name!r}")


# ---------------------------------------------------------------------------
# Typed model-facing input schemas
# ---------------------------------------------------------------------------
#
# These models describe ONLY what the model is allowed to choose: the bounded
# study window, the study slug, and (for participant summaries) the anonymous
# participant number and row limit. They deliberately do NOT expose any lab
# identity field, so the model cannot supply or override the authenticated lab
# scope.


class _ScopedToolParams(BaseModel):
    """Shared bounded-scope params for the aggregate chat tools."""

    model_config = ConfigDict(extra="forbid")

    date_from: date | None = Field(
        default=None,
        description="Inclusive start of the local study-day window. Optional.",
    )
    date_to: date | None = Field(
        default=None,
        description="Inclusive end of the local study-day window. Optional.",
    )
    study_slug: str | None = Field(
        default=None,
        max_length=64,
        pattern=r"^[a-z0-9][a-z0-9-]*$",
        description="Optional study slug within the authenticated lab scope.",
    )

    @model_validator(mode="after")
    def _validate_date_range(self) -> "_ScopedToolParams":
        if (
            self.date_from is not None
            and self.date_to is not None
            and self.date_from > self.date_to
        ):
            raise ValueError("date_from must not be after date_to")
        return self

    def to_scope(self) -> RAChatScope:
        return RAChatScope(
            date_from=self.date_from,
            date_to=self.date_to,
            study_slug=self.study_slug,
        )


class DashboardAnalyticsSummaryParams(_ScopedToolParams):
    """Params for the dashboard analytics snapshot summary tool."""


class StudyWindowSessionCountsParams(_ScopedToolParams):
    """Params for the study-window and linked session-count summary tool."""


class SurveyScoreSummaryParams(_ScopedToolParams):
    """Params for the survey and digit-span aggregate score summary tool."""


class WeatherStudyDaySummaryParams(_ScopedToolParams):
    """Params for the weather/study-day summary tool."""


class ParticipantSessionSummariesParams(_ScopedToolParams):
    """Params for the bounded anonymous participant/session summary tool."""

    participant_number: int | None = Field(
        default=None,
        ge=1,
        description="Optional anonymous participant number filter.",
    )
    limit: int = Field(
        default=MAX_CHAT_TOOL_SESSION_ROWS,
        ge=1,
        le=MAX_CHAT_TOOL_SESSION_ROWS,
        description=(
            "Maximum session rows to return "
            f"(capped at {MAX_CHAT_TOOL_SESSION_ROWS})."
        ),
    )


# ---------------------------------------------------------------------------
# Registry entries
# ---------------------------------------------------------------------------


_DispatchFn = Callable[
    [AsyncSession, LabMember, BaseModel],
    Awaitable[ChatAggregateToolResult],
]


@dataclass(frozen=True)
class ChatTool:
    """A single approved, individually invocable chat data tool."""

    name: str
    description: str
    params_model: type[BaseModel]
    _dispatch: _DispatchFn

    def input_schema(self) -> dict[str, Any]:
        """Return the JSON Schema for this tool's model-facing params."""

        return self.params_model.model_json_schema()

    def tool_spec(self) -> dict[str, Any]:
        """Return an OpenAI/OpenRouter-style function tool spec."""

        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.input_schema(),
            },
        }


async def _dispatch_dashboard_analytics_summary(
    db: AsyncSession, lab_member: LabMember, params: BaseModel
) -> ChatAggregateToolResult:
    assert isinstance(params, DashboardAnalyticsSummaryParams)
    return await get_dashboard_analytics_summary(
        db, lab_member=lab_member, chat_scope=params.to_scope()
    )


async def _dispatch_study_window_session_counts(
    db: AsyncSession, lab_member: LabMember, params: BaseModel
) -> ChatAggregateToolResult:
    assert isinstance(params, StudyWindowSessionCountsParams)
    return await get_study_window_session_counts(
        db, lab_member=lab_member, chat_scope=params.to_scope()
    )


async def _dispatch_survey_score_summary(
    db: AsyncSession, lab_member: LabMember, params: BaseModel
) -> ChatAggregateToolResult:
    assert isinstance(params, SurveyScoreSummaryParams)
    return await get_survey_score_summary(
        db, lab_member=lab_member, chat_scope=params.to_scope()
    )


async def _dispatch_weather_study_day_summary(
    db: AsyncSession, lab_member: LabMember, params: BaseModel
) -> ChatAggregateToolResult:
    assert isinstance(params, WeatherStudyDaySummaryParams)
    return await get_weather_study_day_summary(
        db, lab_member=lab_member, chat_scope=params.to_scope()
    )


async def _dispatch_participant_session_summaries(
    db: AsyncSession, lab_member: LabMember, params: BaseModel
) -> ChatAggregateToolResult:
    assert isinstance(params, ParticipantSessionSummariesParams)
    return await get_participant_session_summaries(
        db,
        lab_member=lab_member,
        chat_scope=params.to_scope(),
        participant_number=params.participant_number,
        limit=params.limit,
    )


_REGISTRY: dict[str, ChatTool] = {
    tool.name: tool
    for tool in (
        ChatTool(
            name="dashboard_analytics_summary",
            description=(
                "Return the dashboard analytics snapshot (models, effects, and "
                "temperature windows) for a bounded local study-day range."
            ),
            params_model=DashboardAnalyticsSummaryParams,
            _dispatch=_dispatch_dashboard_analytics_summary,
        ),
        ChatTool(
            name="study_window_session_counts",
            description=(
                "Return the study-day window span and linked session counts by "
                "status for a bounded local study-day range."
            ),
            params_model=StudyWindowSessionCountsParams,
            _dispatch=_dispatch_study_window_session_counts,
        ),
        ChatTool(
            name="survey_score_summary",
            description=(
                "Return aggregate survey and digit-span score statistics "
                "(count/mean/min/max) for a bounded local study-day range."
            ),
            params_model=SurveyScoreSummaryParams,
            _dispatch=_dispatch_survey_score_summary,
        ),
        ChatTool(
            name="weather_study_day_summary",
            description=(
                "Return weather and study-day counts plus temperature, "
                "precipitation, and sunshine aggregates for a bounded range."
            ),
            params_model=WeatherStudyDaySummaryParams,
            _dispatch=_dispatch_weather_study_day_summary,
        ),
        ChatTool(
            name="participant_session_summaries",
            description=(
                "Return bounded anonymous participant/session summaries "
                "(participant_number, demographics, survey scores, digit span) "
                "for a bounded range or a single participant number. Omits raw "
                "UUIDs."
            ),
            params_model=ParticipantSessionSummariesParams,
            _dispatch=_dispatch_participant_session_summaries,
        ),
    )
}


def list_chat_tools() -> list[ChatTool]:
    """Return all approved chat tools in a stable order."""

    return list(_REGISTRY.values())


def get_chat_tool(tool_name: str) -> ChatTool:
    """Look up an approved chat tool by name, or raise ``UnknownChatToolError``."""

    try:
        return _REGISTRY[tool_name]
    except KeyError as exc:
        raise UnknownChatToolError(tool_name) from exc


def chat_tool_specs() -> list[dict[str, Any]]:
    """Return OpenRouter-style function specs for all approved tools."""

    return [tool.tool_spec() for tool in _REGISTRY.values()]


async def dispatch_tool(
    db: AsyncSession,
    *,
    lab_member: LabMember,
    tool_name: str,
    params: dict[str, Any] | None = None,
) -> ChatAggregateToolResult:
    """Validate ``params`` for ``tool_name`` and run it with server-injected scope.

    The authenticated ``lab_member`` is supplied out-of-band and is the only
    source of lab identity. Model-supplied ``params`` cannot carry a lab scope.
    Validation failures return a typed ``invalid_scope`` result rather than
    raising, preserving the status contract for the coordinator. Unknown tool
    names raise ``UnknownChatToolError`` without any DB access.
    """

    tool = get_chat_tool(tool_name)
    try:
        validated = tool.params_model.model_validate(params or {})
    except ValidationError as exc:
        return ChatAggregateToolResult(
            tool_name=tool_name,
            status="invalid_scope",
            message="Tool parameters failed validation.",
            data={"errors": exc.errors(include_url=False)},
        )
    return await tool._dispatch(db, lab_member, validated)


__all__ = [
    "ChatTool",
    "DashboardAnalyticsSummaryParams",
    "ParticipantSessionSummariesParams",
    "StudyWindowSessionCountsParams",
    "SurveyScoreSummaryParams",
    "UnknownChatToolError",
    "WeatherStudyDaySummaryParams",
    "chat_tool_specs",
    "dispatch_tool",
    "get_chat_tool",
    "list_chat_tools",
]
