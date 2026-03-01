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
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_lab_member
from app.config import STUDY_TIMEZONE
from app.db import get_session
from app.schemas.admin import ImportCommitResponse, ImportPreviewResponse, LegacyWeatherBackfillResponse
from app.services.export_service import build_xlsx, build_zip_csv
from app.services.import_service import commit_import, parse_file, preview_import
from app.services.weather_backfill_service import run_legacy_weather_backfill

router = APIRouter(prefix="/admin", tags=["admin"])

_ALLOWED_EXTENSIONS = frozenset({".csv", ".xlsx"})


def _require_valid_extension(filename: str | None) -> None:
    if not filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file must have a .csv or .xlsx extension.",
        )
    lower = filename.lower()
    if not any(lower.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type. Expected .csv or .xlsx (got: {filename!r}).",
        )


@router.post(
    "/import/preview",
    response_model=ImportPreviewResponse,
    dependencies=[Depends(get_current_lab_member)],
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
    dependencies=[Depends(get_current_lab_member)],
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
    dependencies=[Depends(get_current_lab_member)],
)
async def backfill_legacy_weather(
    db: AsyncSession = Depends(get_session),
) -> LegacyWeatherBackfillResponse:
    """Backfill weather_daily from imported session temperature/precipitation data.

    For each study day that has imported session measures but no existing
    weather_daily row (station 3510), inserts a partial row with only
    current_temp_c and current_precip_today_mm populated (mean of all
    imported sessions for that day). All other weather fields remain null.

    Safe to call multiple times — existing weather_daily rows are never
    overwritten.
    """
    result = await run_legacy_weather_backfill(db)
    return LegacyWeatherBackfillResponse(
        days_backfilled=result.days_backfilled,
        days_skipped=result.days_skipped,
    )


# ── Export endpoints ───────────────────────────────────────────────────────────

def _today_local() -> str:
    """Return today's date in the study timezone as a YYYY-MM-DD string."""
    return datetime.now(ZoneInfo(STUDY_TIMEZONE)).date().isoformat()


@router.get(
    "/export.xlsx",
    dependencies=[Depends(get_current_lab_member)],
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
    dependencies=[Depends(get_current_lab_member)],
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
