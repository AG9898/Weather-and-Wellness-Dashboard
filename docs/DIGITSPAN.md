# DIGITSPAN.md — Backwards Digit Span Task Specification

> Authoritative reference for the backwards digit span task. Implements the protocol from
> [thesimonho/cognitive-battery](https://github.com/thesimonho/cognitive-battery)
> (`tasks/digitspan_backwards.py`), adapted for web delivery.

---

## Overview

Participants are shown a sequence of digits one at a time, then must type the sequence
**backwards** using the keyboard. Sequences increase in length from 3 to 9 digits.

---

## Timing Parameters

| Parameter              | Value     | Description                                      |
|------------------------|-----------|--------------------------------------------------|
| Digit display duration | 1000 ms   | Each digit shown on screen                       |
| Inter-digit gap        | 100 ms    | Blank screen between consecutive digits          |
| Practice feedback      | 2000 ms   | Correct/Incorrect feedback shown (practice only) |

Use `setTimeout` chains for timing — never `setInterval` (see docs/CONVENTIONS.md).

---

## Digit Pool

Digits **1 through 9** only. Zero is excluded.

---

## Sequence Generation

- For each trial, sample `length` digits from the pool **without replacement**
  (equivalent to `random.sample(range(1, 10), length)`)
- No digit repeats within a single sequence
- At max span (9), the sequence is a random permutation of all 9 digits
- All sequences are generated before the task begins (pre-generated at init)

---

## Trial Structure

| Span length | Trial numbers | Count |
|-------------|---------------|-------|
| 3           | 1, 2          | 2     |
| 4           | 3, 4          | 2     |
| 5           | 5, 6          | 2     |
| 6           | 7, 8          | 2     |
| 7           | 9, 10         | 2     |
| 8           | 11, 12        | 2     |
| 9           | 13, 14        | 2     |

- **Total scored trials:** 14
- **Order:** Fixed ascending by span length (3,3,4,4,5,5,6,6,7,7,8,8,9,9)
- **Early termination:** None — all 14 trials are always presented regardless of performance

---

## Practice Trial

- **One** practice trial before scored trials
- **Hardcoded sequence:** `1 3 5 7 9` (span length 5)
- Correct answer: `9 7 5 3 1`
- After participant submits, show feedback for 2000 ms:
  - **Correct:** green text "Correct"
  - **Incorrect:** red text "Incorrect"
- Practice response is **NOT stored** in the database
- **No feedback** is given on main (scored) trials

---

## Participant Input

- **Keyboard only** — no mouse interaction
- Accepted keys: digit keys 1-9 only (ignore all other keys)
- **Backspace** deletes the last entered digit
- **Enter/Return** submits the response
- Entered digits are displayed on screen in real time as the participant types
- **No time limit** on response entry — participant takes as long as needed
- Input prompt: "Type the sequence in backwards order:"

---

## Instruction Screens

Present these screens in order, each advancing on spacebar/button press:

**Screen 1 — Main instructions:**
> **Backwards Digit Span**
>
> You will be shown a number sequence, one number at a time.
>
> Memorize the number sequence.
>
> You will then be asked to type the sequence in reverse/backwards order. For example...
>
> Sequence: 1 2 3 4 5
>
> Correct: 5 4 3 2 1
>
> The sequences will get longer throughout the experiment.

**Screen 2 — Practice intro:**
> We will begin with a practice trial...

**Screen 3 — After practice, before main trials:**
> We will now begin the main trials...

**Screen 4 — End of task:**
> End of task.

---

## Answer Checking

- Reverse the participant's entered string and compare to the original displayed sequence
- Example: shown `4 8 2`, participant types `2 8 4` → reversed = `4 8 2` → matches → **correct**
- **All-or-nothing** scoring — no partial credit

---

## Scoring (Server-Side)

Computed by `backend/app/scoring/digitspan.py` — not on the client.

| Metric          | Computation                                                          | Range |
|-----------------|----------------------------------------------------------------------|-------|
| `total_correct` | Count of trials where `correct == true`                              | 0–14  |
| `max_span`      | Longest `span_length` where at least one trial is correct            | 0–9   |

`max_span` is 0 if all 14 trials are incorrect.

---

## Data Storage

See docs/SCHEMA.md for full column definitions.

**Per run** (`digitspan_runs`): `run_id`, `session_id`, `participant_uuid`, `total_correct`, `max_span`

**Per trial** (`digitspan_trials`): `trial_id`, `run_id`, `trial_number` (1–14), `span_length` (3–9),
`sequence_shown` (space-separated, e.g. `"4 7 2"`), `sequence_entered` (as typed),
`correct` (BOOLEAN)
