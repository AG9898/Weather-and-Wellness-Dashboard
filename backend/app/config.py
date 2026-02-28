"""Study-level configuration constants and derived utilities.

All day-level semantics in this study use America/Vancouver as the canonical
local timezone (see docs/DECISIONS.md RESOLVED-12).

DAYLIGHT_START_LOCAL_TIME (env var, default "06:00") defines the local clock
time used to compute participants.daylight_exposure_minutes at session start.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Canonical study timezone — used for:
#   - study_days.date_local derivation
#   - sessions → study_day linking (completed_at in local tz)
#   - weather_daily day linking
#   - dashboard date-range filtering
#   - daylight exposure computation
STUDY_TIMEZONE = "America/Vancouver"


def get_daylight_start_local_time() -> str:
    """Return the configured local daylight-start time as 'HH:MM'.

    Reads DAYLIGHT_START_LOCAL_TIME from the environment; defaults to '06:00'.
    Raises ValueError if the value is not a valid HH:MM string.
    """
    raw = os.getenv("DAYLIGHT_START_LOCAL_TIME", "06:00").strip()
    parts = raw.split(":")
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        raise ValueError(
            f"DAYLIGHT_START_LOCAL_TIME must be 'HH:MM'; got '{raw}'"
        )
    h, m = int(parts[0]), int(parts[1])
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError(
            f"DAYLIGHT_START_LOCAL_TIME out of range: '{raw}'"
        )
    return raw


def compute_daylight_exposure_minutes(session_start: datetime) -> int:
    """Compute daylight exposure minutes for a given session start time.

    Returns max(0, minutes_between(DAYLIGHT_START_LOCAL_TIME, session_start_local)).

    Args:
        session_start: Session start datetime. If timezone-aware, converted to
            the study timezone. If naive, assumed to be UTC.

    Returns:
        Non-negative integer minutes since the configured daylight-start time
        on the same local calendar day as session_start.
    """
    tz = ZoneInfo(STUDY_TIMEZONE)

    if session_start.tzinfo is None:
        session_start = session_start.replace(tzinfo=timezone.utc)

    session_start_local = session_start.astimezone(tz)

    daylight_str = get_daylight_start_local_time()
    h, m = map(int, daylight_str.split(":"))
    daylight_start_local = session_start_local.replace(
        hour=h, minute=m, second=0, microsecond=0
    )

    delta_seconds = (session_start_local - daylight_start_local).total_seconds()
    return max(0, int(delta_seconds / 60))
