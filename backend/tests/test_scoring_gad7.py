"""Unit tests for GAD-7 scoring."""

from app.scoring.gad7 import score


def test_all_never():
    # All raw = 1. Each: 1-1=0. Total = 0. Band = minimal
    result = score([1, 1, 1, 1, 1, 1, 1])
    assert result.total_score == 0
    assert result.severity_band == "minimal"


def test_all_often():
    # All raw = 4. Each: 4-1=3. Total = 21. Band = severe
    result = score([4, 4, 4, 4, 4, 4, 4])
    assert result.total_score == 21
    assert result.severity_band == "severe"


def test_minimal_boundary():
    # Total = 4 → minimal
    # 4 items at raw 2 (score 1 each) + 3 items at raw 1 (score 0) = 4
    result = score([2, 2, 2, 2, 1, 1, 1])
    assert result.total_score == 4
    assert result.severity_band == "minimal"


def test_mild_boundary_low():
    # Total = 5 → mild
    result = score([2, 2, 2, 2, 2, 1, 1])
    assert result.total_score == 5
    assert result.severity_band == "mild"


def test_mild_boundary_high():
    # Total = 9 → mild
    # 2 items at raw 4 (score 3) + 1 item at raw 4 (score 3) = 9, need 7 items
    # 3 items at raw 4 (9) + 4 items at raw 1 (0) = 9
    result = score([4, 4, 4, 1, 1, 1, 1])
    assert result.total_score == 9
    assert result.severity_band == "mild"


def test_moderate_boundary():
    # Total = 10 → moderate
    # 3 items raw 4 (9) + 1 item raw 2 (1) + 3 items raw 1 (0) = 10
    result = score([4, 4, 4, 2, 1, 1, 1])
    assert result.total_score == 10
    assert result.severity_band == "moderate"


def test_moderate_high():
    # Total = 14 → moderate
    # 4 items raw 4 (12) + 1 item raw 3 (2) + 2 items raw 1 (0) = 14
    result = score([4, 4, 4, 4, 3, 1, 1])
    assert result.total_score == 14
    assert result.severity_band == "moderate"


def test_severe_boundary():
    # Total = 15 → severe
    result = score([4, 4, 4, 4, 4, 1, 1])
    assert result.total_score == 15
    assert result.severity_band == "severe"
