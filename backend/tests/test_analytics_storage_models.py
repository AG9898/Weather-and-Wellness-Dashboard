from __future__ import annotations

from sqlalchemy import CheckConstraint, UniqueConstraint

from app.models import AnalyticsRun, AnalyticsSnapshot


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
