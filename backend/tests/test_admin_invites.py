"""Tests for T151: admin invite token service and email provider.

Covers:
- create_invite: success, duplicate pending invite, email failure
- validate_token: success, not found, expired, already accepted/revoked
- resend_invite: success, updates last_sent_at/send_count/provider_message_id, expired/used
- revoke_invite: success, not found, already accepted
- accept_invite: success (delegates to validate_token)
- email_service: ResendEmailProvider sends correct payload, propagates HTTP errors
- Token generation/hashing: sufficient entropy, only hash persisted
"""
from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.admin_invite_service import (
    CreateInviteResult,
    DuplicatePendingInviteError,
    InviteAlreadyUsedError,
    InviteExpiredError,
    InviteNotFoundError,
    accept_invite,
    create_invite,
    generate_token,
    hash_token,
    resend_invite,
    revoke_invite,
    validate_token,
)
from app.services.email_service import (
    EmailSendResult,
    ResendEmailProvider,
    get_email_provider,
)
from app.models.invitations import RAInvitation

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CREATOR_ID = uuid.uuid4()
_REVOKER_ID = uuid.uuid4()
_INVITE_ID = uuid.uuid4()

_NOW = datetime.now(tz=timezone.utc)
_FUTURE = _NOW + timedelta(days=7)
_PAST = _NOW - timedelta(seconds=1)


def _make_invitation(
    *,
    invitation_id: uuid.UUID | None = None,
    email: str = "ra@lab.test",
    role: str = "ra",
    lab_name: str = "ww",
    status: str = "pending",
    expires_at: datetime | None = None,
    send_count: int = 1,
    provider_message_id: str | None = "msg-001",
    token_hash: str = "abc123",
) -> RAInvitation:
    inv = MagicMock(spec=RAInvitation)
    inv.invitation_id = invitation_id or uuid.uuid4()
    inv.email = email
    inv.role = role
    inv.lab_name = lab_name
    inv.status = status
    inv.expires_at = expires_at if expires_at is not None else _FUTURE
    inv.send_count = send_count
    inv.provider_message_id = provider_message_id
    inv.token_hash = token_hash
    return inv


def _mock_db(scalar_result=None) -> AsyncMock:
    """Return an AsyncMock session where execute().scalar_one_or_none() returns scalar_result."""
    db = AsyncMock()
    # add() is synchronous in SQLAlchemy — use MagicMock to avoid coroutine warnings
    db.add = MagicMock()
    execute_result = MagicMock()
    execute_result.scalar_one_or_none.return_value = scalar_result
    db.execute.return_value = execute_result
    return db


def _stub_email_provider(message_id: str | None = "msg-resend-001") -> MagicMock:
    provider = MagicMock()
    provider.send_invite_email.return_value = EmailSendResult(
        provider_message_id=message_id
    )
    return provider


# ---------------------------------------------------------------------------
# Token primitives
# ---------------------------------------------------------------------------


class TestTokenPrimitives:
    def test_generate_token_sufficient_entropy(self) -> None:
        tokens = {generate_token() for _ in range(20)}
        assert len(tokens) == 20, "All tokens should be unique"
        for token in tokens:
            assert len(token) >= 43, "token_urlsafe(32) encodes to ≥43 chars"

    def test_hash_token_is_sha256(self) -> None:
        raw = "test-token"
        expected = hashlib.sha256(raw.encode()).hexdigest()
        assert hash_token(raw) == expected

    def test_different_tokens_different_hashes(self) -> None:
        t1, t2 = generate_token(), generate_token()
        assert hash_token(t1) != hash_token(t2)


# ---------------------------------------------------------------------------
# create_invite
# ---------------------------------------------------------------------------


