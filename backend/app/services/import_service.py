"""Import parsing and DB interaction for CSV/XLSX legacy data imports.

Parse rules (API.md Admin Data section):
- participant ID → integer participant_number (required)
- date → Excel date serial or ISO string → date_local (America/Vancouver)
- daytime → Excel time fraction or HH:MM[:SS] → local time → daylight_exposure_minutes
- Demographic strings: whitespace-trimmed; canonical variants normalised conservatively
- origin / commute_method prefixed with "Other": main field="Other", detail→*_other_text
- Numeric measures: floats; blanks → None; digit_span_score → int

Upsert rules (commit):
- Participant upsert key: participant_number (demographics overwrite)
- Session: 0 sessions → create; 1 session (no native rows) → update; else → error
- Imported sessions: status="complete", study_day_id from date_local, timestamps at 12:00 local→UTC
- imported_session_measures upserted (keyed by session_id) — full audit trail
- Phase 4: also upserts into canonical outcome tables (digitspan_runs, survey_uls8,
  survey_cesd10, survey_gad7) with data_source='imported'. Native rows are never
  overwritten — the upsert WHERE clause guards against this at the DB level.
- All writes are transactional; any error rolls back everything.
"""
from __future__ import annotations

import csv
import io
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time as dt_time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import openpyxl
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import STUDY_TIMEZONE, compute_daylight_exposure_minutes
from app.models.digitspan import DigitSpanRun
from app.models.imported_session_measures import ImportedSessionMeasures
from app.models.participants import Participant
from app.models.sessions import Session as SessionModel
from app.models.surveys import SurveyCESD10, SurveyCogFunc8a, SurveyGAD7, SurveyULS8
from app.models.weather import StudyDay
from app.schemas.admin import (
    ImportCommitResponse,
    ImportPreviewResponse,
    ImportRowIssue,
)

# ── GAD-7 severity helper ──────────────────────────────────────────────────────

def _gad7_severity_from_total(total: int) -> str:
    """Return GAD-7 severity band for a total score 0–21."""
    if total <= 4:
        return "minimal"
    if total <= 9:
        return "mild"
    if total <= 14:
        return "moderate"
    return "severe"


# ── Column name constants (canonical lowercase) ────────────────────────────────

_C_PARTICIPANT_ID = "participant id"
_C_DATE = "date"
_C_AGE = "age"
_C_GENDER = "gender"
_C_ORIGIN = "origin"
_C_COMMUTE_METHOD = "commute_method"
_C_TIME_OUTSIDE = "time_outside"
_C_PRECIPITATION = "precipitation"
_C_TEMPERATURE = "temperature"
_C_DAYTIME = "daytime"
_C_ANXIETY = "anxiety"
_C_LONELINESS = "loneliness"
_C_DEPRESSION = "depression"
_C_DIGIT_SPAN_SCORE = "digit_span_score"
_C_SELF_REPORT = "self_report"

_REQUIRED_COLS = {_C_PARTICIPANT_ID, _C_DATE}

# ── Demographic normalization maps (lowercase key → canonical value) ───────────

_AGE_BAND_NORM: dict[str, str] = {
    "over 38": ">38",
    "38+": ">38",
    "over38": ">38",
    "38 or older": ">38",
    "older than 38": ">38",
}

_GENDER_NORM: dict[str, str] = {
    "nonbinary person": "Non-binary",
    "non binary person": "Non-binary",
    "nonbinary": "Non-binary",
    "non binary": "Non-binary",
    "non-binary person": "Non-binary",
    "gender nonconforming": "Non-binary",
}

# ── Data classes ───────────────────────────────────────────────────────────────

_EXCEL_EPOCH = date(1899, 12, 30)


@dataclass
class ParsedRow:
    row_num: int
    participant_number: int
    date_local: date
    age_band: str | None
    gender: str | None
    origin: str | None
    origin_other_text: str | None
    commute_method: str | None
    commute_method_other_text: str | None
    time_outside: str | None
    daylight_exposure_minutes: int | None
    precipitation_mm: float | None
    temperature_c: float | None
    anxiety_mean: float | None
    loneliness_mean: float | None
    depression_mean: float | None
    digit_span_max_span: int | None
    self_report: float | None
    source_row_json: dict[str, Any]


