"""ULS-8 scoring — pure function, no DB or side effects."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


@dataclass(frozen=True)
class ULS8Scored:
    computed_mean: Decimal
    score_0_100: Decimal


def score(raw: list[int]) -> ULS8Scored:
    """Score ULS-8 from 8 raw values (1-4).

    Reverse items 3 and 6 (5 - raw), compute mean, transform to 0-100.
    """
    values = list(raw)
    # Reverse-score items 3 and 6 (0-indexed: 2 and 5)
    values[2] = 5 - values[2]
    values[5] = 5 - values[5]

    mean = Decimal(sum(values)) / Decimal(8)
    # Round to 4 decimal places for NUMERIC(5,4)
    computed_mean = mean.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    score_0_100 = ((mean - 1) * Decimal(100) / Decimal(3)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return ULS8Scored(computed_mean=computed_mean, score_0_100=score_0_100)
