"""Analytics snapshot read and live recompute orchestration service."""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analytics import build_canonical_analysis_dataset, fit_analytics_models
from app.analytics.constants import (
    ANALYTICS_DEFAULT_MODE,
    ANALYTICS_MODEL_VERSION,
    ANALYTICS_RESPONSE_VERSION,
)
from app.models.analytics import AnalyticsRun, AnalyticsSnapshot
from app.schemas.analytics import (
    AnalyticsDatasetMetadataResponse,
    AnalyticsReadMode,
    AnalyticsSnapshotMetadataResponse,
    AnalyticsStatus,
    DashboardAnalyticsResponse,
)


@dataclass(frozen=True)
class AnalyticsRefreshRequestResult:
    """Result of requesting a background analytics refresh."""

    response: DashboardAnalyticsResponse
    run_id: uuid.UUID | None


async def get_dashboard_analytics(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    mode: AnalyticsReadMode = ANALYTICS_DEFAULT_MODE,
    triggered_by_lab_member_id: uuid.UUID | None = None,
) -> DashboardAnalyticsResponse | None:
    """Return analytics for the requested range in snapshot or live mode."""

    if mode == "live":
        return await recompute_dashboard_analytics(
            db,
            date_from=date_from,
            date_to=date_to,
            triggered_by_lab_member_id=triggered_by_lab_member_id,
        )

    return await read_dashboard_analytics_snapshot(
        db,
        date_from=date_from,
        date_to=date_to,
    )


async def request_dashboard_analytics_refresh(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    triggered_by_lab_member_id: uuid.UUID | None = None,
) -> AnalyticsRefreshRequestResult:
    """Start a background recompute when needed and return the current snapshot state."""

    if date_from > date_to:
        raise ValueError("date_from must not be after date_to")

    existing_snapshot = await _get_latest_snapshot(
        db,
        date_from=date_from,
        date_to=date_to,
    )
    latest_run = await _get_latest_run(
        db,
        date_from=date_from,
        date_to=date_to,
    )
    if _is_recomputing_run(latest_run):
        if existing_snapshot is not None:
            return AnalyticsRefreshRequestResult(
                response=_response_from_snapshot(
                    existing_snapshot,
                    mode="live",
                    latest_run=latest_run,
                ),
                run_id=None,
            )
        return AnalyticsRefreshRequestResult(
            response=_response_without_snapshot(
                status="recomputing",
                date_from=date_from,
                date_to=date_to,
                mode="live",
                generated_at=latest_run.started_at or datetime.now(timezone.utc),
                recompute_started_at=latest_run.started_at,
                recompute_finished_at=latest_run.finished_at,
            ),
            run_id=None,
        )

    run = await _create_recompute_run(
        db,
        date_from=date_from,
        date_to=date_to,
        triggered_by_lab_member_id=triggered_by_lab_member_id,
    )
    if existing_snapshot is not None:
        return AnalyticsRefreshRequestResult(
            response=_response_from_snapshot(
                existing_snapshot,
                mode="live",
                latest_run=run,
            ),
            run_id=run.run_id,
        )

    return AnalyticsRefreshRequestResult(
        response=_response_without_snapshot(
            status="recomputing",
            date_from=date_from,
            date_to=date_to,
            mode="live",
            generated_at=run.started_at or datetime.now(timezone.utc),
            recompute_started_at=run.started_at,
            recompute_finished_at=run.finished_at,
        ),
        run_id=run.run_id,
    )


async def complete_dashboard_analytics_refresh(
    db: AsyncSession,
    *,
    run_id: uuid.UUID,
) -> DashboardAnalyticsResponse | None:
    """Finish a previously requested background analytics recompute."""

    run = await _get_run_by_id(db, run_id=run_id)
    if run is None:
        return None
    if run.finished_at is not None or run.status != "recomputing":
        return run.result_payload_json and DashboardAnalyticsResponse.model_validate(
            run.result_payload_json
        )

    existing_snapshot = await _get_latest_snapshot(
        db,
        date_from=run.date_from,
        date_to=run.date_to,
    )
    return await _finish_recompute_run(
        db,
        run=run,
        existing_snapshot=existing_snapshot,
    )


