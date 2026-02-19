# ULS8.md — Updated ULS-8 (Loneliness Scale) Specification

> Authoritative reference for the ULS-8 survey instrument.
> Source: Mood Measures.pdf (UBC Attentional Neuroscience Lab, Dr. Todd C. Handy,
> H24-03749 Version 1.2). Scoring reference: ULS-8.pdf.

---

## Overview

8-item loneliness scale. Participants rate how often each statement describes them
**right now** on a 4-point scale.

---

## Instructions (exact wording)

> Please indicate how often each statement describes you right now.

---

## Response Scale

| Value | Label      |
|-------|------------|
| 1     | Never      |
| 2     | Rarely     |
| 3     | Sometimes  |
| 4     | Often      |

---

## Items (exact lab wording)

| # | Item text                                                        | Reverse? |
|---|------------------------------------------------------------------|----------|
| 1 | I am lacking companionship.                                      | No       |
| 2 | I am feeling that there is no one I can turn to.                 | No       |
| 3 | I am feeling outgoing.                                           | **Yes**  |
| 4 | I am feeling left out.                                           | No       |
| 5 | I am feeling isolated from others.                               | No       |
| 6 | I can find companionship if I want it.                           | **Yes**  |
| 7 | I am unhappy being so withdrawn.                                 | No       |
| 8 | I am feeling that people are around me but not with me.          | No       |

> **Reverse-score note:** The scoring section on the lab form explicitly states: "Score 1-4 as
> indicated above for items 1, 2, 4, 5, 7, and 8. For items 3 and 6: Never = 4, Rarely = 3,
> Sometimes = 2, and Often = 1." Only items **3 and 6** are reverse-scored.

---

## Scoring

1. **Reverse-score items 3 and 6:** `reversed = 5 - raw_value`
2. **Compute mean** of all 8 (possibly reversed) values → range 1.0–4.0
3. **Transform to 0–100:** `score_0_100 = (mean - 1) * (100 / 3)`

---

## Validation Ranges

| Field          | Min  | Max    |
|----------------|------|--------|
| r1–r8 (raw)    | 1    | 4      |
| computed_mean   | 1.0  | 4.0    |
| score_0_100     | 0.0  | 100.0  |

---

## Data Storage

See docs/SCHEMA.md for full column definitions.

**Table:** `survey_uls8`

**Columns:** `response_id`, `session_id`, `participant_uuid`, `r1`–`r8` (SMALLINT 1–4),
`computed_mean` (NUMERIC 5,4), `score_0_100` (NUMERIC 6,2), `created_at`
