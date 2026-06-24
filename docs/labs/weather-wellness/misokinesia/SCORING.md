# SCORING.md — Misokinesia Instrument Scoring Summary & Index

> Structured per-instrument scoring corpus for the Misokinesia component. This is the
> canonical, extraction-friendly source for the methodology-explainer retrieval corpus
> (`docs/AI_CHAT.md`). For full item wording, response scales, UI layout, and the
> participant flow, see [MISOKINESIA.md](./MISOKINESIA.md). For endpoint contracts see
> [API.md](./API.md). For DB columns see `docs/labs/weather-wellness/misokinesia/SCHEMA.md`.
>
> All Misokinesia survey scores are computed server-side in
> `backend/app/routers/misokinesia.py` (GAD-7 reuses `backend/app/scoring/gad7.py`).
> The frontend never computes or persists scores. Implement exactly as written here.

---

## Instrument Index

| Instrument                                    | Items | Item scale | Computed score | Range | Notes |
|-----------------------------------------------|-------|------------|----------------|-------|-------|
| Per-clip reactivity questionnaire             | 4     | 1–5        | per-clip sum (`q1+q2+q3+q4`) | 4–20 | Computed in analytics/dashboard, not stored as a column |
| MkAQ (Misokinesia Assessment Questionnaire)   | 21    | 0–3        | `total_score` (sum of `q1`–`q21`) | 0–63 | No reverse scoring |
| GAD-7 (anxiety, miso-isolated)                | 7     | 0–3        | `total_score` (sum of `r1`–`r7`) + `severity_band` | 0–21 | Items stored already on the 0–3 scale |
| MAQ (Misophonia Assessment Questionnaire)     | 21    | 0–3        | `total_score` (sum of `q1`–`q21`) | 0–63 | Distinct instrument from MkAQ; "sound issues" wording |

---

## Per-clip Reactivity Questionnaire

Four questions shown after every clip. Each item is an integer **1–5**
(`1 = Strongly Disagree`, `5 = Strongly Agree`). Items are stored raw on
`misokinesia_trial_responses` (`q1`–`q4`); there is **no per-clip total column**.

Aggregate reactivity is derived on read:

- **Per-clip score** = `q1 + q2 + q3 + q4` (range 4–20).
- The RA dashboard (`GET /misokinesia/dashboard`) reports `avg_clip_score`, the
  mean of `q1+q2+q3+q4` over a participant's clip responses.
- Video rankings (`GET /misokinesia/video-scores`) report, per active stimulus,
  the mean of `q1+q2+q3+q4` across all responses plus a response count, then
  return the top-5 and bottom-5 stimuli by mean.

Higher values indicate stronger negative reactivity to the clip.

---

## MkAQ (Misokinesia Assessment Questionnaire)

Required 21-item post-video questionnaire, submitted once via
`POST /misokinesia/participants/{id}/mkaq`.

**Response scale (per item):** `0 = Not at all`, `1 = A little of the time`,
`2 = A good deal of the time`, `3 = Almost all the time`.

**Scoring:** `total_score = sum(q1 … q21)`. No reverse scoring; no severity band.

| Field            | Min | Max |
|------------------|-----|-----|
| q1–q21 (raw)     | 0   | 3   |
| total_score      | 0   | 63  |

**Storage:** table `misokinesia_mkaq_responses`, columns `q1`–`q21` (SMALLINT 0–3),
`total_score` (0–63), UNIQUE (`misokinesia_participant_id`). Higher = greater
self-reported misokinesia impact.

---

## GAD-7 (Anxiety — Misokinesia-isolated)

Required 7-item post-video anxiety screen, submitted once via
`POST /misokinesia/participants/{id}/gad7`. Stored in the miso-isolated
`misokinesia_gad7_responses` table, separate from the Weather GAD-7 (`survey_gad7`).

**Response scale (per item):** `0 = Not at all`, `1 = Several days`,
`2 = More than half the days`, `3 = Nearly every day`. Items `r1`–`r7` are stored
**already on the canonical 0–3 scale** (unlike the Weather GAD-7, which stores raw
1–4 and converts).

**Scoring:** `total_score = sum(r1 … r7)` (direct 0–3 sum), then assign
`severity_band` from the standard GAD-7 cut points (reuses
`backend/app/scoring/gad7.py` `score_zero_based`):

| Score range | severity_band  |
|-------------|----------------|
| 0–4         | `"minimal"`    |
| 5–9         | `"mild"`       |
| 10–14       | `"moderate"`   |
| 15–21       | `"severe"`     |

**Difficulty question.** The final difficulty question is stored as nullable
`difficulty_impact` (one of `"Not difficult at all"`, `"Somewhat difficult"`,
`"Very difficult"`, `"Extremely difficult"`). It is **required when any `r1`–`r7`
value is greater than 0** and otherwise stored as `null`. It does **not** affect
`total_score` or `severity_band`.

| Field            | Min | Max |
|------------------|-----|-----|
| r1–r7 (raw)      | 0   | 3   |
| total_score      | 0   | 21  |

> **Contrast with Weather GAD-7.** The Weather instrument (`survey_gad7`,
> [../weather/GAD7.md](../weather/GAD7.md)) stores raw 1–4 and converts with
> `raw - 1` before summing; the Misokinesia GAD-7 stores 0–3 directly. Both reach
> the same 0–21 total and the same four severity bands.

---

## MAQ (Misophonia Assessment Questionnaire)

Required 21-item post-video questionnaire, submitted once via
`POST /misokinesia/participants/{id}/maq`. This is a **distinct instrument** from
the MkAQ (it asks about "sound issues", not "visual issues").

**Response scale (per item):** `0 = Not at all`, `1 = A little of the time`,
`2 = A good deal of the time`, `3 = Almost all the time`.

**Scoring:** `total_score = sum(q1 … q21)`. No reverse scoring; no severity band.

| Field            | Min | Max |
|------------------|-----|-----|
| q1–q21 (raw)     | 0   | 3   |
| total_score      | 0   | 63  |

**Storage:** table `misokinesia_maq_responses`, columns `q1`–`q21` (SMALLINT 0–3),
`total_score` (0–63), UNIQUE (`misokinesia_participant_id`).

---

## Not Scored

The end-of-task questionnaire (`end_fidgeting_text`, `end_emotions_text`,
`stronger_responses`, `stronger_responses_timing`) and the sourced demographics
are descriptive fields only — they have no computed score. See
[MISOKINESIA.md](./MISOKINESIA.md) for their definitions and validation rules.
