# CESD10.md — Updated CES-D 10 (Depression Scale) Specification

> Authoritative reference for the CES-D 10 survey instrument.
> Source: Mood Measures.pdf (UBC Attentional Neuroscience Lab, Dr. Todd C. Handy,
> H24-03749 Version 1.2). Scoring reference: DDSSection2.7CESD.pdf.

---

## Overview

10-item depression screening scale. Participants rate how often each statement describes
them **right now** on a 4-point scale. Items 5 and 8 are positive-affect items that require
reverse scoring.

---

## Instructions (exact wording)

> Please indicate how often each statement describes you right now.

---

## Response Scale (as shown on form)

| Value | Label      |
|-------|------------|
| 1     | Never      |
| 2     | Rarely     |
| 3     | Sometimes  |
| 4     | Often      |

**Storage note:** Raw values 1–4 are stored in the database. Scoring converts to 0–3
before computing totals (see Scoring section below).

---

## Items (exact lab wording)

| #  | Item text                                                          | Type     |
|----|--------------------------------------------------------------------|----------|
| 1  | I am being bothered by things that don't usually bother me         | Negative |
| 2  | I am having trouble keeping my mind on what I am doing             | Negative |
| 3  | I am feeling depressed                                             | Negative |
| 4  | I am feeling everything I do is an effort                          | Negative |
| 5  | I am feeling hopeful about the future                              | **Positive (reverse)** |
| 6  | I am feeling fearful                                               | Negative |
| 7  | My sleep was restless                                              | Negative |
| 8  | I am feeling happy                                                 | **Positive (reverse)** |
| 9  | I am feeling lonely                                                | Negative |
| 10 | I cannot "get going"                                               | Negative |

---

## Scoring

1. **Convert raw to 0-based:** For each item, `converted = raw - 1` (maps 1–4 → 0–3)
2. **Reverse positive-affect items (5 and 8):** `reversed = 3 - converted` = `4 - raw`
3. **Sum all 10 converted/reversed values** → `total_score` (range 0–30)

**Equivalently:**
- Negative items (1,2,3,4,6,7,9,10): `score_i = raw_i - 1`
- Positive items (5, 8): `score_i = 4 - raw_i`
- `total_score = sum(score_1 ... score_10)`

**Clinical note:** Score >= 10 is a conventional screening threshold. Store score only — do not
hard-code clinical decisions in the app.

---

## Validation Ranges

| Field       | Min | Max |
|-------------|-----|-----|
| r1–r10 (raw)| 1   | 4   |
| total_score  | 0   | 30  |

---

## Data Storage

See docs/SCHEMA.md for full column definitions.

**Table:** `survey_cesd10`

**Columns:** `response_id`, `session_id`, `participant_uuid`, `r1`–`r10` (SMALLINT 1–4),
`total_score` (SMALLINT 0–30), `created_at`
