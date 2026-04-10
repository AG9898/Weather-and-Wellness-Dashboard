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

    async def execute(self, stmt: object, *args: object, **kwargs: object) -> _FakeResult:
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
        supplemental_attributes_json={"month": 3, "season_bin": 2},
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

        imported_measures_stmt = _find_insert(db, "imported_session_measures")
        imported_measures_compiled = imported_measures_stmt.compile(
            dialect=postgresql.dialect()
        )
        self.assertIn(
            {"month": 3, "season_bin": 2},
            imported_measures_compiled.params.values(),
        )

    def test_parse_rows_preserves_complete_sheet_supplemental_attributes(self) -> None:
        raw_rows = [
            [
                "Participant ID",
                "Date",
                "commute",
                "daylight",
                "month",
                "season_bin",
                "anxiety_z",
            ],
            [101, "2026-03-01", "Walk", 9.25, 3, 2, 1.5],
        ]

        parsed = import_service._parse_rows_from_raw(raw_rows, "xlsx")

        self.assertEqual(parsed.errors, [])
        self.assertEqual(len(parsed.rows), 1)
        row = parsed.rows[0]
        self.assertEqual(row.commute_method, "Walk")
        self.assertEqual(
            row.supplemental_attributes_json,
            {
                "daylight": 9.25,
                "month": 3,
                "season_bin": 2,
                "anxiety_z": 1.5,
            },
        )

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


# ── Workbook reconciliation tests ──────────────────────────────────────────────

from unittest.mock import MagicMock  # noqa: E402

from app.scripts import reconcile_workbook  # noqa: E402


def _make_workbook_parse_result(participant_numbers: list[int]) -> ParseResult:
    """Return a ParseResult whose rows cover the given participant numbers."""
    rows = [
        ParsedRow(
            row_num=i + 2,
            participant_number=pnum,
            date_local=date(2026, 1, 15),  # fixed date — value not significant here
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
            digit_span_legacy_score=None,
            self_report=None,
            supplemental_attributes_json={},
            source_row_json={"participant ID": pnum},
        )
        for i, pnum in enumerate(participant_numbers)
    ]
    return ParseResult(
        file_type="xlsx",
        rows=rows,
        errors=[],
        warnings=[],
        rows_attempted=len(rows),
    )


def _fake_path(name: str = "data_complete.xlsx") -> MagicMock:
    """Return a MagicMock that stands in for a Path object in reconciliation tests."""
    p = MagicMock()
    p.read_bytes.return_value = b""
    p.name = name
    p.__str__ = lambda self: f"/fake/{name}"
    return p


