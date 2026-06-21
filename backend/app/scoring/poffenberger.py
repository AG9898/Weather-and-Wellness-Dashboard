"""IHTT Poffenberger scoring -- pure function, no DB or side effects."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from statistics import median, stdev

from app.schemas.poffenberger import (
    PoffenbergerConditionSummary,
    PoffenbergerManifest,
)

CONDITION_KEYS = ("lh_lvf", "lh_rvf", "rh_lvf", "rh_rvf")
CROSSED_CONDITIONS = {"lh_rvf", "rh_lvf"}
UNCROSSED_CONDITIONS = {"lh_lvf", "rh_rvf"}
ACCEPTED_KEYS = {"f", "j"}
MAX_RT_MS = 2000


class PoffenbergerScoringError(ValueError):
    """Raised when submitted trials cannot be scored against the manifest."""


@dataclass(frozen=True)
class TrialInput:
    block_number: int
    trial_number: int
    global_trial_number: int
    response_hand: str
    visual_field: str
    expected_key: str
    pressed_key: str | None
    reaction_time_ms: int | None
    is_timeout: bool
    is_practice: bool
    client_trial_started_at_ms: Decimal | None = None
    client_stimulus_onset_ms: Decimal | None = None
    client_response_at_ms: Decimal | None = None
    client_trial_ended_at_ms: Decimal | None = None


@dataclass(frozen=True)
class ScoredTrial:
    block_number: int
    trial_number: int
    global_trial_number: int
    response_hand: str
    visual_field: str
    condition_key: str
    is_practice: bool
    is_scored: bool
    expected_key: str
    pressed_key: str | None
    reaction_time_ms: int | None
    is_valid_response: bool
    is_timeout: bool
    is_accurate: bool
    jitter_ms: int
    client_trial_started_at_ms: Decimal | None
    client_stimulus_onset_ms: Decimal | None
    client_response_at_ms: Decimal | None
    client_trial_ended_at_ms: Decimal | None


@dataclass(frozen=True)
class PoffenbergerScored:
    condition_summaries: dict[str, PoffenbergerConditionSummary]
    mean_rt_crossed_ms: Decimal | None
    mean_rt_uncrossed_ms: Decimal | None
    ihtt_difference_ms: Decimal | None
    accuracy_crossed: Decimal | None
    accuracy_uncrossed: Decimal | None
    trials: list[ScoredTrial]


@dataclass(frozen=True)
class _ManifestTrial:
    block_number: int
    trial_number: int
    experimental_global_trial_number: int | None
    response_hand: str
    visual_field: str
    expected_key: str
    jitter_ms: int
    is_practice: bool


def _condition_key(response_hand: str, visual_field: str) -> str:
    hand_key = "lh" if response_hand == "left" else "rh"
    return f"{hand_key}_{visual_field}"


def _round_decimal(value: Decimal, places: str) -> Decimal:
    return value.quantize(Decimal(places), rounding=ROUND_HALF_UP)


def _accuracy(correct: int, total: int) -> Decimal | None:
    if total == 0:
        return None
    return _round_decimal(Decimal(correct) / Decimal(total), "0.0001")


def _mean(values: list[int]) -> Decimal | None:
    if not values:
        return None
    return _round_decimal(Decimal(sum(values)) / Decimal(len(values)), "0.01")


def _median(values: list[int]) -> Decimal | None:
    if not values:
        return None
    return _round_decimal(Decimal(str(median(values))), "0.01")


def _sd(values: list[int]) -> Decimal | None:
    if len(values) < 2:
        return None
    return _round_decimal(Decimal(str(stdev(values))), "0.01")


def _manifest_trials(
    manifest: PoffenbergerManifest,
) -> dict[tuple[bool, int, int], _ManifestTrial]:
    trials: dict[tuple[bool, int, int], _ManifestTrial] = {}

    for practice_trial in manifest.practice_trials:
        key = (True, 0, practice_trial.trial_number)
        trials[key] = _ManifestTrial(
            block_number=0,
            trial_number=practice_trial.trial_number,
            experimental_global_trial_number=None,
            response_hand=practice_trial.response_hand,
            visual_field=practice_trial.visual_field,
            expected_key=practice_trial.expected_key,
            jitter_ms=practice_trial.jitter_ms,
            is_practice=True,
        )

    for block in manifest.blocks:
        for trial in block.trials:
            key = (False, block.block_number, trial.trial_number)
            trials[key] = _ManifestTrial(
                block_number=block.block_number,
                trial_number=trial.trial_number,
                experimental_global_trial_number=trial.global_trial_number,
                response_hand=block.response_hand,
                visual_field=trial.visual_field,
                expected_key=block.expected_key,
                jitter_ms=trial.jitter_ms,
                is_practice=False,
            )

    return trials


def _validate_trial_against_manifest(
    submitted: TrialInput,
    manifest_trial: _ManifestTrial,
    practice_count: int,
) -> int:
    if submitted.response_hand != manifest_trial.response_hand:
        raise PoffenbergerScoringError("response_hand does not match manifest")
    if submitted.visual_field != manifest_trial.visual_field:
        raise PoffenbergerScoringError("visual_field does not match manifest")
    if submitted.expected_key.strip().lower() != manifest_trial.expected_key:
        raise PoffenbergerScoringError("expected_key does not match manifest")

    if manifest_trial.is_practice:
        allowed_globals = {manifest_trial.trial_number}
        storage_global = manifest_trial.trial_number
    else:
        assert manifest_trial.experimental_global_trial_number is not None
        manifest_global = manifest_trial.experimental_global_trial_number
        storage_global = practice_count + manifest_global
        allowed_globals = {manifest_global, storage_global}

    if submitted.global_trial_number not in allowed_globals:
        raise PoffenbergerScoringError("global_trial_number does not match manifest")
    return storage_global


def _score_trial(
    submitted: TrialInput,
    manifest_trial: _ManifestTrial,
    storage_global_trial_number: int,
) -> ScoredTrial:
    pressed_key = (
        submitted.pressed_key.strip().lower()
        if submitted.pressed_key is not None
        else None
    )
    expected_key = manifest_trial.expected_key.strip().lower()
    rt = submitted.reaction_time_ms

    if pressed_key is None and rt is not None:
        raise PoffenbergerScoringError("reaction_time_ms requires pressed_key")
    if pressed_key is not None and rt is None:
        raise PoffenbergerScoringError("pressed_key requires reaction_time_ms")
    if rt is not None and rt < 1:
        raise PoffenbergerScoringError("reaction_time_ms must be at least 1")

    is_timeout = rt is None or rt > MAX_RT_MS
    is_valid_response = (
        not is_timeout
        and pressed_key is not None
        and pressed_key in ACCEPTED_KEYS
    )
    is_accurate = is_valid_response and pressed_key == expected_key

    return ScoredTrial(
        block_number=manifest_trial.block_number,
        trial_number=manifest_trial.trial_number,
        global_trial_number=storage_global_trial_number,
        response_hand=manifest_trial.response_hand,
        visual_field=manifest_trial.visual_field,
        condition_key=_condition_key(
            manifest_trial.response_hand,
            manifest_trial.visual_field,
        ),
        is_practice=manifest_trial.is_practice,
        is_scored=not manifest_trial.is_practice,
        expected_key=expected_key,
        pressed_key=pressed_key,
        reaction_time_ms=rt,
        is_valid_response=is_valid_response,
        is_timeout=is_timeout,
        is_accurate=is_accurate,
        jitter_ms=manifest_trial.jitter_ms,
        client_trial_started_at_ms=submitted.client_trial_started_at_ms,
        client_stimulus_onset_ms=submitted.client_stimulus_onset_ms,
        client_response_at_ms=submitted.client_response_at_ms,
        client_trial_ended_at_ms=submitted.client_trial_ended_at_ms,
    )


def _summarize_condition(trials: list[ScoredTrial]) -> PoffenbergerConditionSummary:
    total_trials = len(trials)
    valid_rt_trials = sum(1 for trial in trials if trial.is_valid_response)
    timeout_trials = sum(1 for trial in trials if trial.is_timeout)
    invalid_trials = sum(
        1
        for trial in trials
        if not trial.is_timeout and not trial.is_valid_response
    )
    accurate_trials = sum(1 for trial in trials if trial.is_accurate)
    accurate_rts = [
        trial.reaction_time_ms
        for trial in trials
        if trial.is_accurate and trial.reaction_time_ms is not None
    ]

    return PoffenbergerConditionSummary(
        total_trials=total_trials,
        valid_rt_trials=valid_rt_trials,
        timeout_trials=timeout_trials,
        invalid_trials=invalid_trials,
        accurate_trials=accurate_trials,
        accuracy=_accuracy(accurate_trials, total_trials),
        mean_rt_ms=_mean(accurate_rts),
        median_rt_ms=_median(accurate_rts),
        sd_rt_ms=_sd(accurate_rts),
    )


def score(
    trials: list[TrialInput],
    manifest: PoffenbergerManifest,
) -> PoffenbergerScored:
    """Validate submitted trials against the manifest and compute summaries."""
    manifest_trials = _manifest_trials(manifest)
    practice_count = len(manifest.practice_trials)
    experimental_keys = {key for key in manifest_trials if key[0] is False}
    practice_keys = {key for key in manifest_trials if key[0] is True}
    submitted_keys = {
        (trial.is_practice, trial.block_number, trial.trial_number) for trial in trials
    }

    if len(submitted_keys) != len(trials):
        raise PoffenbergerScoringError("duplicate submitted trial")
    if not experimental_keys <= submitted_keys:
        raise PoffenbergerScoringError("missing experimental trial")
    if any(key not in manifest_trials for key in submitted_keys):
        raise PoffenbergerScoringError("submitted trial is not in manifest")

    submitted_practice_keys = {key for key in submitted_keys if key[0] is True}
    if submitted_practice_keys and submitted_practice_keys != practice_keys:
        raise PoffenbergerScoringError("practice trials must be submitted completely")

    scored_trials: list[ScoredTrial] = []
    for submitted in sorted(
        trials,
        key=lambda trial: (
            0 if trial.is_practice else 1,
            trial.block_number,
            trial.trial_number,
        ),
    ):
        key = (submitted.is_practice, submitted.block_number, submitted.trial_number)
        manifest_trial = manifest_trials[key]
        storage_global = _validate_trial_against_manifest(
            submitted,
            manifest_trial,
            practice_count,
        )
        scored_trials.append(_score_trial(submitted, manifest_trial, storage_global))

    scored_experimental = [trial for trial in scored_trials if trial.is_scored]
    condition_summaries = {
        condition_key: _summarize_condition(
            [
                trial
                for trial in scored_experimental
                if trial.condition_key == condition_key
            ]
        )
        for condition_key in CONDITION_KEYS
    }

    crossed_trials = [
        trial
        for trial in scored_experimental
        if trial.condition_key in CROSSED_CONDITIONS
    ]
    uncrossed_trials = [
        trial
        for trial in scored_experimental
        if trial.condition_key in UNCROSSED_CONDITIONS
    ]
    crossed_rts = [
        trial.reaction_time_ms
        for trial in crossed_trials
        if trial.is_accurate and trial.reaction_time_ms is not None
    ]
    uncrossed_rts = [
        trial.reaction_time_ms
        for trial in uncrossed_trials
        if trial.is_accurate and trial.reaction_time_ms is not None
    ]
    mean_crossed = _mean(crossed_rts)
    mean_uncrossed = _mean(uncrossed_rts)
    ihtt_difference = (
        _round_decimal(mean_crossed - mean_uncrossed, "0.01")
        if mean_crossed is not None and mean_uncrossed is not None
        else None
    )

    return PoffenbergerScored(
        condition_summaries=condition_summaries,
        mean_rt_crossed_ms=mean_crossed,
        mean_rt_uncrossed_ms=mean_uncrossed,
        ihtt_difference_ms=ihtt_difference,
        accuracy_crossed=_accuracy(
            sum(1 for trial in crossed_trials if trial.is_accurate),
            len(crossed_trials),
        ),
        accuracy_uncrossed=_accuracy(
            sum(1 for trial in uncrossed_trials if trial.is_accurate),
            len(uncrossed_trials),
        ),
        trials=scored_trials,
    )
