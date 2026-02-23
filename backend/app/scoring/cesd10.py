"""CES-D 10 scoring — pure function, no DB or side effects."""

from __future__ import annotations

from dataclasses import dataclass

POSITIVE_ITEMS = {4, 7}  # 0-indexed positions for items 5 and 8


@dataclass(frozen=True)
class CESD10Scored:
    total_score: int


def score(raw: list[int]) -> CESD10Scored:
    """Score CES-D 10 from 10 raw values (1-4).

    Negative items: score = raw - 1
    Positive items (5, 8): score = 4 - raw
    Total range: 0-30.
    """
    total = 0
    for i, val in enumerate(raw):
        if i in POSITIVE_ITEMS:
            total += 4 - val
        else:
            total += val - 1
    return CESD10Scored(total_score=total)
