# MISOKINESIA.md — Misokinesia Video Task

> Canonical spec for the Misokinesia module. For endpoint contracts see `docs/labs/weather-wellness/misokinesia/API.md`. For the structured per-instrument scoring corpus (MkAQ, MAQ, GAD-7, per-clip reactivity) see [`docs/labs/weather-wellness/misokinesia/SCORING.md`](./SCORING.md). For schema see `docs/labs/weather-wellness/misokinesia/SCHEMA.md`. For auth/stimulus management decisions see `docs/DECISIONS.md` (OPEN-02).

---

## Purpose

The Misokinesia module presents a participant with the active video manifest in a randomized per-session order. The current seeded pool has 25 active short video clips (each approximately 15 seconds, longest 33 seconds; 4 clips decommissioned 2026-05, rows retained), but participant-facing progress must use the returned manifest length rather than a hardcoded count. Before any clips play, the participant passes a UI-only consent gate and completes the sourced miso-specific demographics form from `reference/labs/Misokinesia/Demographics copy2.docx` (stored on `misokinesia_participants`). After each clip the participant answers a 4-question per-clip questionnaire. After the final clip response, the participant completes three post-video surveys in a server-assigned randomised order — each preceded by a transition card — covering the 21-item Misokinesia Assessment Questionnaire (MkAQ), the 7-item GAD-7 anxiety scale, and the 21-item Misophonia Assessment Questionnaire (MAQ). After all clip and post-video survey requirements are complete, the participant answers the end-of-task questionnaire. All results are stored anonymously, linked to a dedicated `misokinesia_participants` row that references a standard `participants` UUID and `session_id`.

---

## Participant Flow

1. RA navigates to `/misokinesia` via the floating dock, selects the session language (English or Korean; English is the default), and clicks "Start Misokinesia Session". The selected language is sent as the `language` field of the `POST /misokinesia/start` body.
2. Backend atomically creates an anonymous `participants` row, an `active` session, and a `misokinesia_participants` row, persists the selected `language` on that row, randomly assigns a `post_survey_order` permutation of `["mkaq", "gad7", "maq"]`, then returns the full active clip manifest plus the survey order and the session `language`.
3. App navigates to `/misokinesia/[misokinesia_participant_id]` on the same device (no login required). The whole participant flow renders in the session language returned in the manifest; the locale is fixed for the lifetime of the session and the participant cannot change it mid-flow. See [`LOCALIZATION.md`](./LOCALIZATION.md).
4. Participant answers the UI-only consent gate. "Yes" opens the sourced demographics carousel; "No" returns to `/misokinesia` without a database write.
5. Participant completes all visible demographics questions; frontend submits `PATCH /misokinesia/participants/{id}/demographics`.
6. Participant sees intro screen and clicks to begin. Task container enters browser-native fullscreen (Fullscreen API) at this point and remains fullscreen through clip playback, per-clip questionnaires, transition cards, and post-video surveys.
7. For each clip in the returned manifest (session-randomized playback order):
   - A 4-second solid-black buffer screen is shown; the centered clip progress label appears during the first 2 seconds and the video is preloaded during the buffer.
   - Video clip autoplays full-bleed on black inside the fullscreen task container.
   - Per-clip questionnaire (4 questions) is shown after the clip, inside the fullscreen container.
   - Frontend submits `POST /misokinesia/participants/{id}/responses`.
   - When `is_complete: true` is returned on the final manifest clip submission, backend has set `completed_at` server-side.
8. Participant completes the three post-video surveys in the order given by `post_survey_order`. Before each survey, a transition card is shown describing the next task; the card is keyed to its survey so randomization does not break the pairing:
   - **[transition card → MkAQ]** — 21-item card carousel; `POST /misokinesia/participants/{id}/mkaq`
   - **[transition card → GAD-7]** — 7-item radio form; `POST /misokinesia/participants/{id}/gad7`
   - **[transition card → MAQ]** — 21-item card carousel; `POST /misokinesia/participants/{id}/maq`
