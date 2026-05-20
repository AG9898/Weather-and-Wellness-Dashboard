# MISOKINESIA.md — Misokinesia Video Task

> Canonical spec for the Misokinesia module. For endpoint contracts see `docs/labs/weather-wellness/misokinesia/API.md`. For schema see `docs/SCHEMA.md`. For auth/stimulus management decisions see `docs/DECISIONS.md` (OPEN-02).

---

## Purpose

The Misokinesia module presents a participant with 25 short video clips (each approximately 15 seconds, longest 33 seconds; 4 clips decommissioned 2026-05, rows retained) in a randomized per-session order. Before any clips play, the participant completes a short miso-specific demographics form (optional fields; stored on `misokinesia_participants`). After each clip the participant answers a 4-question per-clip questionnaire. After the final clip response, the participant completes three post-video surveys in a server-assigned randomised order — each preceded by a transition card — covering the 21-item Misokinesia Assessment Questionnaire (MkAQ), the 7-item GAD-7 anxiety scale, and the 21-item Misophonia Assessment Questionnaire (MAQ). After all clip and post-video survey requirements are complete, the participant answers the end-of-task questionnaire. All results are stored anonymously, linked to a dedicated `misokinesia_participants` row that references a standard `participants` UUID and `session_id`.

---

## Participant Flow

1. RA navigates to `/misokinesia` via the floating dock and clicks "Start Misokinesia Session".
2. Backend atomically creates an anonymous `participants` row, an `active` session, and a `misokinesia_participants` row, randomly assigns a `post_survey_order` permutation of `["mkaq", "gad7", "maq"]`, then returns the full clip manifest (all 25 active URLs) plus the survey order.
3. App navigates to `/misokinesia/[misokinesia_participant_id]` on the same device (no login required).
4. Participant completes the miso demographics form (all fields optional); frontend submits `PATCH /misokinesia/participants/{id}/demographics`.
5. Participant sees intro screen and clicks to begin. Task container enters browser-native fullscreen (Fullscreen API) at this point and remains fullscreen for the duration of the task.
6. For each of 25 clips (session-randomized playback order):
   - A 2-second solid-black buffer screen is shown; the video is preloaded during this time.
   - Video clip autoplays.
   - Per-clip questionnaire (4 questions) is shown after the clip, inside the fullscreen container.
   - Frontend submits `POST /misokinesia/participants/{id}/responses`.
   - When `is_complete: true` is returned (25th submission), backend has set `completed_at` server-side.
7. Participant completes the three post-video surveys in the order given by `post_survey_order`. Before each survey, a transition card is shown describing the next task; the card is keyed to its survey so randomization does not break the pairing:
   - **[transition card → MkAQ]** — 21-item card carousel; `POST /misokinesia/participants/{id}/mkaq`
   - **[transition card → GAD-7]** — 7-item radio form; `POST /misokinesia/participants/{id}/gad7`
   - **[transition card → MAQ]** — 21-item card carousel; `POST /misokinesia/participants/{id}/maq`
8. Frontend transitions to the end-of-task questionnaire (not directly to completion).
9. Participant completes the end-of-task form; frontend submits `PATCH /misokinesia/participants/{id}/end-of-task`.
10. Frontend calls `PATCH /sessions/{session_id}/status` with `status='complete'` (reuses existing endpoint, same pattern as digitspan).
11. Completion screen shown; RA clicks "Back to Misokinesia" to return to `/misokinesia`.

State machine: `demographics → intro → playing → questionnaire → (loop × 25) → [transition_card → post_survey] × 3 → end_of_task → complete`

## Trial mode (Run Test Trial)

Misokinesia also supports an RA-invoked no-write rehearsal mode:

Two trial modes are available from the `/misokinesia` RA launch page. Both are no-write rehearsals — no rows are created in any table.

### Short Trial ("Run Short Trial")

