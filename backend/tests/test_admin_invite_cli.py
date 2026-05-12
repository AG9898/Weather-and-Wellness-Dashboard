from __future__ import annotations

import argparse
import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from admin_cli import invite_user
from app.services.admin_invite_service import DuplicatePendingInviteError


_CREATOR_ID = uuid.uuid4()


class _FakeSession:
    async def __aenter__(self) -> "_FakeSession":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


def _args(**overrides: object) -> argparse.Namespace:
    defaults = {
        "email": "RA@Lab.TEST",
        "role": "ra",
        "lab_name": "ww",
        "site_url": None,
        "redirect_to": None,
        "created_by_lab_member_id": str(_CREATOR_ID),
    }
    defaults.update(overrides)
    return argparse.Namespace(**defaults)


def _set_required_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://example")
    monkeypatch.setenv("SITE_URL", "https://app.test")
    monkeypatch.setenv("RESEND_API_KEY", "resend-key")
    monkeypatch.setenv("ADMIN_EMAIL_FROM", "team@app.test")


def test_cli_creates_app_owned_invite_with_service(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    fake_create = AsyncMock()
    fake_create.return_value = SimpleNamespace(
        invitation=SimpleNamespace(
            invitation_id=uuid.uuid4(),
            email="ra@lab.test",
            role="ra",
            lab_name="ww",
            expires_at=datetime(2026, 5, 19, tzinfo=timezone.utc),
            send_count=1,
        )
    )
    monkeypatch.setattr(invite_user, "create_invite", fake_create)
    monkeypatch.setattr(invite_user, "get_session_factory", lambda: _FakeSession)

    result = asyncio.run(invite_user._run_invite(_args()))

    assert result == 0
    fake_create.assert_awaited_once()
    positional, kwargs = fake_create.await_args
    assert isinstance(positional[0], _FakeSession)
    assert kwargs["email"] == "RA@Lab.TEST"
    assert kwargs["role"] == "ra"
    assert kwargs["lab_name"] == "ww"
    assert kwargs["created_by_lab_member_id"] == _CREATOR_ID


def test_cli_supports_redirect_to_as_site_url_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_required_env(monkeypatch)
    fake_create = AsyncMock()
    fake_create.return_value = SimpleNamespace(
        invitation=SimpleNamespace(
            invitation_id=uuid.uuid4(),
            email="admin@lab.test",
            role="admin",
            lab_name="",
            expires_at=datetime(2026, 5, 19, tzinfo=timezone.utc),
            send_count=1,
        )
    )
    monkeypatch.setattr(invite_user, "create_invite", fake_create)
    monkeypatch.setattr(invite_user, "get_session_factory", lambda: _FakeSession)

    asyncio.run(
        invite_user._run_invite(
            _args(
                email="admin@lab.test",
                role="admin",
                lab_name="",
                redirect_to="https://custom.test/set-password",
            )
        )
    )

    assert invite_user.os.environ["SITE_URL"] == "https://custom.test"


def test_cli_reports_duplicate_pending_invite(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    fake_create = AsyncMock(side_effect=DuplicatePendingInviteError("duplicate"))
    monkeypatch.setattr(invite_user, "create_invite", fake_create)
    monkeypatch.setattr(invite_user, "get_session_factory", lambda: _FakeSession)

    with pytest.raises(SystemExit, match="pending invite already exists"):
        asyncio.run(invite_user._run_invite(_args()))


def test_cli_requires_email_provider_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.delenv("RESEND_API_KEY", raising=False)

    with pytest.raises(SystemExit, match="RESEND_API_KEY"):
        asyncio.run(invite_user._run_invite(_args()))


def test_cli_requires_creator_id(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_required_env(monkeypatch)
    monkeypatch.delenv("ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID", raising=False)

    with pytest.raises(SystemExit, match="Missing creator UUID"):
        asyncio.run(invite_user._run_invite(_args(created_by_lab_member_id=None)))


def test_cli_no_longer_uses_supabase_generate_link() -> None:
    source = invite_user.Path(invite_user.__file__).read_text(encoding="utf-8")
    assert "generate_link" not in source
    assert "/auth/v1/invite" not in source