@dataclass
class RowIssue:
    row: int
    field: str | None
    message: str


@dataclass
class ParseResult:
    file_type: str
    rows: list[ParsedRow]
    errors: list[RowIssue]
    warnings: list[RowIssue]
    rows_attempted: int  # total non-blank data rows (including those with errors)


@dataclass
class _DbValidation:
    errors: list[RowIssue]
    participants_create: int
    participants_update: int
    sessions_create: int
    sessions_update: int
    existing_p_uuids: dict[int, uuid.UUID]  # pnum → existing participant_uuid
    session_actions: dict[int, tuple[str, uuid.UUID | None]]  # pnum → ("create"|"update"|"error", session_id|None)


# ── Value parsers ──────────────────────────────────────────────────────────────

def _parse_excel_date(value: Any) -> date | None:
    """Convert an Excel cell value or string to a Python date.

    Accepts Python date/datetime, Excel serial integers/floats,
    or ISO date strings.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        n = int(value)
        if n <= 0:
            return None
        return _EXCEL_EPOCH + timedelta(days=n)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return date.fromisoformat(s)
        except ValueError:
            pass
        # Try as a numeric serial (e.g. "45000")
        try:
            n = int(float(s))
            if n > 0:
                return _EXCEL_EPOCH + timedelta(days=n)
        except ValueError:
            pass
    return None


def _parse_daytime(value: Any) -> tuple[int, int, int] | None:
    """Parse a daytime cell value to (hour, minute, second).

    Accepts:
    - Python time or datetime objects
    - Excel time fraction (float 0.0–<1.0)
    - Strings: "HH:MM" or "HH:MM:SS", or a float string like "0.375"
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return (value.hour, value.minute, value.second)
    if isinstance(value, dt_time):
        return (value.hour, value.minute, value.second)
    if isinstance(value, float):
        if value < 0.0 or value >= 1.0:
            return None
        total_seconds = round(value * 86400)
        h, rem = divmod(total_seconds, 3600)
        m, s = divmod(rem, 60)
        return (min(h, 23), m, s)
    if isinstance(value, int):
        # Unusual but handle 0-23 hour integers gracefully
        if 0 <= value <= 23:
            return (value, 0, 0)
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        # Try HH:MM or HH:MM:SS
        parts = s.split(":")
        if len(parts) in (2, 3):
            try:
                h = int(parts[0])
                m = int(parts[1])
                sec = int(parts[2]) if len(parts) > 2 else 0
                if 0 <= h <= 23 and 0 <= m <= 59 and 0 <= sec <= 59:
                    return (h, m, sec)
            except ValueError:
                pass
        # Try as a float fraction string (e.g. "0.375")
        try:
            frac = float(s)
            if 0.0 <= frac < 1.0:
                return _parse_daytime(frac)
        except ValueError:
            pass
    return None


