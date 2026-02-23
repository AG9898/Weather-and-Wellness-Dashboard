"""Unit tests for ULS-8 scoring."""

from decimal import Decimal

from app.scoring.uls8 import score


def test_all_never():
    # All raw = 1. Items 3,6 reversed: 5-1=4. Values: [1,1,4,1,1,4,1,1]. Mean=14/8=1.75
    result = score([1, 1, 1, 1, 1, 1, 1, 1])
    assert result.computed_mean == Decimal("1.7500")
    assert result.score_0_100 == Decimal("25.00")


def test_all_often():
    # All raw = 4. Items 3,6 reversed: 5-4=1. Values: [4,4,1,4,4,1,4,4]. Mean=26/8=3.25
    result = score([4, 4, 4, 4, 4, 4, 4, 4])
    assert result.computed_mean == Decimal("3.2500")
    assert result.score_0_100 == Decimal("75.00")


def test_max_loneliness():
    # Max loneliness: non-reversed=4, reversed items (3,6) raw=1 → reversed=4
    # All values = 4. Mean = 4.0, score = 100.0
    result = score([4, 4, 1, 4, 4, 1, 4, 4])
    assert result.computed_mean == Decimal("4.0000")
    assert result.score_0_100 == Decimal("100.00")


def test_min_loneliness():
    # Min loneliness: non-reversed=1, reversed items (3,6) raw=4 → reversed=1
    # All values = 1. Mean = 1.0, score = 0.0
    result = score([1, 1, 4, 1, 1, 4, 1, 1])
    assert result.computed_mean == Decimal("1.0000")
    assert result.score_0_100 == Decimal("0.00")


def test_mixed():
    # r1=2, r2=3, r3=2(rev→3), r4=1, r5=4, r6=3(rev→2), r7=2, r8=1
    # Values: [2,3,3,1,4,2,2,1] = 18. Mean = 18/8 = 2.25
    result = score([2, 3, 2, 1, 4, 3, 2, 1])
    assert result.computed_mean == Decimal("2.2500")
    expected_score = (Decimal("2.25") - 1) * 100 / 3
    assert result.score_0_100 == expected_score.quantize(Decimal("0.01"))
