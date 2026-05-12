from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import ANY, AsyncMock, patch

from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from jose import jwt

from app.auth import get_current_admin
from app.models.invitations import RAInvitation
from app.routers.admin import (
    create_admin_user_invitation,
    get_admin_users,
    resend_admin_user_invitation,
    revoke_admin_user_access,
    revoke_admin_user_invitation,
    router,
    update_admin_user,
)
from app.schemas.admin import CreateUserInvitationRequest, UpdateAdminUserRequest
from app.services.admin_invite_service import (
    CreateInviteResult,
    DuplicatePendingInviteError,
    InviteAlreadyUsedError,
)
from app.services.supabase_admin_users import LabUserInfo


_ADMIN_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
_INVITATION_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
_NOW = datetime.now(timezone.utc)


def _invitation(status: str = "pending") -> RAInvitation:
    return RAInvitation(
        invitation_id=_INVITATION_ID,
        email="ra@lab.test",
        role="ra",
        lab_name="ww",
        token_hash="not-returned",
        status=status,
        expires_at=_NOW + timedelta(days=7),
        created_by_lab_member_id=_ADMIN_ID,
        last_sent_at=_NOW,
        send_count=1,
        provider_message_id="msg-001",
        created_at=_NOW,
        updated_at=_NOW,
    )


def _admin_member():
    from app.auth import LabMember

    return LabMember(
        id=_ADMIN_ID,
        email="admin@lab.test",
        role="admin",
        lab_name="ww",
    )


def _user(role: str = "ra") -> LabUserInfo:
    return LabUserInfo(
        id="cccccccc-cccc-cccc-cccc-cccccccccccc",
        email=f"{role}@lab.test",
        role=role,
        lab_name="ww",
        is_banned=False,
        created_at="2026-05-01T00:00:00Z",
        last_sign_in_at=None,
    )


