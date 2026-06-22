# API.md - IHTT Poffenberger Backend API Reference

> Planned endpoint contracts for the IHTT Poffenberger component only. Endpoint
> shapes should be finalized during implementation and kept synchronized here.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:8000` |
| Production | `https://backend-production-5809.up.railway.app` |

## Authentication

- **RA endpoints:** `Authorization: Bearer <supabase-jwt>` required. JWT is
  validated by FastAPI via `Depends(get_current_lab_member)`.
- **Lab scope:** non-admin callers must have `app_metadata.lab == "ihtt"` for
  IHTT endpoints. Admin bypass follows the platform auth adapter.
- **Participant endpoints:** no JWT. Recorded participant submissions are
  validated by server-created run/session identifiers and active session state.
- **Trial endpoints:** no-write rehearsal behavior. Trial endpoints, if backed
  by FastAPI, are RA-protected and must not create or update database rows.

## Trial Run Mode

The IHTT RA launch page exposes:

- **Start Poffenberger Session** - creates recorded rows.
- **Run Short Trial** - no-write rehearsal with a shortened balanced manifest.
- **Run Full Trial** - no-write rehearsal with the production-length manifest.

Trial mode must not call recorded start or submit endpoints and must not write
participants, sessions, Poffenberger runs, Poffenberger trials, or session
completion rows. The frontend owns local trial manifest generation for v1 and
uses fake IDs in the shared trial-run format.

## Endpoint Index

| Method | Path | Auth | Status | Purpose |
|---|---|---|---|---|
| `GET` | `/ihtt/poffenberger/dashboard` | RA | implemented | RA operations summary: run counts, average IHTT difference, recent recorded runs |
| `POST` | `/ihtt/poffenberger/start` | RA | implemented | Create anonymous participant/session/run and return production manifest |
| `GET` | `/ihtt/poffenberger/trial-manifest` | RA | not used in v1 | Return short or full no-write manifest, if manifest generation is server-owned |
| `POST` | `/ihtt/poffenberger/runs/{run_id}/submit` | None | implemented | Submit raw production trial data and receive server-computed summaries |

## GET /ihtt/poffenberger/dashboard

- **Auth:** RA required, scoped to `ihtt`.
- **Status:** implemented.
- **Response:** HTTP 200.

```json
{
  "total_runs": 18,
  "completed_runs": 15,
  "avg_ihtt_difference_ms": "3.40",
  "recent_runs": [
    {
      "participant_number": 42,
      "started_at": "2026-06-21T12:00:00Z",
      "completed_at": null,
      "is_complete": false,
      "age_band": "18-24",
      "gender": "Woman",
      "origin": "Class",
      "ihtt_difference_ms": null
    }
  ]
}
```

Notes:

- Backs the RA-facing Poffenberger operations dashboard (the front surface of the
  `/ihtt/poffenberger` page), mirroring the misokinesia launch board.
- `total_runs` / `completed_runs` count all recorded `ihtt_poffenberger_runs`; only
  IHTT creates Poffenberger runs, so the set is already study-scoped without a
  separate lab filter.
- `avg_ihtt_difference_ms` averages `ihtt_difference_ms` (crossed minus uncrossed
  mean reaction time) over completed runs only; `null` when none are complete.
- `recent_runs` returns up to 10 runs ordered by `started_at` descending, joining
  the start-session demographics stored on `participants`.
- Read-only: no new tables or columns; no Alembic migration required.

## POST /ihtt/poffenberger/start

- **Auth:** RA required, scoped to `ihtt`.
- **Status:** implemented.
- **Request body:** the platform-required anonymous start-session demographics.
  The RA brief does not define additional IHTT-specific demographic fields.
- **Response:** HTTP 201.

```json
{
  "run_id": "uuid",
  "session_id": "uuid",
  "participant_uuid": "uuid",
  "start_path": "/ihtt/poffenberger/<run_id>",
  "manifest": {
    "practice_trials": [
      {
        "trial_number": 1,
        "response_hand": "right",
        "visual_field": "lvf",
        "expected_key": "j",
        "jitter_ms": 1432
      }
    ],
    "blocks": [
      {
        "block_number": 1,
        "response_hand": "left",
        "expected_key": "f",
        "trials": [
          {
            "trial_number": 1,
            "global_trial_number": 1,
            "visual_field": "rvf",
            "jitter_ms": 1180
          }
        ]
      }
    ]
  }
}
```

