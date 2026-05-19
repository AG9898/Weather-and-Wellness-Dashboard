#!/usr/bin/env python3
"""Create and send an app-owned RA/admin invitation.

Env vars are loaded from the project root `.env` file by default. Use
`--env-file` or `--use-railway-env` to target another environment.

Usage (run from repo root or backend/):
    python backend/admin_cli/invite_user.py \\
        --email user@example.com \\
        --role ra \\
        --lab-name ww \\
        --created-by-lab-member-id 00000000-0000-0000-0000-000000000000

    python backend/admin_cli/invite_user.py \\
        --email admin@example.com \\
        --role admin \\
        --lab-name "" \\
        --site-url https://ubcpsych.com

    python backend/admin_cli/invite_user.py \\
        --use-railway-env \\
        --email user@example.com \\
        --role ra \\
        --lab-name ww \\
        --site-url https://ubcpsych.com

Required env vars:
    DATABASE_URL                      Database URL for the app-owned invite row
    RESEND_API_KEY                    Email provider API key when provider=resend
    ADMIN_EMAIL_FROM                  Verified sender for invitation emails
    SITE_URL                          App base URL for /set-password?invite=...
    ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID  Optional fallback creator UUID
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv


_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.db import get_session_factory  # noqa: E402
from app.services.admin_invite_service import (  # noqa: E402
    DuplicatePendingInviteError,
    create_invite,
)


_ROOT_ENV = _BACKEND_DIR.parent / ".env"


def _load_env_file(path: Path) -> None:
    if not path.exists():
        sys.exit(f"ERROR: Env file does not exist: {path}")
    load_dotenv(path, override=True)


def _load_railway_env(service: str, environment: str) -> None:
    command = [
        "railway",
        "variable",
        "list",
        "--service",
        service,
        "--environment",
        environment,
        "--json",
    ]
    try:
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        sys.exit("ERROR: railway CLI is not installed or not on PATH.")
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout).strip()
        sys.exit(f"ERROR: railway variable list failed: {detail}")

    try:
        variables = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        sys.exit(f"ERROR: railway variable list returned invalid JSON: {exc}")

    if not isinstance(variables, dict):
        sys.exit("ERROR: railway variable list returned an unexpected payload.")

    for key, value in variables.items():
        if isinstance(value, str):
            os.environ[key] = value


def _load_cli_environment(args: argparse.Namespace) -> None:
    if args.env_file and args.use_railway_env:
        sys.exit("ERROR: Use either --env-file or --use-railway-env, not both.")

    if args.env_file:
        _load_env_file(Path(args.env_file).expanduser())
        return

    if args.use_railway_env:
        _load_railway_env(args.railway_service, args.railway_environment)
        return

    if _ROOT_ENV.exists():
        load_dotenv(_ROOT_ENV, override=False)


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        sys.exit(f"ERROR: Required env var '{name}' is not set. Check your root .env file.")
    return value


def _normalize_site_url(value: str) -> str:
    normalized = value.strip().rstrip("/")
    suffix = "/set-password"
    if normalized.endswith(suffix):
        normalized = normalized[: -len(suffix)]
    if not normalized:
        sys.exit("ERROR: SITE_URL/--site-url must be an app base URL.")
    return normalized


def _creator_id_from_args(value: str | None) -> uuid.UUID:
    raw = value or os.getenv("ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID", "")
    if not raw.strip():
        sys.exit(
            "ERROR: Missing creator UUID. Pass --created-by-lab-member-id or set "
            "ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID in the root .env file."
        )
    try:
        return uuid.UUID(raw.strip())
    except ValueError:
        sys.exit(
            "ERROR: created-by lab member id must be a valid Supabase Auth user UUID."
        )


def _preflight_email_env() -> None:
    provider = os.getenv("INVITE_EMAIL_PROVIDER", "resend").strip() or "resend"
    if provider != "resend":
        sys.exit(
            f"ERROR: Unsupported INVITE_EMAIL_PROVIDER {provider!r}; only 'resend' is implemented."
        )
    _require_env("RESEND_API_KEY")
    _require_env("ADMIN_EMAIL_FROM")


async def _run_invite(args: argparse.Namespace) -> int:
    _require_env("DATABASE_URL")
    _preflight_email_env()

    site_url = _normalize_site_url(
        args.site_url or args.redirect_to or _require_env("SITE_URL")
    )
    os.environ["SITE_URL"] = site_url
    creator_id = _creator_id_from_args(args.created_by_lab_member_id)

    print(f"Creating app-owned invite for {args.email} (role={args.role}, lab_name={args.lab_name!r}) ...")
    print(f"  site_url: {site_url}")

    session_factory = get_session_factory()
    async with session_factory() as db:
        try:
            result = await create_invite(
                db,
                email=args.email,
                role=args.role,
                lab_name=args.lab_name,
                created_by_lab_member_id=creator_id,
            )
        except DuplicatePendingInviteError:
            sys.exit("ERROR: A non-expired pending invite already exists for this email.")
        except httpx.HTTPError as exc:
            sys.exit(f"ERROR: Invite email send failed: {exc}")

    invitation = result.invitation
    print("Success. App-owned invite created and custom invite email sent.")
    print(f"  invitation_id : {invitation.invitation_id}")
    print(f"  email         : {invitation.email}")
    print(f"  role          : {invitation.role}")
    print(f"  lab_name      : {invitation.lab_name!r}")
    print(f"  expires_at    : {invitation.expires_at}")
    print(f"  send_count    : {invitation.send_count}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create and send an app-owned RA/admin invitation.",
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
        "--site-url",
        dest="site_url",
        default=None,
        help="App base URL for invite links (default: SITE_URL from env).",
    )
    parser.add_argument(
        "--redirect-to",
        dest="redirect_to",
        default=None,
        help=(
            "Deprecated alias for --site-url. A trailing /set-password path is stripped "
            "before building the app-owned invite link."
        ),
    )
    parser.add_argument(
        "--created-by-lab-member-id",
        dest="created_by_lab_member_id",
        default=None,
        help=(
            "Supabase Auth UUID of the admin responsible for this batch invite "
            "(default: ADMIN_CLI_CREATED_BY_LAB_MEMBER_ID)."
        ),
    )
    parser.add_argument(
        "--env-file",
        dest="env_file",
        default=None,
        help=(
            "Load env vars from this file instead of the repo-root .env. Values in "
            "the file override existing process env vars."
        ),
    )
    parser.add_argument(
        "--use-railway-env",
        action="store_true",
        help=(
            "Load backend env vars from Railway before creating the invite. "
            "Useful during migration when root .env still points to the old backend."
        ),
    )
    parser.add_argument(
        "--railway-service",
        default="backend",
        help="Railway service to read when --use-railway-env is set.",
    )
    parser.add_argument(
        "--railway-environment",
        default="production",
        help="Railway environment to read when --use-railway-env is set.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    _load_cli_environment(args)
    raise SystemExit(asyncio.run(_run_invite(args)))


if __name__ == "__main__":
    main()
