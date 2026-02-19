# COGFUNC8A.md — Cognitive Function Short Form 8a (PROMIS) Specification

> Authoritative reference for the PROMIS Cognitive Function 8a survey instrument.
> Source: Cognitive Function.pdf (UBC Attentional Neuroscience Lab, Dr. Todd C. Handy,
> H24-03749 Version 1.2). Official form: PROMIS_SF_v2.0-Cognitive_Function_8a_1-23-2020.pdf.

---

## Overview

8-item cognitive function scale from the PROMIS item bank. Participants rate how often
each statement describes them **right now** on a 5-point scale. Raw responses are stored
as-is (1–5); computed scores use PROMIS-standard reverse scoring where higher = better
cognitive function.

---

## Instructions (exact wording)

> Please respond to each question or statement by marking one box per row.

**Time frame prompt:** "Right now..."

---

## Response Scale (as shown on form)

| Value | Label       |
|-------|-------------|
| 1     | Never       |
| 2     | Rarely      |
| 3     | Sometimes   |
| 4     | Often       |
| 5     | Very Often  |

**Storage note:** Raw values 1–5 are stored in the database. All items describe cognitive
*difficulty*, so higher raw values = more difficulty. Computed scores reverse this to match
official PROMIS direction (higher = better function).

---

## Items (exact lab wording)

| # | Item text                                                                                      |
|---|------------------------------------------------------------------------------------------------|
| 1 | My thinking is slow                                                                            |
| 2 | It seems like my brain is not working as well as usual                                         |
| 3 | I am having to work harder than usual to focus on what I am doing                              |
| 4 | I am having trouble shifting back and forth between different activities that require thinking  |
| 5 | I am having trouble concentrating                                                              |
| 6 | I am having to work hard to pay attention, or I will make a mistake                            |
| 7 | I am having trouble forming thoughts                                                           |
| 8 | I am having trouble adding or subtracting numbers in my head                                   |

---

## Scoring

1. **Reverse each item for scoring:** `scored_i = 6 - raw_i`
   - Never (raw 1) → scored 5
   - Rarely (raw 2) → scored 4
   - Sometimes (raw 3) → scored 3
   - Often (raw 4) → scored 2
   - Very Often (raw 5) → scored 1
2. **Compute total_sum:** sum of all 8 reversed values (range 8–40)
3. **Compute mean_score:** mean of all 8 reversed values (range 1.0–5.0)

Higher `total_sum` and `mean_score` = **better** cognitive function (matches official PROMIS
scoring direction).

---

## Validation Ranges

| Field       | Min  | Max   |
|-------------|------|-------|
| r1–r8 (raw) | 1    | 5     |
| total_sum    | 8    | 40    |
| mean_score   | 1.0  | 5.0   |

---

## Data Storage

See docs/SCHEMA.md for full column definitions.

**Table:** `survey_cogfunc8a`

**Columns:** `response_id`, `session_id`, `participant_uuid`, `r1`–`r8` (SMALLINT 1–5),
`total_sum` (SMALLINT 8–40), `mean_score` (NUMERIC 5,4), `created_at`
