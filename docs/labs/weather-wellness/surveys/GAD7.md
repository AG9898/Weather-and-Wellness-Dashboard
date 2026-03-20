# GAD7.md — Updated GAD-7 (Generalized Anxiety Scale) Specification

> Authoritative reference for the GAD-7 survey instrument.
> Source: Mood Measures.pdf (UBC Attentional Neuroscience Lab, Dr. Todd C. Handy,
> H24-03749 Version 1.2). Scoring reference: anxiety-disorder-response.pdf.

---

## Overview

7-item generalized anxiety screening scale. Participants rate how often each statement
describes them **right now** on a 4-point scale. No reverse scoring.

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

| # | Item text                                                        |
|---|------------------------------------------------------------------|
| 1 | I am feeling nervous, anxious, or on edge                        |
| 2 | I am not able to stop or control worrying                        |
| 3 | I am worrying too much about different things                    |
| 4 | I am having trouble relaxing                                     |
| 5 | I am feeling so restless that it is hard to sit still            |
| 6 | I am feeling easily annoyed or irritable                         |
| 7 | I am feeling afraid, as if something awful might happen          |

**Note:** The lab form includes a difficulty question ("If you checked any problems, how
difficult have they made it...") at the bottom. This question is **NOT captured or stored**.

---

## Scoring

1. **Convert raw to 0-based:** For each item, `converted = raw - 1` (maps 1–4 → 0–3)
2. **Sum all 7 converted values** → `total_score` (range 0–21)
3. **Assign severity band:**

| Score range | severity_band  |
|-------------|----------------|
| 0–4         | `"minimal"`    |
| 5–9         | `"mild"`       |
| 10–14       | `"moderate"`   |
| 15–21       | `"severe"`     |

---

## Validation Ranges

| Field          | Min | Max |
|----------------|-----|-----|
| r1–r7 (raw)    | 1   | 4   |
| total_score     | 0   | 21  |

---

## Data Storage

See docs/SCHEMA.md for full column definitions.

**Table:** `survey_gad7`

**Columns:** `response_id`, `session_id`, `participant_uuid`, `r1`–`r7` (SMALLINT 1–4),
`total_score` (SMALLINT 0–21), `severity_band` (VARCHAR), `created_at`