- RA clicks **Run Short Trial** on `/misokinesia`.
- Frontend calls `GET /misokinesia/trial-manifest` (no params); backend returns 5 randomly sampled active clips.
- Surveys use shortened rehearsal sets: MkAQ `q1`–`q10` only, MAQ `q1`–`q10` only, GAD-7 all 7 items.
- Per-clip questionnaire, all survey, and end-of-task submits are local-only simulated transitions.

Short trial state machine: `demographics → intro → playing → questionnaire → (loop × 5 sampled clips) → [transition_card → post_survey shortened] × 3 → end_of_task → complete`

### Full Trial ("Run Full Trial")

- RA clicks **Run Full Trial** on `/misokinesia`.
- Frontend calls `GET /misokinesia/trial-manifest?full=true`; backend returns all active clips in a randomized order (same count and randomization as production, but no rows written).
- Surveys use full item sets: MkAQ `q1`–`q21`, GAD-7 `q1`–`q7`, MAQ `q1`–`q21`.
- Per-clip questionnaire, all survey, and end-of-task submits are local-only simulated transitions.
- Designed to let the RA rehearse the complete production experience end-to-end.

Full trial state machine: `demographics → intro → playing → questionnaire → (loop × 25 clips) → [transition_card → post_survey full] × 3 → end_of_task → complete`

### Shared trial constraints (both modes)

- Frontend generates fake `misokinesia_participant_id` and `session_id` values.
- Trial videos use the same public Supabase Storage CDN URL pattern as production clips.
- A locally generated `post_survey_order` permutation drives the post-video survey sequence.
- No calls are made to `/misokinesia/start`, `/misokinesia/participants/{id}/demographics`, `/misokinesia/participants/{id}/responses`, `/misokinesia/participants/{id}/mkaq`, `/misokinesia/participants/{id}/gad7`, `/misokinesia/participants/{id}/maq`, or `/misokinesia/participants/{id}/end-of-task`.
- No rows are written to `participants`, `sessions`, `misokinesia_participants`, `misokinesia_trial_responses`, `misokinesia_mkaq_responses`, `misokinesia_gad7_responses`, or `misokinesia_maq_responses`. Demographics screen is shown but the demographics PATCH is not called.
- No `"Trial Run"` watermark is shown on the Misokinesia participant task page in either trial mode.

## RA Flow

Navigate to `/misokinesia` via the floating dock present on all RA pages. Click "Start Misokinesia Session". The backend creates the anonymous participant and session and returns the manifest. The app navigates to `/misokinesia/[id]` on the same device — no external URL or participant handoff.

---

## Data Model

Four core tables were added by migration `20260317_000001`. The planned MkAQ addition extends `misokinesia_participants` with the randomized administration assignment and adds one MkAQ response table. No changes to the existing `sessions` or `participants` tables beyond inserting anonymous rows via `POST /misokinesia/start`.

| Table | Purpose | Key columns |
|---|---|---|
| `misokinesia_test_sets` | Reusable stimulus configuration / study version | `test_set_id` (UUID PK), `name`, `version`, `active` |
| `misokinesia_stimuli` | Clip metadata; no video bytes in DB | `stimulus_id` (UUID PK), `test_set_id` (FK), `storage_path`, `sort_order`, `duration_ms`, `active` |
| `misokinesia_participants` | One row per participant task execution; holds progress state, randomized post-video survey order, and end-of-task responses | `misokinesia_participant_id` (UUID PK), `session_id` (FK), `participant_uuid` (FK), `test_set_id` (FK), `misokinesia_participant_number` (SERIAL), `post_survey_order` (VARCHAR, e.g. `"mkaq,gad7,maq"`), `completed_at` (nullable), end-of-task columns |
| `misokinesia_trial_responses` | One row per clip per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `stimulus_id` (FK), `display_order`, `q1`–`q4` (SMALLINT), UNIQUE (`misokinesia_participant_id`, `stimulus_id`) |
| `misokinesia_mkaq_responses` | One MkAQ response per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `q1`–`q21` (SMALLINT 0–3), `total_score` (0–63), UNIQUE (`misokinesia_participant_id`) |
| `misokinesia_gad7_responses` | One GAD-7 response per participant (miso-isolated table) | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `r1`–`r7` (SMALLINT 1–4), `total_score` (0–21), `severity_band`, UNIQUE (`misokinesia_participant_id`) |
| `misokinesia_maq_responses` | One MAQ response per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `q1`–`q21` (SMALLINT 0–3), `total_score` (0–63), UNIQUE (`misokinesia_participant_id`) |