def _parse_float(value: Any) -> float | None:
    """Parse a cell value to float or None (blanks and NaN → None)."""
    if value is None:
        return None
    if isinstance(value, float):
        return None if value != value else value  # NaN check
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return float(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _parse_int(value: Any) -> int | None:
    """Parse a cell value to int or None."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return None if value != value else int(round(value))  # NaN check
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return int(float(s))
        except ValueError:
            return None
    return None


def _str_or_none(value: Any) -> str | None:
    """Strip and return string, or None if empty."""
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _normalize_str(value: Any, norm_map: dict[str, str] | None = None) -> str | None:
    """Strip a string and apply optional canonical normalization."""
    s = _str_or_none(value)
    if s is None:
        return None
    if norm_map:
        key = s.lower()
        if key in norm_map:
            return norm_map[key]
    return s


def _parse_other_field(value: Any) -> tuple[str | None, str | None]:
    """Parse a field that may be "Other [detail]" or a canonical value.

    Returns (canonical_value, other_text).
    If the value starts with "other" (case-insensitive), canonical is "Other"
    and other_text contains any detail text (length-limited to 500 chars).
    """
    s = _str_or_none(value)
    if s is None:
        return (None, None)
    lower = s.lower()
    if lower == "other":
        return ("Other", None)
    if lower.startswith("other"):
        detail = s[5:].strip(" -–:()/[]").strip()
        return ("Other", detail[:500] if detail else None)
    return (s, None)


def _to_json_serializable(value: Any) -> Any:
    """Convert cell values to JSON-serializable Python types."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dt_time):
        return value.isoformat()
    if isinstance(value, float) and value != value:
        return None  # NaN
    return value


# ── File readers ───────────────────────────────────────────────────────────────

def _read_xlsx(contents: bytes) -> list[list[Any]]:
    """Read an XLSX file into a list of rows (each row is a list of cell values)."""
    wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True, read_only=True)
    try:
        ws = wb.active
        rows = [list(row) for row in ws.iter_rows(values_only=True)]
    finally:
        wb.close()
    return rows


def _read_csv(contents: bytes) -> list[list[Any]]:
    """Read a CSV file into a list of rows (all values are strings)."""
    text = contents.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    return [row for row in reader]


# ── Core parser ────────────────────────────────────────────────────────────────

def _normalize_header(h: Any) -> str:
    return str(h).strip().lower()