class TestCreateInvite:
    def test_success_no_existing_invite(self) -> None:
        db = _mock_db(scalar_result=None)
        provider = _stub_email_provider("msg-001")

        result: CreateInviteResult = asyncio.run(
            create_invite(
                db,
                email="new@lab.test",
                role="ra",
                lab_name="ww",
                created_by_lab_member_id=_CREATOR_ID,
                email_provider=provider,
            )
        )

        assert isinstance(result.raw_token, str)
        assert len(result.raw_token) >= 43
        db.add.assert_called_once()
        db.commit.assert_called()
        provider.send_invite_email.assert_called_once()

    def test_email_lowercased_and_stripped(self) -> None:
        db = _mock_db(scalar_result=None)
        provider = _stub_email_provider()

        asyncio.run(
            create_invite(
                db,
                email="  RA@Lab.TEST  ",
                role="ra",
                lab_name="ww",
                created_by_lab_member_id=_CREATOR_ID,
                email_provider=provider,
            )
        )

        added_invite: RAInvitation = db.add.call_args[0][0]
        assert added_invite.email == "ra@lab.test"

    def test_duplicate_pending_raises(self) -> None:
        existing = _make_invitation(status="pending", expires_at=_FUTURE)
        db = _mock_db(scalar_result=existing)

        with pytest.raises(DuplicatePendingInviteError):
            asyncio.run(
                create_invite(
                    db,
                    email="ra@lab.test",
                    role="ra",
                    lab_name="ww",
                    created_by_lab_member_id=_CREATOR_ID,
                )
            )
        db.add.assert_not_called()
        assert db.execute.await_count == 1

    def test_success_retires_expired_pending_invite_before_insert(self) -> None:
        db = _mock_db(scalar_result=None)
        provider = _stub_email_provider()

        asyncio.run(
            create_invite(
                db,
                email="ra@lab.test",
                role="ra",
                lab_name="ww",
                created_by_lab_member_id=_CREATOR_ID,
                email_provider=provider,
            )
        )

        assert db.execute.await_count == 2
        assert db.add.call_args[0][0].status == "pending"
        db.commit.assert_called_once()

    def test_email_failure_propagates_without_db_write(self) -> None:
        db = _mock_db(scalar_result=None)
        bad_provider = MagicMock()
        bad_provider.send_invite_email.side_effect = httpx.HTTPStatusError(
            "422", request=MagicMock(), response=MagicMock()
        )

        with pytest.raises(httpx.HTTPStatusError):
            asyncio.run(
                create_invite(
                    db,
                    email="fail@lab.test",
                    role="ra",
                    lab_name="ww",
                    created_by_lab_member_id=_CREATOR_ID,
                    email_provider=bad_provider,
                )
            )
        db.add.assert_not_called()
        db.commit.assert_not_called()

    def test_send_email_false_skips_provider(self) -> None:
        db = _mock_db(scalar_result=None)
        provider = _stub_email_provider()

        asyncio.run(
            create_invite(
                db,
                email="quiet@lab.test",
                role="ra",
                lab_name="ww",
                created_by_lab_member_id=_CREATOR_ID,
                email_provider=provider,
                send_email=False,
            )
        )

        provider.send_invite_email.assert_not_called()
        db.add.assert_called_once()

    def test_provider_message_id_stored(self) -> None:
        db = _mock_db(scalar_result=None)
        provider = _stub_email_provider("specific-msg-id")

        asyncio.run(
            create_invite(
                db,
                email="check@lab.test",
                role="ra",
                lab_name="ww",
                created_by_lab_member_id=_CREATOR_ID,
                email_provider=provider,
            )
        )

        added: RAInvitation = db.add.call_args[0][0]
        assert added.provider_message_id == "specific-msg-id"


# ---------------------------------------------------------------------------
# validate_token
# ---------------------------------------------------------------------------


