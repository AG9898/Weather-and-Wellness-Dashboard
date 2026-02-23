"""Unit tests for CES-D 10 scoring."""

from app.scoring.cesd10 import score


def test_all_never():
    # All raw = 1. Negative items: 1-1=0. Positive items (5,8): 4-1=3. Total = 0*8 + 3*2 = 6
    result = score([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    assert result.total_score == 6


def test_all_often():
    # All raw = 4. Negative items: 4-1=3. Positive items (5,8): 4-4=0. Total = 3*8 + 0*2 = 24
    result = score([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])
    assert result.total_score == 24


def test_max_depression():
    # Max: negative items = 4 (score 3 each), positive items (5,8) = 1 (score 3 each)
    # Total = 3*10 = 30
    result = score([4, 4, 4, 4, 1, 4, 4, 1, 4, 4])
    assert result.total_score == 30


def test_min_depression():
    # Min: negative items = 1 (score 0), positive items (5,8) = 4 (score 0)
    # Total = 0
    result = score([1, 1, 1, 1, 4, 1, 1, 4, 1, 1])
    assert result.total_score == 0


def test_mixed():
    # r1=2(1), r2=3(2), r3=1(0), r4=4(3), r5=2(4-2=2), r6=1(0), r7=3(2), r8=3(4-3=1), r9=2(1), r10=1(0)
    # Total = 1+2+0+3+2+0+2+1+1+0 = 12
    result = score([2, 3, 1, 4, 2, 1, 3, 3, 2, 1])
    assert result.total_score == 12
