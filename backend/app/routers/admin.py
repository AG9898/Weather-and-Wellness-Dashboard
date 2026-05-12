"""Admin router: import preview/commit, data export, and backfill endpoints.

POST /admin/import/preview
    RA-only.  Accepts a .csv or .xlsx file, validates rows, and returns
    a summary of what would be written without touching the database.

POST /admin/import/commit
    RA-only.  Accepts the same file format, validates, and writes
    transactionally.  Fails with 422 if any row has errors.

GET /admin/export.xlsx
    RA-only.  Returns a schema-faithful XLSX workbook (README + one sheet per
    table).  Filename: "Weather and wellness - YYYY-MM-DD.xlsx".

GET /admin/export.zip
    RA-only.  Returns a ZIP containing one schema-faithful CSV per table.
    Filename: "Weather and wellness - YYYY-MM-DD.zip".

POST /admin/backfill/legacy-weather
    RA-only.  Backfills weather_daily for imported days that have no
    UBC-ingested weather (temp + precip means from imported sessions only).
    Idempotent: existing weather_daily rows are never overwritten.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import LabMember, get_current_admin
from app.config import STUDY_TIMEZONE
from app.db import get_session
from app.schemas.admin import (
    AdminInvitationResponse,
    AdminUserResponse,
    AdminUsersResponse,
    CreateUserInvitationRequest,
    ImportCommitResponse,
    ImportPreviewResponse,
    LegacyWeatherBackfillResponse,
    UpdateAdminUserRequest,
)
from app.services.admin_invite_service import (
    DuplicatePendingInviteError,
    InviteAlreadyUsedError,
    InviteExpiredError,
    InviteNotFoundError,
    create_invite,
    list_invitations,
    resend_invite,
    revoke_invite,
)
from app.services.export_service import build_xlsx, build_zip_csv
from app.services.import_service import commit_import, parse_file, preview_import
from app.services.supabase_admin_users import (
    LabUserInfo,
    list_lab_users,
    revoke_user_access,
    update_user_metadata,
)
from app.services.weather_backfill_service import run_legacy_weather_backfill

router = APIRouter(prefix="/admin", tags=["admin"])

_ALLOWED_EXTENSIONS = frozenset({".csv", ".xlsx"})


def _require_valid_extension(filename: str | None) -> None:
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Uploaded file must have a .csv or .xlsx extension.",
        )
    lower = filename.lower()
    if not any(lower.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Unsupported file type. Expected .csv or .xlsx (got: {filename!r}).",
        )


def _admin_user_response(user: LabUserInfo) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        lab_name=user.lab_name,
        is_banned=user.is_banned,
        created_at=user.created_at,
        last_sign_in_at=user.last_sign_in_at,
    )


def _map_invite_error(exc: Exception) -> HTTPException:
    if isinstance(exc, DuplicatePendingInviteError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending invite already exists for this email.",
        )
    if isinstance(exc, InviteNotFoundError):
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found.",
        )
    if isinstance(exc, InviteExpiredError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation has expired.",
        )
    if isinstance(exc, InviteAlreadyUsedError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invitation is no longer pending.",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Invitation operation failed.",
    )


def _map_admin_client_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ValueError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, RuntimeError):
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin user management is not configured.",
        )
    if isinstance(exc, httpx.HTTPError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase Admin API request failed.",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Admin user operation failed.",
    )


# ── Admin user management endpoints ───────────────────────────────────────────


@router.get(
    "/users",
    response_model=AdminUsersResponse,
)
async def get_admin_users(
    _admin: LabMember = Depends(get_current_admin),
    db: AsyncSession = Depends(get_session),
) -> AdminUsersResponse:
    """Return safe Supabase Auth user summaries plus app-owned invitations."""
    try:
        users = [_admin_user_response(user) for user in list_lab_users()]
        invitations = await list_invitations(db)
    except (RuntimeError, httpx.HTTPStatusError) as exc:
        raise _map_admin_client_error(exc) from exc
    return AdminUsersResponse(
        users=users,
        invitations=[
            AdminInvitationResponse.model_validate(invitation)
            for invitation in invitations
        ],
    )


@router.post(
    "/users/invitations",
    response_model=AdminInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_user_invitation(
    request: CreateUserInvitationRequest,
    admin: LabMember = Depends(get_current_admin),
    db: AsyncSession = Depends(get_session),
) -> AdminInvitationResponse:
    """Create and send an app-owned invitation for an RA/admin user."""
    try:
        result = await create_invite(
            db,
            email=request.email,
            role=request.role,
            lab_name=request.lab_name,
            created_by_lab_member_id=admin.id,
        )
    except (
        DuplicatePendingInviteError,
        InviteExpiredError,
        InviteAlreadyUsedError,
        InviteNotFoundError,
    ) as exc:
        raise _map_invite_error(exc) from exc
    except (RuntimeError, httpx.HTTPError) as exc:
        raise _map_admin_client_error(exc) from exc
    return AdminInvitationResponse.model_validate(result.invitation)


@router.post(
    "/users/invitations/{invitation_id}/resend",
    response_model=AdminInvitationResponse,
)
async def resend_admin_user_invitation(
    invitation_id: UUID,
    _admin: LabMember = Depends(get_current_admin),
    db: AsyncSession = Depends(get_session),
) -> AdminInvitationResponse:
    """Resend a pending invitation and rotate its token."""
    try:
        invitation = await resend_invite(db, invitation_id=invitation_id)
    except (InviteNotFoundError, InviteExpiredError, InviteAlreadyUsedError) as exc:
        raise _map_invite_error(exc) from exc
    except (RuntimeError, httpx.HTTPError) as exc:
        raise _map_admin_client_error(exc) from exc
    return AdminInvitationResponse.model_validate(invitation)


@router.post(
    "/users/invitations/{invitation_id}/revoke",
    response_model=AdminInvitationResponse,
)
async def revoke_admin_user_invitation(
    invitation_id: UUID,
    admin: LabMember = Depends(get_current_admin),
    db: AsyncSession = Depends(get_session),
) -> AdminInvitationResponse:
    """Revoke a pending or expired invitation."""
    try:
        invitation = await revoke_invite(
            db,
            invitation_id=invitation_id,
            revoked_by_lab_member_id=admin.id,
        )
    except (InviteNotFoundError, InviteAlreadyUsedError) as exc:
        raise _map_invite_error(exc) from exc
    return AdminInvitationResponse.model_validate(invitation)


@router.patch(
    "/users/{user_id}",
    response_model=AdminUserResponse,
)
async def update_admin_user(
    user_id: str,
    request: UpdateAdminUserRequest,
    _admin: LabMember = Depends(get_current_admin),
) -> AdminUserResponse:
    """Update an RA/admin user's app_metadata role and lab assignment."""
    try:
        user = update_user_metadata(user_id, request.role, request.lab_name)
    except Exception as exc:
        raise _map_admin_client_error(exc) from exc
    return _admin_user_response(user)