9. Frontend transitions to the end-of-task questionnaire (not directly to completion).
10. Participant completes the end-of-task form; frontend submits `PATCH /misokinesia/participants/{id}/end-of-task`.
11. Frontend calls `PATCH /sessions/{session_id}/status` with `status='complete'` (reuses existing endpoint, same pattern as digitspan).
12. Completion screen shown; RA clicks "Back to Misokinesia" to return to `/misokinesia`.

State machine: `consent_gate → demographics → intro → playing → questionnaire → (loop × manifest clips) → [transition_card → post_survey] × 3 → end_of_task → complete`

## Sourced Demographics Instrument

Source: `reference/labs/Misokinesia/Demographics copy2.docx`.

The DOCX consent item is a UI-only gate and is not stored. Demographics answers are required in production before the intro screen. Database columns remain nullable for legacy rows and no-write trial runs, but the participant UI must not submit an incomplete visible form.

Demographics are displayed as a carousel/card flow grouped by source block. Each block computes its panes from the currently visible questions: blocks with fewer than 6 visible questions remain on one pane; blocks with 6 or more visible questions split into two near-equal panes while preserving source order. For odd counts, the first pane gets the smaller count, e.g. 7 visible questions split `3 + 4`. Hidden conditional questions are not counted until they become visible. Block 5 is the one exception: weekly video game hours appears directly under Q21 when "Yes" is selected, and Q21-Q25 remain on a single pane. Preserve the source block grouping and show block progress.

| Block | Questions |
|---|---|
| Block 1 | Age; Sex; Gender Identity |
| Block 2 | Years lived in the reference country (`en` Canada / `ko` Korea); Residence Status; Student Type; Total Years of Education; Cumulative GPA; Major(s); Highest Level of Education Completed |
| Block 3 | Ethnicity; Native Language; English Fluency; Other Fluent Languages; Everyday English Frequency; Non-English Schooling; Instruction Languages |
| Block 4 | Diagnosed Disorders; ADHD Diagnosis; ADHD Medication |
| Block 5 | Avid Videogamer; Weekly Video Game Hours; Prescription Stimulants; Regular Substance Use; Relationship Status; Occupational Status |

Slider questions are rendered as styled slider controls paired with numeric inputs. Both controls must stay synchronized. The UI shows visible range labels above the slider and softly snaps dragging near those labels, but participants can still choose in-between values and direct numeric input remains exact. Ranges are: age `0`-`100`, years in the reference country `0`-`100`, total education years `0`-`100`, and weekly video game hours `0`-`100`. Cumulative GPA is the one locale-dependent range: `0`-`5.0` in `en` and `0`-`4.5` in `ko`. The numeric input clamps to the locale bound rather than only advertising it, so a `ko` participant cannot type `4.8`. See [`LOCALIZATION.md`](LOCALIZATION.md) section 3.

Question stems and block titles are catalogue keys (`demo.q*`, `chrome.demographics.block_title.*` — [`LOCALIZATION.md`](LOCALIZATION.md) sections 5.6 and 6.4), never inline literals. Choice options are stable option keys with per-locale labels (section 2); Q14 and Q17 present divergent option sets — the Korean-language option in `en` only, the English-language option in `ko` only.

Conditional fields:
- "Other" answers require matching free text, gated on the option key (`residence_other`, `ethnicity_other`, …), never on the display string `"Other"`.
- `instruction_languages` is shown only when non-English schooling is "Yes".
- `video_game_hours_per_week` is shown only when avid videogamer is "Yes".
- `fluent_lang_none`, `disorder_na`, and `substance_none` are exclusive in their multi-select groups.

## Trial mode (Run Test Trial)

Misokinesia also supports an RA-invoked no-write rehearsal mode:

Two trial modes are available from the `/misokinesia` RA launch page. Both are no-write rehearsals — no rows are created in any table.

### Short Trial ("Run Short Trial")

- RA clicks **Run Short Trial** on `/misokinesia`.
- Frontend calls `GET /misokinesia/trial-manifest` (no params); backend returns 5 randomly sampled active clips.
- Surveys use shortened rehearsal sets: MkAQ `q1`–`q10` only, MAQ `q1`–`q10` only, GAD-7 all 7 items.
- Per-clip questionnaire, all survey, and end-of-task submits are local-only simulated transitions.