def _parse_rows_from_raw(raw_rows: list[list[Any]], file_type: str) -> ParseResult:
    """Parse raw file rows into a ParseResult.

    The first row is treated as column headers.  Empty/blank data rows are
    skipped.  Row numbers in issues are 1-based (header = row 1).
    """
    errors: list[RowIssue] = []
    warnings: list[RowIssue] = []
    parsed: list[ParsedRow] = []
    rows_attempted = 0

    if not raw_rows:
        errors.append(RowIssue(row=0, field=None, message="File is empty"))
        return ParseResult(
            file_type=file_type,
            rows=[],
            errors=errors,
            warnings=warnings,
            rows_attempted=0,
        )

    # ── Header row ────────────────────────────────────────────────────────────
    header_row = raw_rows[0]
    # Map normalized column name → column index
    headers: dict[str, int] = {}
    for i, h in enumerate(header_row):
        if h is None:
            continue
        norm = _normalize_header(h)
        if norm and norm not in headers:
            headers[norm] = i

    missing = _REQUIRED_COLS - set(headers.keys())
    if missing:
        errors.append(RowIssue(
            row=0,
            field=None,
            message=f"Missing required columns: {', '.join(sorted(missing))}",
        ))
        return ParseResult(
            file_type=file_type,
            rows=[],
            errors=errors,
            warnings=warnings,
            rows_attempted=0,
        )

    def _get(row: list[Any], col: str) -> Any:
        idx = headers.get(col)
        if idx is None or idx >= len(row):
            return None
        return row[idx]

    seen_pnums: set[int] = set()

    # ── Data rows ─────────────────────────────────────────────────────────────
    for row_idx, raw_row in enumerate(raw_rows[1:], start=2):
        # Skip fully blank rows
        if all(
            v is None or (isinstance(v, str) and not v.strip())
            for v in raw_row
        ):
            continue

        rows_attempted += 1
        row_num = row_idx

        # ── participant_number (required) ──────────────────────────────────
        pnum_raw = _get(raw_row, _C_PARTICIPANT_ID)
        pnum = _parse_int(pnum_raw)
        if pnum is None or pnum <= 0:
            errors.append(RowIssue(
                row=row_num,
                field="participant id",
                message=f"Invalid or missing participant ID: {pnum_raw!r}",
            ))
            continue

        if pnum in seen_pnums:
            errors.append(RowIssue(
                row=row_num,
                field="participant id",
                message=f"Duplicate participant ID {pnum} in this file",
            ))
            continue
        seen_pnums.add(pnum)

        # ── date_local (required) ──────────────────────────────────────────
        date_raw = _get(raw_row, _C_DATE)
        date_local = _parse_excel_date(date_raw)
        if date_local is None:
            errors.append(RowIssue(
                row=row_num,
                field="date",
                message=f"Cannot parse date value: {date_raw!r}",
            ))
            continue

        # ── Demographic fields ─────────────────────────────────────────────
        age_band = _normalize_str(_get(raw_row, _C_AGE), _AGE_BAND_NORM)
        gender = _normalize_str(_get(raw_row, _C_GENDER), _GENDER_NORM)
        origin, origin_other_text = _parse_other_field(_get(raw_row, _C_ORIGIN))
        commute_method, commute_method_other_text = _parse_other_field(
            _get(raw_row, _C_COMMUTE_METHOD)
        )
        time_outside = _normalize_str(_get(raw_row, _C_TIME_OUTSIDE))

        # ── Daytime → daylight_exposure_minutes ────────────────────────────
        daytime_raw = _get(raw_row, _C_DAYTIME)
        daytime_hms = _parse_daytime(daytime_raw)
        daylight_exposure_minutes: int | None = None

        if daytime_hms is not None:
            h_d, m_d, s_d = daytime_hms
            tz = ZoneInfo(STUDY_TIMEZONE)
            session_start_local = datetime(
                date_local.year, date_local.month, date_local.day,
                h_d, m_d, s_d,
                tzinfo=tz,
            )
            daylight_exposure_minutes = compute_daylight_exposure_minutes(session_start_local)
        elif _str_or_none(daytime_raw) is not None:
            warnings.append(RowIssue(
                row=row_num,
                field="daytime",
                message=f"Could not parse daytime value {daytime_raw!r}; daylight_exposure_minutes will be null",
            ))

        # ── Measure fields ─────────────────────────────────────────────────
        precipitation_mm = _parse_float(_get(raw_row, _C_PRECIPITATION))
        temperature_c = _parse_float(_get(raw_row, _C_TEMPERATURE))
        anxiety_mean = _parse_float(_get(raw_row, _C_ANXIETY))
        loneliness_mean = _parse_float(_get(raw_row, _C_LONELINESS))
        depression_mean = _parse_float(_get(raw_row, _C_DEPRESSION))
        digit_span_max_span = _parse_int(_get(raw_row, _C_DIGIT_SPAN_SCORE))
        self_report = _parse_float(_get(raw_row, _C_SELF_REPORT))

        # ── source_row_json (full audit payload) ───────────────────────────
        source_row_json: dict[str, Any] = {
            col: _to_json_serializable(raw_row[idx] if idx < len(raw_row) else None)
            for col, idx in headers.items()
        }

        parsed.append(ParsedRow(
            row_num=row_num,
            participant_number=pnum,
            date_local=date_local,
            age_band=age_band,
            gender=gender,
            origin=origin,
            origin_other_text=origin_other_text,
            commute_method=commute_method,
            commute_method_other_text=commute_method_other_text,
            time_outside=time_outside,
            daylight_exposure_minutes=daylight_exposure_minutes,
            precipitation_mm=precipitation_mm,
            temperature_c=temperature_c,
            anxiety_mean=anxiety_mean,
            loneliness_mean=loneliness_mean,
            depression_mean=depression_mean,
            digit_span_max_span=digit_span_max_span,
            self_report=self_report,
            source_row_json=source_row_json,
        ))

    return ParseResult(
        file_type=file_type,
        rows=parsed,
        errors=errors,
        warnings=warnings,
        rows_attempted=rows_attempted,
    )


# ── Public parse entry point ───────────────────────────────────────────────────