See `docs/SCHEMA.md` — "Phase 4 Additions — Misokinesia Module" for the full column list.

---

## API Surface

Router prefix: `/misokinesia`. Implemented in `backend/app/routers/misokinesia.py`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/misokinesia/start` | RA required | Creates anonymous participant + session + misokinesia_participants row; returns the full 25-clip manifest (active stimuli) in a randomized playback order plus `post_survey_order` |
| `GET` | `/misokinesia/trial-manifest` | RA required | Read-only rehearsal endpoint; returns 5 randomly sampled active clip URLs and a locally generated `post_survey_order` without creating any rows |
| `PATCH` | `/misokinesia/participants/{participant_id}/demographics` | None (participant-facing) | Writes miso-specific demographics to `misokinesia_participants`; idempotent; all fields optional |
| `POST` | `/misokinesia/participants/{participant_id}/responses` | None (participant-facing) | Submits one per-clip questionnaire; sets `completed_at` server-side on final submission; returns `is_complete` flag |
| `POST` | `/misokinesia/participants/{participant_id}/mkaq` | None (participant-facing) | Submits the required 21-item MkAQ once; server computes and stores `total_score` |
| `POST` | `/misokinesia/participants/{participant_id}/gad7` | None (participant-facing) | Submits the 7-item GAD-7 once; server computes `total_score` and `severity_band` |
| `POST` | `/misokinesia/participants/{participant_id}/maq` | None (participant-facing) | Submits the 21-item MAQ once; server computes and stores `total_score` |
| `PATCH` | `/misokinesia/participants/{participant_id}/end-of-task` | None (participant-facing) | Writes the 4 end-of-task fields to `misokinesia_participants`; requires all three post-video surveys to be submitted first |

See `docs/labs/weather-wellness/misokinesia/API.md` for full request/response schemas and error codes.

---

## Per-clip Questionnaire

4 questions shown after every clip. All items are integer 1–5 (1 = Strongly Disagree, 5 = Strongly Agree).

| Column | Question |
|---|---|
| `q1` | I find this video unpleasant |
| `q2` | I felt physical discomfort during the video |
| `q3` | I felt upset during the video |
| `q4` | I wanted to stop the video early / or close my eyes |

---

## Post-Video Surveys

Three surveys are administered after the video loop, in the randomised order given by `post_survey_order` from the session manifest. The frontend drives the sequence; all three must be submitted before `PATCH .../end-of-task` is accepted.

---

## Misokinesia Assessment Questionnaire (MkAQ)

Required 21-item questionnaire shown once per production participant, always after the video loop as part of the randomised post-video survey block.

Response scale: `0 = Not at all`, `1 = A little of the time`, `2 = A good deal of the time`, `3 = Almost all the time`. All 21 items are required. FastAPI computes `total_score` as the sum of `q1`–`q21` (range 0–63); the frontend must not compute or persist the score.

### MkAQ UI Layout

The MkAQ is displayed as one in-flow section on the Misokinesia participant page, not as 21 vertically stacked questions and not as separate routed pages. The frontend renders the section as a single card carousel with pane navigation:

- Production panes: `q1`-`q5`, `q6`-`q10`, `q11`-`q15`, `q16`-`q21`.
- Trial Run panes: `q1`-`q5`, `q6`-`q10`.
- `Previous` is available after the first pane and preserves all selected answers.
- `Next` is enabled only after every question on the current pane has an answer.
- Final submit is enabled only after every required item for the current mode has an answer.
- Pane navigation is frontend-only; production still submits one complete `q1`-`q21` payload to `/misokinesia/participants/{id}/mkaq`.

Trial Run uses the same card carousel behavior but only includes source items `q1` through `q10` in order. The Trial Run MkAQ submit is local-only and does not call the production MkAQ endpoint.

The MkAQ items come from `reference/labs/Misokinesia/41598_2021_96430_MOESM1_ESM.pdf`, Supplementary Figure S1 only. Ignore the Supplementary Methods cover page and the three attention-check prompts in Supplementary Table S1.

| Column | Question |
|---|---|
| `q1` | My visual issues currently make me unhappy. |
| `q2` | My visual issues currently create problems for me. |
| `q3` | My visual issues have recently made me feel angry. |
| `q4` | I feel that no one understands my problems with certain visuals. |
| `q5` | My visual issues do not seem to have a known cause. |
| `q6` | My visual issues currently make me feel helpless. |
| `q7` | My visual issues currently interfere with my social life. |
| `q8` | My visual issues currently make me feel isolated. |
| `q9` | My visual issues have recently created problems for me in groups. |
| `q10` | My visual issues negatively affect my work/school life (currently or recently). |
| `q11` | My visual issues currently make me feel frustrated. |
| `q12` | My visual issues currently impact my entire life negatively. |
| `q13` | My visual issues have recently made me feel guilty. |
| `q14` | My visual issues are classified as 'crazy'. |
| `q15` | I feel that no one can help me with my visual issues. |
| `q16` | My visual issues currently make me feel hopeless. |
| `q17` | I feel that my visual issues will only get worse with time. |
| `q18` | My visual issues currently impact my family relationships. |
| `q19` | My visual issues have recently affected my ability to be with other people. |
| `q20` | My visual issues have not been recognized as legitimate. |
| `q21` | I am worried that my whole life will be affected by visual issues. |

---

## GAD-7 (Generalized Anxiety Disorder-7)

Required 7-item questionnaire shown once per production participant as part of the randomised post-video survey block. Results are stored in the miso-isolated `misokinesia_gad7_responses` table.

> **Wording update (T182):** The 7 question strings must be updated to the original validated GAD-7 wording from `reference/labs/weather-wellness/anxiety-disorder-response.pdf`. The WW-lab wording listed below is the current implementation and will be replaced. The response scale, scoring formula, and API contract are **unchanged**.

Response scale: `1 = Never`, `2 = Rarely`, `3 = Sometimes`, `4 = Often`. All 7 items are required. FastAPI computes `total_score` (0–21, converted 1–4 → 0–3 per item) and `severity_band`; the frontend must not compute scores.

Rendered using the shared `SurveyForm` component — not a card carousel.

| Column | Question (current WW-lab wording — replace per T182) |
|---|---|
| `r1` | I am feeling nervous, anxious, or on edge. |
| `r2` | I am not able to stop or control worrying. |
| `r3` | I am worrying too much about different things. |
| `r4` | I am having trouble relaxing. |
| `r5` | I am feeling so restless that it is hard to sit still. |
| `r6` | I am feeling easily annoyed or irritable. |
| `r7` | I am feeling afraid, as if something awful might happen. |

---

## Misophonia Assessment Questionnaire (MAQ)

Required 21-item questionnaire shown once per production participant as part of the randomised post-video survey block. Source: `reference/labs/Misokinesia/MAQ.pdf` page 1 (Marsha Johnson, revised by Tom Dozier, 2013). Original "sound issues" wording is preserved — this is a distinct instrument from the MkAQ.

Response scale: `0 = Not at all`, `1 = A little of the time`, `2 = A good deal of the time`, `3 = Almost all the time`. All 21 items are required. FastAPI computes `total_score` as the sum of `q1`–`q21` (range 0–63); the frontend must not compute or persist the score.

### MAQ UI Layout

Same card carousel pattern as MkAQ:
- Production panes: `q1`–`q7`, `q8`–`q14`, `q15`–`q21`.
- Trial Run panes: `q1`–`q5`, `q6`–`q10`.
- Trial Run submit is local-only and does not call the production MAQ endpoint.

| Column | Question |
|---|---|
| `q1` | My sound issues currently make me unhappy. |
| `q2` | My sound issues currently create problems for me. |
| `q3` | My sound issues have recently made me feel angry. |
| `q4` | I feel that no one understands my problems with certain sounds. |
| `q5` | My sound issues do not seem to have a known cause. |
| `q6` | My sound issues currently make me feel helpless. |
| `q7` | My sound issues currently interfere with my social life. |
| `q8` | My sound issues currently make me feel isolated. |
| `q9` | My sound issues have recently created problems for me in groups. |
| `q10` | My sound issues negatively affect my work/school life (currently or recently). |
| `q11` | My sound issues currently make me feel frustrated. |
| `q12` | My sound issues currently impact my entire life negatively. |
| `q13` | My sound issues have recently made me feel guilty. |
| `q14` | My sound issues are classified as 'crazy'. |
| `q15` | I feel that no one can help me with my sound issues. |
| `q16` | My sound issues currently make me feel hopeless. |
| `q17` | I feel that my sound issues will only get worse with time. |
| `q18` | My sound issues currently impact my family relationships. |
| `q19` | My sound issues have recently affected my ability to be with other people. |
| `q20` | My sound issues have not been recognized as legitimate. |
| `q21` | I am worried that my whole life will be affected by sound issues. |

---

## End-of-task Questionnaire

Three items shown once after all 29 per-clip questionnaires and all three post-video surveys are complete, before the completion screen. Stored as columns on `misokinesia_participants`.

| Column | Type | Question / Notes |
|---|---|---|
| `end_fidgeting_text` | TEXT | "Please list any fidgeting stimuli that you are bothered by that did not show up in the task" (free text, optional) |
| `end_emotions_text` | TEXT | "Please list any emotional responses that you felt during the videos that were not asked in the questionnaire" (free text, optional) |
| `stronger_responses` | BOOLEAN | "Did viewing the videos create stronger responses over time?" — No (false) / Yes (true), optional |
| `stronger_responses_timing` | VARCHAR | If `stronger_responses` is true: one of `"Immediately"`, `"After 5 seconds"`, `"After 10 seconds"`, `"At the end of the video"`; otherwise null. Setting this when `stronger_responses` is false returns 422. |

All fields are optional (null accepted). `PATCH /end-of-task` returns 409 if `completed_at` is null (clips not yet finished) or if any of the three post-video surveys (MkAQ, GAD-7, MAQ) have not been submitted.

---

## Architecture Notes

- **Videos served from Supabase Storage public CDN.** Bucket: `misokinesia-stimuli`. URL format: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`. No signing, no expiry. Never proxied through FastAPI.
- **Manifest-first pattern.** All 25 active clip URLs are returned in a single `POST /misokinesia/start` response in the randomized order used for that participant. The frontend plays clips directly from those URLs; no per-clip backend round-trip for media.
- **Trial manifest is read-only.** `GET /misokinesia/trial-manifest` returns only clip metadata and public CDN URLs for 5 randomly sampled active stimuli. It must not create or mutate `participants`, `sessions`, `misokinesia_participants`, or response rows.
- **Post-video survey order is randomized and persisted.** Production starts assign a random permutation of `["mkaq", "gad7", "maq"]` as `post_survey_order` server-side, persist it on `misokinesia_participants`, and return it in the manifest so the frontend drives all three post-video surveys in the correct sequence.
- **Transition cards are frontend-only.** A transition/intro card is shown before each post-video survey. Each card is keyed to its survey key (`mkaq`, `gad7`, `maq`) and paired with it in the `post_survey_order` sequence. No backend involvement; no new API call.
- **Survey scores are server-computed.** MkAQ and MAQ: direct sum of raw items; GAD-7: items converted 1–4 → 0–3 then summed. The frontend must not compute or persist scores for any survey.
- **`completed_at` set server-side.** On each `POST /responses` call the backend counts submitted responses for the participant; when all stimuli are answered it sets `misokinesia_participants.completed_at` automatically and returns `is_complete: true`.
- **Independent participant numbering.** `misokinesia_participant_number` is assigned by a dedicated PostgreSQL SERIAL sequence and starts from 1, independent of `participants.participant_number`.
- **Stimuli seeded via seed script.** No admin upload endpoint exists yet; stimulus rows are inserted manually or via a seed script. Decommissioned stimuli have `active = false`; their rows are retained.
- **Fullscreen.** The task container element (wrapping video, questionnaire, transition cards, and surveys) enters browser-native fullscreen via the Fullscreen API at task start. Fullscreen persists across all state transitions. An exit-fullscreen button is visible at all times.
- **2-second pre-clip buffer.** Before each clip autoplays, a 2-second solid-black interstitial is shown. The `<video>` element is loaded (`preload="auto"`) during this buffer so playback starts immediately after.
- **Demographics are participant-submitted.** Miso demographics are collected via the first screen of the participant task (before intro) and stored on `misokinesia_participants` via `PATCH /misokinesia/participants/{id}/demographics`. All fields are optional. Trial mode shows the screen but does not call the endpoint.

