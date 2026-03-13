from __future__ import annotations

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql

from app.models import AnalyticsRun, AnalyticsSnapshot, Session


def test_analytics_run_table_has_expected_audit_columns() -> None:
    table = AnalyticsRun.__table__

    assert table.name == "analytics_runs"
    assert {"run_id", "date_from", "date_to", "model_version", "status", "result_payload_json"} <= set(table.c.keys())
    assert any(
        isinstance(constraint, CheckConstraint)
        and constraint.name == "ck_analytics_runs_date_range"
        for constraint in table.constraints
    )


def test_analytics_snapshot_table_has_unique_versioned_range_and_fk() -> None:
    table = AnalyticsSnapshot.__table__

    assert table.name == "analytics_snapshots"
    assert table.c.source_run_id.foreign_keys
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == (
            "date_from",
            "date_to",
            "model_version",
            "response_version",
        )
        for constraint in table.constraints
    )


def test_session_table_has_partial_indexes_for_complete_analytics_reads() -> None:
    table = Session.__table__
    indexes = {index.name: index for index in table.indexes}

    assert "ix_sessions_complete_completed_at" in indexes
    assert "ix_sessions_complete_study_day_completed_at" in indexes

    completed_at_index = indexes["ix_sessions_complete_completed_at"]
    study_day_index = indexes["ix_sessions_complete_study_day_completed_at"]

    assert tuple(str(expr) for expr in completed_at_index.expressions) == (
        "sessions.completed_at",
        "sessions.session_id",
    )
    assert tuple(str(expr) for expr in study_day_index.expressions) == (
        "sessions.study_day_id",
        "sessions.completed_at",
        "sessions.session_id",
    )

    completed_at_where = completed_at_index.dialect_options["postgresql"]["where"]
    study_day_where = study_day_index.dialect_options["postgresql"]["where"]
    assert (
        str(
            completed_at_where.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        == "status = 'complete'"
    )
    assert (
        str(
            study_day_where.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        == "status = 'complete' AND study_day_id IS NOT NULL"
    )