def parse_file(contents: bytes, filename: str) -> ParseResult:
    """Parse CSV or XLSX bytes into a ParseResult.

    Detects file type from filename extension.  Returns errors if the
    extension is unsupported or required columns are missing.
    """
    filename_lower = filename.lower()
    if filename_lower.endswith(".xlsx"):
        file_type = "xlsx"
        raw_rows = _read_xlsx(contents)
    elif filename_lower.endswith(".csv"):
        file_type = "csv"
        raw_rows = _read_csv(contents)
    else:
        return ParseResult(
            file_type="unknown",
            rows=[],
            errors=[RowIssue(
                row=0,
                field=None,
                message=f"Unsupported file type. Expected .csv or .xlsx (got: {filename!r})",
            )],
            warnings=[],
            rows_attempted=0,
        )

    return _parse_rows_from_raw(raw_rows, file_type)


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def _get_sessions_with_native_rows(
    db: AsyncSession,
    session_ids: list[uuid.UUID],
) -> set[uuid.UUID]:
    """Return the subset of session_ids that have any *native* survey or digit span rows.

    Tables that carry data_source (Phase 4): only rows with data_source='native' count.
    SurveyCogFunc8a has no data_source — any row in it is native (no import path).
    """
    if not session_ids:
        return set()

    found: set[uuid.UUID] = set()

    # Phase 4: these tables have data_source; only 'native' rows block re-import
    for model in (DigitSpanRun, SurveyULS8, SurveyCESD10, SurveyGAD7):
        result = await db.execute(
            select(model.session_id)
            .where(
                model.session_id.in_(session_ids),
                model.data_source == "native",
            )
            .distinct()
        )
        found.update(result.scalars().all())

    # SurveyCogFunc8a has no data_source — any row is native
    result = await db.execute(
        select(SurveyCogFunc8a.session_id)
        .where(SurveyCogFunc8a.session_id.in_(session_ids))
        .distinct()
    )
    found.update(result.scalars().all())

    return found


async def _validate_with_db(result: ParseResult, db: AsyncSession) -> _DbValidation:
    """Query DB to determine create/update actions for each parsed row.

    Returns DB-level errors (ambiguous sessions, native row conflicts) and
    action maps needed by commit_import.
    """
    errors: list[RowIssue] = []

    if not result.rows:
        return _DbValidation(
            errors=errors,
            participants_create=0,
            participants_update=0,
            sessions_create=0,
            sessions_update=0,
            existing_p_uuids={},
            session_actions={},
        )

    pnums = [r.participant_number for r in result.rows]

    # Batch-query existing participants
    p_result = await db.execute(
        select(Participant.participant_number, Participant.participant_uuid)
        .where(Participant.participant_number.in_(pnums))
    )
    existing_p_uuids: dict[int, uuid.UUID] = {
        row.participant_number: row.participant_uuid
        for row in p_result.all()
    }

    # Batch-query session counts for existing participants
    p_uuids = list(existing_p_uuids.values())
    session_counts: dict[uuid.UUID, int] = {}
    session_ids_by_puuid: dict[uuid.UUID, uuid.UUID] = {}

    if p_uuids:
        sc_result = await db.execute(
            select(
                SessionModel.participant_uuid,
                func.count(SessionModel.session_id).label("cnt"),
            )
            .where(SessionModel.participant_uuid.in_(p_uuids))
            .group_by(SessionModel.participant_uuid)
        )
        session_counts = {row.participant_uuid: row.cnt for row in sc_result.all()}

        # For participants with exactly 1 session, retrieve the session_id
        one_session_puuids = [
            puuid for puuid, cnt in session_counts.items() if cnt == 1
        ]
        if one_session_puuids:
            sid_result = await db.execute(
                select(SessionModel.participant_uuid, SessionModel.session_id)
                .where(SessionModel.participant_uuid.in_(one_session_puuids))
            )
            session_ids_by_puuid = {
                row.participant_uuid: row.session_id
                for row in sid_result.all()
            }

    # Check for native rows in the candidate sessions
    candidate_sids = list(session_ids_by_puuid.values())
    native_session_ids = await _get_sessions_with_native_rows(db, candidate_sids)

    participants_create = 0
    participants_update = 0
    sessions_create = 0
    sessions_update = 0
    session_actions: dict[int, tuple[str, uuid.UUID | None]] = {}

    for row in result.rows:
        pnum = row.participant_number

        if pnum not in existing_p_uuids:
            participants_create += 1
            sessions_create += 1
            session_actions[pnum] = ("create", None)
        else:
            participants_update += 1
            puuid = existing_p_uuids[pnum]
            cnt = session_counts.get(puuid, 0)

            if cnt == 0:
                sessions_create += 1
                session_actions[pnum] = ("create", None)
            elif cnt == 1:
                sid = session_ids_by_puuid[puuid]
                if sid in native_session_ids:
                    errors.append(RowIssue(
                        row=row.row_num,
                        field="participant id",
                        message=(
                            f"Participant {pnum} has a session with native survey or "
                            "digit span data — import cannot overwrite it."
                        ),
                    ))
                    session_actions[pnum] = ("error", None)
                else:
                    sessions_update += 1
                    session_actions[pnum] = ("update", sid)
            else:
                errors.append(RowIssue(
                    row=row.row_num,
                    field="participant id",
                    message=(
                        f"Participant {pnum} has {cnt} sessions in the database "
                        "(ambiguous for import — expected 0 or 1)."
                    ),
                ))
                session_actions[pnum] = ("error", None)

    return _DbValidation(
        errors=errors,
        participants_create=participants_create,
        participants_update=participants_update,
        sessions_create=sessions_create,
        sessions_update=sessions_update,
        existing_p_uuids=existing_p_uuids,
        session_actions=session_actions,
    )


