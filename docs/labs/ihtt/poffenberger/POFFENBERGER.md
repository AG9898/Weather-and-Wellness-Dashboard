# POFFENBERGER.md - IHTT Poffenberger Paradigm

> Canonical v1 task spec for the IHTT Poffenberger component. For endpoint
> contracts see `docs/labs/ihtt/poffenberger/API.md`. For scoring and derived
> fields see `docs/labs/ihtt/poffenberger/SCORING.md`.

---

## Source Of Truth

The v1 requirements come from
`reference/labs/ihtt/Poffenberger Paradigm.docx`, provided by the IHTT RA.

The Millisecond/Inquisit Poffenberger page is a task reference, but the RA brief
overrides it for implementation details. In particular, v1 follows the
RA-provided Friedrich-style protocol summarized below, not the longer
Millisecond default duration or any unrequested stimulus-position variants.

## Purpose

The Poffenberger Paradigm measures simple reaction time to lateralized visual
stimuli. Participants respond as quickly as possible when a dot appears in the
left visual field (LVF) or right visual field (RVF), using the hand assigned for
the current block.

The primary RA-requested outputs are categorized reaction time and categorized
accuracy for four hand-by-visual-field conditions:

1. Left hand - dot LVF
2. Left hand - dot RVF
3. Right hand - dot LVF
4. Right hand - dot RVF

Complementary platform-derived summaries may also group those conditions into
crossed and uncrossed response categories to estimate interhemispheric transfer
cost, but those summaries must not replace the four RA-requested condition
outputs.

## Production Protocol

Expected total task duration: about 15 minutes.

Production consists of:

- 10 practice trials using the right hand, shown before the first experimental
  block.
- 12 experimental blocks total.
- 6 blocks assigned to the left hand and 6 blocks assigned to the right hand.
- 50 consecutive trials per experimental block.
- Within each block, 25 LVF trials and 25 RVF trials.
- The side of stimulus presentation is randomized but counterbalanced within
  each block.
- Across the full task, each of the four conditions has a maximum of 150 trials.

The task must use a manifest generated before the participant starts the
experimental trials. The manifest records block number, assigned response hand,
trial number, visual field, jitter, and expected response key. The frontend may
use the manifest to present stimuli and capture client-side timing, but
condition assignment and summary scoring remain server-owned.

## Trial Definition

One trial is the appearance of one dot plus the response period.

Each trial ends when either:

- a valid response occurs, or
- 2000 ms elapse without a valid response.

The next stimulus onset is jittered randomly between 1000 ms and 2000 ms to
reduce expectancy effects. The jitter occurs before the next dot appears.

## Stimulus And Response Model

- Visual field values: `lvf`, `rvf`.
- Response hand values: `left`, `right`.
- Stimulus: a brief dot presented lateralized to the left or right visual field.
- Response: keyboard button press using the hand assigned for the current block.
- Expected keys: left-hand blocks use `f`; right-hand blocks and practice trials
  use `j`.
- Participants are instructed to react as fast as possible after perceiving a
  stimulus, regardless of the visual half field where it appears.

Exact stimulus size, eccentricity, fixation appearance, response keys, and dot
duration are not specified in the RA brief. Implementation should choose
conservative defaults from the established Poffenberger literature and keep them
documented here once chosen. The task should avoid adding multiple dot
eccentricities in v1 unless the RA explicitly requests them.

### Audio Cue Scope

The Millisecond/Inquisit reference task includes a short pre-stimulus audio cue,
but the RA-provided v1 brief does not require audio. For the current planned
implementation, Poffenberger is a visual reaction-time task only: reaction time
starts at visual dot onset, and no beep or tone is played during trials.

If the lab later asks for the reference-task audio cue, implement it as a
frontend-only timing cue using the Web Audio API. The recommended shape is:

- create or resume an `AudioContext` from an explicit user action before timed
  trials begin, so browser autoplay restrictions are satisfied
- generate a short oscillator tone, for example a 1000 Hz sine wave for 100 ms,
  through a low-gain `GainNode`
- schedule the tone before visual stimulus onset without changing the server
  manifest or scoring contract
- continue measuring reaction time from visual dot onset only, not from tone
  onset
- keep audio disabled by default for v1 trial and production sessions unless a
  future task explicitly enables and tests it

## Participant Flow

1. RA opens the IHTT launch page.
2. RA chooses one launch mode:
   - **Start Poffenberger Session** - creates a recorded participant/session and
     task manifest.
   - **Run Short Trial** - no-write rehearsal with fewer blocks/trials.
   - **Run Full Trial** - no-write rehearsal using production-length timing and
     trial structure.