Notes:

- Atomically creates an anonymous participant, active session, Poffenberger run,
  and production manifest.
- Persists the run shell in `ihtt_poffenberger_runs`, including
  `participant_uuid`, `session_id`, and the server-generated `manifest_json`.
- Stores platform start-session demographics on `participants` only, consistent
  with the existing platform rule.
- Production manifest has 10 right-hand practice trials and 12 experimental
  blocks of 50 trials each.
- Each experimental block has 25 LVF and 25 RVF trials in randomized,
  counterbalanced order.
- Six experimental blocks are left-hand blocks and six are right-hand blocks.
- Left-hand blocks use expected key `f`; right-hand blocks and practice trials
  use expected key `j`.
- `start_path` routes the browser to the participant task page on the same
  device.

## GET /ihtt/poffenberger/trial-manifest

- **Auth:** RA required, scoped to `ihtt`.
- **Status:** not used in v1.
- **Query params:**
  - `mode`: `"short"` or `"full"`.
- **Response:** HTTP 200.

```json
{
  "mode": "short",
  "manifest": {
    "practice_trials": [],
    "blocks": []
  }
}
```

Notes:

- This endpoint is optional. If the frontend can generate trial manifests with a
  pure helper, no backend endpoint is required. The v1 frontend uses the pure
  helper path and does not call this endpoint.
- If implemented, it is read-only and must not create or update rows.
- `mode=full` returns a production-length manifest without participant/session
  identifiers.
- `mode=short` returns a reduced manifest that still covers both response hands
  and both visual fields.

## POST /ihtt/poffenberger/runs/{run_id}/submit

- **Auth:** none; validates `run_id`, active session, and server manifest.
- **Status:** implemented.
- **Response:** HTTP 201.

```json
{
  "run_id": "uuid",
  "session_id": "uuid",
  "trials": [
    {
      "global_trial_number": 1,
      "block_number": 1,
      "trial_number": 1,
      "response_hand": "left",
      "visual_field": "rvf",
      "expected_key": "f",
      "pressed_key": "f",
      "reaction_time_ms": 342,
      "is_timeout": false,
      "is_practice": false,
      "client_trial_started_at_ms": 123000.0,
      "client_stimulus_onset_ms": 123456.7,
      "client_response_at_ms": 123798.7,
      "client_trial_ended_at_ms": 123820.0
    }
  ]
}
```

Response:

```json
{
  "run_id": "uuid",
  "session_id": "uuid",
  "condition_summaries": {
    "lh_lvf": {
      "total_trials": 150,
      "accurate_trials": 146,
      "accuracy": 0.9733,
      "mean_rt_ms": 318.4
    }
  },
  "mean_rt_crossed_ms": 331.2,
  "mean_rt_uncrossed_ms": 318.7,
  "ihtt_difference_ms": 12.5,
  "is_complete": true
}
```

Notes:

- Backend validates that submitted trials match the stored manifest.
- The production participant UI submits all 10 practice trials plus all 600
  experimental trials as raw timing rows. Practice trials are optional at the
  API boundary, but if any practice trial is submitted then all 10 practice
  trials must be submitted.
- Experimental `global_trial_number` may use the experimental manifest sequence
  (`1-600`) or the persisted full-task sequence (`11-610`). Persisted trial
  rows use the full-task sequence so practice rows (`1-10`) do not collide with
  experimental rows.
- Persists accepted raw trial rows in `ihtt_poffenberger_trials`; each row
  includes `participant_uuid`, `session_id`, `run_id`, block/trial/global order,
  assignment fields, response fields, timeout/validity/accuracy flags, jitter,
  and raw client timing timestamps.
- Persists server-computed four-condition and crossed/uncrossed summaries on
  `ihtt_poffenberger_runs`.
- Marks the Poffenberger run complete and marks the active session complete.
- Backend recomputes condition keys, accuracy, timeout status, and all summary
  fields.
- Reaction-time means exclude practice trials, timeouts, invalid responses, and
  RTs outside the allowed 1-2000 ms range.
- The endpoint should reject duplicate submits for an already completed run
  unless idempotency is explicitly implemented.