class AdminUserRouteRegistrationTests(IsolatedAsyncioTestCase):
    def test_admin_user_routes_are_registered_with_admin_dependency(self) -> None:
        expected = {
            ("/admin/users", "GET"),
            ("/admin/users/invitations", "POST"),
            ("/admin/users/invitations/{invitation_id}/resend", "POST"),
            ("/admin/users/invitations/{invitation_id}/revoke", "POST"),
            ("/admin/users/{user_id}", "PATCH"),
            ("/admin/users/{user_id}/revoke-access", "POST"),
        }

        for path, method in expected:
            route = next(
                route
                for route in router.routes
                if isinstance(route, APIRoute) and route.path == path
            )
            dependency_calls = {
                dependency.call for dependency in route.dependant.dependencies
            }

            assert method in route.methods
            assert get_current_admin in dependency_calls

    def test_admin_routes_return_401_without_auth_and_403_for_non_admin(
        self,
    ) -> None:
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        missing = client.get("/admin/users")
        assert missing.status_code == 401

        token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "email": "ra@lab.test",
                "app_metadata": {"role": "ra", "lab_name": "ww"},
            },
            "test-secret",
            algorithm="HS256",
        )
        with patch.dict("os.environ", {"SUPABASE_JWT_SECRET": "test-secret"}):
            forbidden = client.get(
                "/admin/users",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert forbidden.status_code == 403

    async def test_get_admin_users_returns_safe_users_and_invitations(self) -> None:
        db = AsyncMock()
        with (
            patch("app.routers.admin.list_lab_users", return_value=[_user("admin")]),
            patch(
                "app.routers.admin.list_invitations",
                new=AsyncMock(return_value=[_invitation()]),
            ),
        ):
            response = await get_admin_users(_admin=_admin_member(), db=db)

        assert response.users[0].email == "admin@lab.test"
        assert response.invitations[0].email == "ra@lab.test"
        assert not hasattr(response.invitations[0], "token_hash")

    async def test_create_invitation_maps_duplicate_to_409(self) -> None:
        db = AsyncMock()
        with patch(
            "app.routers.admin.create_invite",
            new=AsyncMock(side_effect=DuplicatePendingInviteError()),
        ):
            with self.assertRaises(Exception) as exc_info:
                await create_admin_user_invitation(
                    CreateUserInvitationRequest(
                        email="ra@lab.test",
                        role="ra",
                        lab_name="ww",
                    ),
                    admin=_admin_member(),
                    db=db,
                )

        assert exc_info.exception.status_code == 409

    async def test_create_invitation_returns_sanitized_invitation(self) -> None:
        invitation = _invitation()
        with patch(
            "app.routers.admin.create_invite",
            new=AsyncMock(
                return_value=CreateInviteResult(
                    invitation=invitation,
                    raw_token="raw-token-never-returned",
                )
            ),
        ) as create_mock:
            response = await create_admin_user_invitation(
                CreateUserInvitationRequest(
                    email="RA@Lab.TEST",
                    role="ra",
                    lab_name="ww",
                ),
                admin=_admin_member(),
                db=AsyncMock(),
            )

        create_mock.assert_awaited_once()
        assert response.email == "ra@lab.test"
        assert not hasattr(response, "token_hash")

    async def test_resend_and_revoke_invitations_call_services(self) -> None:
        invitation = _invitation()
        with patch(
            "app.routers.admin.resend_invite",
            new=AsyncMock(return_value=invitation),
        ) as resend_mock:
            resend_response = await resend_admin_user_invitation(
                invitation_id=_INVITATION_ID,
                _admin=_admin_member(),
                db=AsyncMock(),
            )

        with patch(
            "app.routers.admin.revoke_invite",
            new=AsyncMock(return_value=_invitation(status="revoked")),
        ) as revoke_mock:
            revoke_response = await revoke_admin_user_invitation(
                invitation_id=_INVITATION_ID,
                admin=_admin_member(),
                db=AsyncMock(),
            )

        assert resend_response.invitation_id == _INVITATION_ID
        assert revoke_response.status == "revoked"
        resend_mock.assert_awaited_once_with(
            ANY,
            invitation_id=_INVITATION_ID,
        )
        revoke_mock.assert_awaited_once()

    async def test_resend_used_invitation_maps_to_409(self) -> None:
        with patch(
            "app.routers.admin.resend_invite",
            new=AsyncMock(side_effect=InviteAlreadyUsedError()),
        ):
            with self.assertRaises(Exception) as exc_info:
                await resend_admin_user_invitation(
                    invitation_id=_INVITATION_ID,
                    _admin=_admin_member(),
                    db=AsyncMock(),
                )

        assert exc_info.exception.status_code == 409

    async def test_update_user_and_revoke_access_call_supabase_client(self) -> None:
        with patch(
            "app.routers.admin.update_user_metadata",
            return_value=_user("admin"),
        ) as update_mock:
            response = await update_admin_user(
                "cccccccc-cccc-cccc-cccc-cccccccccccc",
                UpdateAdminUserRequest(role="admin", lab_name="ww"),
                _admin=_admin_member(),
            )

        with patch("app.routers.admin.revoke_user_access") as revoke_mock:
            revoke_response = await revoke_admin_user_access(
                "cccccccc-cccc-cccc-cccc-cccccccccccc",
                _admin=_admin_member(),
            )

        assert response.role == "admin"
        assert revoke_response.status_code == 204
        update_mock.assert_called_once()
        revoke_mock.assert_called_once_with("cccccccc-cccc-cccc-cccc-cccccccccccc")

    async def test_final_admin_guard_maps_to_409(self) -> None:
        with patch(
            "app.routers.admin.revoke_user_access",
            side_effect=ValueError("Cannot revoke the last active admin."),
        ):
            with self.assertRaises(Exception) as exc_info:
                await revoke_admin_user_access(
                    "cccccccc-cccc-cccc-cccc-cccccccccccc",
                    _admin=_admin_member(),
                )

        assert exc_info.exception.status_code == 409
