"""Unit tests for digit span scoring — all correct, all wrong, mixed."""

from app.scoring.digitspan import TrialInput, score

SPANS = [3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]


def _make_trials(correct_flags: list[bool]) -> list[TrialInput]:
    return [
        TrialInput(
            trial_number=i + 1,
            span_length=SPANS[i],
            sequence_shown=f"seq_{i}",
            sequence_entered=f"ent_{i}",
            correct=correct_flags[i],
        )
        for i in range(14)
    ]


def test_all_correct():
    result = score(_make_trials([True] * 14))
    assert result.total_correct == 14
    assert result.max_span == 9


def test_all_wrong():
    result = score(_make_trials([False] * 14))
    assert result.total_correct == 0
    assert result.max_span == 0


def test_mixed_results():
    # Correct on trials 1-6 (spans 3,3,4,4,5,5), wrong on 7-14
    flags = [True] * 6 + [False] * 8
    result = score(_make_trials(flags))
    assert result.total_correct == 6
    assert result.max_span == 5


def test_mixed_sparse():
    # Correct only on trial 13 (span 9) and trial 2 (span 3)
    flags = [False] * 14
    flags[1] = True   # trial 2, span 3
    flags[12] = True  # trial 13, span 9
    result = score(_make_trials(flags))
    assert result.total_correct == 2
    assert result.max_span == 9


def test_single_correct_lowest_span():
    # Only trial 1 (span 3) correct
    flags = [False] * 14
    flags[0] = True
    result = score(_make_trials(flags))
    assert result.total_correct == 1
    assert result.max_span == 3
