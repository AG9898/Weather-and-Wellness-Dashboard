from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class ChatToolInvocation(Base):
    """Append-only audit record for one RA-chatbot tool invocation.

    Written once per tool call in the agentic coordinator loop for
    research-ethics review and debugging. Stores tool metadata, the
    model-supplied params, and the resulting status only — never raw
    participant rows or PII. See ``docs/SCHEMA.md`` and ``docs/AI_CHAT.md``
    (Tool-Call Audit). There is no FK to a conversation table because v1 does
    not persist conversations server-side.
    """

    __tablename__ = "chat_tool_invocations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    lab_name: Mapped[str] = mapped_column(String, nullable=False)
    tool_name: Mapped[str] = mapped_column(String, nullable=False)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