Short trial state machine: `consent_gate → demographics → intro → playing → questionnaire → (loop × 5 sampled clips) → [transition_card → post_survey shortened] × 3 → end_of_task → complete`

### Full Trial ("Run Full Trial")

- RA clicks **Run Full Trial** on `/misokinesia`.
- Frontend calls `GET /misokinesia/trial-manifest?full=true`; backend returns all active clips in a randomized order (same count and randomization as production, but no rows written).
- Surveys use full item sets: MkAQ `q1`–`q21`, GAD-7 `q1`–`q7`, MAQ `q1`–`q21`.
- Per-clip questionnaire, all survey, and end-of-task submits are local-only simulated transitions.
- Designed to let the RA rehearse the complete production experience end-to-end.

Full trial state machine: `consent_gate → demographics → intro → playing → questionnaire → (loop × active manifest clips) → [transition_card → post_survey full] × 3 → end_of_task → complete`

### Shared trial constraints (both modes)

- Frontend generates fake `misokinesia_participant_id` and `session_id` values.
- Trial videos use the same public Supabase Storage CDN URL pattern as production clips.
- A locally generated `post_survey_order` permutation drives the post-video survey sequence.
- No calls are made to `/misokinesia/start`, `/misokinesia/participants/{id}/demographics`, `/misokinesia/participants/{id}/responses`, `/misokinesia/participants/{id}/mkaq`, `/misokinesia/participants/{id}/gad7`, `/misokinesia/participants/{id}/maq`, or `/misokinesia/participants/{id}/end-of-task`.
- No rows are written to `participants`, `sessions`, `misokinesia_participants`, `misokinesia_trial_responses`, `misokinesia_mkaq_responses`, `misokinesia_gad7_responses`, or `misokinesia_maq_responses`. Consent and demographics screens are shown, but the demographics PATCH is not called.
- No `"Trial Run"` watermark is shown on the Misokinesia participant task page in either trial mode.

### Section jumper (trial only)

Both trial modes render a section jumper that lets the RA navigate directly to any major
stage of the flow instead of clicking through every step. It is a rehearsal/QA aid only.

- **Visibility.** Renders only when `trialMode === true`, in both Short and Full trials after
  demographics has advanced into the task container. It is never rendered in real recorded
  participant sessions, loading/error states, or the pre-container consent/demographics flow. It
  lives inside the fullscreen task container alongside the exit-fullscreen control.
- **Jump targets (major sections only):** Intro, Clips & Questionnaire loop, MkAQ, GAD-7, MAQ,
  End-of-task, Complete. Consent and demographics precede the task container and fullscreen and
  are not jump targets.
- **Landing behavior.** Each target sets `phase` plus the companion state required for that
  stage to render validly:
  - **Clips loop** resets to the first clip (`currentClip` index `0`) and enters `pre_play`.
  - **MkAQ / GAD-7 / MAQ** set `surveyOrder`/`surveyIndex` so the chosen survey is the active
    one and its preceding transition card is treated as already passed.
  - Targets inside the task container assume fullscreen has already started
    (`fullscreenStarted === true`).
- **Shared mapping helper.** `frontend/src/lib/misokinesia-section-jump.ts` owns the ordered
  target list (`Intro`, `Clips`, `MkAQ`, `GAD-7`, `MAQ`, `End`, `Done`) and the pure mapping from
  a target plus `post_survey_order` to `{ phase, currentClipIndex?, surveyIndex? }`.
- **No-write guarantee preserved.** Jumping drives local phase, clip index, and survey index
  state only — it triggers no API calls and writes no rows, consistent with the shared trial
  constraints above. No `"Trial Run"` watermark is added.
- **Survey item counts unchanged.** Jumping to a survey does not change which item set renders:
  Short trial still uses the shortened sets (MkAQ/MAQ `q1`–`q10`, GAD-7 all 7) and Full uses the
  full sets.

See `docs/labs/weather-wellness/misokinesia/DESIGN_SPEC.md` ("Trial Section Jumper") for the
visual placement and theming spec.

