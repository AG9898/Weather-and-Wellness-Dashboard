"""Regression tests for analytics snapshot orchestration."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase
from unittest.mock import AsyncMock, patch

from app.analytics.dataset import AnalyticsDatasetBuildResult, AnalyticsDatasetRow
from app.analytics.modeling import AnalyticsModelingResult
from app.analytics.temperature_summary import build_temperature_summary
from app.models.analytics import AnalyticsRun, AnalyticsSnapshot
from app.schemas.analytics import (
    AnalyticsDatasetMetadataResponse,
    AnalyticsEffectCardResponse,
    AnalyticsModelSummaryResponse,
    AnalyticsTemperatureSummaryResponse,
    DashboardAnalyticsResponse,
)
from app.services.analytics_service import (
    complete_dashboard_analytics_refresh,
    get_dashboard_analytics,
    read_dashboard_analytics_snapshot,
    recompute_dashboard_analytics,
    request_dashboard_analytics_refresh,
)


class _FakeAsyncSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commit_count = 0

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def commit(self) -> None:
        self.commit_count += 1


def _build_dataset_metadata(
    *,
    generated_at: datetime,
) -> AnalyticsDatasetMetadataResponse:
    return AnalyticsDatasetMetadataResponse(
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 8),
        included_sessions=24,
        included_days=8,
        native_rows=20,
        imported_rows=4,
        excluded_rows=3,
        exclusion_reasons=[],
        generated_at=generated_at,
    )


def _build_model_summary(
    *,
    generated_at: datetime,
) -> AnalyticsModelSummaryResponse:
    return AnalyticsModelSummaryResponse(
        outcome="digit_span",
        formula="digit_span_z ~ temperature_z + anxiety_z + (1 | date_bin)",
        sample_size=24,
        day_count=8,
        converged=True,
        generated_at=generated_at,
        warnings=[],
        effects=[
            AnalyticsEffectCardResponse(
                term="temperature_z",
                predictor="temperature_z",
                is_interaction=False,
                coefficient=0.25,
                standard_error=0.1,
                statistic=2.5,
                p_value=0.02,
                ci_95_low=0.05,
                ci_95_high=0.45,
                direction="positive",
                significant=True,
            )
        ],
    )


def _build_temperature_summary() -> AnalyticsTemperatureSummaryResponse:
    generated_at = datetime(2026, 3, 10, 20, 0, tzinfo=timezone.utc)
    rows = (
        AnalyticsDatasetRow(
            session_id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
            participant_uuid=uuid.UUID("22222222-2222-2222-2222-222222222222"),
            date_local=date(2026, 3, 1),
            date_bin=1,
            temperature=2.0,
            precipitation=0.0,
            daylight_hours=9.0,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
        ),
        AnalyticsDatasetRow(
            session_id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
            participant_uuid=uuid.UUID("44444444-4444-4444-4444-444444444444"),
            date_local=date(2026, 3, 2),
            date_bin=2,
            temperature=8.0,
            precipitation=0.0,
            daylight_hours=9.5,
            anxiety=1.0,
            depression=1.0,
            loneliness=1.0,
            self_report=1.0,
            digit_span_score=1,
            imported_fields=(),
        ),
    )
    dataset = AnalyticsDatasetBuildResult(
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 2),
        generated_at=generated_at,
        rows=rows,
        excluded_rows=(),
    )
    return build_temperature_summary(dataset)


def _build_modeling_result(
    *,
    status: str,
    generated_at: datetime,
    warnings: tuple[str, ...] = (),
    temperature_summary: AnalyticsTemperatureSummaryResponse | None = None,
) -> AnalyticsModelingResult:
    if temperature_summary is None:
        temperature_summary = (
            _build_temperature_summary()
            if status != "insufficient_data"
            else AnalyticsTemperatureSummaryResponse()
        )
    return AnalyticsModelingResult(
        status=status,
        generated_at=generated_at,
        dataset=_build_dataset_metadata(generated_at=generated_at),
        models=(_build_model_summary(generated_at=generated_at),) if status != "insufficient_data" else (),
        temperature_summary=temperature_summary,
        warnings=warnings,
    )


def _build_snapshot(
    *,
    source_run_id: uuid.UUID,
    generated_at: datetime,
) -> AnalyticsSnapshot:
    temperature_summary = _build_temperature_summary()
    payload = DashboardAnalyticsResponse(
        status="ready",
        snapshot={
            "generated_at": generated_at,
        },
        dataset=_build_dataset_metadata(generated_at=generated_at),
        models=[_build_model_summary(generated_at=generated_at)],
        temperature_summary=temperature_summary,
    ).model_dump(mode="json")
    return AnalyticsSnapshot(
        snapshot_id=uuid.uuid4(),
        date_from=date(2026, 3, 1),
        date_to=date(2026, 3, 8),
        model_version="weather-mlm-v2",
        response_version="dashboard-analytics-v2",
        status="ready",
        warnings_json=[],
        payload_json=payload,
        source_run_id=source_run_id,
        generated_at=generated_at,
    )


class AnalyticsServiceTests(IsolatedAsyncioTestCase):
    async def test_snapshot_read_returns_stored_payload_without_recompute(self) -> None:
        run_id = uuid.uuid4()
        generated_at = datetime(2026, 3, 10, 20, 0, tzinfo=timezone.utc)
        snapshot = _build_snapshot(source_run_id=run_id, generated_at=generated_at)
        source_run = AnalyticsRun(
            run_id=run_id,
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            model_version="weather-mlm-v2",
            response_version="dashboard-analytics-v2",
            status="ready",
            started_at=generated_at,
            finished_at=generated_at,
        )

        with (
            patch(
                "app.services.analytics_service._get_latest_snapshot",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "app.services.analytics_service._get_latest_run",
                new=AsyncMock(return_value=source_run),
            ),
            patch(
                "app.services.analytics_service.build_canonical_analysis_dataset",
                new=AsyncMock(),
            ) as build_dataset_mock,
        ):
            response = await get_dashboard_analytics(
                _FakeAsyncSession(),
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                mode="snapshot",
            )

        assert response is not None
        assert response.status == "ready"
        assert response.snapshot.mode == "snapshot"
        assert response.snapshot.generated_at == generated_at
        assert response.temperature_summary.windows[0].day_count == 2
        assert response.temperature_summary.windows[0].threshold_method == "window_day_zscore_v1"
        assert response.temperature_summary.windows[0].threshold_z_cutoff == 2
        build_dataset_mock.assert_not_awaited()

    async def test_live_recompute_persists_run_metadata_and_snapshot_after_success(self) -> None:
        db = _FakeAsyncSession()
        generated_at = datetime(2026, 3, 10, 21, 0, tzinfo=timezone.utc)
        modeling_result = _build_modeling_result(
            status="ready",
            generated_at=generated_at,
            warnings=("optimizer retried",),
        )

        def _fit_side_effect(dataset_result: object) -> AnalyticsModelingResult:
            assert all(not isinstance(item, AnalyticsSnapshot) for item in db.added)
            assert len([item for item in db.added if isinstance(item, AnalyticsRun)]) == 1
            assert dataset_result == "dataset-build-result"
            return modeling_result

        with (
            patch(
                "app.services.analytics_service._get_latest_snapshot",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "app.services.analytics_service._get_latest_run",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "app.services.analytics_service.build_canonical_analysis_dataset",
                new=AsyncMock(return_value="dataset-build-result"),
            ),
            patch(
                "app.services.analytics_service.fit_analytics_models",
                side_effect=_fit_side_effect,
            ),
        ):
            response = await recompute_dashboard_analytics(
                db,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                triggered_by_lab_member_id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            )

        runs = [item for item in db.added if isinstance(item, AnalyticsRun)]
        snapshots = [item for item in db.added if isinstance(item, AnalyticsSnapshot)]

        assert response.status == "ready"
        assert response.snapshot.mode == "live"
        assert response.snapshot.recompute_started_at is not None
        assert response.snapshot.recompute_finished_at is not None
        assert response.temperature_summary.windows[0].day_count == 2
        assert response.temperature_summary.windows[0].threshold_method == "window_day_zscore_v1"
        assert response.temperature_summary.windows[0].threshold_z_cutoff == 2
        assert len(runs) == 1
        assert len(snapshots) == 1
        assert db.commit_count == 2

        run = runs[0]
        snapshot = snapshots[0]
        assert run.status == "ready"
        assert run.model_version == "weather-mlm-v2"
        assert run.generated_at == generated_at
        assert run.warnings_json == ["optimizer retried"]
        assert run.result_payload_json is not None
        assert run.triggered_by_lab_member_id == uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        assert snapshot.status == "ready"
        assert snapshot.source_run_id == run.run_id
        assert snapshot.generated_at == generated_at
        assert snapshot.payload_json["status"] == "ready"
        assert snapshot.payload_json["snapshot"]["mode"] == "snapshot"
        assert snapshot.payload_json["snapshot"]["recompute_started_at"] is None
        assert snapshot.payload_json["temperature_summary"]["windows"][0]["day_count"] == 2

    async def test_live_recompute_returns_recomputing_snapshot_while_run_is_in_progress(self) -> None:
        db = _FakeAsyncSession()
        source_run_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        snapshot = _build_snapshot(
            source_run_id=source_run_id,
            generated_at=now - timedelta(minutes=10),
        )
        recomputing_run = AnalyticsRun(
            run_id=uuid.uuid4(),
            date_from=date(2026, 3, 1),
            date_to=date(2026, 3, 8),
            model_version="weather-mlm-v2",
            response_version="dashboard-analytics-v2",
            status="recomputing",
            started_at=now - timedelta(minutes=1),
            finished_at=None,
        )

        with (
            patch(
                "app.services.analytics_service._get_latest_snapshot",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "app.services.analytics_service._get_latest_run",
                new=AsyncMock(return_value=recomputing_run),
            ),
            patch(
                "app.services.analytics_service.build_canonical_analysis_dataset",
                new=AsyncMock(),
            ) as build_dataset_mock,
        ):
            response = await recompute_dashboard_analytics(
                db,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
            )

        assert response.status == "recomputing"
        assert response.snapshot.is_stale is True
        assert response.snapshot.recompute_started_at == recomputing_run.started_at
        assert response.temperature_summary.windows[0].day_count == 2
        assert response.temperature_summary.windows[0].threshold_method == "window_day_zscore_v1"
        assert db.added == []
        assert db.commit_count == 0
        build_dataset_mock.assert_not_awaited()

    async def test_refresh_request_starts_background_run_and_returns_recomputing_snapshot(self) -> None:
        db = _FakeAsyncSession()
        source_run_id = uuid.uuid4()
        snapshot = _build_snapshot(
            source_run_id=source_run_id,
            generated_at=datetime(2026, 3, 10, 19, 0, tzinfo=timezone.utc),
        )

        with (
            patch(
                "app.services.analytics_service._get_latest_snapshot",
                new=AsyncMock(return_value=snapshot),
            ),
            patch(
                "app.services.analytics_service._get_latest_run",
                new=AsyncMock(return_value=None),
            ),
        ):
            result = await request_dashboard_analytics_refresh(
                db,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
                triggered_by_lab_member_id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            )

        runs = [item for item in db.added if isinstance(item, AnalyticsRun)]

        assert result.run_id is not None
        assert result.response.status == "recomputing"
        assert result.response.snapshot.is_stale is True
        assert result.response.snapshot.mode == "live"
        assert result.response.temperature_summary.windows[0].day_count == 2
        assert result.response.temperature_summary.windows[0].threshold_method == "window_day_zscore_v1"
        assert len(runs) == 1
        assert runs[0].run_id == result.run_id
        assert runs[0].status == "recomputing"
        assert db.commit_count == 1

    async def test_complete_background_refresh_returns_none_when_run_is_missing(self) -> None:
        with patch(
            "app.services.analytics_service._get_run_by_id",
            new=AsyncMock(return_value=None),
        ):
            result = await complete_dashboard_analytics_refresh(
                _FakeAsyncSession(),
                run_id=uuid.uuid4(),
            )

        assert result is None

    async def test_live_recompute_failure_preserves_prior_snapshot_and_marks_run_failed(self) -> None:
        db = _FakeAsyncSession()
        prior_run_id = uuid.uuid4()
        prior_snapshot = _build_snapshot(
            source_run_id=prior_run_id,
            generated_at=datetime(2026, 3, 10, 18, 0, tzinfo=timezone.utc),
        )

        with (
            patch(
                "app.services.analytics_service._get_latest_snapshot",
                new=AsyncMock(return_value=prior_snapshot),
            ),
            patch(
                "app.services.analytics_service._get_latest_run",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "app.services.analytics_service.build_canonical_analysis_dataset",
                new=AsyncMock(side_effect=RuntimeError("model exploded")),
            ),
        ):
            response = await recompute_dashboard_analytics(
                db,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
            )

        runs = [item for item in db.added if isinstance(item, AnalyticsRun)]
        snapshots = [item for item in db.added if isinstance(item, AnalyticsSnapshot)]

        assert response.status == "stale"
        assert response.snapshot.mode == "live"
        assert response.snapshot.is_stale is True
        assert response.temperature_summary.windows[0].day_count == 2
        assert response.temperature_summary.windows[0].threshold_method == "window_day_zscore_v1"
        assert response.dataset.included_sessions == 24
        assert len(runs) == 1
        assert snapshots == []
        assert db.commit_count == 2
        assert runs[0].status == "failed"
        assert runs[0].error_json == {
            "error_type": "RuntimeError",
            "message": "model exploded",
        }

    async def test_live_recompute_returns_insufficient_data_without_persisting_snapshot(self) -> None:
        db = _FakeAsyncSession()
        generated_at = datetime(2026, 3, 10, 22, 0, tzinfo=timezone.utc)
        modeling_result = _build_modeling_result(
            status="insufficient_data",
            generated_at=generated_at,
            warnings=("No canonical analytics rows are available for the requested window.",),
        )

        with (
            patch(
                "app.services.analytics_service._get_latest_snapshot",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "app.services.analytics_service._get_latest_run",
                new=AsyncMock(return_value=None),
            ),
            patch(
                "app.services.analytics_service.build_canonical_analysis_dataset",
                new=AsyncMock(return_value="dataset-build-result"),
            ),
            patch(
                "app.services.analytics_service.fit_analytics_models",
                return_value=modeling_result,
            ),
        ):
            response = await read_dashboard_analytics_snapshot(
                db,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
            )
            live_response = await recompute_dashboard_analytics(
                db,
                date_from=date(2026, 3, 1),
                date_to=date(2026, 3, 8),
            )

        runs = [item for item in db.added if isinstance(item, AnalyticsRun)]
        snapshots = [item for item in db.added if isinstance(item, AnalyticsSnapshot)]

        assert response is None
        assert live_response.status == "insufficient_data"
        assert live_response.models == []
        assert live_response.temperature_summary.windows == []
        assert live_response.dataset.included_sessions == 24
        assert len(runs) == 1
        assert snapshots == []
        assert db.commit_count == 2
        assert runs[0].status == "insufficient_data"
        assert runs[0].generated_at == generated_at
        assert runs[0].warnings_json == [
            "No canonical analytics rows are available for the requested window."
        ]
