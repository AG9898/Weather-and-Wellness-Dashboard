from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql

from app.models import PoffenbergerRun, PoffenbergerTrial
from app.schemas.poffenberger import PoffenbergerRunResponse, PoffenbergerTrialCreate


def test_poffenberger_tables_have_session_and_participant_scope() -> None:
    run_table = PoffenbergerRun.__table__
    trial_table = PoffenbergerTrial.__table__

    assert run_table.name == "ihtt_poffenberger_runs"
    assert trial_table.name == "ihtt_poffenberger_trials"
    assert {"run_id", "session_id", "participant_uuid", "manifest_json"} <= set(
        run_table.c.keys()
    )
    assert {"trial_id", "run_id", "session_id", "participant_uuid"} <= set(
        trial_table.c.keys()
    )
    assert isinstance(run_table.c.manifest_json.type, postgresql.JSONB)
    assert run_table.c.session_id.foreign_keys
    assert run_table.c.participant_uuid.foreign_keys
    assert trial_table.c.run_id.foreign_keys
    assert trial_table.c.session_id.foreign_keys
    assert trial_table.c.participant_uuid.foreign_keys
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("session_id",)
        for constraint in run_table.constraints
    )
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("run_id", "global_trial_number")
        for constraint in trial_table.constraints
    )


def test_poffenberger_models_include_required_summary_and_trial_fields() -> None:
    run_columns = set(PoffenbergerRun.__table__.c.keys())
    trial_columns = set(PoffenbergerTrial.__table__.c.keys())

    assert {
        "lh_lvf_accuracy",
        "lh_rvf_mean_rt_ms",
        "rh_lvf_accurate_trials",
        "rh_rvf_sd_rt_ms",
        "mean_rt_crossed_ms",
        "mean_rt_uncrossed_ms",
        "ihtt_difference_ms",
        "accuracy_crossed",
        "accuracy_uncrossed",
    } <= run_columns
    assert {
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
        "is_timeout",
        "is_valid_response",
        "is_accurate",
        "jitter_ms",
        "client_stimulus_onset_ms",
        "client_response_at_ms",
    } <= trial_columns
    assert {
        constraint.name
        for constraint in trial_table_constraints(PoffenbergerTrial)
    } >= {
        "ck_ihtt_poffenberger_trials_response_hand_allowed",
        "ck_ihtt_poffenberger_trials_visual_field_allowed",
        "ck_ihtt_poffenberger_trials_condition_key_allowed",
        "ck_ihtt_poffenberger_trials_practice_not_scored",
    }


def test_poffenberger_schemas_serialize_storage_shapes() -> None:
    run_id = uuid4()
    session_id = uuid4()
    participant_uuid = uuid4()

    trial = PoffenbergerTrialCreate(
        run_id=run_id,
        session_id=session_id,
        participant_uuid=participant_uuid,
        block_number=1,
        trial_number=1,
        global_trial_number=1,
        response_hand="left",
        visual_field="rvf",
        condition_key="lh_rvf",
        is_practice=False,
        is_scored=True,
        expected_key="a",
        pressed_key="a",
        reaction_time_ms=342,
        is_valid_response=True,
        is_timeout=False,
        is_accurate=True,
        jitter_ms=1180,
        client_stimulus_onset_ms=Decimal("123456.700"),
        client_response_at_ms=Decimal("123798.700"),
    )
    response = PoffenbergerRunResponse(
        run_id=run_id,
        session_id=session_id,
        participant_uuid=participant_uuid,
        manifest_json={"blocks": []},
        started_at=datetime.now(tz=UTC),
        completed_at=datetime.now(tz=UTC),
        is_complete=True,
        total_practice_trials=10,
        total_experimental_trials=600,
        lh_lvf_total_trials=150,
        lh_lvf_valid_rt_trials=146,
        lh_lvf_timeout_trials=2,
        lh_lvf_invalid_trials=2,
        lh_lvf_accurate_trials=145,
        lh_lvf_accuracy=Decimal("0.9667"),
        lh_lvf_mean_rt_ms=Decimal("310.25"),
        lh_lvf_median_rt_ms=Decimal("304.00"),
        lh_lvf_sd_rt_ms=Decimal("24.50"),
        lh_rvf_total_trials=150,
        lh_rvf_valid_rt_trials=145,
        lh_rvf_timeout_trials=3,
        lh_rvf_invalid_trials=2,
        lh_rvf_accurate_trials=144,
        lh_rvf_accuracy=Decimal("0.9600"),
        lh_rvf_mean_rt_ms=Decimal("322.10"),
        lh_rvf_median_rt_ms=Decimal("318.00"),
        lh_rvf_sd_rt_ms=Decimal("26.30"),
        rh_lvf_total_trials=150,
        rh_lvf_valid_rt_trials=147,
        rh_lvf_timeout_trials=1,
        rh_lvf_invalid_trials=2,
        rh_lvf_accurate_trials=146,
        rh_lvf_accuracy=Decimal("0.9733"),
        rh_lvf_mean_rt_ms=Decimal("327.45"),
        rh_lvf_median_rt_ms=Decimal("321.50"),
        rh_lvf_sd_rt_ms=Decimal("22.90"),
        rh_rvf_total_trials=150,
        rh_rvf_valid_rt_trials=148,
        rh_rvf_timeout_trials=1,
        rh_rvf_invalid_trials=1,
        rh_rvf_accurate_trials=147,
        rh_rvf_accuracy=Decimal("0.9800"),
        rh_rvf_mean_rt_ms=Decimal("314.20"),
        rh_rvf_median_rt_ms=Decimal("309.00"),
        rh_rvf_sd_rt_ms=Decimal("21.70"),
        mean_rt_crossed_ms=Decimal("324.78"),
        mean_rt_uncrossed_ms=Decimal("312.23"),
        ihtt_difference_ms=Decimal("12.55"),
        accuracy_crossed=Decimal("0.9667"),
        accuracy_uncrossed=Decimal("0.9733"),
    )

    assert trial.model_dump()["condition_key"] == "lh_rvf"
    assert response.model_dump(mode="json")["run_id"] == str(run_id)
    assert response.model_dump(mode="json")["ihtt_difference_ms"] == "12.55"


def test_poffenberger_trial_schema_rejects_inconsistent_condition() -> None:
    with pytest.raises(ValidationError):
        PoffenbergerTrialCreate(
            run_id=uuid4(),
            session_id=uuid4(),
            participant_uuid=uuid4(),
            block_number=1,
            trial_number=1,
            global_trial_number=1,
            response_hand="left",
            visual_field="rvf",
            condition_key="rh_rvf",
            is_practice=False,
            is_scored=True,
            expected_key="a",
            is_valid_response=True,
            is_timeout=False,
            is_accurate=True,
            jitter_ms=1180,
        )


def trial_table_constraints(model: type[PoffenbergerTrial]) -> set[CheckConstraint]:
    return {
        constraint
        for constraint in model.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    }