## RA Flow

Navigate to `/misokinesia` via the floating dock present on all RA pages. Select the session language on the EN / KO toggle, then click "Start Misokinesia Session". The backend creates the anonymous participant and session, persists the selected `language`, and returns the manifest. The app navigates to `/misokinesia/[id]` on the same device — no external URL or participant handoff.

The toggle also drives both trial modes, which never call `POST /misokinesia/start` and carry the locale on their local manifest instead. The launch page renders its own copy in the selected language so the RA can see which version is about to run, and remembers the selection per browser between visits; `/misokinesia` is the only translated RA surface. See [`LOCALIZATION.md`](LOCALIZATION.md) section 6.13 and [`DESIGN_SPEC.md`](DESIGN_SPEC.md).

---

## Data Model

Four core tables were added by migration `20260317_000001`. The planned MkAQ addition extends `misokinesia_participants` with the randomized administration assignment and adds one MkAQ response table. No changes to the existing `sessions` or `participants` tables beyond inserting anonymous rows via `POST /misokinesia/start`.

| Table | Purpose | Key columns |
|---|---|---|
| `misokinesia_test_sets` | Reusable stimulus configuration / study version | `test_set_id` (UUID PK), `name`, `version`, `active` |
| `misokinesia_stimuli` | Clip metadata; no video bytes in DB | `stimulus_id` (UUID PK), `test_set_id` (FK), `storage_path`, `sort_order`, `duration_ms`, `active` |
| `misokinesia_participants` | One row per participant task execution; holds progress state, randomized post-video survey order, sourced demographics, and end-of-task responses | `misokinesia_participant_id` (UUID PK), `session_id` (FK), `participant_uuid` (FK), `test_set_id` (FK), `misokinesia_participant_number` (SERIAL), `post_survey_order` (VARCHAR, e.g. `"mkaq,gad7,maq"`), `completed_at` (nullable), demographics columns, end-of-task columns |
| `misokinesia_trial_responses` | One row per clip per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `stimulus_id` (FK), `display_order`, `q1`–`q4` (SMALLINT), UNIQUE (`misokinesia_participant_id`, `stimulus_id`) |
| `misokinesia_mkaq_responses` | One MkAQ response per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `q1`–`q21` (SMALLINT 0–3), `total_score` (0–63), UNIQUE (`misokinesia_participant_id`) |
| `misokinesia_gad7_responses` | One GAD-7 response per participant (miso-isolated table) | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `r1`–`r7` (SMALLINT 0–3), `difficulty_impact` (nullable), `total_score` (0–21), `severity_band`, UNIQUE (`misokinesia_participant_id`) |
| `misokinesia_maq_responses` | One MAQ response per participant | `response_id` (UUID PK), `misokinesia_participant_id` (FK), `session_id` (FK), `participant_uuid` (FK), `q1`–`q21` (SMALLINT 0–3), `total_score` (0–63), UNIQUE (`misokinesia_participant_id`) |

See `docs/labs/weather-wellness/misokinesia/SCHEMA.md` for the full column list.

---

## API Surface

