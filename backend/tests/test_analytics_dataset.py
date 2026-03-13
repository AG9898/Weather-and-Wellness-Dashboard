"""Regression tests for the canonical analytics dataset service."""

from __future__ import annotations

import uuid
from datetime import date
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase

from sqlalchemy.dialects import postgresql

from app.analytics.dataset import (
    _build_dataset_source_query,
    build_canonical_analysis_dataset,
)


class _FakeResult:
    def __init__(self, rows: list[object] | None = None) -> None:
        self._rows = rows or []

    def all(self) -> list[object]:
        return list(self._rows)


class _FakeAsyncSession:
    def __init__(self, execute_results: list[_FakeResult]) -> None:
        self.execute_results = list(execute_results)
        self.executed: list[object] = []

    async def execute(self, stmt: object) -> _FakeResult:
        self.executed.append(stmt)
        if not self.execute_results:
            raise AssertionError("Unexpected execute() call with no remaining fake results.")
        return self.execute_results.pop(0)


def _dataset_row(
    *,
    session_id: uuid.UUID | None = None,
    participant_uuid: uuid.UUID | None = None,
    date_local: date | None = date(2026, 3, 1),
    weather_temperature: float | None = 9.5,
    weather_precipitation: float | None = 1.25,
    weather_daylight_hours: float | None = 8.0,
    import_temperature: float | None = None,
    import_precipitation: float | None = None,
    import_anxiety_mean: float | None = None,
    import_loneliness_mean: float | None = None,
    import_depression_mean: float | None = None,
    import_self_report: float | None = None,
    digit_span_total_correct: int | None = 10,
    digit_span_data_source: str | None = "native",
    gad_total_score: int | None = 12,
    gad_legacy_total_score: int | None = None,
    gad_legacy_mean: float | None = None,
    gad_data_source: str | None = "native",
    cesd_total_score: int | None = 7,
    cesd_legacy_mean: float | None = None,
    cesd_data_source: str | None = "native",
    uls_computed_mean: float | None = 2.5,
    uls_legacy_mean: float | None = None,
    uls_data_source: str | None = "native",
    cogfunc_mean_score: float | None = 3.75,
    cogfunc_legacy_mean: float | None = None,
    cogfunc_data_source: str | None = "native",
) -> SimpleNamespace:
    return SimpleNamespace(
        session_id=session_id or uuid.uuid4(),
        participant_uuid=participant_uuid or uuid.uuid4(),
        date_local=date_local,
        weather_temperature=weather_temperature,
        weather_precipitation=weather_precipitation,
        weather_daylight_hours=weather_daylight_hours,
        import_temperature=import_temperature,
        import_precipitation=import_precipitation,
        import_anxiety_mean=import_anxiety_mean,
        import_loneliness_mean=import_loneliness_mean,
        import_depression_mean=import_depression_mean,
        import_self_report=import_self_report,
        digit_span_total_correct=digit_span_total_correct,
        digit_span_data_source=digit_span_data_source,
        gad_total_score=gad_total_score,
        gad_legacy_total_score=gad_legacy_total_score,
        gad_legacy_mean=gad_legacy_mean,
        gad_data_source=gad_data_source,
        cesd_total_score=cesd_total_score,
        cesd_legacy_mean=cesd_legacy_mean,
        cesd_data_source=cesd_data_source,
        uls_computed_mean=uls_computed_mean,
        uls_legacy_mean=uls_legacy_mean,
        uls_data_source=uls_data_source,
        cogfunc_mean_score=cogfunc_mean_score,
        cogfunc_legacy_mean=cogfunc_legacy_mean,
        cogfunc_data_source=cogfunc_data_source,
    )


