from __future__ import annotations

import io
import json
import uuid
from collections.abc import Mapping
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

import openpyxl
from openpyxl.styles import Font
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.participants import Participant
from app.models.poffenberger import PoffenbergerRun, PoffenbergerTrial
from app.models.sessions import Session as SessionModel


_RUN_COLUMNS = [
    "run_id",
    "session_id",
    "participant_uuid",
    "participant_number",
    "age_band",
    "gender",
    "handedness",
    "session_status",
    "session_created_at",
    "session_completed_at",
    "manifest_json",
    "started_at",
    "completed_at",
    "is_complete",
    "total_practice_trials",
    "total_experimental_trials",
    "lh_lvf_total_trials",
    "lh_lvf_valid_rt_trials",
    "lh_lvf_timeout_trials",
    "lh_lvf_invalid_trials",
    "lh_lvf_accurate_trials",
    "lh_lvf_accuracy",
    "lh_lvf_mean_rt_ms",
    "lh_lvf_median_rt_ms",
    "lh_lvf_sd_rt_ms",
    "lh_rvf_total_trials",
    "lh_rvf_valid_rt_trials",
    "lh_rvf_timeout_trials",
    "lh_rvf_invalid_trials",
    "lh_rvf_accurate_trials",
    "lh_rvf_accuracy",
    "lh_rvf_mean_rt_ms",
    "lh_rvf_median_rt_ms",
    "lh_rvf_sd_rt_ms",
    "rh_lvf_total_trials",
    "rh_lvf_valid_rt_trials",
    "rh_lvf_timeout_trials",
    "rh_lvf_invalid_trials",
    "rh_lvf_accurate_trials",
    "rh_lvf_accuracy",
    "rh_lvf_mean_rt_ms",
    "rh_lvf_median_rt_ms",
    "rh_lvf_sd_rt_ms",
    "rh_rvf_total_trials",
    "rh_rvf_valid_rt_trials",
    "rh_rvf_timeout_trials",
    "rh_rvf_invalid_trials",
    "rh_rvf_accurate_trials",
    "rh_rvf_accuracy",
    "rh_rvf_mean_rt_ms",
    "rh_rvf_median_rt_ms",
    "rh_rvf_sd_rt_ms",
    "mean_rt_crossed_ms",
    "mean_rt_uncrossed_ms",
    "ihtt_difference_ms",
    "accuracy_crossed",
    "accuracy_uncrossed",
]

_TRIAL_COLUMNS = [
    "trial_id",
    "run_id",
    "session_id",
    "participant_uuid",
    "block_number",
    "trial_number",
    "global_trial_number",
    "response_hand",
    "visual_field",
    "condition_key",
    "is_practice",
    "is_scored",
    "expected_key",
    "pressed_key",
    "reaction_time_ms",
    "is_valid_response",
    "is_timeout",
    "is_accurate",
    "jitter_ms",
    "client_trial_started_at_ms",
    "client_stimulus_onset_ms",
    "client_response_at_ms",
    "client_trial_ended_at_ms",
    "created_at",
]

_README_TEXT = """\
IHTT Poffenberger - Data Export

Exported: {export_date}
Mode: {export_mode}

Sheets included:
  poffenberger_runs   One row per recorded Poffenberger run, joined to participant and session context.
  poffenberger_trials One row per persisted practice or experimental trial.

Join key conventions:
  - participant_uuid : links participants -> sessions -> Poffenberger runs/trials
  - session_id       : links sessions -> Poffenberger runs/trials
  - run_id           : links Poffenberger runs -> Poffenberger trials

Value notes:
  - All UUIDs are strings.
  - Timestamps and dates are ISO-8601 strings.
  - JSON columns contain JSON strings.
  - Numeric summary columns remain numeric where possible.
"""

_SAMPLE_RUN_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
_SAMPLE_SESSION_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")
_SAMPLE_PARTICIPANT_UUID = uuid.UUID("33333333-3333-4333-8333-333333333333")
_SAMPLE_EXPORTED_AT = datetime(2026, 6, 24, 17, 30, tzinfo=timezone.utc)


