"""Open-Meteo historical weather fetch service (T65).

Fetches daily weather aggregates from the Open-Meteo Archive API for UBC main
campus (49.2606, -123.2460) using America/Vancouver timezone. No API key required.

Returns a dict keyed by local date (DATE) with all six mapped daily fields.
sunshine_duration is divided by 3600 to produce hours.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import httpx

_OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
_UBC_LATITUDE = 49.2606
_UBC_LONGITUDE = -123.2460
_DAILY_FIELDS = (
    "temperature_2m_mean",
    "temperature_2m_max",
    "temperature_2m_min",
    "relative_humidity_2m_mean",
    "precipitation_sum",
    "sunshine_duration",
)


class OpenMeteoError(Exception):
    """Raised when Open-Meteo returns a non-2xx response."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Open-Meteo error {status_code}: {detail}")


@dataclass
class OpenMeteoDay:
    """All six mapped daily fields for one local calendar day."""

    current_temp_c: float | None
    current_relative_humidity_pct: int | None
    current_precip_today_mm: float | None
    forecast_high_c: float | None
    forecast_low_c: float | None
    sunshine_duration_hours: float | None


def build_open_meteo_url(start_date: date, end_date: date) -> str:
    """Return the canonical Open-Meteo Archive URL for the given date range."""
    params = (
        f"latitude={_UBC_LATITUDE}"
        f"&longitude={_UBC_LONGITUDE}"
        f"&start_date={start_date.isoformat()}"
        f"&end_date={end_date.isoformat()}"
        f"&daily={','.join(_DAILY_FIELDS)}"
        f"&timezone=America%2FVancouver"
    )
    return f"{_OPEN_METEO_URL}?{params}"


async def fetch_open_meteo(
    start_date: date,
    end_date: date,
) -> dict[date, OpenMeteoDay]:
    """Fetch daily weather from Open-Meteo for the given local date range.

    Args:
        start_date: First day (inclusive) in America/Vancouver.
        end_date: Last day (inclusive) in America/Vancouver.

    Returns:
        Dict keyed by local date (datetime.date) with all six mapped fields.

    Raises:
        OpenMeteoError: If Open-Meteo returns a non-2xx HTTP status.
    """
    url = build_open_meteo_url(start_date, end_date)

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)

    if response.status_code != 200:
        raise OpenMeteoError(
            status_code=response.status_code,
            detail=response.text[:500],
        )

    data = response.json()
    daily = data["daily"]

    times: list[str] = daily["time"]
    temp_mean: list[float | None] = daily["temperature_2m_mean"]
    temp_max: list[float | None] = daily["temperature_2m_max"]
    temp_min: list[float | None] = daily["temperature_2m_min"]
    humidity: list[float | None] = daily["relative_humidity_2m_mean"]
    precip: list[float | None] = daily["precipitation_sum"]
    sunshine: list[float | None] = daily["sunshine_duration"]

    result: dict[date, OpenMeteoDay] = {}
    for i, time_str in enumerate(times):
        day = date.fromisoformat(time_str)
        hum_val = humidity[i]
        sun_val = sunshine[i]
        result[day] = OpenMeteoDay(
            current_temp_c=temp_mean[i],
            current_relative_humidity_pct=int(round(hum_val)) if hum_val is not None else None,
            current_precip_today_mm=precip[i],
            forecast_high_c=temp_max[i],
            forecast_low_c=temp_min[i],
            sunshine_duration_hours=sun_val / 3600.0 if sun_val is not None else None,
        )

    return result