# ── Public service functions ───────────────────────────────────────────────────

async def preview_import(result: ParseResult, db: AsyncSession) -> ImportPreviewResponse:
    """Return a preview summary without writing to the database.

    If there are parse errors, DB validation is skipped and counts are zero.
    """
    parse_errors = [
        ImportRowIssue(row=e.row, field=e.field, message=e.message)
        for e in result.errors
    ]
    warnings = [
        ImportRowIssue(row=w.row, field=w.field, message=w.message)
        for w in result.warnings
    ]

    if parse_errors:
        return ImportPreviewResponse(
            file_type=result.file_type,
            rows_total=result.rows_attempted,
            participants_create=0,
            participants_update=0,
            sessions_create=0,
            sessions_update=0,
            errors=parse_errors,
            warnings=warnings,
        )

    if not result.rows:
        return ImportPreviewResponse(
            file_type=result.file_type,
            rows_total=0,
            participants_create=0,
            participants_update=0,
            sessions_create=0,
            sessions_update=0,
            errors=[],
            warnings=warnings,
        )

    validation = await _validate_with_db(result, db)
    db_errors = [
        ImportRowIssue(row=e.row, field=e.field, message=e.message)
        for e in validation.errors
    ]

    return ImportPreviewResponse(
        file_type=result.file_type,
        rows_total=result.rows_attempted,
        participants_create=validation.participants_create,
        participants_update=validation.participants_update,
        sessions_create=validation.sessions_create,
        sessions_update=validation.sessions_update,
        errors=db_errors,
        warnings=warnings,
    )