---

## Decommissioned Stimuli

The following clips were removed from the active pool by stakeholder decision (2026-05). Their `misokinesia_stimuli` rows are retained with `active = false` and will never be returned by the manifest endpoints. All historical response data linked to these stimuli remains intact.

| Filename | Sort order | Behaviour |
|---|---|---|
| `wristRotation.mp4` | 29 | Decommissioned 2026-05 |
| `fingerRolling.mp4` | 12 | Decommissioned 2026-05 |
| `penClicking.mp4` | 26 | Decommissioned 2026-05 |
| `footTapping.mp4` | 14 | Decommissioned 2026-05 |

To decommission: run `UPDATE misokinesia_stimuli SET active = false WHERE filename IN (...)` or re-run `backend/admin_cli/seed_misokinesia_stimuli.py` after it is updated to apply decommission flags (T180).

---

## Miso Demographics

Collected at task start before the intro screen. Stored on `misokinesia_participants`. All fields are optional (null accepted). Submitted via `PATCH /misokinesia/participants/{id}/demographics` (T184). Trial mode shows the screen but does not call the endpoint.

| Column | Type | Allowed values |
|---|---|---|
| `age_band` | VARCHAR NULLABLE | `"Under 18"` / `"18-24"` / `"25-31"` / `"32-38"` / `"Over 38"` |
| `gender` | VARCHAR NULLABLE | `"Woman"` / `"Man"` / `"Nonbinary person"` / `"Prefer not to say"` / `"Not listed"` |
| `gender_other_text` | VARCHAR NULLABLE | Free text; accepted only when `gender = "Not listed"` |
| `country` | VARCHAR NULLABLE | `"Canada"` / `"South Korea"` / `"Not listed"` (country of current residence) |
| `country_other_text` | VARCHAR NULLABLE | Free text; accepted only when `country = "Not listed"` |
| `nationality` | VARCHAR NULLABLE | Free text (no preset values) |

Source questions: `reference/labs/Misokinesia/Miso-demographics.pdf`.

---

## Deferred / Open

- Auth and stimulus management rules (who can upload or replace video clips, whether stimulus management is admin-only, whether non-admin RAs can configure or launch the module) are tracked in `docs/DECISIONS.md` OPEN-02.
- Undo-last-session extension to cover `misokinesia_participants` and `misokinesia_trial_responses` rows is deferred.
- Admin export / data-download surface for the misokinesia tables is deferred.
