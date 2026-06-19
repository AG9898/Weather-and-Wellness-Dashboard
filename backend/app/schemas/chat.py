from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


ChatMessageRole = Literal["user", "assistant"]


class RAChatMessage(BaseModel):
    """Prior conversation turn sent by the RA chat frontend."""

    model_config = ConfigDict(extra="forbid")

    role: ChatMessageRole
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        content = value.strip()
        if not content:
            raise ValueError("content must not be blank")
        return content


class RAChatScope(BaseModel):
    """Optional bounded study scope for future approved backend data tools."""

    model_config = ConfigDict(extra="forbid")

    date_from: date | None = None
    date_to: date | None = None
    study_slug: str | None = Field(
        default=None,
        max_length=64,
        pattern=r"^[a-z0-9][a-z0-9-]*$",
    )

    @model_validator(mode="after")
    def validate_date_range(self) -> "RAChatScope":
        if self.date_from is not None and self.date_to is not None:
            if self.date_from > self.date_to:
                raise ValueError("date_from must not be after date_to")
        return self


class RAChatRequest(BaseModel):
    """Authenticated RA chat request accepted by POST /chat."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)
    conversation_id: UUID | None = None
    history: list[RAChatMessage] = Field(default_factory=list, max_length=20)
    scope: RAChatScope = Field(default_factory=RAChatScope)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("message must not be blank")
        return message


class RAChatToolResult(BaseModel):
    """Compact user-safe summary of an approved backend tool result."""

    tool_name: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=500)


class RAChatResponse(BaseModel):
    """Typed response returned by the RA data chatbot coordinator."""

    conversation_id: UUID
    message: str
    model: str
    tool_results: list[RAChatToolResult] = Field(default_factory=list)
    blocked_reason: str | None = None


__all__ = [
    "ChatMessageRole",
    "RAChatMessage",
    "RAChatRequest",
    "RAChatResponse",
    "RAChatScope",
    "RAChatToolResult",
]
