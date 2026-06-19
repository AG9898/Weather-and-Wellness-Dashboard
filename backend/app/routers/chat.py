from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import LabMember, get_current_lab_member
from app.schemas.chat import RAChatRequest, RAChatResponse
from app.services.chat_service import coordinate_ra_chat


router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=RAChatResponse)
async def post_chat_route(
    request: RAChatRequest,
    lab_member: LabMember = Depends(get_current_lab_member),
) -> RAChatResponse:
    """Handle an authenticated RA chatbot request."""

    return coordinate_ra_chat(request, lab_member=lab_member)


__all__ = ["router"]
