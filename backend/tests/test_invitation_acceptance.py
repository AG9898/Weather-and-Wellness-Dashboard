from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi.routing import APIRoute

from app.auth import get_current_admin, get_current_lab_member
from app.models.invitations import RAInvitation
from app.routers.auth_invitations import accept_invitation_route, router
from app.schemas.admin import AcceptInvitationRequest
from app.services.admin_invite_service import (
    InviteAlreadyUsedError,
    InviteExpiredError,
    InviteNotFoundError,
)
from app.services.supabase_admin_users import LabUserInfo


_USER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
_ADMIN_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
_NOW = datetime.now(timezone.utc)


def _invitation(status: str = "pending") -> RAInvitation:
    return RAInvitation(
        invitation_id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        email="ra@lab.test",
        role="ra",
        lab_name="ww",
        token_hash="not-returned",
        status=status,
        expires_at=_NOW + timedelta(days=7),
        created_by_lab_member_id=_ADMIN_ID,
        send_count=1,
        created_at=_NOW,
        updated_at=_NOW,
    )


def _user() -> LabUserInfo:
    return LabUserInfo(
        id=_USER_ID,
        email="ra@lab.test",
        role="ra",
        lab_name="ww",
        is_banned=False,
        created_at="2026-05-01T00:00:00Z",
        last_sign_in_at=None,
    )


class InvitationAcceptanceRouteTests(IsolatedAsyncioTestCase):
    def test_accept_route_is_public_and_registered(self) -> None:
        route = next(
            route
            for route in router.routes
            if isinstance(route, APIRoute) and route.path == "/auth/invitations/accept"
        )

        assert route.methods == {"POST"}
        dependency_calls = {
            dependency.call for dependency in route.dependant.dependencies
        }
        assert get_current_admin not in dependency_calls
        assert get_current_lab_member not in dependency_calls

    async def test_accept_invite_creates_auth_user_and_marks_invite_accepted(self) -> None:
        pending = _invitation()
        accepted = _invitation(status="accepted")

        with (
            patch(
                "app.routers.auth_invitations.validate_token",
                new=AsyncMock(return_value=pending),
            ) as validate_mock,
            patch(
                "app.routers.auth_invitations.create_or_update_user",
                return_value=_user(),
            ) as user_mock,
            patch(
                "app.routers.auth_invitations.accept_invite",
                new=AsyncMock(return_value=accepted),
            ) as accept_mock,
        ):
            response = await accept_invitation_route(
                AcceptInvitationRequest(
                    token="valid-token-value-with-enough-length",
                    password="new-secure-password",
                ),
                db=AsyncMock(),
            )

        assert response.status == "accepted"
        assert response.email == "ra@lab.test"
        assert response.supabase_user_id == _USER_ID
        validate_mock.assert_awaited_once()
        user_mock.assert_called_once_with(
            "ra@lab.test",
            "ra",
            "ww",
            password="new-secure-password",
        )
        accept_mock.assert_awaited_once()

    async def test_accept_rejects_invalid_expired_and_used_tokens(self) -> None:
        cases = [
            (InviteNotFoundError(), 404, "invalid"),
            (InviteExpiredError(), 410, "expired"),
            (InviteAlreadyUsedError(), 409, "no longer available"),
        ]

        for error, status_code, detail in cases:
            with patch(
                "app.routers.auth_invitations.validate_token",
                new=AsyncMock(side_effect=error),
            ):
                with self.assertRaises(Exception) as exc_info:
                    await accept_invitation_route(
                        AcceptInvitationRequest(
                            token="valid-token-value-with-enough-length",
                            password="new-secure-password",
                        ),
                        db=AsyncMock(),
                    )

            assert exc_info.exception.status_code == status_code
            assert detail in exc_info.exception.detail