class TestValidateToken:
    def test_valid_pending_token(self) -> None:
        raw = generate_token()
        inv = _make_invitation(
            token_hash=hash_token(raw),
            status="pending",
            expires_at=_FUTURE,
        )
        db = _mock_db(scalar_result=inv)

        result = asyncio.run(validate_token(db, token=raw))
        assert result is inv

    def test_not_found_raises(self) -> None:
        db = _mock_db(scalar_result=None)
        with pytest.raises(InviteNotFoundError):
            asyncio.run(validate_token(db, token=generate_token()))

    def test_expired_raises(self) -> None:
        raw = generate_token()
        inv = _make_invitation(
            token_hash=hash_token(raw),
            status="pending",
            expires_at=_PAST,
        )
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteExpiredError):
            asyncio.run(validate_token(db, token=raw))

    def test_accepted_raises(self) -> None:
        raw = generate_token()
        inv = _make_invitation(
            token_hash=hash_token(raw),
            status="accepted",
            expires_at=_FUTURE,
        )
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteAlreadyUsedError):
            asyncio.run(validate_token(db, token=raw))

    def test_revoked_raises(self) -> None:
        raw = generate_token()
        inv = _make_invitation(
            token_hash=hash_token(raw),
            status="revoked",
            expires_at=_FUTURE,
        )
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteAlreadyUsedError):
            asyncio.run(validate_token(db, token=raw))


# ---------------------------------------------------------------------------
# resend_invite
# ---------------------------------------------------------------------------


class TestResendInvite:
    def test_success_updates_counters_and_token(self) -> None:
        inv = _make_invitation(status="pending", expires_at=_FUTURE, send_count=1)
        original_hash = inv.token_hash
        db = _mock_db(scalar_result=inv)
        provider = _stub_email_provider("new-msg-id")

        asyncio.run(
            resend_invite(db, invitation_id=inv.invitation_id, email_provider=provider)
        )

        assert inv.send_count == 2
        assert inv.provider_message_id == "new-msg-id"
        # Token hash must have been rotated
        assert inv.token_hash != original_hash
        db.commit.assert_called()

    def test_resend_not_found_raises(self) -> None:
        db = _mock_db(scalar_result=None)
        with pytest.raises(InviteNotFoundError):
            asyncio.run(resend_invite(db, invitation_id=uuid.uuid4()))

    def test_resend_expired_raises(self) -> None:
        inv = _make_invitation(status="pending", expires_at=_PAST)
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteExpiredError):
            asyncio.run(resend_invite(db, invitation_id=inv.invitation_id))

    def test_resend_accepted_raises(self) -> None:
        inv = _make_invitation(status="accepted", expires_at=_FUTURE)
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteAlreadyUsedError):
            asyncio.run(resend_invite(db, invitation_id=inv.invitation_id))

    def test_resend_email_failure_does_not_commit(self) -> None:
        inv = _make_invitation(status="pending", expires_at=_FUTURE)
        db = _mock_db(scalar_result=inv)
        bad_provider = MagicMock()
        bad_provider.send_invite_email.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock()
        )

        with pytest.raises(httpx.HTTPStatusError):
            asyncio.run(
                resend_invite(
                    db, invitation_id=inv.invitation_id, email_provider=bad_provider
                )
            )
        db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# revoke_invite
# ---------------------------------------------------------------------------


class TestRevokeInvite:
    def test_success_sets_revoked_fields(self) -> None:
        inv = _make_invitation(status="pending", expires_at=_FUTURE)
        db = _mock_db(scalar_result=inv)

        asyncio.run(
            revoke_invite(
                db,
                invitation_id=inv.invitation_id,
                revoked_by_lab_member_id=_REVOKER_ID,
            )
        )

        assert inv.status == "revoked"
        assert inv.revoked_at is not None
        assert inv.revoked_by_lab_member_id == _REVOKER_ID
        db.commit.assert_called()

    def test_revoke_not_found_raises(self) -> None:
        db = _mock_db(scalar_result=None)
        with pytest.raises(InviteNotFoundError):
            asyncio.run(
                revoke_invite(
                    db,
                    invitation_id=uuid.uuid4(),
                    revoked_by_lab_member_id=_REVOKER_ID,
                )
            )

    def test_revoke_accepted_raises(self) -> None:
        inv = _make_invitation(status="accepted", expires_at=_FUTURE)
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteAlreadyUsedError):
            asyncio.run(
                revoke_invite(
                    db,
                    invitation_id=inv.invitation_id,
                    revoked_by_lab_member_id=_REVOKER_ID,
                )
            )

    def test_revoke_expired_invite_succeeds(self) -> None:
        inv = _make_invitation(status="pending", expires_at=_PAST)
        db = _mock_db(scalar_result=inv)

        asyncio.run(
            revoke_invite(
                db,
                invitation_id=inv.invitation_id,
                revoked_by_lab_member_id=_REVOKER_ID,
            )
        )
        assert inv.status == "revoked"


