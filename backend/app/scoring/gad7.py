"""GAD-7 scoring — pure function, no DB or side effects."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GAD7Scored:
    total_score: int
    severity_band: str


def score(raw: list[int]) -> GAD7Scored:
    """Score GAD-7 from 7 raw values (1-4).

    Convert to 0-3 (raw - 1), sum, assign severity band.
    """
    total = sum(val - 1 for val in raw)

    if total <= 4:
        band = "minimal"
    elif total <= 9:
        band = "mild"
    elif total <= 14:
        band = "moderate"
    else:
        band = "severe"

    return GAD7Scored(total_score=total, severity_band=band)
