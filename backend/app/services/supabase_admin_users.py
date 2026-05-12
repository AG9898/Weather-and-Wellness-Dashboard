"""Supabase Admin API client for lab member (RA/admin) user management.

Wraps the Supabase Auth Admin API using the service-role key.
All functions are server-only; never expose the service-role key to frontend.

Public functions:
    list_lab_users(supabase_url, service_role_key) -> list[LabUserInfo]
    create_or_update_user(email, role, lab_name, ...) -> LabUserInfo
    update_user_metadata(user_id, role, lab_name, ...) -> LabUserInfo
    revoke_user_access(user_id, ..., *, check_final_admin) -> None

Access revocation bans the user (ban_duration) without deleting auth.users.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


@dataclass
class LabUserInfo:
    id: str
    email: str
    role: str
    lab_name: str
    is_banned: bool
    created_at: str
    last_sign_in_at: str | None


def _get_service_role_key() -> str:
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY is not set; required for admin user management."
        )
    return key


def _get_supabase_url() -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise RuntimeError("SUPABASE_URL is not set.")
    return url


def _admin_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }


def _extract_user(user: dict) -> LabUserInfo:
    app_metadata = user.get("app_metadata") or {}
    banned_until = user.get("banned_until")
    is_banned = bool(banned_until)
    return LabUserInfo(
        id=user["id"],
        email=user.get("email") or "",
        role=app_metadata.get("role") or "ra",
        lab_name=app_metadata.get("lab_name") or "",
        is_banned=is_banned,
        created_at=user.get("created_at") or "",
        last_sign_in_at=user.get("last_sign_in_at"),
    )


def list_lab_users(
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> list[LabUserInfo]:
    """Return all Supabase Auth users with only safe fields (no secrets, no raw metadata)."""
    url = supabase_url or _get_supabase_url()
    key = service_role_key or _get_service_role_key()

    resp = httpx.get(
        f"{url}/auth/v1/admin/users",
        headers=_admin_headers(key),
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    raw_users = data.get("users", []) if isinstance(data, dict) else data
    return [_extract_user(u) for u in raw_users]


def create_or_update_user(
    email: str,
    role: str,
    lab_name: str,
    password: str | None = None,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> LabUserInfo:
    """Create a new Supabase Auth user; update metadata if one with that email already exists.

    role and lab_name are stored in app_metadata only — never trusted from the browser.
    """
    url = supabase_url or _get_supabase_url()
    key = service_role_key or _get_service_role_key()

    payload: dict = {
        "email": email,
        "email_confirm": True,
        "app_metadata": {"role": role, "lab_name": lab_name},
    }
    if password is not None:
        payload["password"] = password

    resp = httpx.post(
        f"{url}/auth/v1/admin/users",
        headers=_admin_headers(key),
        json=payload,
        timeout=10,
    )

    # 422 means the user already exists — find and update instead.
    if resp.status_code == 422:
        users = list_lab_users(url, key)
        existing = next((u for u in users if u.email.lower() == email.lower()), None)
        if existing:
            return update_user_metadata(
                user_id=existing.id,
                role=role,
                lab_name=lab_name,
                password=password,
                supabase_url=url,
                service_role_key=key,
            )

    resp.raise_for_status()
    return _extract_user(resp.json())


def update_user_metadata(
    user_id: str,
    role: str,
    lab_name: str,
    password: str | None = None,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
) -> LabUserInfo:
    """Update an existing user's app_metadata.role and app_metadata.lab_name.

    Optionally set a new password. role/lab_name are admin-only and never
    accepted from the browser without an admin-authorized request.
    """
    url = supabase_url or _get_supabase_url()
    key = service_role_key or _get_service_role_key()

    payload: dict = {
        "app_metadata": {"role": role, "lab_name": lab_name},
    }
    if password is not None:
        payload["password"] = password

    resp = httpx.put(
        f"{url}/auth/v1/admin/users/{user_id}",
        headers=_admin_headers(key),
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()
    return _extract_user(resp.json())


def revoke_user_access(
    user_id: str,
    supabase_url: str | None = None,
    service_role_key: str | None = None,
    *,
    check_final_admin: bool = True,
) -> None:
    """Revoke user access by banning (not hard-deleting) the Supabase Auth user.

    Uses ban_duration to block future logins while preserving the auth.users row
    and its audit history. Raises ValueError when check_final_admin=True and
    revoking would leave zero active admins.
    """
    url = supabase_url or _get_supabase_url()
    key = service_role_key or _get_service_role_key()

    if check_final_admin:
        users = list_lab_users(url, key)
        target = next((u for u in users if u.id == user_id), None)
        if target and target.role == "admin":
            active_admins = [u for u in users if u.role == "admin" and not u.is_banned]
            if len(active_admins) <= 1:
                raise ValueError(
                    "Cannot revoke the last active admin. Promote another user to admin first."
                )

    resp = httpx.put(
        f"{url}/auth/v1/admin/users/{user_id}",
        headers=_admin_headers(key),
        json={"ban_duration": "876600h"},  # ~100 years; preserves auth.users row
        timeout=10,
    )
    resp.raise_for_status()


__all__ = [
    "LabUserInfo",
    "list_lab_users",
    "create_or_update_user",
    "update_user_metadata",
    "revoke_user_access",
]
