from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class WeatherIngestRequest(BaseModel):
    station_id: int = Field(default=3510, description="UBC EOS station ID")


class WeatherIngestResponse(BaseModel):
    run_id: uuid.UUID
    station_id: int
    ingested_at: datetime
    parse_status: Literal["success", "partial", "fail"]
    parse_errors: list[dict]
    upserted_days: int


class WeatherDailyItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_id: int
    study_day_id: uuid.UUID
    date_local: date
    source_run_id: uuid.UUID
    updated_at: datetime
    current_temp_c: float | None
    current_precip_today_mm: float | None
    forecast_high_c: float | None
    forecast_low_c: float | None
    forecast_condition_text: str | None
    forecast_periods: list[Any]


class LatestRunInfo(BaseModel):
    run_id: uuid.UUID
    ingested_at: datetime
    parse_status: Literal["success", "partial", "fail"]


class WeatherDailyResponse(BaseModel):
    items: list[WeatherDailyItem]
    latest_run: LatestRunInfo | None


__all__ = [
    "WeatherIngestRequest",
    "WeatherIngestResponse",
    "WeatherDailyItem",
    "LatestRunInfo",
    "WeatherDailyResponse",
]
