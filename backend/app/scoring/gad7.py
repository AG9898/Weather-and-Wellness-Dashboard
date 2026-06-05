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
    return _score_total(total)


def score_zero_based(raw: list[int]) -> GAD7Scored:
    """Score GAD-7 from 7 values already on the canonical 0-3 scale."""
    total = sum(raw)
    return _score_total(total)


def _score_total(total: int) -> GAD7Scored:
    """Assign a GAD-7 severity band from a 0-21 total."""

    if total <= 4:
        band = "minimal"
    elif total <= 9:
        band = "mild"
    elif total <= 14:
        band = "moderate"
    else:
        band = "severe"

    return GAD7Scored(total_score=total, severity_band=band)


def score_gad7(raw: list[int]) -> GAD7Scored:
    return score(raw)