class ReconcileWorkbookTests(IsolatedAsyncioTestCase):
    """Tests for the workbook reconciliation script."""

    async def _run(
        self,
        *,
        workbook_pnums: list[int],
        db_participants: dict[int, uuid.UUID],
        db_sessions: list[SimpleNamespace],
        native_session_ids: set[uuid.UUID],
        apply: bool,
    ) -> reconcile_workbook.ReconciliationResult:
        """Helper: run reconciliation with mocked parse_file and DB."""
        parse_result = _make_workbook_parse_result(workbook_pnums)

        # Build fake execute results:
        #   [0] = all participants query
        #   [1] = sessions for absent participants
        all_p_rows = [
            SimpleNamespace(participant_number=pnum, participant_uuid=puuid)
            for pnum, puuid in db_participants.items()
        ]
        execute_results = [
            _FakeResult(rows=all_p_rows),
            _FakeResult(rows=db_sessions),
        ]
        db = _FakeAsyncSession(execute_results=execute_results)
        session_context = _SessionContext(db)

        def fake_factory() -> _SessionContext:
            return session_context

        with patch.object(
            reconcile_workbook,
            "parse_file",
            return_value=parse_result,
        ), patch.object(
            reconcile_workbook,
            "_get_sessions_with_native_rows",
            new=AsyncMock(return_value=native_session_ids),
        ):
            return await reconcile_workbook.run_reconciliation(
                file_path=_fake_path(),
                apply=apply,
                session_factory=fake_factory,
            )

    async def test_dry_run_identifies_imported_only_absent_participant(self) -> None:
        """Dry-run reports imported-only absent participant in would_delete_pnums."""
        p101_uuid = uuid.uuid4()
        p142_uuid = uuid.uuid4()
        session_142 = uuid.uuid4()

        result = await self._run(
            workbook_pnums=[101],
            db_participants={101: p101_uuid, 142: p142_uuid},
            db_sessions=[
                SimpleNamespace(session_id=session_142, participant_uuid=p142_uuid)
            ],
            native_session_ids=set(),  # 142 has only imported data
            apply=False,
        )

        self.assertEqual(result.mode, "dry-run")
        self.assertEqual(result.absent_from_workbook, [142])
        self.assertEqual(result.would_delete_pnums, [142])
        self.assertEqual(result.protected_pnums, [])
        self.assertEqual(result.deleted_pnums, [])
        self.assertEqual(result.sessions_deleted, 0)
        self.assertEqual(result.participants_deleted, 0)

    async def test_apply_deletes_imported_only_absent_participant(self) -> None:
        """Apply mode deletes imported-only participant absent from workbook."""
        p101_uuid = uuid.uuid4()
        p142_uuid = uuid.uuid4()
        session_142 = uuid.uuid4()

        result = await self._run(
            workbook_pnums=[101],
            db_participants={101: p101_uuid, 142: p142_uuid},
            db_sessions=[
                SimpleNamespace(session_id=session_142, participant_uuid=p142_uuid)
            ],
            native_session_ids=set(),  # 142 has only imported data
            apply=True,
        )

        self.assertEqual(result.mode, "apply")
        self.assertEqual(result.absent_from_workbook, [142])
        self.assertEqual(result.deleted_pnums, [142])
        self.assertEqual(result.protected_pnums, [])
        self.assertEqual(result.would_delete_pnums, [])
        self.assertEqual(result.sessions_deleted, 1)
        self.assertEqual(result.participants_deleted, 1)

    async def test_apply_protects_participant_with_native_data(self) -> None:
        """Participant absent from workbook but with native rows is protected."""
        p101_uuid = uuid.uuid4()
        p200_uuid = uuid.uuid4()
        session_200 = uuid.uuid4()

        result = await self._run(
            workbook_pnums=[101],
            db_participants={101: p101_uuid, 200: p200_uuid},
            db_sessions=[
                SimpleNamespace(session_id=session_200, participant_uuid=p200_uuid)
            ],
            native_session_ids={session_200},  # 200 has native data
            apply=True,
        )

        self.assertEqual(result.mode, "apply")
        self.assertIn(200, result.protected_pnums)
        self.assertEqual(result.deleted_pnums, [])
        self.assertEqual(result.participants_deleted, 0)

    async def test_dry_run_consistent_db_returns_no_deletions(self) -> None:
        """When DB exactly matches workbook, no deletions are reported."""
        p101_uuid = uuid.uuid4()

        result = await self._run(
            workbook_pnums=[101],
            db_participants={101: p101_uuid},
            db_sessions=[],
            native_session_ids=set(),
            apply=False,
        )

        self.assertEqual(result.absent_from_workbook, [])
        self.assertEqual(result.would_delete_pnums, [])
        self.assertEqual(result.deleted_pnums, [])

    async def test_participant_142_pattern_is_removed_when_workbook_absent(self) -> None:
        """Participant 142 (known old-only orphan) is deleted by reconciliation."""
        p_uuids = {pnum: uuid.uuid4() for pnum in range(101, 143)}
        workbook_pnums = list(range(101, 142))  # 142 missing from workbook
        session_142 = uuid.uuid4()
        p142_uuid = p_uuids[142]

        result = await self._run(
            workbook_pnums=workbook_pnums,
            db_participants=p_uuids,
            db_sessions=[
                SimpleNamespace(session_id=session_142, participant_uuid=p142_uuid)
            ],
            native_session_ids=set(),
            apply=True,
        )

        self.assertIn(142, result.deleted_pnums)
        self.assertNotIn(142, result.protected_pnums)
        self.assertEqual(result.participants_deleted, 1)