Router prefix: `/misokinesia`. Implemented in `backend/app/routers/misokinesia.py`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/misokinesia/start` | RA required | Creates anonymous participant + session + misokinesia_participants row; accepts the RA-selected `language` (`en` / `ko`, default `en`); returns the full active stimulus manifest in a randomized playback order plus `post_survey_order` and `language` |
| `GET` | `/misokinesia/trial-manifest` | RA required | Read-only rehearsal endpoint; returns 5 randomly sampled active clip URLs and a locally generated `post_survey_order` without creating any rows |
| `PATCH` | `/misokinesia/participants/{participant_id}/demographics` | None (participant-facing) | Writes the sourced miso-specific demographics form to `misokinesia_participants`; idempotent; production UI requires all visible questions |
| `POST` | `/misokinesia/participants/{participant_id}/responses` | None (participant-facing) | Submits one per-clip questionnaire; sets `completed_at` server-side on final submission; returns `is_complete` flag |
| `POST` | `/misokinesia/participants/{participant_id}/mkaq` | None (participant-facing) | Submits the required 21-item MkAQ once; server computes and stores `total_score` |
| `POST` | `/misokinesia/participants/{participant_id}/gad7` | None (participant-facing) | Submits the 7-item GAD-7 once; server computes `total_score` and `severity_band` |
| `POST` | `/misokinesia/participants/{participant_id}/maq` | None (participant-facing) | Submits the 21-item MAQ once; server computes and stores `total_score` |
| `PATCH` | `/misokinesia/participants/{participant_id}/end-of-task` | None (participant-facing) | Writes the 4 end-of-task fields to `misokinesia_participants`; requires all three post-video surveys to be submitted first |

See `docs/labs/weather-wellness/misokinesia/API.md` for full request/response schemas and error codes.

---

## Per-clip Questionnaire

4 questions shown after every clip. All items are integer 1–5 (1 = Strongly Disagree, 5 = Strongly Agree). Stored values are the integers and are identical in every locale.

The English below is the `en` label, not canonical item text: `MisokinesiaQuestionnaire.tsx` resolves both the items and the five scale labels by key from the session locale. Per-locale strings live in [`LOCALIZATION.md`](./LOCALIZATION.md) section 5.1 (`vma.item.*`, `vma.scale.*`).

| Column | Question |
|---|---|
| `q1` | I find this video unpleasant |
| `q2` | I felt physical discomfort during the video |
| `q3` | I felt upset during the video |
| `q4` | I wanted to stop the video early / or close my eyes |

---

## Post-Video Surveys

Three surveys are administered after the video loop, in the randomised order given by `post_survey_order` from the session manifest. The frontend drives the sequence; all three must be submitted before `PATCH .../end-of-task` is accepted.

Scoring rules for all three surveys (and the per-clip questionnaire) are consolidated in [`SCORING.md`](./SCORING.md), the canonical extraction source for the methodology corpus. The per-survey sections below cover item wording and UI layout.

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

The English below is the `en` label, not canonical item text: `MisokinesiaMkaqForm.tsx` resolves every item and the four scale anchors by key from the session locale. Per-locale strings live in [`LOCALIZATION.md`](./LOCALIZATION.md) section 5.2 (`mkaq.item.*`, `mkaq.scale.*`). `MKAQ_ITEMS` carries the submitted `key` plus a catalogue `textKey`; the stored value is the 0–3 integer and is identical in every locale.

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

Header text: "Over the last two weeks, how often have you been bothered by the following problems?" (catalogue key `gad7.stem`).

Response scale: `0 = Not at all`, `1 = Several days`, `2 = More than half the days`, `3 = Nearly every day`. All 7 items are required. FastAPI computes `total_score` (0–21, direct sum of the 0–3 item values) and `severity_band`; the frontend must not compute scores.

Rendered as a single-screen form — not a card carousel.

Item wording and difficulty question from the revised misokinesia GAD-7 form (`reference/labs/Misokinesia/GAD7 revised (Miso).pdf`; Spitzer et al., 2006).

The English below is the `en` label, not canonical item text: `MisokinesiaGAD7Form.tsx` resolves the stem, every item, the four scale anchors and the difficulty question by key from the session locale. Per-locale strings live in [`LOCALIZATION.md`](./LOCALIZATION.md) section 5.3 (`gad7.*`). The Korean is the lab's validated Korean GAD-7, not a new translation — never reword it. Stored values are the 0–3 integers and are identical in every locale.

| Column | Question |
|---|---|
| `r1` | Feeling nervous, anxious, or on edge |
| `r2` | Not being able to stop or control worrying |
| `r3` | Worrying too much about different things |
| `r4` | Trouble relaxing |
| `r5` | Being so restless that it is hard to sit still |
| `r6` | Becoming easily annoyed or irritable |
| `r7` | Feeling afraid, as if something awful might happen |

Final difficulty question: "If you checked any problems, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?" Stored as nullable `difficulty_impact`. It is required when any `r1`–`r7` value is greater than `0`; otherwise it is stored as `null`. Allowed values: `"Not difficult at all"`, `"Somewhat difficult"`, `"Very difficult"`, `"Extremely difficult"`. Unlike the demographics and end-of-task choices, `difficulty_impact` is **not** key-migrated: a `ko` session displays the Korean label but still submits the English string above, so the column stays poolable across locales. See [`LOCALIZATION.md`](./LOCALIZATION.md) section 5.3.

---

## Misophonia Assessment Questionnaire (MAQ)

Required 21-item questionnaire shown once per production participant as part of the randomised post-video survey block. Source: `reference/labs/Misokinesia/MAQ.pdf` page 1 (Marsha Johnson, revised by Tom Dozier, 2013). Original "sound issues" wording is preserved — this is a distinct instrument from the MkAQ.

Response scale: `0 = Not at all`, `1 = A little of the time`, `2 = A good deal of the time`, `3 = Almost all the time`. All 21 items are required. FastAPI computes `total_score` as the sum of `q1`–`q21` (range 0–63); the frontend must not compute or persist the score.

The English below is the `en` label, not canonical item text: `MisokinesiaMAQForm.tsx` resolves every item and the four scale anchors by key from the session locale. Per-locale strings live in [`LOCALIZATION.md`](./LOCALIZATION.md) section 5.4 (`maq.item.*`, `maq.scale.*`); the workbook calls this instrument MpAQ. `MAQ_ITEMS` carries the submitted `id` plus a catalogue `textKey`; the stored value is the 0–3 integer and is identical in every locale.

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

Three items shown once after all per-clip questionnaires for the returned manifest and all three post-video surveys are complete, before the completion screen. Stored as columns on `misokinesia_participants`.

The English below is the `en` label. `MisokinesiaEndOfTaskForm.tsx` resolves every prompt, the Yes/No labels, and the four timing labels by key from the session locale; per-locale strings live in [`LOCALIZATION.md`](./LOCALIZATION.md) section 5.5 (`end.item.*`, `end.timing.*`). The form has exactly these three items — workbook prompt O3 is deliberately not collected (LOCALIZATION.md section 5.7).

| Column | Type | Question / Notes |
|---|---|---|
| `end_fidgeting_text` | TEXT | "Please list any fidgeting stimuli that you are bothered by that did not show up in the task" (free text, optional) |
| `end_emotions_text` | TEXT | "Please list any emotional responses that you felt during the videos that were not asked in the questionnaire" (free text, optional) |
| `stronger_responses` | BOOLEAN | "Did viewing the videos create stronger responses over time?" — No (false) / Yes (true), optional |
| `stronger_responses_timing` | VARCHAR | If `stronger_responses` is true: one of the option keys `timing_immediately`, `timing_after_5s`, `timing_after_10s`, `timing_end_of_video`; otherwise null. Setting this when `stronger_responses` is false returns 422. Labels per locale live in [`LOCALIZATION.md`](./LOCALIZATION.md). |

All fields are optional (null accepted). `PATCH /end-of-task` returns 409 if `completed_at` is null (clips not yet finished) or if any of the three post-video surveys (MkAQ, GAD-7, MAQ) have not been submitted.

---

## Architecture Notes

- **Videos served from Supabase Storage public CDN.** Bucket: `misokinesia-stimuli`. URL format: `{SUPABASE_URL}/storage/v1/object/public/misokinesia-stimuli/{storage_path}`. No signing, no expiry. Never proxied through FastAPI.
- **Manifest-first pattern.** All active clip URLs are returned in a single `POST /misokinesia/start` response in the randomized order used for that participant. The frontend plays clips directly from those URLs; no per-clip backend round-trip for media.
- **Trial manifest is read-only.** `GET /misokinesia/trial-manifest` returns only clip metadata and public CDN URLs for 5 randomly sampled active stimuli. It must not create or mutate `participants`, `sessions`, `misokinesia_participants`, or response rows.
- **Post-video survey order is randomized and persisted.** Production starts assign a random permutation of `["mkaq", "gad7", "maq"]` as `post_survey_order` server-side, persist it on `misokinesia_participants`, and return it in the manifest so the frontend drives all three post-video surveys in the correct sequence.
- **Transition cards are frontend-only.** A transition/intro card is shown before each post-video survey. Each card is keyed to its survey key (`mkaq`, `gad7`, `maq`) and paired with it in the `post_survey_order` sequence. No backend involvement; no new API call.
- **Survey scores are server-computed.** MkAQ and MAQ: direct sum of raw items; GAD-7: direct sum of 0–3 item values. The frontend must not compute or persist scores for any survey.
- **`completed_at` set server-side.** On each `POST /responses` call the backend counts submitted responses for the participant; when all stimuli are answered it sets `misokinesia_participants.completed_at` automatically and returns `is_complete: true`.
- **Independent participant numbering.** `misokinesia_participant_number` is assigned by a dedicated PostgreSQL SERIAL sequence and starts from 1, independent of `participants.participant_number`.
- **Stimuli seeded via seed script.** No admin upload endpoint exists yet; stimulus rows are inserted manually or via a seed script. Decommissioned stimuli have `active = false`; their rows are retained.
- **Fullscreen.** The task container element (wrapping video, questionnaire, transition cards, and surveys) enters browser-native fullscreen via the Fullscreen API at task start. Fullscreen persists across clip, questionnaire, transition-card, and survey state transitions, then exits when the end-of-task flow reaches completion. An exit-fullscreen button is visible during active task phases.
- **Pre-clip buffer.** Before each clip autoplays, a 4-second solid-black interstitial is shown. The centered clip progress label appears during the first 2 seconds, then the screen remains black until playback starts. The `<video>` element is loaded (`preload="auto"`) during this buffer so playback starts immediately after.
- **Demographics are participant-submitted.** Miso demographics are collected after the UI-only consent gate and before the intro. Production participants must complete all visible demographics fields before proceeding; trial mode shows consent/demographics but does not call the endpoint.

---

## Decommissioned Stimuli

The following clips were removed from the active pool by stakeholder decision (2026-05). Their `misokinesia_stimuli` rows are retained with `active = false` and will never be returned by the manifest endpoints. All historical response data linked to these stimuli remains intact.

| Filename | Sort order | Behaviour |
|---|---|---|
| `wristRotation.mp4` | 29 | Decommissioned 2026-05 |
| `fingerRolling.mp4` | 12 | Decommissioned 2026-05 |
| `penClicking.mp4` | 26 | Decommissioned 2026-05 |
| `footTapping.mp4` | 14 | Decommissioned 2026-05 |

To decommission additional clips: add the filename to the `DECOMMISSIONED` frozenset in `backend/admin_cli/seed_misokinesia_stimuli.py` and re-run the script. The script is idempotent and applies `active = false` for any filename in `DECOMMISSIONED` on re-run. Alternatively run `UPDATE misokinesia_stimuli SET active = false WHERE filename IN (...)` directly.

---

## Miso Demographics

Collected at task start after the UI-only consent gate and before the intro screen. Stored on `misokinesia_participants`. Submitted via `PATCH /misokinesia/participants/{id}/demographics`. Trial mode shows consent/demographics but does not call the endpoint.

The sourced replacement was applied by migration `20260603_000001` (T199) and supersedes the earlier T184 six-field form (`age_band`, `gender`, `gender_other_text`, `country`, `country_other_text`, `nationality`).

| Field | Type | Allowed values / notes |
|---|---|---|
| `age` | INTEGER NULLABLE | Slider/input, `0`-`100` |
| `sex` | VARCHAR NULLABLE | Option keys `sex_male` / `sex_female` |
| `gender_identity` | TEXT NULLABLE | Free text |
| `years_lived_canada` | INTEGER NULLABLE | Slider/input, `0`-`100`. Column reused across locales: years in Canada (`en`) or Korea (`ko`) |
| `residence_status` | VARCHAR NULLABLE | Option keys `residence_citizenship` / `residence_permanent_resident` / `residence_student_visa` / `residence_other` |
| `residence_status_other_text` | TEXT NULLABLE | Required when residence status is `residence_other` |
| `student_type` | VARCHAR NULLABLE | Option keys `student_domestic` / `student_international` |
| `total_years_education` | INTEGER NULLABLE | Slider/input, `0`-`100` |
| `cumulative_gpa` | NUMERIC NULLABLE | Slider/input; locale-dependent bound: `0`-`5.0` (`en`), `0`-`4.5` (`ko`) |
| `majors_text` | TEXT NULLABLE | Free text |
| `highest_education_completed` | VARCHAR NULLABLE | Source Q27 `education_*` option keys |
| `ethnicity` | TEXT[] NULLABLE | Multi-select source Q11 `ethnicity_*` option keys |
| `ethnicity_other_text` | TEXT NULLABLE | Required when ethnicity includes `ethnicity_other` |
| `native_language` | TEXT NULLABLE | Free text |
| `english_fluency` | VARCHAR NULLABLE | Source Q13 agreement scale, `fluency_*` option keys |
| `fluent_languages` | TEXT[] NULLABLE | Multi-select source Q14 `fluent_lang_*` option keys; `fluent_lang_none` is exclusive. Divergent set: `fluent_lang_korean` is `en`-only, `fluent_lang_english` is `ko`-only |
| `fluent_languages_other_text` | TEXT NULLABLE | Required when fluent languages includes `fluent_lang_other` |
| `english_speaking_frequency` | VARCHAR NULLABLE | Option keys `frequency_always` / `frequency_often` / `frequency_sometimes` / `frequency_rarely` / `frequency_never` |
| `non_english_schooling` | BOOLEAN NULLABLE | Source Q16 yes/no |
| `instruction_languages` | TEXT[] NULLABLE | Source Q17 `instruction_lang_*` option keys; required only when non-English schooling is true. Divergent set: `instruction_lang_korean` is `en`-only, `instruction_lang_english` is `ko`-only |
| `instruction_languages_other_text` | TEXT NULLABLE | Required when instruction languages includes `instruction_lang_other` |
| `diagnosed_disorders` | TEXT[] NULLABLE | Multi-select source Q18 `disorder_*` option keys; `disorder_na` is exclusive |
| `diagnosed_disorders_other_text` | TEXT NULLABLE | Required when diagnosed disorders includes `disorder_other` |
| `adhd_diagnosis` | BOOLEAN NULLABLE | Source Q19 yes/no |
| `adhd_medication` | VARCHAR NULLABLE | Option keys `adhd_med_yes` / `adhd_med_maybe` / `adhd_med_no` |
| `avid_videogamer` | BOOLEAN NULLABLE | Source Q21 yes/no |
| `video_game_hours_per_week` | INTEGER NULLABLE | Slider/input, `0`-`100`; required only when avid videogamer is true |
| `prescription_stimulants` | BOOLEAN NULLABLE | Source Q22 yes/no |
| `regular_substances` | TEXT[] NULLABLE | Multi-select source Q23 `substance_*` option keys; `substance_none` is exclusive |
| `regular_substances_other_text` | TEXT NULLABLE | Required when regular substances includes `substance_other` |
| `relationship_status` | VARCHAR NULLABLE | Source Q24 `relationship_*` option keys |
| `relationship_status_other_text` | TEXT NULLABLE | Required when relationship status is `relationship_other` |
| `occupational_status` | VARCHAR NULLABLE | Source Q25 `occupation_*` option keys |
| `occupational_status_other_text` | TEXT NULLABLE | Required when occupational status is `occupation_other` |

Source questions: `reference/labs/Misokinesia/Demographics copy2.docx`. Stored choice values are language-independent option keys, not display labels; the full registry, per-locale labels, and per-locale validation overrides are in [`LOCALIZATION.md`](LOCALIZATION.md) sections 2-3.

---

## Deferred / Open

- Auth and stimulus management rules (who can upload or replace video clips, whether stimulus management is admin-only, whether non-admin RAs can configure or launch the module) are tracked in `docs/DECISIONS.md` OPEN-02.
- Undo-last-session extension to cover `misokinesia_participants` and `misokinesia_trial_responses` rows is deferred.
- Admin export / data-download surface for the misokinesia tables is deferred.