def _to_xlsx(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return value


async def _fetch_run_rows(db: AsyncSession) -> list[dict[str, Any]]:
    stmt = (
        select(
            PoffenbergerRun.run_id.label("run_id"),
            PoffenbergerRun.session_id.label("session_id"),
            PoffenbergerRun.participant_uuid.label("participant_uuid"),
            Participant.participant_number.label("participant_number"),
            Participant.age_band.label("age_band"),
            Participant.gender.label("gender"),
            Participant.handedness.label("handedness"),
            SessionModel.status.label("session_status"),
            SessionModel.created_at.label("session_created_at"),
            SessionModel.completed_at.label("session_completed_at"),
            *[
                getattr(PoffenbergerRun, column).label(column)
                for column in _RUN_COLUMNS[10:]
            ],
        )
        .join(
            Participant,
            Participant.participant_uuid == PoffenbergerRun.participant_uuid,
        )
        .join(SessionModel, SessionModel.session_id == PoffenbergerRun.session_id)
        .order_by(PoffenbergerRun.started_at, PoffenbergerRun.run_id)
    )
    return list((await db.execute(stmt)).mappings().all())


async def _fetch_trial_rows(db: AsyncSession) -> list[PoffenbergerTrial]:
    stmt = select(PoffenbergerTrial).order_by(
        PoffenbergerTrial.run_id,
        PoffenbergerTrial.global_trial_number,
    )
    return list((await db.execute(stmt)).scalars().all())


def _trial_to_row(trial: PoffenbergerTrial) -> dict[str, Any]:
    return {column: getattr(trial, column) for column in _TRIAL_COLUMNS}


def _sample_run_rows() -> list[dict[str, Any]]:
    return [
        {
            "run_id": _SAMPLE_RUN_ID,
            "session_id": _SAMPLE_SESSION_ID,
            "participant_uuid": _SAMPLE_PARTICIPANT_UUID,
            "participant_number": 9001,
            "age_band": "18-24",
            "gender": "Woman",
            "handedness": "Right-handed",
            "session_status": "complete",
            "session_created_at": _SAMPLE_EXPORTED_AT,
            "session_completed_at": _SAMPLE_EXPORTED_AT,
            "manifest_json": {
                "sample": True,
                "practice_trials": 10,
                "experimental_trials": 600,
            },
            "started_at": _SAMPLE_EXPORTED_AT,
            "completed_at": _SAMPLE_EXPORTED_AT,
            "is_complete": True,
            "total_practice_trials": 10,
            "total_experimental_trials": 600,
            "lh_lvf_total_trials": 150,
            "lh_lvf_valid_rt_trials": 146,
            "lh_lvf_timeout_trials": 2,
            "lh_lvf_invalid_trials": 2,
            "lh_lvf_accurate_trials": 142,
            "lh_lvf_accuracy": Decimal("0.9467"),
            "lh_lvf_mean_rt_ms": Decimal("318.40"),
            "lh_lvf_median_rt_ms": Decimal("314.00"),
            "lh_lvf_sd_rt_ms": Decimal("31.25"),
            "lh_rvf_total_trials": 150,
            "lh_rvf_valid_rt_trials": 148,
            "lh_rvf_timeout_trials": 1,
            "lh_rvf_invalid_trials": 1,
            "lh_rvf_accurate_trials": 144,
            "lh_rvf_accuracy": Decimal("0.9600"),
            "lh_rvf_mean_rt_ms": Decimal("325.80"),
            "lh_rvf_median_rt_ms": Decimal("321.50"),
            "lh_rvf_sd_rt_ms": Decimal("33.10"),
            "rh_lvf_total_trials": 150,
            "rh_lvf_valid_rt_trials": 147,
            "rh_lvf_timeout_trials": 2,
            "rh_lvf_invalid_trials": 1,
            "rh_lvf_accurate_trials": 143,
            "rh_lvf_accuracy": Decimal("0.9533"),
            "rh_lvf_mean_rt_ms": Decimal("329.20"),
            "rh_lvf_median_rt_ms": Decimal("326.00"),
            "rh_lvf_sd_rt_ms": Decimal("34.45"),
            "rh_rvf_total_trials": 150,
            "rh_rvf_valid_rt_trials": 149,
            "rh_rvf_timeout_trials": 1,
            "rh_rvf_invalid_trials": 0,
            "rh_rvf_accurate_trials": 146,
            "rh_rvf_accuracy": Decimal("0.9733"),
            "rh_rvf_mean_rt_ms": Decimal("316.60"),
            "rh_rvf_median_rt_ms": Decimal("312.50"),
            "rh_rvf_sd_rt_ms": Decimal("29.80"),
            "mean_rt_crossed_ms": Decimal("327.50"),
            "mean_rt_uncrossed_ms": Decimal("317.50"),
            "ihtt_difference_ms": Decimal("10.00"),
            "accuracy_crossed": Decimal("0.9567"),
            "accuracy_uncrossed": Decimal("0.9600"),
        }
    ]


def _sample_trial_rows() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    samples = [
        (0, 1, 1, "right", "lvf", "rh_lvf", True, False, "j", "j", 410, True),
        (1, 1, 11, "left", "rvf", "lh_rvf", False, True, "f", "f", 322, True),
        (1, 2, 12, "left", "lvf", "lh_lvf", False, True, "f", None, None, False),
        (2, 1, 61, "right", "lvf", "rh_lvf", False, True, "j", "f", 355, False),
        (2, 2, 62, "right", "rvf", "rh_rvf", False, True, "j", "j", 304, True),
    ]
    for index, sample in enumerate(samples, start=1):
        (
            block_number,
            trial_number,
            global_trial_number,
            response_hand,
            visual_field,
            condition_key,
            is_practice,
            is_scored,
            expected_key,
            pressed_key,
            reaction_time_ms,
            is_accurate,
        ) = sample
        rows.append(
            {
                "trial_id": uuid.UUID(f"44444444-4444-4444-8444-{index:012d}"),
                "run_id": _SAMPLE_RUN_ID,
                "session_id": _SAMPLE_SESSION_ID,
                "participant_uuid": _SAMPLE_PARTICIPANT_UUID,
                "block_number": block_number,
                "trial_number": trial_number,
                "global_trial_number": global_trial_number,
                "response_hand": response_hand,
                "visual_field": visual_field,
                "condition_key": condition_key,
                "is_practice": is_practice,
                "is_scored": is_scored,
                "expected_key": expected_key,
                "pressed_key": pressed_key,
                "reaction_time_ms": reaction_time_ms,
                "is_valid_response": pressed_key is not None,
                "is_timeout": pressed_key is None,
                "is_accurate": is_accurate,
                "jitter_ms": 1200 + (index * 75),
                "client_trial_started_at_ms": Decimal(f"{index * 1000}.000"),
                "client_stimulus_onset_ms": Decimal(f"{index * 1000 + 1200}.000"),
                "client_response_at_ms": (
                    Decimal(f"{index * 1000 + 1200 + reaction_time_ms}.000")
                    if reaction_time_ms is not None
                    else None
                ),
                "client_trial_ended_at_ms": Decimal(f"{index * 1000 + 3200}.000"),
                "created_at": _SAMPLE_EXPORTED_AT,
            }
        )
    return rows


def _write_header(ws: Any, columns: list[str]) -> None:
    header_font = Font(bold=True)
    for col_idx, column in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=column)
        cell.font = header_font
    ws.freeze_panes = "A2"


