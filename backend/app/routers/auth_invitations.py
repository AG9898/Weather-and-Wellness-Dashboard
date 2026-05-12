from __future__ import annotations

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.admin import AcceptInvitationRequest, AcceptInvitationResponse
from app.services.admin_invite_service import (
    InviteAlreadyUsedError,
    InviteExpiredError,
    InviteNotFoundError,
    accept_invite,
    validate_token,
)
from app.services.supabase_admin_users import create_or_update_user

router = APIRouter(prefix="/auth/invitations", tags=["auth"])


def _public_invite_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InviteNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation token is invalid.",
        )
    if isinstance(exc, InviteExpiredError):
        return HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invitation has expired.",
        )
    if isinstance(exc, InviteAlreadyUsedError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation is no longer available.",
        )
    if isinstance(exc, RuntimeError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invitation acceptance is not configured.",
        )
    if isinstance(exc, httpx.HTTPError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Account activation failed.",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Invitation acceptance failed.",
    )


@router.post(
    "/accept",
    response_model=AcceptInvitationResponse,
)
async def accept_invitation_route(
    request: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_session),
) -> AcceptInvitationResponse:
    """Accept a token-protected app-owned invitation and activate auth access."""
    try:
        invitation = await validate_token(db, token=request.token)
        user = create_or_update_user(
            invitation.email,
            invitation.role,
            invitation.lab_name,
            password=request.password,
        )
        accepted = await accept_invite(
            db,
            token=request.token,
            supabase_user_id=UUID(user.id),
        )
    except Exception as exc:
        raise _public_invite_error(exc) from exc

    return AcceptInvitationResponse(
        email=accepted.email,
        role=accepted.role,
        lab_name=accepted.lab_name,
        supabase_user_id=user.id,
    )
