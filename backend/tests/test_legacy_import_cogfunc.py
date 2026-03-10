"""Regression tests for legacy CogFunc import/backfill behavior."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from app.scripts import phase4_backfill
from app.services import import_service
from app.services.import_service import ParsedRow, ParseResult, _DbValidation


class _FakeResult:
    def __init__(
        self,
        *,
        scalar_one: object | None = None,
        scalar_list: list[object] | None = None,
        rows: list[object] | None = None,
    ) -> None:
        self._scalar_one = scalar_one
        self._scalar_list = scalar_list or []
        self._rows = rows or []

    def scalar_one(self) -> object:
        return self._scalar_one

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> list[object]:
        if self._rows:
            return self._rows
        return list(self._scalar_list)


class _FakeAsyncSession:
    def __init__(self, execute_results: list[_FakeResult] | None = None) -> None:
        self.execute_results = list(execute_results or [])
        self.executed: list[object] = []
        self.added: list[object] = []
        self.committed = False

    async def execute(self, stmt: object) -> _FakeResult:
        self.executed.append(stmt)
        if self.execute_results:
            return self.execute_results.pop(0)
        return _FakeResult()

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        for obj in self.added:
            if getattr(obj, "session_id", None) is None:
                setattr(obj, "session_id", uuid.uuid4())

    async def commit(self) -> None:
        self.committed = True


class _SessionContext:
    def __init__(self, session: _FakeAsyncSession) -> None:
        self.session = session

    async def __aenter__(self) -> _FakeAsyncSession:
        return self.session

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


@dataclass
class _FakeSessionFactory:
    sessions: list[_FakeAsyncSession]

    def __call__(self) -> _SessionContext:
        return _SessionContext(self.sessions.pop(0))


def _find_insert(session: _FakeAsyncSession, table_name: str) -> object:
    for stmt in session.executed:
        table = getattr(stmt, "table", None)
        if table is not None and getattr(table, "name", None) == table_name:
            return stmt
    raise AssertionError(f"No statement recorded for table {table_name!r}")


def _parsed_result(
    *,
    participant_number: int = 101,
    digit_span_legacy_score: int | None = 9,
    self_report: float | None = 4.25,
) -> ParseResult:
    row = ParsedRow(
        row_num=2,
        participant_number=participant_number,
        date_local=date(2026, 3, 1),
        age_band=None,
        gender=None,
        origin=None,
        origin_other_text=None,
        commute_method=None,
        commute_method_other_text=None,
        time_outside=None,
        daylight_exposure_minutes=None,
        precipitation_mm=None,
        temperature_c=None,
        anxiety_mean=None,
        loneliness_mean=None,
        depression_mean=None,
        digit_span_legacy_score=digit_span_legacy_score,
        self_report=self_report,
        source_row_json={"participant ID": participant_number},
    )
    return ParseResult(
        file_type="xlsx",
        rows=[row],
        errors=[],
        warnings=[],
        rows_attempted=1,
    )


class LegacyCogFuncImportTests(IsolatedAsyncioTestCase):
    async def test_preview_import_counts_self_report_row_as_create_without_errors(self) -> None:
        db = _FakeAsyncSession(
            execute_results=[
                _FakeResult(rows=[]),
            ]
        )
        result = _parsed_result()

        preview = await import_service.preview_import(result, db)

        self.assertEqual(preview.rows_total, 1)
        self.assertEqual(preview.participants_create, 1)
        self.assertEqual(preview.sessions_create, 1)
        self.assertEqual(preview.participants_update, 0)
        self.assertEqual(preview.sessions_update, 0)
        self.assertEqual(preview.errors, [])
        self.assertEqual(preview.warnings, [])

    async def test_preview_import_counts_self_report_row_as_update_when_session_has_only_imported_data(self) -> None:
        participant_uuid = uuid.uuid4()
        session_id = uuid.uuid4()
        db = _FakeAsyncSession(
            execute_results=[
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            participant_number=101,
                            participant_uuid=participant_uuid,
                        )
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            participant_uuid=participant_uuid,
                            cnt=1,
                        )
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            participant_uuid=participant_uuid,
                            session_id=session_id,
                        )
                    ]
                ),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
            ]
        )

        preview = await import_service.preview_import(_parsed_result(), db)

        self.assertEqual(preview.rows_total, 1)
        self.assertEqual(preview.participants_create, 0)
        self.assertEqual(preview.participants_update, 1)
        self.assertEqual(preview.sessions_create, 0)
        self.assertEqual(preview.sessions_update, 1)
        self.assertEqual(preview.errors, [])

    async def test_get_sessions_with_native_rows_treats_cogfunc_like_other_imported_tables(self) -> None:
        session_id = uuid.uuid4()
        db = _FakeAsyncSession(
            execute_results=[
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[session_id]),
            ]
        )

        found = await import_service._get_sessions_with_native_rows(db, [session_id])

        self.assertEqual(found, {session_id})
        self.assertEqual(len(db.executed), 5)

        cogfunc_stmt = db.executed[-1]
        compiled = cogfunc_stmt.compile(dialect=postgresql.dialect())
        sql = str(compiled)
        self.assertIn("survey_cogfunc8a.data_source =", sql)
        self.assertIn([session_id], compiled.params.values())
        self.assertIn("native", compiled.params.values())

    async def test_commit_import_rejects_reimport_when_native_cogfunc_row_exists(self) -> None:
        participant_uuid = uuid.uuid4()
        session_id = uuid.uuid4()
        db = _FakeAsyncSession(
            execute_results=[
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            participant_number=101,
                            participant_uuid=participant_uuid,
                        )
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            participant_uuid=participant_uuid,
                            cnt=1,
                        )
                    ]
                ),
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            participant_uuid=participant_uuid,
                            session_id=session_id,
                        )
                    ]
                ),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[session_id]),
            ]
        )

        with self.assertRaises(HTTPException) as ctx:
            await import_service.commit_import(_parsed_result(), db)

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertEqual(
            ctx.exception.detail,
            [
                {
                    "row": 2,
                    "field": "participant id",
                    "message": (
                        "Participant 101 has a session with native survey or "
                        "digit span data — import cannot overwrite it."
                    ),
                }
            ],
        )
        self.assertFalse(db.committed)

    async def test_commit_import_upserts_imported_cogfunc_rows_from_self_report(self) -> None:
        study_day_id = uuid.uuid4()
        participant_uuid = uuid.uuid4()
        db = _FakeAsyncSession(
            execute_results=[
                _FakeResult(scalar_one=study_day_id),
                _FakeResult(scalar_one=participant_uuid),
            ]
        )

        result = _parsed_result()
        validation = _DbValidation(
            errors=[],
            participants_create=1,
            participants_update=0,
            sessions_create=1,
            sessions_update=0,
            existing_p_uuids={},
            session_actions={101: ("create", None)},
        )

        with patch.object(
            import_service,
            "_validate_with_db",
            new=AsyncMock(return_value=validation),
        ):
            response = await import_service.commit_import(result, db)

        self.assertEqual(response.rows_total, 1)
        self.assertEqual(response.sessions_created, 1)
        self.assertTrue(db.committed)

        cogfunc_stmt = _find_insert(db, "survey_cogfunc8a")
        compiled = cogfunc_stmt.compile(dialect=postgresql.dialect())
        sql = str(compiled)

        self.assertIn("ON CONFLICT (session_id) DO UPDATE", sql)
        self.assertIn("WHERE survey_cogfunc8a.data_source =", sql)
        self.assertIn(4.25, compiled.params.values())
        imported_flags = [value for value in compiled.params.values() if value == "imported"]
        self.assertGreaterEqual(len(imported_flags), 2)

        digitspan_stmt = _find_insert(db, "digitspan_runs")
        digitspan_compiled = digitspan_stmt.compile(dialect=postgresql.dialect())
        digitspan_sql = str(digitspan_compiled)

        self.assertIn("ON CONFLICT (session_id) DO UPDATE", digitspan_sql)
        self.assertIn("WHERE digitspan_runs.data_source =", digitspan_sql)
        self.assertIn(9, digitspan_compiled.params.values())
        self.assertIn("imported", digitspan_compiled.params.values())
        self.assertIn(None, digitspan_compiled.params.values())

    async def test_phase4_backfill_upserts_imported_cogfunc_rows_from_self_report(self) -> None:
        session_id = uuid.uuid4()
        participant_uuid = uuid.uuid4()
        main_db = _FakeAsyncSession(
            execute_results=[
                _FakeResult(
                    rows=[
                        SimpleNamespace(
                            session_id=session_id,
                            participant_uuid=participant_uuid,
                            legacy_digit_span_score=None,
                            loneliness_mean=None,
                            depression_mean=None,
                            anxiety_mean=None,
                            self_report=3.75,
                            completed_at=None,
                            study_day_id=uuid.uuid4(),
                        )
                    ]
                ),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
                _FakeResult(scalar_list=[]),
            ]
        )
        weather_db = _FakeAsyncSession()
        session_factory = _FakeSessionFactory([main_db, weather_db])
        weather_result = SimpleNamespace(days_inserted=0, days_updated=0, days_skipped=0)

        with patch.object(
            phase4_backfill,
            "get_session_factory",
            return_value=session_factory,
        ), patch.object(
            phase4_backfill,
            "run_legacy_weather_backfill",
            new=AsyncMock(return_value=weather_result),
        ):
            counts = await phase4_backfill.run_backfill(dry_run=False)

        self.assertEqual(counts.sessions_total, 1)
        self.assertEqual(counts.cogfunc_created, 1)
        self.assertEqual(counts.cogfunc_updated, 0)
        self.assertEqual(counts.cogfunc_skipped, 0)
        self.assertTrue(main_db.committed)

        cogfunc_stmt = _find_insert(main_db, "survey_cogfunc8a")
        compiled = cogfunc_stmt.compile(dialect=postgresql.dialect())
        sql = str(compiled)

        self.assertIn("ON CONFLICT (session_id) DO UPDATE", sql)
        self.assertIn("WHERE survey_cogfunc8a.data_source =", sql)
        self.assertIn(3.75, compiled.params.values())
