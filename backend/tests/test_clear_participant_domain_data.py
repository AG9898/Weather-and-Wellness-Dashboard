"""Regression tests for the selective participant-domain wipe script."""

from __future__ import annotations

from unittest import IsolatedAsyncioTestCase

from app.scripts import clear_participant_domain_data


class _FakeResult:
    def __init__(
        self,
        *,
        scalar_one: int | None = None,
        rowcount: int | None = None,
    ) -> None:
        self._scalar_one = scalar_one
        self.rowcount = rowcount

    def scalar_one(self) -> int:
        if self._scalar_one is None:
            raise AssertionError("scalar_one() was requested without a configured value.")
        return self._scalar_one


class _FakeAsyncSession:
    def __init__(self, counts: dict[str, int], delete_rowcount: int) -> None:
        self.counts = counts
        self.delete_rowcount = delete_rowcount
        self.executed_sql: list[str] = []
        self.committed = False

    async def execute(self, stmt: object) -> _FakeResult:
        sql = str(stmt).strip()
        self.executed_sql.append(sql)

        if sql == clear_participant_domain_data._SELECTIVE_WIPE_SQL:
            return _FakeResult()
        if sql == clear_participant_domain_data._DELETE_ORPHAN_STUDY_DAYS_SQL:
            return _FakeResult(rowcount=self.delete_rowcount)
        if sql.startswith("SELECT count(*) FROM "):
            table = sql.removeprefix("SELECT count(*) FROM ").strip()
            return _FakeResult(scalar_one=self.counts[table])
        raise AssertionError(f"Unexpected SQL: {sql}")

    async def commit(self) -> None:
        self.committed = True


class _SessionContext:
    def __init__(self, session: _FakeAsyncSession) -> None:
        self.session = session

    async def __aenter__(self) -> _FakeAsyncSession:
        return self.session

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None


def _session_factory(session: _FakeAsyncSession):
    def factory() -> _SessionContext:
        return _SessionContext(session)

    return factory


class ClearParticipantDomainDataTests(IsolatedAsyncioTestCase):
    async def test_dry_run_returns_without_opening_db_session(self) -> None:
        used = False

        def failing_factory() -> _SessionContext:
            nonlocal used
            used = True
            raise AssertionError("Dry-run should not open a DB session.")

        result = await clear_participant_domain_data.run_selective_wipe(
            apply=False,
            session_factory=failing_factory,
        )

        self.assertIsNone(result)
        self.assertFalse(used)

    async def test_apply_preserves_weather_tables_and_cleans_orphan_study_days(self) -> None:
        counts = {
            "digitspan_trials": 0,
            "digitspan_runs": 0,
            "survey_uls8": 0,
            "survey_cesd10": 0,
            "survey_gad7": 0,
            "survey_cogfunc8a": 0,
            "imported_session_measures": 0,
            "sessions": 0,
            "participants": 0,
            "study_days": 12,
            "weather_daily": 12,
            "weather_ingest_runs": 3,
        }
        session = _FakeAsyncSession(counts=counts, delete_rowcount=4)

        summary = await clear_participant_domain_data.run_selective_wipe(
            apply=True,
            session_factory=_session_factory(session),
        )

        self.assertIsNotNone(summary)
        assert summary is not None
        self.assertEqual(summary.deleted_orphan_study_days, 4)
        self.assertEqual(summary.post_counts["weather_daily"], 12)
        self.assertEqual(summary.post_counts["weather_ingest_runs"], 3)
        self.assertTrue(session.committed)

        truncate_sql = session.executed_sql[0]
        self.assertIn("participants", truncate_sql)
        self.assertIn("sessions", truncate_sql)
        self.assertNotIn("weather_daily", truncate_sql)
        self.assertNotIn("weather_ingest_runs", truncate_sql)

        self.assertEqual(
            session.executed_sql[1],
            clear_participant_domain_data._DELETE_ORPHAN_STUDY_DAYS_SQL,
        )