async def commit_import(result: ParseResult, db: AsyncSession) -> ImportCommitResponse:
    """Validate and write the import to the database transactionally.

    Raises HTTP 422 if there are any parse or DB validation errors.
    All writes succeed or none do.
    """
    # 1. Fail fast on parse errors
    if result.errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {"row": e.row, "field": e.field, "message": e.message}
                for e in result.errors
            ],
        )

    if not result.rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No valid data rows found in file.",
        )

    # 2. DB validation
    validation = await _validate_with_db(result, db)
    if validation.errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[
                {"row": e.row, "field": e.field, "message": e.message}
                for e in validation.errors
            ],
        )

    # 3. Upsert study_days for all unique date_locals
    unique_dates = {r.date_local for r in result.rows}
    study_day_ids: dict[date, uuid.UUID] = {}
    for d in unique_dates:
        stmt = (
            pg_insert(StudyDay)
            .values(
                study_day_id=uuid.uuid4(),
                date_local=d,
                tz_name=STUDY_TIMEZONE,
            )
            .on_conflict_do_update(
                index_elements=["date_local"],
                set_={"tz_name": STUDY_TIMEZONE},
            )
            .returning(StudyDay.study_day_id)
        )
        study_day_id: uuid.UUID = (await db.execute(stmt)).scalar_one()
        study_day_ids[d] = study_day_id

    # 4. Process each row
    tz = ZoneInfo(STUDY_TIMEZONE)
    participants_created = 0
    participants_updated = 0
    sessions_created = 0
    sessions_updated = 0

    for row in result.rows:
        pnum = row.participant_number
        action_s, existing_sid = validation.session_actions[pnum]
        study_day_id = study_day_ids[row.date_local]

        # Session anchor timestamp: 12:00 local on the import date, stored as UTC
        local_noon = datetime(
            row.date_local.year, row.date_local.month, row.date_local.day,
            12, 0, 0,
            tzinfo=tz,
        )
        utc_noon = local_noon.astimezone(timezone.utc)

        # Upsert participant (demographics overwrite on conflict)
        p_upsert_stmt = (
            pg_insert(Participant)
            .values(
                participant_uuid=uuid.uuid4(),
                participant_number=pnum,
                age_band=row.age_band,
                gender=row.gender,
                origin=row.origin,
                origin_other_text=row.origin_other_text,
                commute_method=row.commute_method,
                commute_method_other_text=row.commute_method_other_text,
                time_outside=row.time_outside,
                daylight_exposure_minutes=row.daylight_exposure_minutes,
            )
            .on_conflict_do_update(
                index_elements=["participant_number"],
                set_={
                    "age_band": row.age_band,
                    "gender": row.gender,
                    "origin": row.origin,
                    "origin_other_text": row.origin_other_text,
                    "commute_method": row.commute_method,
                    "commute_method_other_text": row.commute_method_other_text,
                    "time_outside": row.time_outside,
                    "daylight_exposure_minutes": row.daylight_exposure_minutes,
                },
            )
            .returning(Participant.participant_uuid)
        )
        p_uuid: uuid.UUID = (await db.execute(p_upsert_stmt)).scalar_one()

        if pnum not in validation.existing_p_uuids:
            participants_created += 1
        else:
            participants_updated += 1

        # Session: create or update
        if action_s == "create":
            session_obj = SessionModel(
                participant_uuid=p_uuid,
                status="complete",
                created_at=utc_noon,
                completed_at=utc_noon,
                study_day_id=study_day_id,
            )
            db.add(session_obj)
            await db.flush()  # assigns session_id
            session_id = session_obj.session_id
            sessions_created += 1
        else:
            # action_s == "update"
            session_id = existing_sid  # type: ignore[assignment]
            s_result = await db.execute(
                select(SessionModel).where(SessionModel.session_id == session_id)
            )
            session_obj = s_result.scalar_one()
            session_obj.status = "complete"
            session_obj.completed_at = utc_noon
            session_obj.study_day_id = study_day_id
            sessions_updated += 1

        # Upsert imported_session_measures (audit trail — always write)
        m_stmt = (
            pg_insert(ImportedSessionMeasures)
            .values(
                session_id=session_id,
                participant_uuid=p_uuid,
                precipitation_mm=row.precipitation_mm,
                temperature_c=row.temperature_c,
                anxiety_mean=row.anxiety_mean,
                loneliness_mean=row.loneliness_mean,
                depression_mean=row.depression_mean,
                digit_span_max_span=row.digit_span_max_span,
                self_report=row.self_report,
                source_row_json=row.source_row_json,
            )
            .on_conflict_do_update(
                index_elements=["session_id"],
                set_={
                    "participant_uuid": p_uuid,
                    "precipitation_mm": row.precipitation_mm,
                    "temperature_c": row.temperature_c,
                    "anxiety_mean": row.anxiety_mean,
                    "loneliness_mean": row.loneliness_mean,
                    "depression_mean": row.depression_mean,
                    "digit_span_max_span": row.digit_span_max_span,
                    "self_report": row.self_report,
                    "source_row_json": row.source_row_json,
                },
            )
        )
        await db.execute(m_stmt)

        # ── Phase 4: upsert canonical outcome tables ──────────────────────
        # digit_span_score maps to digitspan_runs.total_correct (max_span unknown)
        if row.digit_span_max_span is not None:
            ds_stmt = (
                pg_insert(DigitSpanRun)
                .values(
                    run_id=uuid.uuid4(),
                    session_id=session_id,
                    participant_uuid=p_uuid,
                    total_correct=row.digit_span_max_span,
                    max_span=None,
                    data_source="imported",
                )
                .on_conflict_do_update(
                    index_elements=["session_id"],
                    set_={
                        "total_correct": row.digit_span_max_span,
                        "max_span": None,
                        "data_source": "imported",
                    },
                    where=DigitSpanRun.data_source == "imported",
                )
            )
            await db.execute(ds_stmt)

        # loneliness_mean → survey_uls8.legacy_mean_1_4
        if row.loneliness_mean is not None:
            uls8_stmt = (
                pg_insert(SurveyULS8)
                .values(
                    response_id=uuid.uuid4(),
                    session_id=session_id,
                    participant_uuid=p_uuid,
                    legacy_mean_1_4=row.loneliness_mean,
                    data_source="imported",
                )
                .on_conflict_do_update(
                    index_elements=["session_id"],
                    set_={
                        "legacy_mean_1_4": row.loneliness_mean,
                        "data_source": "imported",
                    },
                    where=SurveyULS8.data_source == "imported",
                )
            )
            await db.execute(uls8_stmt)

        # depression_mean → survey_cesd10.legacy_mean_1_4
        if row.depression_mean is not None:
            cesd10_stmt = (
                pg_insert(SurveyCESD10)
                .values(
                    response_id=uuid.uuid4(),
                    session_id=session_id,
                    participant_uuid=p_uuid,
                    legacy_mean_1_4=row.depression_mean,
                    data_source="imported",
                )
                .on_conflict_do_update(
                    index_elements=["session_id"],
                    set_={
                        "legacy_mean_1_4": row.depression_mean,
                        "data_source": "imported",
                    },
                    where=SurveyCESD10.data_source == "imported",
                )
            )
            await db.execute(cesd10_stmt)

        # anxiety_mean → survey_gad7.legacy_mean_1_4
        # If anxiety is an exact integer 0–21, also populate total_score + severity_band
        if row.anxiety_mean is not None:
            anx = row.anxiety_mean
            anx_int = int(anx)
            if anx == anx_int and 0 <= anx_int <= 21:
                gad7_total: int | None = anx_int
                gad7_band: str | None = _gad7_severity_from_total(anx_int)
            else:
                gad7_total = None
                gad7_band = None

            gad7_stmt = (
                pg_insert(SurveyGAD7)
                .values(
                    response_id=uuid.uuid4(),
                    session_id=session_id,
                    participant_uuid=p_uuid,
                    legacy_mean_1_4=row.anxiety_mean,
                    legacy_total_score=gad7_total,
                    total_score=gad7_total,
                    severity_band=gad7_band,
                    data_source="imported",
                )
                .on_conflict_do_update(
                    index_elements=["session_id"],
                    set_={
                        "legacy_mean_1_4": row.anxiety_mean,
                        "legacy_total_score": gad7_total,
                        "total_score": gad7_total,
                        "severity_band": gad7_band,
                        "data_source": "imported",
                    },
                    where=SurveyGAD7.data_source == "imported",
                )
            )
            await db.execute(gad7_stmt)

    await db.commit()

    return ImportCommitResponse(
        rows_total=result.rows_attempted,
        participants_created=participants_created,
        participants_updated=participants_updated,
        sessions_created=sessions_created,
        sessions_updated=sessions_updated,
    )
