#!/usr/bin/env python3
"""Admin CLI: invite a new RA or admin user and assign role + lab_name.

Uses the Supabase Admin API (service role key) via httpx.
Env vars are loaded automatically from the project root .env file.

Usage (run from repo root or backend/):
    python backend/admin_cli/invite_user.py \\
        --email user@example.com \\
        --role ra \\
        --lab-name ww

    python backend/admin_cli/invite_user.py \\
        --email admin@example.com \\
        --role admin \\
        --lab-name ""

Required env vars (loaded from root .env):
    SUPABASE_URL               Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY  Service role key — NEVER the anon key
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load env from project root .env (two levels up: backend/admin_cli/ → root)
# ---------------------------------------------------------------------------
_ROOT_ENV = Path(__file__).resolve().parent.parent.parent / ".env"
if _ROOT_ENV.exists():
    load_dotenv(_ROOT_ENV, override=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        sys.exit(f"ERROR: Required env var '{name}' is not set. Check your root .env file.")
    return value


def _jwt_role_claim(token: str) -> str | None:
    """Decode the payload of a JWT without verifying signature and return the 'role' claim."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        # Base64url decode with padding
        padding = 4 - len(parts[1]) % 4
        payload_bytes = base64.urlsafe_b64decode(parts[1] + "=" * padding)
        payload = json.loads(payload_bytes)
        return payload.get("role")
    except Exception:
        return None


def _validate_service_role_key(key: str) -> None:
    """Abort if the key looks like the anon key rather than the service role key."""
    role = _jwt_role_claim(key)
    if role == "anon":
        sys.exit(
            "ERROR: The key you provided has role='anon' — this is the anon key, not the service "
            "role key. SUPABASE_SERVICE_ROLE_KEY must be the service_role JWT from your Supabase "
            "project settings > API."
        )
    if role is not None and role != "service_role":
        sys.exit(
            f"ERROR: Unexpected JWT role claim '{role}' in SUPABASE_SERVICE_ROLE_KEY. "
            "Expected 'service_role'."
        )


def _admin_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Supabase Admin API calls
# ---------------------------------------------------------------------------

def invite_user(supabase_url: str, service_role_key: str, email: str, redirect_to: str) -> dict:
    """Send an invite email and return the created user object.
    If the email already exists, fall back to a password-recovery (magic link) flow."""
    url = f"{supabase_url}/auth/v1/invite"
    response = httpx.post(
        url,
        headers=_admin_headers(service_role_key),
        json={"email": email, "redirect_to": redirect_to},
        timeout=15,
    )
    if response.status_code in (200, 201):
        return response.json()

    body = response.json()
    if response.status_code == 422 and body.get("error_code") == "email_exists":
        print("  User already exists — sending a password-reset link instead.")
        return _generate_recovery_link(supabase_url, service_role_key, email, redirect_to)

    sys.exit(f"ERROR: Supabase invite failed (HTTP {response.status_code}):\n{response.text}")


def _generate_recovery_link(
    supabase_url: str, service_role_key: str, email: str, redirect_to: str
) -> dict:
    """Use the admin generate_link endpoint to send a password-recovery email."""
    url = f"{supabase_url}/auth/v1/admin/generate_link"
    response = httpx.post(
        url,
        headers=_admin_headers(service_role_key),
        json={"type": "recovery", "email": email, "redirect_to": redirect_to},
        timeout=15,
    )
    if response.status_code not in (200, 201):
        sys.exit(
            f"ERROR: generate_link failed (HTTP {response.status_code}):\n{response.text}"
        )
    data = response.json()
    # generate_link returns the user under data.user; normalise to same shape as invite
    return data.get("user") or data


def set_app_metadata(
    supabase_url: str,
    service_role_key: str,
    user_id: str,
    role: str,
    lab_name: str,
) -> dict:
    """Set app_metadata.role and app_metadata.lab_name on an existing user."""
    url = f"{supabase_url}/auth/v1/admin/users/{user_id}"
    response = httpx.put(
        url,
        headers=_admin_headers(service_role_key),
        json={"app_metadata": {"role": role, "lab_name": lab_name}},
        timeout=15,
    )
    if response.status_code not in (200, 201):
        sys.exit(
            f"ERROR: Supabase update_user failed (HTTP {response.status_code}):\n{response.text}"
        )
    return response.json()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Invite a new RA or admin user and assign role + lab_name via Supabase Admin API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--email", required=True, help="Email address to invite")
    parser.add_argument(
        "--role",
        required=True,
        choices=["admin", "ra"],
        help="Role to assign: 'admin' or 'ra'",
    )
    parser.add_argument(
        "--lab-name",
        required=True,
        dest="lab_name",
        help="Lab name to assign (e.g. 'ww'). Use '' for admins with no lab restriction.",
    )
    parser.add_argument(
        "--redirect-to",
        dest="redirect_to",
        default=None,
        help=(
            "URL to redirect after invite acceptance (default: SITE_URL/set-password from env). "
            "Must be in the Supabase redirect allowlist."
        ),
    )
    args = parser.parse_args()

    supabase_url = _require_env("SUPABASE_URL").rstrip("/")
    service_role_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")

    site_url = os.getenv("SITE_URL", "").rstrip("/")
    redirect_to = args.redirect_to or (f"{site_url}/set-password" if site_url else None)
    if not redirect_to:
        sys.exit(
            "ERROR: No redirect URL. Set SITE_URL in your .env or pass --redirect-to <url>."
        )

    _validate_service_role_key(service_role_key)

    print(f"Inviting {args.email} (role={args.role}, lab_name={args.lab_name!r}) ...")
    print(f"  redirect_to: {redirect_to}")

    user = invite_user(supabase_url, service_role_key, args.email, redirect_to)
    user_id: str = user.get("id", "")
    if not user_id:
        sys.exit(f"ERROR: Invite succeeded but response contained no user ID.\nResponse: {user}")

    set_app_metadata(supabase_url, service_role_key, user_id, args.role, args.lab_name)

    print(f"Success. User ID: {user_id}")
    print(f"  email    : {args.email}")
    print(f"  role     : {args.role}")
    print(f"  lab_name : {args.lab_name!r}")
    print("Invite email sent. The user must accept it before they can log in.")


if __name__ == "__main__":
    main()
