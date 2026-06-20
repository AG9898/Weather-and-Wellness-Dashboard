from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_lab_member
from app.db import get_session
from app.schemas.chat import RAChatRequest, RAChatResponse
from app.services.chat_service import (
    coordinate_ra_chat,
    format_sse_event,
    stream_ra_chat,
)


router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=RAChatResponse)
async def post_chat_route(
    request: RAChatRequest,
    lab_member: LabMember = Depends(get_current_lab_member),
    db: AsyncSession = Depends(get_session),
) -> RAChatResponse:
    """Handle an authenticated RA chatbot request."""

    return await coordinate_ra_chat(request, lab_member=lab_member, db=db)


@router.post("/chat/stream")
async def post_chat_stream_route(
    request: RAChatRequest,
    lab_member: LabMember = Depends(get_current_lab_member),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Stream an authenticated RA chatbot turn over SSE.

    Emits incremental ``token`` events plus ``tool_running``/``tool_resolved``
    lifecycle events, ending with one terminal ``done`` (carrying the full
    ``RAChatResponse`` payload) or ``error`` event. Auth, privacy, scope
    injection, and tool boundaries are identical to the non-streaming ``/chat``
    route — only the transport differs.
    """

    async def event_source() -> AsyncIterator[str]:
        async for event in stream_ra_chat(request, lab_member=lab_member, db=db):
            yield format_sse_event(event)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


__all__ = ["router"]
