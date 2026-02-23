"""CogFunc 8a scoring — pure function, no DB or side effects."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


@dataclass(frozen=True)
class CogFunc8aScored:
    total_sum: int
    mean_score: Decimal


def score(raw: list[int]) -> CogFunc8aScored:
    """Score CogFunc 8a from 8 raw values (1-5).

    Reverse all items (6 - raw), compute sum and mean.
    Higher = better cognitive function.
    """
    reversed_values = [6 - val for val in raw]
    total_sum = sum(reversed_values)
    mean_score = (Decimal(total_sum) / Decimal(8)).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP
    )
    return CogFunc8aScored(total_sum=total_sum, mean_score=mean_score)
