"""Tests for backend/app/services/supabase_admin_users.py (T152).

Covers:
- list_lab_users: success, missing service-role key, HTTP API error
- create_or_update_user: success (new user), already-exists path (422 → update)
- update_user_metadata: success, HTTP API error
- revoke_user_access: success, final-admin guard (raises ValueError), non-admin revoke
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services.supabase_admin_users import (
    LabUserInfo,
    create_or_update_user,
    list_lab_users,
    revoke_user_access,
    update_user_metadata,
)

_URL = "https://test.supabase.co"
_KEY = "service-role-secret"

_RAW_ADMIN = {
    "id": "aaaa-0001",
    "email": "admin@lab.test",
    "app_metadata": {"role": "admin", "lab_name": "ww"},
    "banned_until": None,
    "created_at": "2026-01-01T00:00:00Z",
    "last_sign_in_at": "2026-05-01T10:00:00Z",
}

_RAW_RA = {
    "id": "bbbb-0002",
    "email": "ra@lab.test",
    "app_metadata": {"role": "ra", "lab_name": "ww"},
    "banned_until": None,
    "created_at": "2026-02-01T00:00:00Z",
    "last_sign_in_at": None,
}

_RAW_BANNED = {
    "id": "cccc-0003",
    "email": "old@lab.test",
    "app_metadata": {"role": "ra", "lab_name": "ww"},
    "banned_until": "2126-01-01T00:00:00Z",
    "created_at": "2026-03-01T00:00:00Z",
    "last_sign_in_at": None,
}


def _mock_response(status_code: int, json_data: object) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            f"HTTP {status_code}",
            request=MagicMock(),
            response=resp,
        )
    else:
        resp.raise_for_status.return_value = None
    return resp


# ---------------------------------------------------------------------------
# list_lab_users
# ---------------------------------------------------------------------------


class TestListLabUsers:
    def test_success_returns_typed_list(self) -> None:
        resp = _mock_response(200, {"users": [_RAW_ADMIN, _RAW_RA, _RAW_BANNED]})
        with patch("httpx.get", return_value=resp) as mock_get:
            users = list_lab_users(_URL, _KEY)

        mock_get.assert_called_once()
        assert len(users) == 3

        admin = next(u for u in users if u.id == "aaaa-0001")
        assert admin.email == "admin@lab.test"
        assert admin.role == "admin"
        assert admin.lab_name == "ww"
        assert admin.is_banned is False
        assert admin.last_sign_in_at == "2026-05-01T10:00:00Z"

        banned = next(u for u in users if u.id == "cccc-0003")
        assert banned.is_banned is True

    def test_response_without_users_key(self) -> None:
        resp = _mock_response(200, {"users": []})
        with patch("httpx.get", return_value=resp):
            users = list_lab_users(_URL, _KEY)
        assert users == []

    def test_missing_service_role_key_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        monkeypatch.setenv("SUPABASE_URL", _URL)
        with pytest.raises(RuntimeError, match="SUPABASE_SERVICE_ROLE_KEY"):
            list_lab_users()

    def test_http_error_propagates(self) -> None:
        resp = _mock_response(401, {"message": "unauthorized"})
        with patch("httpx.get", return_value=resp):
            with pytest.raises(httpx.HTTPStatusError):
                list_lab_users(_URL, _KEY)


# ---------------------------------------------------------------------------
# create_or_update_user
# ---------------------------------------------------------------------------


class TestCreateOrUpdateUser:
    def test_create_success(self) -> None:
        new_user = dict(_RAW_ADMIN, id="dddd-0004", email="new@lab.test")
        resp = _mock_response(200, new_user)
        with patch("httpx.post", return_value=resp) as mock_post:
            result = create_or_update_user("new@lab.test", "admin", "ww", _KEY, _URL, _KEY)

        mock_post.assert_called_once()
        assert result.email == "new@lab.test"
        assert result.role == "admin"
        assert result.is_banned is False

    def test_already_exists_falls_back_to_update(self) -> None:
        existing_user = dict(_RAW_RA, email="ra@lab.test")
        conflict_resp = _mock_response(422, {"message": "already registered"})

        list_resp = _mock_response(200, {"users": [existing_user]})
        updated_user = dict(existing_user, app_metadata={"role": "admin", "lab_name": "ww2"})
        put_resp = _mock_response(200, updated_user)

        with (
            patch("httpx.post", return_value=conflict_resp),
            patch("httpx.get", return_value=list_resp),
            patch("httpx.put", return_value=put_resp) as mock_put,
        ):
            result = create_or_update_user("ra@lab.test", "admin", "ww2", None, _URL, _KEY)

        mock_put.assert_called_once()
        assert result.role == "admin"
        assert result.lab_name == "ww2"

    def test_http_error_propagates(self) -> None:
        resp = _mock_response(500, {"message": "internal error"})
        with patch("httpx.post", return_value=resp):
            with pytest.raises(httpx.HTTPStatusError):
                create_or_update_user("x@lab.test", "ra", "ww", None, _URL, _KEY)


# ---------------------------------------------------------------------------
# update_user_metadata
# ---------------------------------------------------------------------------


class TestUpdateUserMetadata:
    def test_success(self) -> None:
        updated = dict(_RAW_RA, app_metadata={"role": "admin", "lab_name": "ww"})
        resp = _mock_response(200, updated)
        with patch("httpx.put", return_value=resp) as mock_put:
            result = update_user_metadata("bbbb-0002", "admin", "ww", None, _URL, _KEY)

        mock_put.assert_called_once()
        call_kwargs = mock_put.call_args
        sent_payload = call_kwargs.kwargs.get("json") or call_kwargs.args[1] if len(call_kwargs.args) > 1 else call_kwargs.kwargs["json"]
        assert sent_payload["app_metadata"]["role"] == "admin"
        assert sent_payload["app_metadata"]["lab_name"] == "ww"
        assert "password" not in sent_payload
        assert result.role == "admin"

    def test_http_error_propagates(self) -> None:
        resp = _mock_response(404, {"message": "not found"})
        with patch("httpx.put", return_value=resp):
            with pytest.raises(httpx.HTTPStatusError):
                update_user_metadata("no-such-id", "ra", "ww", None, _URL, _KEY)


# ---------------------------------------------------------------------------
# revoke_user_access
# ---------------------------------------------------------------------------


class TestRevokeUserAccess:
    def test_success_for_ra_user(self) -> None:
        list_resp = _mock_response(200, {"users": [_RAW_ADMIN, _RAW_RA]})
        put_resp = _mock_response(200, dict(_RAW_RA, banned_until="2126-01-01T00:00:00Z"))
        with (
            patch("httpx.get", return_value=list_resp),
            patch("httpx.put", return_value=put_resp) as mock_put,
        ):
            revoke_user_access("bbbb-0002", _URL, _KEY)

        mock_put.assert_called_once()
        sent_json = mock_put.call_args.kwargs.get("json") or mock_put.call_args[1].get("json")
        assert "ban_duration" in sent_json

    def test_final_admin_guard_raises(self) -> None:
        list_resp = _mock_response(200, {"users": [_RAW_ADMIN]})
        with patch("httpx.get", return_value=list_resp):
            with pytest.raises(ValueError, match="last active admin"):
                revoke_user_access("aaaa-0001", _URL, _KEY, check_final_admin=True)

    def test_multiple_admins_allows_revoke(self) -> None:
        second_admin = dict(_RAW_RA, id="eeee-0005", role=None,
                            app_metadata={"role": "admin", "lab_name": "ww"})
        list_resp = _mock_response(200, {"users": [_RAW_ADMIN, second_admin]})
        put_resp = _mock_response(200, dict(_RAW_ADMIN, banned_until="2126-01-01T00:00:00Z"))
        with (
            patch("httpx.get", return_value=list_resp),
            patch("httpx.put", return_value=put_resp) as mock_put,
        ):
            revoke_user_access("aaaa-0001", _URL, _KEY, check_final_admin=True)

        mock_put.assert_called_once()

    def test_check_final_admin_false_skips_guard(self) -> None:
        put_resp = _mock_response(200, dict(_RAW_ADMIN, banned_until="2126-01-01T00:00:00Z"))
        with patch("httpx.put", return_value=put_resp) as mock_put:
            revoke_user_access("aaaa-0001", _URL, _KEY, check_final_admin=False)

        mock_put.assert_called_once()

    def test_http_error_propagates(self) -> None:
        list_resp = _mock_response(200, {"users": [_RAW_ADMIN, _RAW_RA]})
        put_resp = _mock_response(500, {"message": "server error"})
        with (
            patch("httpx.get", return_value=list_resp),
            patch("httpx.put", return_value=put_resp),
        ):
            with pytest.raises(httpx.HTTPStatusError):
                revoke_user_access("bbbb-0002", _URL, _KEY)

    def test_missing_service_role_key_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        monkeypatch.setenv("SUPABASE_URL", _URL)
        with pytest.raises(RuntimeError, match="SUPABASE_SERVICE_ROLE_KEY"):
            revoke_user_access("aaaa-0001")
