"""Stroop scoring — pure function, no DB or side effects.

Backend recomputes correctness and all summary metrics from the raw
client-submitted trial data. See
`docs/labs/weather-wellness/weather/STROOP.md` for the metric definitions.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CONGRUENT = "congruent"
INCONGRUENT = "incongruent"


@dataclass(frozen=True)
class TrialInput:
    trial_number: int
    condition: str
    word: str
    ink_color: str
    response_key: str | None
    response_color: str | None
    reaction_time_ms: int | None
    timed_out: bool


@dataclass(frozen=True)
class ScoredTrial:
    trial_number: int
    condition: str
    word: str
    ink_color: str
    response_key: str | None
    response_color: str | None
    reaction_time_ms: int | None
    timed_out: bool
    correct: bool


@dataclass(frozen=True)
class StroopScored:
    total_trials: int
    correct_trials: int
    error_trials: int
    timeout_trials: int
    overall_accuracy: Decimal
    congruent_accuracy: Decimal | None
    incongruent_accuracy: Decimal | None
    mean_rt_congruent_ms: Decimal | None
    mean_rt_incongruent_ms: Decimal | None
    stroop_interference_ms: Decimal | None
    trials: list[ScoredTrial]


def _normalize(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip().lower()


def _accuracy(correct: int, total: int) -> Decimal | None:
    if total == 0:
        return None
    return (Decimal(correct) / Decimal(total)).quantize(
        Decimal("0.0001"), rounding=ROUND_HALF_UP
    )


def _mean_rt(rts: list[int]) -> Decimal | None:
    if not rts:
        return None
    return (Decimal(sum(rts)) / Decimal(len(rts))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def score(trials: list[TrialInput]) -> StroopScored:
    """Recompute correctness and run-level Stroop metrics.

    Correctness: a trial is correct when it did not time out and the response
    color (normalized) equals the ink color (normalized). Timed-out trials are
    never correct and are excluded from correct-trial reaction-time means.
    Condition reaction-time means are computed over correct, non-timeout trials
    only. The interference score is incongruent minus congruent mean RT, and is
    null whenever either condition mean is null.
    """
    scored: list[ScoredTrial] = []
    correct_trials = 0
    timeout_trials = 0
    congruent_total = 0
    congruent_correct = 0
    incongruent_total = 0
    incongruent_correct = 0
    congruent_rts: list[int] = []
    incongruent_rts: list[int] = []

    for t in trials:
        is_timeout = bool(t.timed_out)
        is_correct = (not is_timeout) and (
            _normalize(t.response_color) is not None
            and _normalize(t.response_color) == _normalize(t.ink_color)
        )

        if is_timeout:
            timeout_trials += 1
        if is_correct:
            correct_trials += 1

        if t.condition == CONGRUENT:
            congruent_total += 1
            if is_correct:
                congruent_correct += 1
                if t.reaction_time_ms is not None:
                    congruent_rts.append(t.reaction_time_ms)
        elif t.condition == INCONGRUENT:
            incongruent_total += 1
            if is_correct:
                incongruent_correct += 1
                if t.reaction_time_ms is not None:
                    incongruent_rts.append(t.reaction_time_ms)

        scored.append(
            ScoredTrial(
                trial_number=t.trial_number,
                condition=t.condition,
                word=t.word,
                ink_color=t.ink_color,
                response_key=t.response_key,
                response_color=t.response_color,
                reaction_time_ms=None if is_timeout else t.reaction_time_ms,
                timed_out=is_timeout,
                correct=is_correct,
            )
        )

    total_trials = len(trials)
    error_trials = total_trials - correct_trials - timeout_trials

    mean_rt_congruent = _mean_rt(congruent_rts)
    mean_rt_incongruent = _mean_rt(incongruent_rts)
    if mean_rt_congruent is not None and mean_rt_incongruent is not None:
        interference: Decimal | None = mean_rt_incongruent - mean_rt_congruent
    else:
        interference = None

    return StroopScored(
        total_trials=total_trials,
        correct_trials=correct_trials,
        error_trials=error_trials,
        timeout_trials=timeout_trials,
        overall_accuracy=_accuracy(correct_trials, total_trials) or Decimal("0.0000"),
        congruent_accuracy=_accuracy(congruent_correct, congruent_total),
        incongruent_accuracy=_accuracy(incongruent_correct, incongruent_total),
        mean_rt_congruent_ms=mean_rt_congruent,
        mean_rt_incongruent_ms=mean_rt_incongruent,
        stroop_interference_ms=interference,
        trials=scored,
    )