async def read_dashboard_analytics_snapshot(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> DashboardAnalyticsResponse | None:
    """Return the latest durable snapshot for the requested range, if one exists."""

    if date_from > date_to:
        raise ValueError("date_from must not be after date_to")

    snapshot = await _get_latest_snapshot(
        db,
        date_from=date_from,
        date_to=date_to,
    )
    if snapshot is None:
        return None

    latest_run = await _get_latest_run(
        db,
        date_from=date_from,
        date_to=date_to,
    )
    return _response_from_snapshot(
        snapshot,
        mode="snapshot",
        latest_run=latest_run,
    )


async def recompute_dashboard_analytics(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    triggered_by_lab_member_id: uuid.UUID | None = None,
) -> DashboardAnalyticsResponse:
    """Run analytics recompute and persist durable run/snapshot state."""

    if date_from > date_to:
        raise ValueError("date_from must not be after date_to")

    existing_snapshot = await _get_latest_snapshot(
        db,
        date_from=date_from,
        date_to=date_to,
    )
    latest_run = await _get_latest_run(
        db,
        date_from=date_from,
        date_to=date_to,
    )
    if _is_recomputing_run(latest_run):
        if existing_snapshot is not None:
            return _response_from_snapshot(
                existing_snapshot,
                mode="live",
                latest_run=latest_run,
            )
        return _response_without_snapshot(
            status="recomputing",
            date_from=date_from,
            date_to=date_to,
            mode="live",
            generated_at=latest_run.started_at or datetime.now(timezone.utc),
            recompute_started_at=latest_run.started_at,
            recompute_finished_at=latest_run.finished_at,
        )

    run = await _create_recompute_run(
        db,
        date_from=date_from,
        date_to=date_to,
        triggered_by_lab_member_id=triggered_by_lab_member_id,
    )
    return await _finish_recompute_run(
        db,
        run=run,
        existing_snapshot=existing_snapshot,
    )


async def _create_recompute_run(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    triggered_by_lab_member_id: uuid.UUID | None,
) -> AnalyticsRun:
    started_at = datetime.now(timezone.utc)
    run = AnalyticsRun(
        run_id=uuid.uuid4(),
        date_from=date_from,
        date_to=date_to,
        model_version=ANALYTICS_MODEL_VERSION,
        response_version=ANALYTICS_RESPONSE_VERSION,
        status="recomputing",
        triggered_by_lab_member_id=triggered_by_lab_member_id,
        warnings_json=[],
        started_at=started_at,
    )
    db.add(run)
    await db.commit()
    return run


async def _finish_recompute_run(
    db: AsyncSession,
    *,
    run: AnalyticsRun,
    existing_snapshot: AnalyticsSnapshot | None,
) -> DashboardAnalyticsResponse:
    try:
        dataset_result = await build_canonical_analysis_dataset(
            db,
            date_from=run.date_from,
            date_to=run.date_to,
        )
        modeling_result = await asyncio.to_thread(fit_analytics_models, dataset_result)
    except Exception as exc:
        finished_at = datetime.now(timezone.utc)
        run.status = "failed"
        run.error_json = {
            "error_type": exc.__class__.__name__,
            "message": str(exc),
        }
        run.finished_at = finished_at
        await db.commit()

        if existing_snapshot is not None:
            return _response_from_snapshot(
                existing_snapshot,
                mode="live",
                latest_run=run,
            )

        return _response_without_snapshot(
            status="failed",
            date_from=run.date_from,
            date_to=run.date_to,
            mode="live",
            generated_at=finished_at,
            recompute_started_at=run.started_at,
            recompute_finished_at=finished_at,
        )

    finished_at = datetime.now(timezone.utc)
    response = _response_from_modeling_result(
        modeling_result=modeling_result,
        mode="live",
        recompute_started_at=run.started_at,
        recompute_finished_at=finished_at,
    )
    response_payload = response.model_dump(mode="json")

    run.status = modeling_result.status
    run.warnings_json = list(modeling_result.warnings)
    run.result_payload_json = response_payload
    run.generated_at = modeling_result.generated_at
    run.finished_at = finished_at
    run.error_json = None

    if modeling_result.status == "ready":
        snapshot = existing_snapshot
        snapshot_payload = _snapshot_payload_from_response(response)
        if snapshot is None:
            snapshot = AnalyticsSnapshot(
                snapshot_id=uuid.uuid4(),
                date_from=run.date_from,
                date_to=run.date_to,
                model_version=ANALYTICS_MODEL_VERSION,
                response_version=ANALYTICS_RESPONSE_VERSION,
                status="ready",
                warnings_json=list(modeling_result.warnings),
                payload_json=snapshot_payload,
                source_run_id=run.run_id,
                generated_at=modeling_result.generated_at,
            )
            db.add(snapshot)
        else:
            snapshot.status = "ready"
            snapshot.warnings_json = list(modeling_result.warnings)
            snapshot.payload_json = snapshot_payload
            snapshot.source_run_id = run.run_id
            snapshot.generated_at = modeling_result.generated_at

        await db.commit()
        return response

    await db.commit()
    if existing_snapshot is not None:
        return _response_from_snapshot(
            existing_snapshot,
            mode="live",
            latest_run=run,
        )

    return response


async def _get_latest_snapshot(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> AnalyticsSnapshot | None:
    result = await db.execute(
        select(AnalyticsSnapshot)
        .where(
            AnalyticsSnapshot.date_from == date_from,
            AnalyticsSnapshot.date_to == date_to,
            AnalyticsSnapshot.model_version == ANALYTICS_MODEL_VERSION,
            AnalyticsSnapshot.response_version == ANALYTICS_RESPONSE_VERSION,
        )
        .order_by(AnalyticsSnapshot.generated_at.desc(), AnalyticsSnapshot.updated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_run_by_id(
    db: AsyncSession,
    *,
    run_id: uuid.UUID,
) -> AnalyticsRun | None:
    result = await db.execute(
        select(AnalyticsRun)
        .where(AnalyticsRun.run_id == run_id)
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_latest_run(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> AnalyticsRun | None:
    result = await db.execute(
        select(AnalyticsRun)
        .where(
            AnalyticsRun.date_from == date_from,
            AnalyticsRun.date_to == date_to,
            AnalyticsRun.model_version == ANALYTICS_MODEL_VERSION,
            AnalyticsRun.response_version == ANALYTICS_RESPONSE_VERSION,
        )
        .order_by(AnalyticsRun.started_at.desc(), AnalyticsRun.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _response_from_modeling_result(
    *,
    modeling_result: Any,
    mode: AnalyticsReadMode,
    recompute_started_at: datetime | None,
    recompute_finished_at: datetime | None,
) -> DashboardAnalyticsResponse:
    return DashboardAnalyticsResponse(
        status=modeling_result.status,
        snapshot=AnalyticsSnapshotMetadataResponse(
            mode=mode,
            response_version=ANALYTICS_RESPONSE_VERSION,
            model_version=ANALYTICS_MODEL_VERSION,
            generated_at=modeling_result.generated_at,
            is_stale=False,
            recompute_started_at=recompute_started_at,
            recompute_finished_at=recompute_finished_at,
        ),
        dataset=modeling_result.dataset,
        models=list(modeling_result.models),
        visualizations=modeling_result.visualizations,
    )


def _snapshot_payload_from_response(response: DashboardAnalyticsResponse) -> dict[str, Any]:
    payload = response.model_copy(
        update={
            "status": "ready",
            "snapshot": response.snapshot.model_copy(
                update={
                    "mode": "snapshot",
                    "is_stale": False,
                    "recompute_started_at": None,
                    "recompute_finished_at": None,
                }
            ),
        }
    )
    return payload.model_dump(mode="json")


def _response_from_snapshot(
    snapshot: AnalyticsSnapshot,
    *,
    mode: AnalyticsReadMode,
    latest_run: AnalyticsRun | None,
) -> DashboardAnalyticsResponse:
    response = DashboardAnalyticsResponse.model_validate(snapshot.payload_json)
    status: AnalyticsStatus = "ready"
    is_stale = False
    recompute_started_at: datetime | None = None
    recompute_finished_at: datetime | None = None

    if latest_run is not None and latest_run.run_id != snapshot.source_run_id:
        if _is_recomputing_run(latest_run):
            status = "recomputing"
            is_stale = True
            recompute_started_at = latest_run.started_at
        elif latest_run.status in {"failed", "insufficient_data"}:
            status = "stale"
            is_stale = True
            recompute_started_at = latest_run.started_at
            recompute_finished_at = latest_run.finished_at

    return response.model_copy(
        update={
            "status": status,
            "snapshot": response.snapshot.model_copy(
                update={
                    "mode": mode,
                    "response_version": snapshot.response_version,
                    "model_version": snapshot.model_version,
                    "generated_at": snapshot.generated_at,
                    "is_stale": is_stale,
                    "recompute_started_at": recompute_started_at,
                    "recompute_finished_at": recompute_finished_at,
                }
            ),
        }
    )


def _response_without_snapshot(
    *,
    status: AnalyticsStatus,
    date_from: date,
    date_to: date,
    mode: AnalyticsReadMode,
    generated_at: datetime,
    recompute_started_at: datetime | None,
    recompute_finished_at: datetime | None,
) -> DashboardAnalyticsResponse:
    return DashboardAnalyticsResponse(
        status=status,
        snapshot=AnalyticsSnapshotMetadataResponse(
            mode=mode,
            generated_at=generated_at,
            is_stale=False,
            recompute_started_at=recompute_started_at,
            recompute_finished_at=recompute_finished_at,
        ),
        dataset=AnalyticsDatasetMetadataResponse(
            date_from=date_from,
            date_to=date_to,
            included_sessions=0,
            included_days=0,
            native_rows=0,
            imported_rows=0,
            excluded_rows=0,
            exclusion_reasons=[],
            generated_at=generated_at,
        ),
        models=[],
    )


_RECOMPUTE_STALENESS_TIMEOUT = timedelta(minutes=30)


def _is_recomputing_run(run: AnalyticsRun | None) -> bool:
    if run is None:
        return False
    if run.status != "recomputing" or run.finished_at is not None:
        return False
    if run.started_at is not None:
        elapsed = datetime.now(timezone.utc) - run.started_at
        if elapsed > _RECOMPUTE_STALENESS_TIMEOUT:
            return False
    return True


__all__ = [
    "AnalyticsRefreshRequestResult",
    "complete_dashboard_analytics_refresh",
    "get_dashboard_analytics",
    "request_dashboard_analytics_refresh",
    "read_dashboard_analytics_snapshot",
    "recompute_dashboard_analytics",
]
