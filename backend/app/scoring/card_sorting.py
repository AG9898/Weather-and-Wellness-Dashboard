"""Card sorting (WCST-64-inspired) scoring — pure function, no DB or side effects.

The backend reads the stored hidden ``rule_order`` for the session and recomputes
correctness, streaks, category shifts, and all run-level metrics from the raw
client-submitted trial choices. The client-submitted choice is never trusted for
correctness. See ``docs/labs/weather-wellness/weather/CARD_SORTING.md`` for the
metric definitions and rule schedule.

Correctness model
-----------------
Participants choose one of four fixed reference cards. Each reference card has a
unique value on every dimension, so the response card's value on the active rule
dimension determines exactly one matching reference index:

| Index | color  | shape    | number |
|-------|--------|----------|--------|
| 1     | red    | triangle | 1      |
| 2     | green  | star     | 2      |
| 3     | yellow | cross    | 3      |
| 4     | blue   | circle   | 4      |

A trial is correct when ``selected_reference_index`` equals the reference index
whose attribute on the active rule dimension matches the response card's value on
that dimension.

Shift rule
----------
The active rule advances to the next entry in ``rule_order`` after exactly 10
consecutive correct responses; the change takes effect on the next trial. A single
error resets the streak to 0. After the final (sixth) category, the last rule stays
active for the remaining cards and ``categories_completed`` stays capped at 6. The
task never stops before card 64.
"""

from __future__ import annotations

from dataclasses import dataclass

COLOR = "color"
SHAPE = "shape"
NUMBER = "number"

DIMENSIONS = (COLOR, SHAPE, NUMBER)

SHIFT_STREAK = 10
MAX_CATEGORIES = 6
MAX_TRIALS = 64

# Canonical reference cards, indexed 1-4. Each dimension value maps to a unique
# reference index. Numbers are stored as strings for uniform lookup.
_REFERENCE_BY_DIMENSION: dict[str, dict[str, int]] = {
    COLOR: {"red": 1, "green": 2, "yellow": 3, "blue": 4},
    SHAPE: {"triangle": 1, "star": 2, "cross": 3, "circle": 4},
    NUMBER: {"1": 1, "2": 2, "3": 3, "4": 4},
}


class CardSortingScoringError(ValueError):
    """Raised when a trial cannot be scored against the canonical reference cards."""


@dataclass(frozen=True)
class TrialInput:
    trial_number: int
    card_color: str
    card_shape: str
    card_number: int
    selected_reference_index: int
    reaction_time_ms: int | None


@dataclass(frozen=True)
class ScoredTrial:
    trial_number: int
    category_index: int
    active_rule: str
    previous_rule: str | None
    card_color: str
    card_shape: str
    card_number: int
    selected_reference_index: int
    correct: bool
    perseverative_response: bool
    perseverative_error: bool
    streak_before: int
    streak_after: int
    category_completed_after_trial: bool
    reaction_time_ms: int | None
    feedback: str


@dataclass(frozen=True)
class CardSortingScored:
    total_trials: int
    categories_completed: int
    total_correct: int
    total_errors: int
    perseverative_responses: int
    perseverative_errors: int
    nonperseverative_errors: int
    trials_to_first_category: int | None
    failure_to_maintain_set_count: int
    trials: list[ScoredTrial]


def _card_value(dimension: str, trial: TrialInput) -> str:
    if dimension == COLOR:
        return trial.card_color.strip().lower()
    if dimension == SHAPE:
        return trial.card_shape.strip().lower()
    return str(trial.card_number)


def _matching_reference_index(dimension: str, trial: TrialInput) -> int:
    value = _card_value(dimension, trial)
    mapping = _REFERENCE_BY_DIMENSION[dimension]
    if value not in mapping:
        raise CardSortingScoringError(
            f"card {dimension} value {value!r} on trial {trial.trial_number} "
            "is not one of the four reference cards"
        )
    return mapping[value]


