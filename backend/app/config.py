"""Study-level configuration constants and derived utilities.

All day-level semantics in this study use America/Vancouver as the canonical
local timezone (see docs/DECISIONS.md RESOLVED-12).

DAYLIGHT_START_LOCAL_TIME (env var, default "06:00") defines the local clock
time used to compute participants.daylight_exposure_minutes at session start.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Canonical study timezone — used for:
#   - study_days.date_local derivation
#   - sessions → study_day linking (completed_at in local tz)
#   - weather_daily day linking
#   - dashboard date-range filtering
#   - daylight exposure computation
STUDY_TIMEZONE = "America/Vancouver"

_OPENROUTER_UNAVAILABLE_MESSAGE = (
    "AI chat is unavailable because its privacy configuration is incomplete."
)


class OpenRouterConfigError(RuntimeError):
    """Raised when server-side OpenRouter configuration is missing or unsafe."""

    def __init__(self, detail: str) -> None:
        self.detail = detail
        self.public_message = _OPENROUTER_UNAVAILABLE_MESSAGE
        super().__init__(self.public_message)


@dataclass(frozen=True)
class OpenRouterConfig:
    """Server-only OpenRouter runtime configuration."""

    api_key: str
    model: str
    require_zdr: bool
    provider_allowlist: tuple[str, ...]
    # Optional, owner-approved non-ZDR availability fallback. When
    # fallback_model is set, a primary ZDR-required request that fails due to
    # provider unavailability/upstream error retries once on this model with
    # ZDR routing relaxed. Unset (empty) means no fallback: the client fails
    # closed. See docs/AI_CHAT.md and docs/DECISIONS.md.
    fallback_model: str = ""
    fallback_provider_allowlist: tuple[str, ...] = ()

    @property
    def has_fallback(self) -> bool:
        """Whether a non-ZDR availability fallback model is configured."""
        return bool(self.fallback_model)


def _parse_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default

    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False

    raise OpenRouterConfigError(f"{name} must be a boolean value.")


def _parse_csv_env(name: str) -> tuple[str, ...]:
    raw = os.getenv(name, "")
    values = tuple(part.strip() for part in raw.split(",") if part.strip())
    if len(set(values)) != len(values):
        raise OpenRouterConfigError(f"{name} must not contain duplicate providers.")
    return values


def get_openrouter_config() -> OpenRouterConfig:
    """Return validated server-only OpenRouter config for the RA chatbot.

    The API key is intentionally read only from non-public backend env vars.
    Privacy-sensitive routing fails closed until the backend can prove the
    configured request will use approved provider controls.
    """
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    model = (os.getenv("OPENROUTER_MODEL") or "").strip()
    require_zdr = _parse_bool_env("OPENROUTER_REQUIRE_ZDR", True)
    provider_allowlist = _parse_csv_env("OPENROUTER_PROVIDER_ALLOWLIST")
    fallback_model = (os.getenv("OPENROUTER_FALLBACK_MODEL") or "").strip()
    fallback_provider_allowlist = _parse_csv_env(
        "OPENROUTER_FALLBACK_PROVIDER_ALLOWLIST"
    )

    if not api_key:
        raise OpenRouterConfigError("OPENROUTER_API_KEY is required.")
    if not model:
        raise OpenRouterConfigError("OPENROUTER_MODEL is required.")
    if require_zdr and not provider_allowlist:
        raise OpenRouterConfigError(
            "OPENROUTER_PROVIDER_ALLOWLIST is required when ZDR routing is required."
        )

    return OpenRouterConfig(
        api_key=api_key,
        model=model,
        require_zdr=require_zdr,
        provider_allowlist=provider_allowlist,
        fallback_model=fallback_model,
        fallback_provider_allowlist=fallback_provider_allowlist,
    )


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