3. For a recorded session, the RA completes the platform-required anonymous
   start-session demographics. The RA brief does not add IHTT-specific
   demographic questions.
4. Backend creates an anonymous participant, active session, Poffenberger run,
   and production manifest.
5. Participant completes a UI-only consent gate if the component uses the shared
   platform consent pattern.
6. Participant sees task instructions and the right-hand practice block.
7. Participant completes all 12 experimental blocks.
8. Frontend submits raw trial timing and response data.
9. Backend validates the manifest, persists raw trials, computes condition
   summaries, marks the run complete, and allows the session to be completed.
10. Completion screen is shown.

## Trial Mode

Both trial modes are no-write rehearsals. They must not create participants,
sessions, runs, trials, or summary rows.

Short Trial:

- Keeps the same major screens and response mechanics.
- Uses a reduced manifest suitable for fast RA verification.
- Should include both hands and both visual fields so all four conditions can be
  checked.
- Recommended minimum: 1 practice segment plus 2 short experimental blocks, one
  per hand, with balanced LVF/RVF trials.

Full Trial:

- Mirrors the production 10-practice-trial, 12-block, 600-experimental-trial
  structure as closely as practical.
- Uses local fake IDs and local simulated submit success.
- Performs no backend writes.

Trial mode generates manifests locally in the frontend v1 helper layer. The
short helper creates practice trials plus two balanced experimental blocks, one
per hand. The full helper mirrors the production 10-practice-trial,
12-block, 600-experimental-trial structure. Both modes use fake local run,
session, and participant IDs and do not call recorded start, submit, or
session-complete endpoints.

## Data Collection Requirements

The RA-required recorded data outputs are categorized reaction time and
categorized accuracy for the same four conditions:

| Condition key | Response hand | Visual field | Requested output |
|---|---|---|---|
| `lh_lvf` | Left | LVF | Reaction time and accuracy |
| `lh_rvf` | Left | RVF | Reaction time and accuracy |
| `rh_lvf` | Right | LVF | Reaction time and accuracy |
| `rh_rvf` | Right | RVF | Reaction time and accuracy |

Reaction time unit: milliseconds.

Raw trial storage should retain enough detail to recompute all summaries:

- participant UUID
- session ID
- Poffenberger run ID
- block number
- trial number within block
- global trial number
- response hand
- visual field
- expected response key
- pressed key, if any
- reaction time in milliseconds, if any
- response validity
- timeout flag
- practice vs experimental flag
- jitter duration
- client event timestamps needed for audit/debugging

Practice trials are useful for QA but are excluded from production condition
summaries unless the RA later asks to analyze them.

## Persistence

The v1 persistence layer was added by migration `20260621_000001` (T1833).
Recorded runs are stored in `ihtt_poffenberger_runs`; raw practice and
experimental trials are stored in `ihtt_poffenberger_trials`.

`ihtt_poffenberger_runs` has one row per recorded session (`session_id` is
unique), links to both `participant_uuid` and `session_id`, stores the
server-generated `manifest_json`, and persists the four RA-required condition
summaries (`lh_lvf`, `lh_rvf`, `rh_lvf`, `rh_rvf`) plus crossed/uncrossed
derived fields.

`ihtt_poffenberger_trials` stores each persisted assignment and response row:
practice/scored flags, block/trial/global order, response hand, visual field,
condition key, expected/pressed keys, reaction time, timeout/validity/accuracy
flags, jitter, and raw client timing timestamps for audit/debugging.

The recorded start route, production manifest generation, scoring service,
submit route, frontend API wrappers, and the participant task route are
implemented. The recorded participant route reads the launch-time run bundle
from browser session storage, presents the manifest-driven practice and
experimental trials, captures raw client timing rows, and submits those rows to
the backend. Frontend trial helpers create no-write short/full manifests for
local rehearsal runs. The RA launch UI is implemented by a follow-on task. See
`docs/SCHEMA.md` for the full column list.

## Open Items

- Dot size, dot duration, color, background, fixation mark, and screen distance
  assumptions.
- Whether to add the optional Millisecond-style pre-stimulus audio cue in a
  future version. This is explicitly out of scope for v1.
- Whether the RA wants any participant demographic fields beyond the platform's
  required anonymous start-session demographics. The current RA brief does not
  request any.
- Whether practice trials should be stored for QA or kept local-only.
