from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql

from app.models import CardSortingRun, CardSortingTrial, Session, StroopRun, StroopTrial
from app.schemas.cognitive import (
    CardSortingRunResponse,
    CardSortingTrialSubmission,
    StroopRunResponse,
    StroopTrialSubmission,
)


def test_session_model_has_cognitive_order_fields() -> None:
    table = Session.__table__

    assert "cognitive_task_order" in table.c
    assert "card_sorting_rule_order" in table.c
    assert isinstance(table.c.cognitive_task_order.type, postgresql.JSONB)
    assert isinstance(table.c.card_sorting_rule_order.type, postgresql.JSONB)
    assert {
        constraint.name
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    } >= {
        "ck_sessions_cognitive_task_order_array",
        "ck_sessions_card_sorting_rule_order_array",
    }


def test_stroop_tables_have_session_unique_and_trial_uniqueness() -> None:
    run_table = StroopRun.__table__
    trial_table = StroopTrial.__table__

    assert run_table.name == "stroop_runs"
    assert trial_table.name == "stroop_trials"
    assert {"run_id", "session_id", "participant_uuid", "overall_accuracy"} <= set(
        run_table.c.keys()
    )
    assert run_table.c.session_id.foreign_keys
    assert run_table.c.participant_uuid.foreign_keys
    assert trial_table.c.run_id.foreign_keys
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("session_id",)
        for constraint in run_table.constraints
    )
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("run_id", "trial_number")
        for constraint in trial_table.constraints
    )


def test_card_sorting_tables_have_session_unique_and_trial_uniqueness() -> None:
    run_table = CardSortingRun.__table__
    trial_table = CardSortingTrial.__table__

    assert run_table.name == "card_sorting_runs"
    assert trial_table.name == "card_sorting_trials"
    assert {"run_id", "session_id", "participant_uuid", "rule_order"} <= set(
        run_table.c.keys()
    )
    assert run_table.c.session_id.foreign_keys
    assert run_table.c.participant_uuid.foreign_keys
    assert trial_table.c.run_id.foreign_keys
    assert isinstance(run_table.c.rule_order.type, postgresql.JSONB)
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("session_id",)
        for constraint in run_table.constraints
    )
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("run_id", "trial_number")
        for constraint in trial_table.constraints
    )


def test_cognitive_schemas_serialize_planned_response_shapes() -> None:
    run_id = uuid4()

    stroop_response = StroopRunResponse(
        run_id=run_id,
        total_trials=80,
        correct_trials=72,
        error_trials=6,
        timeout_trials=2,
        overall_accuracy=Decimal("0.9000"),
        congruent_accuracy=Decimal("0.9500"),
        incongruent_accuracy=Decimal("0.8500"),
        mean_rt_congruent_ms=Decimal("650.00"),
        mean_rt_incongruent_ms=Decimal("780.00"),
        stroop_interference_ms=Decimal("130.00"),
    )
    stroop_trial = StroopTrialSubmission(
        trial_number=1,
        condition="congruent",
        word="RED",
        ink_color="red",
        response_key="r",
        response_color="red",
        reaction_time_ms=742,
        timed_out=False,
    )
    card_response = CardSortingRunResponse(
        run_id=run_id,
        total_trials=64,
        categories_completed=4,
        total_correct=45,
        total_errors=19,
        perseverative_responses=7,
        perseverative_errors=6,
        nonperseverative_errors=13,
        trials_to_first_category=14,
        failure_to_maintain_set_count=1,
    )
    card_trial = CardSortingTrialSubmission(
        trial_number=1,
        card_color="red",
        card_shape="triangle",
        card_number=2,
        selected_reference_index=3,
        reaction_time_ms=2310,
    )

    assert stroop_response.model_dump(mode="json")["run_id"] == str(run_id)
    assert stroop_trial.model_dump()["timed_out"] is False
    assert card_response.model_dump(mode="json")["categories_completed"] == 4
    assert card_trial.model_dump()["selected_reference_index"] == 3