def _build_workbook(
    *,
    export_date: str,
    export_mode: str,
    run_rows: list[Mapping[str, Any]],
    trial_rows: list[Mapping[str, Any]],
) -> bytes:
    wb = openpyxl.Workbook()

    readme_ws = wb.active
    readme_ws.title = "README"
    for row_idx, line in enumerate(
        _README_TEXT.format(
            export_date=export_date,
            export_mode=export_mode,
        ).splitlines(),
        start=1,
    ):
        cell = readme_ws.cell(row=row_idx, column=1, value=line)
        if row_idx == 1:
            cell.font = Font(bold=True, size=13)
    readme_ws.column_dimensions["A"].width = 110

    runs_ws = wb.create_sheet(title="poffenberger_runs")
    _write_header(runs_ws, _RUN_COLUMNS)
    for row_idx, row in enumerate(run_rows, start=2):
        for col_idx, column in enumerate(_RUN_COLUMNS, start=1):
            runs_ws.cell(row=row_idx, column=col_idx, value=_to_xlsx(row[column]))

    trials_ws = wb.create_sheet(title="poffenberger_trials")
    _write_header(trials_ws, _TRIAL_COLUMNS)
    for row_idx, trial in enumerate(trial_rows, start=2):
        for col_idx, column in enumerate(_TRIAL_COLUMNS, start=1):
            trials_ws.cell(
                row=row_idx,
                column=col_idx,
                value=_to_xlsx(trial[column]),
            )

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


async def build_poffenberger_xlsx(db: AsyncSession, export_date: str) -> bytes:
    run_rows = await _fetch_run_rows(db)
    trial_rows = [_trial_to_row(trial) for trial in await _fetch_trial_rows(db)]
    return _build_workbook(
        export_date=export_date,
        export_mode="live database export",
        run_rows=run_rows,
        trial_rows=trial_rows,
    )


def build_sample_poffenberger_xlsx(export_date: str) -> bytes:
    return _build_workbook(
        export_date=export_date,
        export_mode="hardcoded sample data; no database rows were read or written",
        run_rows=_sample_run_rows(),
        trial_rows=_sample_trial_rows(),
    )
