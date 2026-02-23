"""Digit span scoring — pure function, no DB or side effects."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TrialInput:
    trial_number: int
    span_length: int
    sequence_shown: str
    sequence_entered: str
    correct: bool


@dataclass(frozen=True)
class DigitSpanScored:
    total_correct: int
    max_span: int


def score(trials: list[TrialInput]) -> DigitSpanScored:
    """Compute total_correct and max_span from a list of trial inputs.

    total_correct: count of trials where correct == True (range 0–14).
    max_span: longest span_length where at least one trial is correct (0 if all wrong).
    """
    total_correct = sum(1 for t in trials if t.correct)
    max_span = max((t.span_length for t in trials if t.correct), default=0)
    return DigitSpanScored(total_correct=total_correct, max_span=max_span)
