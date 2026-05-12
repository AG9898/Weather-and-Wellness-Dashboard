"""Transactional email provider abstraction for admin invite emails.

Supports Resend (INVITE_EMAIL_PROVIDER=resend, the only implemented provider).
AWS SES or other providers can be swapped in later without changing callers.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable

import httpx


_TEMPLATE_DIR = Path(__file__).parent / "email_templates"


def _render_template(template_name: str, **context: str) -> str:
    """Render a template file by substituting {{key}} placeholders."""
    content = (_TEMPLATE_DIR / template_name).read_text(encoding="utf-8")
    for key, value in context.items():
        content = content.replace("{{" + key + "}}", value)
    return content


@dataclass
class EmailSendResult:
    provider_message_id: str | None


@runtime_checkable
class EmailProvider(Protocol):
    def send_invite_email(
        self,
        *,
        to_email: str,
        invite_url: str,
        role_label: str,
        lab_name: str,
        expires_at: str,
        site_name: str,
        support_email: str,
    ) -> EmailSendResult:
        ...


class ResendEmailProvider:
    """Resend (resend.com) transactional email provider."""

    _API_URL = "https://api.resend.com/emails"

    def __init__(
        self,
        api_key: str | None = None,
        from_email: str | None = None,
    ) -> None:
        self._api_key = api_key or os.getenv("RESEND_API_KEY") or ""
        self._from_email = from_email or os.getenv("ADMIN_EMAIL_FROM") or ""

    def send_invite_email(
        self,
        *,
        to_email: str,
        invite_url: str,
        role_label: str,
        lab_name: str,
        expires_at: str,
        site_name: str,
        support_email: str,
    ) -> EmailSendResult:
        context = {
            "invite_url": invite_url,
            "recipient_email": to_email.lower(),
            "role_label": role_label,
            "lab_name": lab_name,
            "expires_at": expires_at,
            "site_name": site_name,
            "support_email": support_email,
        }
        html_body = _render_template("admin_invite.html", **context)
        text_body = _render_template("admin_invite.txt", **context)

        resp = httpx.post(
            self._API_URL,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": self._from_email,
                "to": [to_email],
                "subject": f"You're invited to {site_name}",
                "html": html_body,
                "text": text_body,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return EmailSendResult(provider_message_id=resp.json().get("id"))


def get_email_provider(provider_name: str | None = None) -> EmailProvider:
    """Return the configured email provider instance."""
    name = provider_name or os.getenv("INVITE_EMAIL_PROVIDER", "resend")
    if name == "resend":
        return ResendEmailProvider()
    raise ValueError(f"Unsupported INVITE_EMAIL_PROVIDER: {name!r}")


__all__ = [
    "EmailProvider",
    "EmailSendResult",
    "ResendEmailProvider",
    "get_email_provider",
]