@router.post(
    "/users/{user_id}/revoke-access",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_admin_user_access(
    user_id: str,
    _admin: LabMember = Depends(get_current_admin),
) -> Response:
    """Revoke access without hard-deleting the Supabase Auth user."""
    try:
        revoke_user_access(user_id)
    except Exception as exc:
        raise _map_admin_client_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/import/preview",
    response_model=ImportPreviewResponse,
    dependencies=[Depends(get_current_admin)],
)
async def import_preview(
    file: UploadFile = File(..., description="CSV or XLSX file to preview"),
    db: AsyncSession = Depends(get_session),
) -> ImportPreviewResponse:
    """Validate an import file and return counts/issues without writing to the database."""
    _require_valid_extension(file.filename)
    contents = await file.read()
    result = parse_file(contents, file.filename or "upload")
    return await preview_import(result, db)


@router.post(
    "/import/commit",
    response_model=ImportCommitResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(get_current_admin)],
)
async def import_commit(
    file: UploadFile = File(..., description="CSV or XLSX file to import"),
    db: AsyncSession = Depends(get_session),
) -> ImportCommitResponse:
    """Validate and commit an import file transactionally.

    Returns 422 with row-level detail if any row fails validation.
    No data is written on failure.
    """
    _require_valid_extension(file.filename)
    contents = await file.read()
    result = parse_file(contents, file.filename or "upload")
    return await commit_import(result, db)


# ── Backfill endpoints ─────────────────────────────────────────────────────────

@router.post(
    "/backfill/legacy-weather",
    response_model=LegacyWeatherBackfillResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(get_current_admin)],
)
async def backfill_legacy_weather(
    db: AsyncSession = Depends(get_session),
) -> LegacyWeatherBackfillResponse:
    """Backfill weather_daily from imported session temperature/precipitation data.

    For each study day that has imported session measures, apply the weather
    precedence rules for station 3510:
    - no existing row: insert a partial row with temp + precip only
    - existing open-meteo row: overwrite temp + precip with import values
      while preserving humidity/sunshine fields
    - existing legacy-import row: no-op
    - existing UBC EOS row: no-op

    Safe to call multiple times — rows already sourced from the legacy import
    are left unchanged on subsequent runs.
    """
    result = await run_legacy_weather_backfill(db)
    return LegacyWeatherBackfillResponse(
        days_inserted=result.days_inserted,
        days_updated=result.days_updated,
        days_skipped=result.days_skipped,
    )


# ── Export endpoints ───────────────────────────────────────────────────────────

def _today_local() -> str:
    """Return today's date in the study timezone as a YYYY-MM-DD string."""
    return datetime.now(ZoneInfo(STUDY_TIMEZONE)).date().isoformat()


@router.get(
    "/export.xlsx",
    dependencies=[Depends(get_current_admin)],
    response_class=Response,
)
async def export_xlsx(
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Return a schema-faithful XLSX workbook of all DB tables.

    Includes a README sheet followed by one sheet per table.
    All join keys are present for cross-table analysis.
    """
    today = _today_local()
    xlsx_bytes = await build_xlsx(db, export_date=today)
    filename = f"Weather and wellness - {today}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/export.zip",
    dependencies=[Depends(get_current_admin)],
    response_class=Response,
)
async def export_zip(
    db: AsyncSession = Depends(get_session),
) -> Response:
    """Return a ZIP archive containing one schema-faithful CSV per DB table.

    Each CSV is named <table_name>.csv and includes all join keys.
    """
    today = _today_local()
    zip_bytes = await build_zip_csv(db)
    filename = f"Weather and wellness - {today}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