def score(trials: list[TrialInput], rule_order: list[str]) -> CardSortingScored:
    """Recompute correctness, streaks, category shifts, and run-level metrics.

    ``rule_order`` is the stored hidden per-session schedule (up to six dimension
    blocks). The active rule starts at ``rule_order[0]`` and advances on the trial
    after 10 consecutive correct responses, clamping at the final rule.
    """
    if not rule_order:
        raise CardSortingScoringError("rule_order must contain at least one dimension")
    for dim in rule_order:
        if dim not in DIMENSIONS:
            raise CardSortingScoringError(f"unknown rule dimension {dim!r}")

    scored: list[ScoredTrial] = []

    category_index = 0  # 0-based index into rule_order
    streak = 0
    total_correct = 0
    perseverative_responses = 0
    perseverative_errors = 0
    nonperseverative_errors = 0
    categories_completed = 0
    trials_to_first_category: int | None = None
    failure_to_maintain_set_count = 0

    # The rule that was active for the block immediately before the current one.
    # Used for perseverative-response detection after a shift.
    previous_rule_for_shift: str | None = None

    for trial in trials:
        active_rule = rule_order[category_index]
        previous_rule = previous_rule_for_shift
        streak_before = streak

        correct_index = _matching_reference_index(active_rule, trial)
        is_correct = trial.selected_reference_index == correct_index

        # Perseverative response: matches the previous (pre-shift) rule's
        # category while that previous rule is still being persevered on. A
        # response is perseverative when it would have been correct under the
        # previous rule but the previous rule differs from the active rule.
        perseverative_response = False
        if previous_rule is not None and previous_rule != active_rule:
            prev_correct_index = _matching_reference_index(previous_rule, trial)
            if trial.selected_reference_index == prev_correct_index:
                perseverative_response = True

        perseverative_error = perseverative_response and not is_correct

        if perseverative_response:
            perseverative_responses += 1

        if is_correct:
            total_correct += 1
            streak_after = streak_before + 1
        else:
            streak_after = 0
            if perseverative_error:
                perseverative_errors += 1
            else:
                nonperseverative_errors += 1
            # Failure to maintain set: an error after 5-9 consecutive correct.
            if 5 <= streak_before <= 9:
                failure_to_maintain_set_count += 1

        # Determine whether this trial completes the current category.
        category_completed_after_trial = False
        if is_correct and streak_after >= SHIFT_STREAK:
            category_completed_after_trial = True
            if categories_completed < MAX_CATEGORIES:
                categories_completed += 1
            if trials_to_first_category is None:
                trials_to_first_category = trial.trial_number
            # Advance to the next rule for the following trial, clamping at the
            # final rule once all blocks are exhausted.
            if category_index < len(rule_order) - 1:
                previous_rule_for_shift = active_rule
                category_index += 1
            streak = 0
        else:
            streak = streak_after

        scored.append(
            ScoredTrial(
                trial_number=trial.trial_number,
                category_index=category_index + 1,
                active_rule=active_rule,
                previous_rule=previous_rule,
                card_color=trial.card_color,
                card_shape=trial.card_shape,
                card_number=trial.card_number,
                selected_reference_index=trial.selected_reference_index,
                correct=is_correct,
                perseverative_response=perseverative_response,
                perseverative_error=perseverative_error,
                streak_before=streak_before,
                streak_after=streak_after,
                category_completed_after_trial=category_completed_after_trial,
                reaction_time_ms=trial.reaction_time_ms,
                feedback="correct" if is_correct else "incorrect",
            )
        )

    total_trials = len(trials)
    total_errors = total_trials - total_correct

    return CardSortingScored(
        total_trials=total_trials,
        categories_completed=categories_completed,
        total_correct=total_correct,
        total_errors=total_errors,
        perseverative_responses=perseverative_responses,
        perseverative_errors=perseverative_errors,
        nonperseverative_errors=nonperseverative_errors,
        trials_to_first_category=trials_to_first_category,
        failure_to_maintain_set_count=failure_to_maintain_set_count,
        trials=scored,
    )
