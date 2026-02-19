# SCORING.md — Instrument Scoring Summary & Index

> Summary index for all instrument scoring rules. For full details (exact item wording,
> response scales, scoring formulas, DB columns), see the per-instrument docs linked below.
> Implement exactly as written in each instrument doc.

---

## Instrument Docs

| Instrument              | Full specification       | Key scoring notes                                          |
|-------------------------|--------------------------|------------------------------------------------------------|
| Backwards Digit Span    | [docs/DIGITSPAN.md](DIGITSPAN.md)   | Server-side: total_correct + max_span                     |
| ULS-8 (Loneliness)      | [docs/ULS8.md](ULS8.md)             | Reverse items 3 & 6; mean → 0-100 transform              |
| CES-D 10 (Depression)   | [docs/CESD10.md](CESD10.md)         | Raw 1-4, convert to 0-3; reverse items 5 & 8; sum 0-30   |
| GAD-7 (Anxiety)         | [docs/GAD7.md](GAD7.md)             | Raw 1-4, convert to 0-3; sum 0-21; severity band          |
| CogFunc 8a (PROMIS)     | [docs/COGFUNC8A.md](COGFUNC8A.md)   | Raw 1-5, reverse (6-raw) for computed scores; sum + mean  |

---

## Response Scale Summary

All lab forms use present-tense wording ("Right now...") and uniform scales:

| Instrument   | Scale on form | Raw stored | Scoring conversion       |
|--------------|---------------|------------|--------------------------|
| ULS-8        | 1-4 (Never/Rarely/Sometimes/Often) | 1-4 | Score directly; reverse items 3 & 6 with `5 - raw` |
| CES-D 10     | 1-4 (Never/Rarely/Sometimes/Often) | 1-4 | Convert to 0-3 (`raw - 1`); reverse items 5 & 8 with `4 - raw` |
| GAD-7        | 1-4 (Never/Rarely/Sometimes/Often) | 1-4 | Convert to 0-3 (`raw - 1`) before summing |
| CogFunc 8a   | 1-5 (Never/Rarely/Sometimes/Often/Very Often) | 1-5 | Reverse all items (`6 - raw`) for computed scores |

---

## Score Validation Ranges

Use these ranges to validate computed values server-side before persisting:

| Instrument    | Field          | Min   | Max    |
|---------------|----------------|-------|--------|
| Digit Span    | total_correct  | 0     | 14     |
| Digit Span    | max_span       | 0     | 9      |
| ULS-8         | r1–r8          | 1     | 4      |
| ULS-8         | computed_mean  | 1.0   | 4.0    |
| ULS-8         | score_0_100    | 0.0   | 100.0  |
| CES-D 10      | r1–r10         | 1     | 4      |
| CES-D 10      | total_score    | 0     | 30     |
| GAD-7         | r1–r7          | 1     | 4      |
| GAD-7         | total_score    | 0     | 21     |
| CogFunc 8a    | r1–r8          | 1     | 5      |
| CogFunc 8a    | total_sum      | 8     | 40     |
| CogFunc 8a    | mean_score     | 1.0   | 5.0    |
