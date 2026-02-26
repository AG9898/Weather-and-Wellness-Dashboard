"""UBC EOS weather scraper and parser.

Fetches HTML from two UBC EOS URLs and returns a ParseResult containing:
- Raw HTML and SHA-256 hashes (stored in weather_ingest_runs for debugging)
- Parsed current conditions and forecast data (stored in weather_daily)
- parse_status / parse_errors for triage

Parse status:
- success: at least one source fetched AND current_temp_c is not None
           AND at least one forecast period found
- partial: at least one source fetched AND (current_temp_c is not None
           OR at least one forecast period found)
- fail:    both fetches failed, or nothing useful parsed

This module is pure I/O + parsing — no DB access.
"""
from __future__ import annotations

import asyncio
import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Literal
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup

_TZ_EDMONTON = ZoneInfo("America/Edmonton")
PARSER_VERSION = "ubc-eos-v1"

_PRIMARY_URL = "https://weather.eos.ubc.ca/wxfcst/users/Guest/custom.php?location={station_id}"
_SECONDARY_URL = "https://weather.eos.ubc.ca/wxfcst/users/Guest/ubcrs_withicons/index.php?location={station_id}"

_NUMBER_RE = re.compile(r"-?\d+\.?\d*")

# Compass direction → degrees (16-point rose)
_DIR_TO_DEG: dict[str, int] = {
    "N": 0, "NNE": 22, "NE": 45, "ENE": 67,
    "E": 90, "ESE": 112, "SE": 135, "SSE": 157,
    "S": 180, "SSW": 202, "SW": 225, "WSW": 247,
    "W": 270, "WNW": 292, "NW": 315, "NNW": 337,
}


@dataclass
class ParseResult:
    # ── Source info (written to weather_ingest_runs) ─────────────────────────
    source_primary_url: str
    source_secondary_url: str
    http_primary_status: int | None
    http_secondary_status: int | None
    raw_html_primary: str | None
    raw_html_secondary: str | None
    raw_html_primary_sha256: str | None
    raw_html_secondary_sha256: str | None
    parsed_json: dict[str, Any]
    parse_status: Literal["success", "partial", "fail"]
    parse_errors: list[dict[str, Any]]
    parser_version: str

    # ── Day (used for study_days + weather_daily) ─────────────────────────────
    date_local: date

    # ── Current conditions (written to weather_daily) ─────────────────────────
    current_observed_at: datetime | None
    current_temp_c: float | None
    current_relative_humidity_pct: int | None
    current_wind_speed_kmh: float | None
    current_wind_gust_kmh: float | None
    current_wind_dir_deg: int | None
    current_pressure_kpa: float | None
    current_precip_today_mm: float | None

    # ── Day-level forecast summary (written to weather_daily) ─────────────────
    forecast_high_c: float | None
    forecast_low_c: float | None
    forecast_precip_prob_pct: int | None   # Not available from UBC EOS pages
    forecast_precip_mm: float | None
    forecast_condition_text: str | None
    forecast_periods: list[dict[str, Any]]  # Raw 3-hour blocks


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _first_num(text: str) -> float | None:
    m = _NUMBER_RE.search(text)
    return float(m.group()) if m else None


def _first_int(text: str) -> int | None:
    f = _first_num(text)
    return int(round(f)) if f is not None else None


def _parse_wind(text: str) -> tuple[float | None, int | None]:
    """Parse 'S 6.9 km/h' or 'S at 6.9 km/h' → (speed_kmh, dir_deg)."""
    speed: float | None = None
    deg: int | None = None
    m = re.search(r"(\d+\.?\d*)\s*km/h", text)
    if m:
        speed = float(m.group(1))
    dm = re.match(r"([A-Z]{1,3})\b", text.strip())
    if dm:
        deg = _DIR_TO_DEG.get(dm.group(1))
    return speed, deg


def _build_var_value_map(soup: Any, source: str) -> dict[str, str]:
    """Extract label→value pairs from td.var/td.value and font.var/font.value."""
    vmap: dict[str, str] = {}
    for tag in ("td", "font"):
        for var_el in soup.find_all(tag, class_="var"):
            label = var_el.get_text(strip=True).rstrip(":").strip()
            if not label or label == "\xa0":
                continue
            nxt = var_el.find_next_sibling(tag)
            if nxt and "value" in (nxt.get("class") or []):
                vmap[label.lower()] = nxt.get_text(strip=True)
    return vmap