class AnalyticsDatasetServiceTests(IsolatedAsyncioTestCase):
    def test_dataset_source_query_uses_unionized_candidate_session_paths(self) -> None:
        stmt = _build_dataset_source_query(
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 7),
        )

        compiled = str(
            stmt.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )

        self.assertIn("candidate_session_ids AS", compiled)
        self.assertIn("UNION", compiled)
        self.assertNotIn(" OR ", compiled)
        self.assertIn("sessions.status = 'complete'", compiled)
        self.assertIn("study_days.date_local >=", compiled)
        self.assertIn("sessions.completed_at IS NOT NULL", compiled)

    async def test_build_dataset_prefers_native_values_and_derives_date_bins(self) -> None:
        row_one = _dataset_row(
            date_local=date(2026, 3, 1),
            weather_temperature=5.0,
            weather_precipitation=0.25,
            weather_daylight_hours=7.5,
            import_temperature=99.0,
            import_precipitation=88.0,
            import_anxiety_mean=1.5,
            import_loneliness_mean=1.25,
            import_depression_mean=1.75,
            import_self_report=1.1,
            gad_total_score=11,
            cesd_total_score=9,
            uls_computed_mean=2.75,
            cogfunc_mean_score=4.25,
            digit_span_total_correct=13,
        )
        row_two = _dataset_row(
            date_local=date(2026, 3, 2),
            weather_temperature=6.0,
            weather_precipitation=0.0,
            weather_daylight_hours=8.25,
            gad_total_score=10,
            cesd_total_score=8,
            uls_computed_mean=2.25,
            cogfunc_mean_score=3.5,
            digit_span_total_correct=9,
        )
        db = _FakeAsyncSession([_FakeResult(rows=[row_one, row_two])])

        result = await build_canonical_analysis_dataset(
            db,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 2),
        )

        self.assertEqual(result.included_sessions, 2)
        self.assertEqual(result.included_days, 2)
        self.assertEqual(result.native_rows, 2)
        self.assertEqual(result.imported_rows, 0)
        self.assertEqual(result.excluded_count, 0)
        self.assertEqual(result.rows[0].temperature, 5.0)
        self.assertEqual(result.rows[0].precipitation, 0.25)
        self.assertEqual(result.rows[0].anxiety, 11.0)
        self.assertEqual(result.rows[0].self_report, 4.25)
        self.assertEqual(result.rows[0].digit_span_score, 13)
        self.assertEqual(result.rows[0].date_bin, 1)
        self.assertEqual(result.rows[1].date_bin, 2)

    async def test_build_dataset_uses_imported_self_report_when_no_cogfunc_row_exists(self) -> None:
        row = _dataset_row(
            cogfunc_mean_score=None,
            cogfunc_legacy_mean=None,
            cogfunc_data_source=None,
            import_self_report=4.5,
            digit_span_total_correct=None,
            gad_total_score=None,
            gad_legacy_total_score=14,
            gad_data_source="imported",
            cesd_total_score=None,
            cesd_legacy_mean=2.1,
            cesd_data_source="imported",
            uls_computed_mean=None,
            uls_legacy_mean=1.75,
            uls_data_source="imported",
        )
        db = _FakeAsyncSession([_FakeResult(rows=[row])])

        result = await build_canonical_analysis_dataset(
            db,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 1),
        )

        self.assertEqual(result.included_sessions, 1)
        self.assertEqual(result.imported_rows, 1)
        self.assertEqual(result.native_rows, 0)
        self.assertEqual(result.rows[0].self_report, 4.5)
        self.assertIsNone(result.rows[0].digit_span_score)
        self.assertIn("self_report", result.rows[0].imported_fields)
        self.assertIn("anxiety", result.rows[0].imported_fields)
        self.assertIn("depression", result.rows[0].imported_fields)
        self.assertIn("loneliness", result.rows[0].imported_fields)

    async def test_build_dataset_excludes_rows_with_structured_reasons(self) -> None:
        missing_study_day = _dataset_row(
            date_local=None,
            weather_temperature=None,
            weather_precipitation=None,
            weather_daylight_hours=None,
        )
        missing_daylight_and_outcomes = _dataset_row(
            weather_daylight_hours=None,
            cogfunc_mean_score=None,
            cogfunc_legacy_mean=None,
            cogfunc_data_source=None,
            import_self_report=None,
            digit_span_total_correct=None,
            digit_span_data_source=None,
        )
        db = _FakeAsyncSession(
            [_FakeResult(rows=[missing_study_day, missing_daylight_and_outcomes])]
        )

        result = await build_canonical_analysis_dataset(
            db,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 1),
        )

        self.assertEqual(result.included_sessions, 0)
        self.assertEqual(result.excluded_count, 2)
        counts = {item.reason: item.count for item in result.exclusion_reasons}
        self.assertEqual(counts["missing_study_day"], 1)
        self.assertEqual(counts["missing_daylight_hours"], 2)
        self.assertEqual(counts["missing_modeled_outcome"], 1)

    async def test_build_dataset_rejects_inverted_date_range(self) -> None:
        db = _FakeAsyncSession([_FakeResult(rows=[])])

        with self.assertRaisesRegex(ValueError, "date_from must not be after date_to"):
            await build_canonical_analysis_dataset(
                db,
                date_from=date(2026, 3, 2),
                date_to=date(2026, 3, 1),
            )
