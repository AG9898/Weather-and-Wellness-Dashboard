from __future__ import annotations

import io
from datetime import datetime, timezone
from decimal import Decimal
from unittest import IsolatedAsyncioTestCase

import openpyxl

from app.services.poffenberger_export_service import (
    build_poffenberger_xlsx,
    build_sample_poffenberger_xlsx,
)


class _MappingRows:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def all(self) -> list[dict[str, object]]:
        return self._rows


class _MappingResult:
    def __init__(self, rows: list[dict[str, object]]) -> None:
        self._rows = rows

    def mappings(self) -> _MappingRows:
        return _MappingRows(self._rows)


class _ExportDB:
    def __init__(self, run_rows: list[dict[str, object]]) -> None:
        self._results = [_MappingResult(run_rows)]

    async def execute(self, stmt: object) -> object:  # noqa: ARG002
        if not self._results:
            raise AssertionError("Unexpected execute() call with no remaining fake results.")
        return self._results.pop(0)


class PoffenbergerExportServiceTests(IsolatedAsyncioTestCase):
    async def test_build_poffenberger_xlsx_includes_ra_readable_run_summary(self) -> None:
        created_at = datetime(2026, 6, 24, 18, 30, tzinfo=timezone.utc)

        run_row = {
            "participant_number": 17,
            "age_band": "18-24",
            "gender": "Woman",
            "handedness": "Right-handed",
            "started_at": created_at,
            "completed_at": created_at,
            "lh_lvf_accuracy": Decimal("0.9867"),
            "lh_lvf_mean_rt_ms": Decimal("301.25"),
            "lh_rvf_accuracy": Decimal("0.9800"),
            "lh_rvf_mean_rt_ms": Decimal("305.25"),
            "rh_lvf_accuracy": Decimal("0.9733"),
            "rh_lvf_mean_rt_ms": Decimal("306.25"),
            "rh_rvf_accuracy": Decimal("0.9933"),
            "rh_rvf_mean_rt_ms": Decimal("300.25"),
            "mean_rt_crossed_ms": Decimal("305.75"),
            "mean_rt_uncrossed_ms": Decimal("300.75"),
            "ihtt_difference_ms": Decimal("5.00"),
            "accuracy_crossed": Decimal("0.9767"),
            "accuracy_uncrossed": Decimal("0.9900"),
        }

        workbook_bytes = await build_poffenberger_xlsx(
            _ExportDB([run_row]),
            export_date="2026-06-24",
        )

        workbook = openpyxl.load_workbook(io.BytesIO(workbook_bytes))
        assert workbook.sheetnames == ["README", "Poffenberger Data"]

        data = workbook["Poffenberger Data"]
        headers = [cell.value for cell in data[4] if cell.value]
        assert "Participant number" in headers
        assert "Trial Time" in headers
        assert "IHTT difference (ms)" in headers
        assert "Left hand + right-side stimulus accuracy" in headers
        assert "Session status" not in headers
        assert "Task complete?" not in headers
        assert "Practice trials recorded" not in headers
        assert "Experimental trials recorded" not in headers
        assert not any("valid trials" in str(header) for header in headers)
        assert not any("uuid" in str(header).lower() for header in headers)
        assert not any(str(header).lower().endswith("_id") for header in headers)

        values = {
            header: data.cell(row=5, column=index + 1).value
            for index, header in enumerate(headers)
        }
        assert values["Participant number"] == 17
        assert values["Handedness"] == "Right-handed"
        assert values["Trial Time"] == (
            "Started: 2026-06-24 11:30am\n"
            "Completed: 2026-06-24 11:30am"
        )
        assert values["IHTT difference (ms)"] == 5
        assert values["Left hand + right-side stimulus mean RT (ms)"] == 305.25
        assert (
            data.cell(row=5, column=headers.index("Crossed accuracy") + 1).number_format
            == "0.0%"
        )

    async def test_build_sample_poffenberger_xlsx_uses_fictional_rows(self) -> None:
        workbook_bytes = build_sample_poffenberger_xlsx(export_date="2026-06-24")

        workbook = openpyxl.load_workbook(io.BytesIO(workbook_bytes))
        readme_values = [
            workbook["README"].cell(row=row_num, column=1).value
            for row_num in range(1, 20)
        ]
        readme_values.extend(
            workbook["README"].cell(row=row_num, column=2).value
            for row_num in range(1, 20)
        )
        assert any(
            value and "Sample workbook with fictional rows" in str(value)
            for value in readme_values
        )

        data = workbook["Poffenberger Data"]
        headers = [cell.value for cell in data[4] if cell.value]
        row_values = [
            {
                header: data.cell(row=row_num, column=index + 1).value
                for index, header in enumerate(headers)
            }
            for row_num in range(5, 9)
        ]
        assert [row["Participant number"] for row in row_values] == [9001, 9002, 9003, 9004]
        assert row_values[1]["Age group"] == "25-31"
        assert row_values[2]["Handedness"] == "Ambidextrous"
        assert row_values[3]["Gender"] == "Prefer not to say"
        assert all("Started:" in row["Trial Time"] for row in row_values)
        assert all("\nCompleted:" in row["Trial Time"] for row in row_values)
        assert row_values[0]["Trial Time"] == (
            "Started: 2026-06-24 10:30am\n"
            "Completed: 2026-06-24 10:48am"
        )
        assert row_values[0]["IHTT difference (ms)"] == 10
        assert row_values[3]["IHTT difference (ms)"] == 8.8
        assert data.freeze_panes == "A5"