def _extract_current_from_vmap(
    vmap: dict[str, str], source: str
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Extract typed current-conditions fields from a label→value map."""
    result: dict[str, Any] = {}
    errors: list[dict[str, Any]] = []

    # Temperature
    for key in ("temperature", "temp"):
        raw = vmap.get(key)
        if raw:
            v = _first_num(raw)
            if v is not None:
                result["current_temp_c"] = v
            break
    if "current_temp_c" not in result:
        errors.append({
            "code": "MISSING_TEMPERATURE",
            "message": "Could not parse temperature",
            "source": source,
        })

    # Humidity
    raw = vmap.get("humidity")
    if raw:
        v = _first_int(raw)
        if v is not None:
            result["current_relative_humidity_pct"] = v
    else:
        errors.append({
            "code": "MISSING_HUMIDITY",
            "message": "Could not parse humidity",
            "source": source,
        })

    # Pressure (kPa)
    raw = vmap.get("pressure")
    if raw:
        v = _first_num(raw)
        if v is not None:
            result["current_pressure_kpa"] = v
    else:
        errors.append({
            "code": "MISSING_PRESSURE",
            "message": "Could not parse pressure",
            "source": source,
        })

    # Rain Today
    for key in ("rain today", "rain"):
        raw = vmap.get(key)
        if raw and "rate" not in key:
            v = _first_num(raw)
            if v is not None:
                result["current_precip_today_mm"] = v
            break

    # Wind — Page 1: "Wind:" → "S 6.9 km/h"; Page 2: "Wind from:" → "S at 6.9 km/h"
    wind_raw = vmap.get("wind") or vmap.get("wind from")
    if wind_raw:
        speed, deg = _parse_wind(wind_raw)
        if speed is not None:
            result["current_wind_speed_kmh"] = speed
        if deg is not None:
            result["current_wind_dir_deg"] = deg

    # Observed-at timestamp (Page 1: "Updated:" → "25 Feb 2026 at 22:30")
    updated_raw = vmap.get("updated")
    if updated_raw:
        try:
            dt = datetime.strptime(updated_raw, "%d %b %Y at %H:%M")
            result["current_observed_at"] = dt.replace(tzinfo=_TZ_EDMONTON)
        except ValueError:
            pass

    return result, errors


# ── Page-specific parsers ─────────────────────────────────────────────────────

def _parse_primary(html: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Parse Page 1 (custom.php): current conditions in td.var/td.value table."""
    soup = BeautifulSoup(html, "lxml")
    vmap = _build_var_value_map(soup, "primary")
    return _extract_current_from_vmap(vmap, "primary")


def _parse_secondary(
    html: str, today_local: date
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Parse Page 2 (ubcrs_withicons): current conditions + 3-hour forecast periods."""
    soup = BeautifulSoup(html, "lxml")
    errors: list[dict[str, Any]] = []

    # Current conditions from div.current-conds-wrapper
    conds_div = soup.find("div", class_="current-conds-wrapper")
    if conds_div:
        vmap = _build_var_value_map(conds_div, "secondary")
    else:
        vmap = {}
        errors.append({
            "code": "SECONDARY_MISSING_CONDS_DIV",
            "message": "Could not find current-conds-wrapper div",
            "source": "secondary",
        })

    current, current_errors = _extract_current_from_vmap(vmap, "secondary")
    errors.extend(current_errors)

    # Forecast periods from div.time-range-wrapper
    forecast_periods: list[dict[str, Any]] = []
    for wrapper in soup.find_all("div", class_="time-range-wrapper"):
        period: dict[str, Any] = {
            "start": wrapper.get("data-date1"),
            "end": wrapper.get("data-date2"),
        }

        icon_img = wrapper.find("img")
        if icon_img:
            src = str(icon_img.get("src", ""))
            period["icon"] = src.split("/")[-1] if "/" in src else src

        text_wrapper = wrapper.find("div", class_="text-wrapper")
        if not text_wrapper:
            forecast_periods.append(period)
            continue

        # Description
        desc_div = text_wrapper.find("div", class_="description")
        if desc_div:
            period["condition"] = desc_div.get_text(strip=True)

        # Direct children divs (temperature, precipitation, wind)
        for child in text_wrapper.children:
            if not hasattr(child, "name") or child.name != "div":
                continue
            cls = child.get("class") or []
            if "description" in cls or "raindrop" in cls:
                continue
            text = child.get_text(" ", strip=True)
            if not text:
                continue
            # Temperature: contains a degree symbol
            if ("°" in text or "\u00b0" in text) and "temp_c" not in period:
                v = _first_num(text)
                if v is not None:
                    period["temp_c"] = v
            # Precipitation: contains "mm" but not "km"
            elif "mm" in text and "km" not in text and "precip_mm" not in period:
                v = _first_num(text)
                if v is not None:
                    period["precip_mm"] = v
            # Wind: contains "km/h"
            elif "km/h" in text and "wind_speed_kmh" not in period:
                speed, deg = _parse_wind(text)
                if speed is not None:
                    period["wind_speed_kmh"] = speed
                if deg is not None:
                    period["wind_dir_deg"] = deg

        forecast_periods.append(period)

    if not forecast_periods:
        errors.append({
            "code": "SECONDARY_NO_FORECAST_PERIODS",
            "message": "No time-range-wrapper divs found",
            "source": "secondary",
        })

    # Day-level forecast summary for today_local
    # Periods whose start timestamp falls on today_local (local time, no TZ)
    today_periods = []
    for p in forecast_periods:
        start_str = p.get("start")
        if start_str:
            try:
                dt = datetime.fromisoformat(start_str)  # "2026-02-25T21:00" (naive local)
                if dt.date() == today_local:
                    today_periods.append(p)
            except ValueError:
                pass

    # Fallback: if no periods match today, use first 8 (~24 hours)
    if not today_periods:
        today_periods = forecast_periods[:8]

    temps = [p["temp_c"] for p in today_periods if "temp_c" in p]
    precips = [p["precip_mm"] for p in today_periods if "precip_mm" in p]
    conditions = [p["condition"] for p in today_periods if "condition" in p]

    result = {
        **current,
        "forecast_high_c": max(temps) if temps else None,
        "forecast_low_c": min(temps) if temps else None,
        "forecast_precip_mm": round(sum(precips), 2) if precips else None,
        "forecast_condition_text": conditions[0] if conditions else None,
        "forecast_periods": forecast_periods,
    }
    return result, errors


# ── HTTP fetch ────────────────────────────────────────────────────────────────

async def _safe_fetch(
    client: httpx.AsyncClient, url: str
) -> tuple[str | None, int | None, str | None]:
    """Fetch URL; return (html, status_code, error_message)."""
    try:
        resp = await client.get(url)
        if resp.is_success:
            return resp.text, resp.status_code, None
        return None, resp.status_code, f"HTTP {resp.status_code} {resp.reason_phrase}"
    except httpx.RequestError as exc:
        return None, None, f"{type(exc).__name__}: {exc}"


# ── Public entry point ────────────────────────────────────────────────────────

async def fetch_and_parse(station_id: int) -> ParseResult:
    """Fetch both UBC EOS URLs and return a fully populated ParseResult."""
    today_local = datetime.now(_TZ_EDMONTON).date()
    primary_url = _PRIMARY_URL.format(station_id=station_id)
    secondary_url = _SECONDARY_URL.format(station_id=station_id)

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        (p_html, p_status, p_err), (s_html, s_status, s_err) = await asyncio.gather(
            _safe_fetch(client, primary_url),
            _safe_fetch(client, secondary_url),
        )

    errors: list[dict[str, Any]] = []
    if p_err:
        errors.append({"code": "PRIMARY_FETCH_ERROR", "message": p_err, "source": "primary"})
    if s_err:
        errors.append({"code": "SECONDARY_FETCH_ERROR", "message": s_err, "source": "secondary"})

    # Parse primary (current conditions only)
    primary_data: dict[str, Any] = {}
    if p_html:
        try:
            primary_data, perrs = _parse_primary(p_html)
            errors.extend(perrs)
        except Exception as exc:
            errors.append({
                "code": "PRIMARY_PARSE_EXCEPTION",
                "message": str(exc),
                "source": "primary",
            })

    # Parse secondary (current conditions + forecast periods)
    secondary_data: dict[str, Any] = {}
    if s_html:
        try:
            secondary_data, serrs = _parse_secondary(s_html, today_local)
            errors.extend(serrs)
        except Exception as exc:
            errors.append({
                "code": "SECONDARY_PARSE_EXCEPTION",
                "message": str(exc),
                "source": "secondary",
            })

    # Merge: primary wins for current conditions; secondary supplies forecast
    def _pick(key: str) -> Any:
        return primary_data.get(key) if primary_data.get(key) is not None else secondary_data.get(key)

    current_temp_c = _pick("current_temp_c")
    current_relative_humidity_pct = _pick("current_relative_humidity_pct")
    current_wind_speed_kmh = _pick("current_wind_speed_kmh")
    current_wind_dir_deg = _pick("current_wind_dir_deg")
    current_pressure_kpa = _pick("current_pressure_kpa")
    current_precip_today_mm = _pick("current_precip_today_mm")
    current_observed_at_raw = _pick("current_observed_at")
    current_observed_at: datetime | None = (
        current_observed_at_raw if isinstance(current_observed_at_raw, datetime) else None
    )

    forecast_periods: list[dict[str, Any]] = secondary_data.get("forecast_periods", [])
    forecast_high_c: float | None = secondary_data.get("forecast_high_c")
    forecast_low_c: float | None = secondary_data.get("forecast_low_c")
    forecast_precip_mm: float | None = secondary_data.get("forecast_precip_mm")
    forecast_condition_text: str | None = secondary_data.get("forecast_condition_text")

    # parse_status
    has_fetch_success = (p_status is not None and p_status < 400) or (
        s_status is not None and s_status < 400
    )
    has_current = current_temp_c is not None
    has_forecast = len(forecast_periods) > 0
    if not has_fetch_success:
        parse_status: Literal["success", "partial", "fail"] = "fail"
    elif has_current and has_forecast:
        parse_status = "success"
    elif has_current or has_forecast:
        parse_status = "partial"
    else:
        parse_status = "fail"

    parsed_json: dict[str, Any] = {
        "current": {
            "temp_c": current_temp_c,
            "relative_humidity_pct": current_relative_humidity_pct,
            "wind_speed_kmh": current_wind_speed_kmh,
            "wind_gust_kmh": None,
            "wind_dir_deg": current_wind_dir_deg,
            "pressure_kpa": current_pressure_kpa,
            "precip_today_mm": current_precip_today_mm,
            "observed_at": current_observed_at.isoformat() if current_observed_at else None,
        },
        "forecast_summary": {
            "high_c": forecast_high_c,
            "low_c": forecast_low_c,
            "precip_mm": forecast_precip_mm,
            "precip_prob_pct": None,
            "condition_text": forecast_condition_text,
        },
        "forecast_periods": forecast_periods,
    }

    return ParseResult(
        source_primary_url=primary_url,
        source_secondary_url=secondary_url,
        http_primary_status=p_status,
        http_secondary_status=s_status,
        raw_html_primary=p_html,
        raw_html_secondary=s_html,
        raw_html_primary_sha256=_sha256(p_html) if p_html else None,
        raw_html_secondary_sha256=_sha256(s_html) if s_html else None,
        parsed_json=parsed_json,
        parse_status=parse_status,
        parse_errors=errors,
        parser_version=PARSER_VERSION,
        date_local=today_local,
        current_observed_at=current_observed_at,
        current_temp_c=current_temp_c,
        current_relative_humidity_pct=current_relative_humidity_pct,
        current_wind_speed_kmh=current_wind_speed_kmh,
        current_wind_gust_kmh=None,  # Not available from UBC EOS pages
        current_wind_dir_deg=current_wind_dir_deg,
        current_pressure_kpa=current_pressure_kpa,
        current_precip_today_mm=current_precip_today_mm,
        forecast_high_c=forecast_high_c,
        forecast_low_c=forecast_low_c,
        forecast_precip_prob_pct=None,  # Not available from UBC EOS pages
        forecast_precip_mm=forecast_precip_mm,
        forecast_condition_text=forecast_condition_text,
        forecast_periods=forecast_periods,
    )
