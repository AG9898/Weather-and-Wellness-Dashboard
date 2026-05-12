"""Invite token service for app-owned RA/admin onboarding (T151).

Implements the full token lifecycle: generate → create → validate → accept/revoke/resend.
No HTTP routes are exposed here; router tasks call these functions.

Security invariant: raw tokens are never persisted. Only SHA-256 hashes are
stored in ra_invitations.token_hash. Resending rotates the token so old links
are invalidated.
"""
from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invitations import RAInvitation
from app.services.email_service import EmailProvider, get_email_provider

_DEFAULT_EXPIRY_DAYS = 7
_SITE_NAME = "UBC Psychology Lab Research Platform"


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class InviteError(Exception):
    """Base class for invite service errors."""


class DuplicatePendingInviteError(InviteError):
    """A non-expired pending invite already exists for this email address."""


class InviteNotFoundError(InviteError):
    """No invite matches the given token or invitation_id."""


class InviteExpiredError(InviteError):
    """The invite exists but has passed its expires_at timestamp."""


class InviteAlreadyUsedError(InviteError):
    """The invite was already accepted or revoked."""


# ---------------------------------------------------------------------------
# Token primitives
# ---------------------------------------------------------------------------


def generate_token() -> str:
    """Return a cryptographically random invite token (256 bits of entropy)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest of a raw invite token."""
    return hashlib.sha256(token.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def _invite_url(raw_token: str) -> str:
    site_url = os.getenv("SITE_URL", "http://localhost:3000").rstrip("/")
    return f"{site_url}/set-password?invite={raw_token}"


def _role_label(role: str) -> str:
    return {"admin": "Admin", "ra": "Research Assistant"}.get(role, role.title())


def _format_expires(expires_at: datetime) -> str:
    utc = expires_at.astimezone(timezone.utc)
    return utc.strftime("%B %-d, %Y at %H:%M UTC")


def _support_email() -> str:
    return os.getenv("ADMIN_EMAIL_FROM") or ""


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------


@dataclass
class CreateInviteResult:
    invitation: RAInvitation
    raw_token: str


async def create_invite(
    db: AsyncSession,
    *,
    email: str,
    role: str,
    lab_name: str,
    created_by_lab_member_id: uuid.UUID,
    expiry_days: int = _DEFAULT_EXPIRY_DAYS,
    email_provider: EmailProvider | None = None,
    send_email: bool = True,
) -> CreateInviteResult:
    """Create a pending invite record and optionally send the invite email.

    Raises DuplicatePendingInviteError when a non-expired, pending invite
    already exists for this email. Email is sent before the DB write is
    committed, so a send failure leaves the database unchanged.

    Returns CreateInviteResult with the persisted record and the raw token.
    The raw token must be discarded after building the invite URL — it is not
    stored anywhere.
    """
    normalized = email.strip().lower()
    now = _now_utc()

    existing = (
        await db.execute(
            select(RAInvitation).where(
                RAInvitation.email == normalized,
                RAInvitation.status == "pending",
                RAInvitation.expires_at > now,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise DuplicatePendingInviteError(
            f"A pending invite for {normalized!r} already exists."
        )

    raw_token = generate_token()
    expires_at = now + timedelta(days=expiry_days)

    provider_message_id: str | None = None
    if send_email:
        provider = email_provider or get_email_provider()
        result = provider.send_invite_email(
            to_email=normalized,
            invite_url=_invite_url(raw_token),
            role_label=_role_label(role),
            lab_name=lab_name,
            expires_at=_format_expires(expires_at),
            site_name=_SITE_NAME,
            support_email=_support_email(),
        )
        provider_message_id = result.provider_message_id

    invitation = RAInvitation(
        email=normalized,
        role=role,
        lab_name=lab_name,
        token_hash=hash_token(raw_token),
        status="pending",
        expires_at=expires_at,
        created_by_lab_member_id=created_by_lab_member_id,
        last_sent_at=now if send_email else None,
        send_count=1 if send_email else 0,
        provider_message_id=provider_message_id,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    return CreateInviteResult(invitation=invitation, raw_token=raw_token)


async def validate_token(db: AsyncSession, *, token: str) -> RAInvitation:
    """Return the RAInvitation for a valid, unexpired, pending token.

    Raises:
        InviteNotFoundError — no invite matches this token hash
        InviteAlreadyUsedError — invite was accepted or revoked
        InviteExpiredError — invite exists but has passed expires_at
    """
    token_hash = hash_token(token)
    invitation = (
        await db.execute(
            select(RAInvitation).where(RAInvitation.token_hash == token_hash)
        )
    ).scalar_one_or_none()

    if invitation is None:
        raise InviteNotFoundError("Invite token not found.")
    if invitation.status in ("accepted", "revoked"):
        raise InviteAlreadyUsedError(
            f"This invite has already been {invitation.status}."
        )
    if invitation.expires_at <= _now_utc():
        raise InviteExpiredError("This invite has expired.")
    return invitation


async def resend_invite(
    db: AsyncSession,
    *,
    invitation_id: uuid.UUID,
    email_provider: EmailProvider | None = None,
) -> RAInvitation:
    """Re-send an invite email and rotate the token.

    Rotating the token invalidates previously sent links. Updates last_sent_at,
    increments send_count, and records provider_message_id.

    Raises:
        InviteNotFoundError — no invite with this ID
        InviteAlreadyUsedError — already accepted or revoked
        InviteExpiredError — invite has passed its expires_at
    """
    invitation = (
        await db.execute(
            select(RAInvitation).where(RAInvitation.invitation_id == invitation_id)
        )
    ).scalar_one_or_none()

    if invitation is None:
        raise InviteNotFoundError(f"Invite {invitation_id} not found.")
    if invitation.status in ("accepted", "revoked"):
        raise InviteAlreadyUsedError(
            f"This invite has already been {invitation.status}."
        )
    now = _now_utc()
    if invitation.expires_at <= now:
        raise InviteExpiredError("This invite has expired.")

    raw_token = generate_token()
    provider = email_provider or get_email_provider()
    result = provider.send_invite_email(
        to_email=invitation.email,
        invite_url=_invite_url(raw_token),
        role_label=_role_label(invitation.role),
        lab_name=invitation.lab_name,
        expires_at=_format_expires(invitation.expires_at),
        site_name=_SITE_NAME,
        support_email=_support_email(),
    )

    invitation.token_hash = hash_token(raw_token)
    invitation.last_sent_at = now
    invitation.send_count = (invitation.send_count or 0) + 1
    invitation.provider_message_id = result.provider_message_id
    invitation.updated_at = now
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def revoke_invite(
    db: AsyncSession,
    *,
    invitation_id: uuid.UUID,
    revoked_by_lab_member_id: uuid.UUID,
) -> RAInvitation:
    """Revoke a pending or expired invitation.

    Raises:
        InviteNotFoundError — no invite with this ID
        InviteAlreadyUsedError — already accepted; accepted invites cannot be revoked
    """
    invitation = (
        await db.execute(
            select(RAInvitation).where(RAInvitation.invitation_id == invitation_id)
        )
    ).scalar_one_or_none()

    if invitation is None:
        raise InviteNotFoundError(f"Invite {invitation_id} not found.")
    if invitation.status == "accepted":
        raise InviteAlreadyUsedError("Cannot revoke an already accepted invite.")

    now = _now_utc()
    invitation.status = "revoked"
    invitation.revoked_at = now
    invitation.revoked_by_lab_member_id = revoked_by_lab_member_id
    invitation.updated_at = now
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def accept_invite(
    db: AsyncSession,
    *,
    token: str,
    supabase_user_id: uuid.UUID | None = None,
) -> RAInvitation:
    """Mark a valid pending invite as accepted.

    Validates the token first. Optionally links the resulting Supabase Auth
    user ID.

    Raises: InviteNotFoundError, InviteExpiredError, InviteAlreadyUsedError
    """
    invitation = await validate_token(db, token=token)
    now = _now_utc()
    invitation.status = "accepted"
    invitation.accepted_at = now
    invitation.updated_at = now
    if supabase_user_id is not None:
        invitation.supabase_user_id = supabase_user_id
    await db.commit()
    await db.refresh(invitation)
    return invitation


__all__ = [
    "InviteError",
    "DuplicatePendingInviteError",
    "InviteNotFoundError",
    "InviteExpiredError",
    "InviteAlreadyUsedError",
    "generate_token",
    "hash_token",
    "CreateInviteResult",
    "create_invite",
    "validate_token",
    "resend_invite",
    "revoke_invite",
    "accept_invite",
]