# ---------------------------------------------------------------------------
# accept_invite
# ---------------------------------------------------------------------------


class TestAcceptInvite:
    def test_success_marks_accepted(self) -> None:
        raw = generate_token()
        supabase_uid = uuid.uuid4()
        inv = _make_invitation(
            token_hash=hash_token(raw), status="pending", expires_at=_FUTURE
        )
        db = _mock_db(scalar_result=inv)

        asyncio.run(accept_invite(db, token=raw, supabase_user_id=supabase_uid))

        assert inv.status == "accepted"
        assert inv.accepted_at is not None
        assert inv.supabase_user_id == supabase_uid
        db.commit.assert_called()

    def test_accept_expired_raises(self) -> None:
        raw = generate_token()
        inv = _make_invitation(
            token_hash=hash_token(raw), status="pending", expires_at=_PAST
        )
        db = _mock_db(scalar_result=inv)
        with pytest.raises(InviteExpiredError):
            asyncio.run(accept_invite(db, token=raw))


# ---------------------------------------------------------------------------
# ResendEmailProvider
# ---------------------------------------------------------------------------


class TestResendEmailProvider:
    def _provider(self) -> ResendEmailProvider:
        return ResendEmailProvider(api_key="test-key", from_email="no-reply@test.com")

    def test_send_builds_correct_request(self) -> None:
        provider = self._provider()
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"id": "resend-123"}

        with patch("httpx.post", return_value=mock_resp) as mock_post:
            result = provider.send_invite_email(
                to_email="user@lab.test",
                invite_url="https://app.test/set-password?invite=tok",
                role_label="Research Assistant",
                lab_name="WW Lab",
                expires_at="May 19, 2026 at 12:00 UTC",
                site_name="Test Platform",
                support_email="support@test.com",
            )

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["to"] == ["user@lab.test"]
        assert "Test Platform" in call_kwargs["json"]["subject"]
        assert result.provider_message_id == "resend-123"

    def test_send_http_error_propagates(self) -> None:
        provider = self._provider()
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 422
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "422", request=MagicMock(), response=mock_resp
        )

        with patch("httpx.post", return_value=mock_resp):
            with pytest.raises(httpx.HTTPStatusError):
                provider.send_invite_email(
                    to_email="user@lab.test",
                    invite_url="https://app.test/set-password?invite=tok",
                    role_label="Research Assistant",
                    lab_name="WW Lab",
                    expires_at="May 19, 2026 at 12:00 UTC",
                    site_name="Test Platform",
                    support_email="support@test.com",
                )

    def test_templates_rendered_no_raw_placeholder(self) -> None:
        provider = self._provider()
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"id": "x"}

        with patch("httpx.post", return_value=mock_resp) as mock_post:
            provider.send_invite_email(
                to_email="user@lab.test",
                invite_url="https://app.test/set-password?invite=TOKEN123",
                role_label="Admin",
                lab_name="WW",
                expires_at="May 19, 2026",
                site_name="Platform",
                support_email="support@test.com",
            )

        payload = mock_post.call_args.kwargs["json"]
        # No unreplaced placeholders remain
        assert "{{" not in payload["html"]
        assert "{{" not in payload["text"]
        # Token appears in invite_url
        assert "TOKEN123" in payload["html"]

    def test_get_email_provider_returns_resend(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "resend")
        provider = get_email_provider()
        assert isinstance(provider, ResendEmailProvider)

    def test_get_email_provider_unknown_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("INVITE_EMAIL_PROVIDER", "unknown_provider")
        with pytest.raises(ValueError, match="Unsupported"):
            get_email_provider()
