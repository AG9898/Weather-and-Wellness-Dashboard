"""Unit tests for CogFunc 8a scoring."""

from decimal import Decimal

from app.scoring.cogfunc8a import score


def test_all_never():
    # All raw = 1 (no difficulty). Reversed: 6-1=5 each. Sum = 40. Mean = 5.0
    result = score([1, 1, 1, 1, 1, 1, 1, 1])
    assert result.total_sum == 40
    assert result.mean_score == Decimal("5.0000")


def test_all_very_often():
    # All raw = 5 (max difficulty). Reversed: 6-5=1 each. Sum = 8. Mean = 1.0
    result = score([5, 5, 5, 5, 5, 5, 5, 5])
    assert result.total_sum == 8
    assert result.mean_score == Decimal("1.0000")


def test_all_sometimes():
    # All raw = 3. Reversed: 6-3=3 each. Sum = 24. Mean = 3.0
    result = score([3, 3, 3, 3, 3, 3, 3, 3])
    assert result.total_sum == 24
    assert result.mean_score == Decimal("3.0000")


def test_mixed():
    # raw: [1,2,3,4,5,1,2,3]. Reversed: [5,4,3,2,1,5,4,3]. Sum=27. Mean=27/8=3.375
    result = score([1, 2, 3, 4, 5, 1, 2, 3])
    assert result.total_sum == 27
    assert result.mean_score == Decimal("3.3750")


def test_mixed_uneven():
    # raw: [2,2,2,2,2,2,2,1]. Reversed: [4,4,4,4,4,4,4,5]. Sum=33. Mean=33/8=4.125
    result = score([2, 2, 2, 2, 2, 2, 2, 1])
    assert result.total_sum == 33
    assert result.mean_score == Decimal("4.1250")
