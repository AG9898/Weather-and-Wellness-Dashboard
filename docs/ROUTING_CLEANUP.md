# Backend Reliability Fixes — Archived Playbook

> **Status:** Historical archive (completed reliability pass).
> **Canonical replacements:** `docs/workboard.json` for active task tracking, `docs/ARCHITECTURE.md` for deployed routing/runtime behavior, and `docs/labs/weather-wellness/ANALYTICS.md` for analytics recompute behavior.
> **Context:** Diagnosed 2026-03-15 via live Playwright inspection of the deployed site.
> This file is retained for implementation history only; do not treat it as an active task board.

---

## Status Legend

- `todo` — not started
- `in_progress` — actively being implemented
- `done` — implemented, tests pass, docs updated

---

## Summary Board

| ID | Status | Area | Title |
|---|---|---|---|
| `RB01` | `done` | Frontend infra | Increase Vercel function `maxDuration` to 60s on all 3 route handlers |
| `RB02` | `done` | Frontend infra | Increase `BACKEND_FETCH_TIMEOUT_MS` from 15s to 55s |
| `RB03` | `done` | Backend service | Add staleness cutoff to `_is_recomputing_run` (30-minute timeout) |
| `RB04` | `done` | Backend startup | Add lifespan cleanup for orphaned recomputing runs on Render restart |
| `RB05` | `done` | Backend service | Wrap `fit_analytics_models` in `asyncio.to_thread` to unblock event loop |
| `RB06` | `done` | GitHub Actions | Add Render keep-alive ping workflow (every 14 minutes) |

---

## Root Cause Summary

### Bug 1 — Cold start takes 8 minutes

`BACKEND_FETCH_TIMEOUT_MS = 15_000` in `frontend/src/lib/server/route-handler-backend.ts:3` is shorter than Render free-tier cold start time (30–90 seconds). Every request times out before the backend even responds.

Compounding problem: Vercel Route Handlers have no `maxDuration` configured. Vercel's Hobby-plan default is 10 seconds — meaning Vercel kills the serverless function at 10s, *before* the 15s AbortController fires. The effective timeout is whichever is smaller.

On cold start, all three parallel fetch chains fail simultaneously:
- `GET /api/ra/dashboard?mode=live` → timeout → no weather card data
- `GET /api/ra/weather/range?mode=live` → timeout → no chart data
- `GET /api/ra/dashboard/analytics?mode=snapshot` → timeout → "temporarily unavailable" error

There is no automatic retry in the analytics path. The user must manually refresh or click buttons repeatedly until Render finishes booting, accumulating ~8 minutes of failed attempts.

### Bug 2 — "Refresh In Background" permanently broken

`fit_analytics_models()` in `backend/app/analytics/modeling.py` is a **synchronous** statsmodels CPU call (runs `mixedlm` with lbfgs/powell optimizers, 30–90s). It is called directly from `async def _finish_recompute_run` in `analytics_service.py:283` with no `asyncio.to_thread` wrapper — blocking the entire uvicorn event loop during computation.

If the Render process is killed while that sync call is running (deployment restart, OOM, idle kill), the `AnalyticsRun` row stays stuck at `status="recomputing"`, `finished_at=NULL` forever. There is no time-based cutoff in `_is_recomputing_run()` at `analytics_service.py:534` — it only checks `status == "recomputing" and finished_at is None`, with no elapsed-time guard.

Every future "Refresh In Background" click sees the stuck run and returns a fake "recomputing" response without queuing any background task. The system is permanently stuck until a DB row is manually edited.

---

## Fix Details

---

### RB01 — Increase Vercel function `maxDuration` to 60s

**Why:** Without `maxDuration`, Vercel kills route handler functions at the platform default (10s on Hobby). This is shorter than both the current and target `fetchBackend` timeout. This fix must land before RB02 or the timeout increase has no effect.

**Files to change:**
- `frontend/src/app/api/ra/dashboard/route.ts`
- `frontend/src/app/api/ra/weather/range/route.ts`
- `frontend/src/app/api/ra/dashboard/analytics/route.ts`

**Exact change — add one line immediately after the existing `export const dynamic` line in each file:**

```typescript
// Before (all three files have this):
export const dynamic = "force-dynamic";

// After (add maxDuration directly below dynamic in all three files):
export const dynamic = "force-dynamic";
export const maxDuration = 60;
```

**Verify:** Deploy. Open browser DevTools → Network. On a cold backend, route handler requests should stay pending for up to 60 seconds instead of failing at 10s.

**Docs to update after this fix:**
- `docs/ARCHITECTURE.md` — "Shared Route Handler Infrastructure" section references "15-second timeout"; update to note that each Route Handler also exports `maxDuration = 60` to allow the full timeout window.

---

### RB02 — Increase `BACKEND_FETCH_TIMEOUT_MS` from 15s to 55s

**Why:** 15 seconds is shorter than Render free-tier cold start. 55 seconds leaves 5 seconds of headroom before the 60s `maxDuration` fires, allowing Vercel to flush the response.

**File to change:** `frontend/src/lib/server/route-handler-backend.ts`

```typescript
// Line 3 — before:
export const BACKEND_FETCH_TIMEOUT_MS = 15_000;

// After:
export const BACKEND_FETCH_TIMEOUT_MS = 55_000;
```

That is the only change in this file.

**Verify:** On a cold Render backend, at least one of the three dashboard fetch chains should now complete successfully within 55s instead of failing immediately. Check the `x-ww-cache` response header — a value of `refresh` means the backend responded and the result was cached.

**Docs to update after this fix:**
- `docs/ARCHITECTURE.md` — update **all** references to "15s timeout" or "15-second timeout" to "55-second timeout". Specifically:
  - "Vercel Cache Route Handler" section: `with a 15s timeout` → `with a 55s timeout`
  - "Vercel Weather Range Cache Route Handler" section: same
  - "Vercel Analytics Route Handler" section: same (appears twice)
  - "Shared Route Handler Infrastructure" section: `15-second timeout fetch wrapper` → `55-second timeout fetch wrapper`

---

### RB03 — Add staleness cutoff to `_is_recomputing_run`

**Why:** A run that has been `status="recomputing"` for more than 30 minutes is certainly dead (Render free-tier process lifetime is 15 minutes of idle; the computation itself takes at most 2–3 minutes). Without a time-based cutoff, one crashed run blocks all future recomputes permanently. With the cutoff, the system self-heals after 30 minutes on the next "Refresh In Background" click.

**File to change:** `backend/app/services/analytics_service.py`

Step 1 — add `timedelta` to the existing datetime import (line 3):
```python
# Before:
from datetime import date, datetime, timezone

# After:
from datetime import date, datetime, timedelta, timezone
```

Step 2 — add the staleness constant directly above `_is_recomputing_run` (near line 533):
```python
# Add this constant immediately above _is_recomputing_run:
_RECOMPUTE_STALENESS_TIMEOUT = timedelta(minutes=30)
```

Step 3 — replace `_is_recomputing_run` (lines 534–535):
```python
# Before:
def _is_recomputing_run(run: AnalyticsRun | None) -> bool:
    return run is not None and run.status == "recomputing" and run.finished_at is None

# After:
def _is_recomputing_run(run: AnalyticsRun | None) -> bool:
    if run is None:
        return False
    if run.status != "recomputing" or run.finished_at is not None:
        return False
    if run.started_at is not None:
        elapsed = datetime.now(timezone.utc) - run.started_at
        if elapsed > _RECOMPUTE_STALENESS_TIMEOUT:
            return False
    return True
```

**Verify:**
1. In Supabase Studio, manually set an `analytics_runs` row to `status='recomputing'`, `finished_at=NULL`, `started_at = now() - interval '31 minutes'`.
2. Click "Refresh In Background" on the dashboard.
3. Expect: a new run is created (new row in `analytics_runs` with a fresh `started_at`), not the "already recomputing" fast-return path.

**Docs to update after this fix:**
- `docs/ANALYTICS.md` — "Snapshot And Recompute Strategy" section: add a note that `_is_recomputing_run` now treats runs older than 30 minutes as timed out, allowing automatic recovery from process-kill scenarios without manual DB intervention.
- `docs/ARCHITECTURE.md` — "Analytics Snapshot Architecture / Current lifecycle" and "Failure behavior" sections: add note about the 30-minute staleness cutoff.

---

### RB04 — Add lifespan startup cleanup for orphaned recomputing runs

**Why:** RB03 handles runtime recovery (the next button click self-heals). RB04 handles the startup path: when Render restarts after a process kill, any run that was in-flight in the previous process is now orphaned. A lifespan hook marks those orphans `"failed"` on startup so they do not count toward the 30-minute staleness window — they are cleared immediately.

**File to change:** `backend/app/main.py`

Step 1 — add these imports near the top (after existing imports):
```python
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.db import get_session_factory
from app.models.analytics import AnalyticsRun
```

> Check which of these are already imported before adding — avoid duplicates. `datetime`, `timezone` may already appear if other utils are imported.

Step 2 — add the lifespan function before `app = FastAPI(...)`:
```python
_STARTUP_STALE_THRESHOLD = timedelta(minutes=30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Mark any stuck recomputing analytics runs as failed on startup."""
    stale_cutoff = datetime.now(timezone.utc) - _STARTUP_STALE_THRESHOLD
    async with get_session_factory()() as db:
        await db.execute(
            update(AnalyticsRun)
            .where(
                AnalyticsRun.status == "recomputing",
                AnalyticsRun.finished_at.is_(None),
                AnalyticsRun.started_at < stale_cutoff,
            )
            .values(
                status="failed",
                finished_at=datetime.now(timezone.utc),
                error_json={
                    "error_type": "ProcessKilled",
                    "message": (
                        "Run was in progress when the server restarted. "
                        "Assumed killed by process termination."
                    ),
                },
            )
        )
        await db.commit()
    yield


app = FastAPI(lifespan=lifespan, ...)
```

> The existing `app = FastAPI(...)` line likely passes `title=`, `description=`, etc. Preserve those kwargs and add `lifespan=lifespan`.

**Verify:**
1. Manually insert an `analytics_runs` row with `status='recomputing'`, `finished_at=NULL`, `started_at = now() - interval '31 minutes'`.
2. Restart the Render backend (manual redeploy or service restart).
3. Query the row after restart — expect `status='failed'`, `finished_at` set, `error_json.error_type = 'ProcessKilled'`.

**Docs to update after this fix:**
- `docs/ARCHITECTURE.md` — "Render Setup" section: add a note that the backend runs a startup lifespan hook that cleans up orphaned `analytics_runs` rows from previous process lifetimes.
- `docs/ANALYTICS.md` — "Snapshot And Recompute Strategy": add a sentence that orphaned recomputing runs are automatically failed on backend restart.

---

### RB05 — Wrap `fit_analytics_models` in `asyncio.to_thread`

**Why:** `fit_analytics_models()` is a synchronous, CPU-bound statsmodels computation that can run for 30–90 seconds. Calling it directly from an `async def` blocks the entire uvicorn event loop — the backend cannot serve any HTTP requests (polls, weather fetches, health checks) while it runs. Using `asyncio.to_thread` offloads it to the default thread pool, keeping the event loop free.

**File to change:** `backend/app/services/analytics_service.py`

Step 1 — add `import asyncio` at the top of the file (with the other stdlib imports):
```python
import asyncio
```

Step 2 — change line 283 inside `_finish_recompute_run`:
```python
# Before:
modeling_result = fit_analytics_models(dataset_result)

# After:
modeling_result = await asyncio.to_thread(fit_analytics_models, dataset_result)
```

That is the only change. `fit_analytics_models` takes one positional argument (`dataset_result`); `asyncio.to_thread(fn, *args)` passes it correctly.

**Verify:**
1. Trigger a "Refresh In Background" click.
2. While the recompute is running, navigate to another part of the app or hit `/health` — the backend should respond immediately (event loop is free).
3. After completion, the analytics snapshot should appear on the dashboard.

**Docs to update after this fix:**
- `docs/ANALYTICS.md` — "Snapshot And Recompute Strategy / Current lifecycle": add a note that `fit_analytics_models` runs in a thread pool via `asyncio.to_thread` so the backend event loop stays responsive during model fitting.

---

### RB06 — Add Render keep-alive ping workflow

**Why:** Render free tier spins down after 15 minutes of inactivity. Even with a 55s timeout (RB02), a fully cold Render instance takes 30–90 seconds. A keep-alive ping every 14 minutes prevents cold starts entirely during active lab hours.

**Reference pattern:** `.github/workflows/weather-ingest.yml` — use the same curl-with-retry pattern.

**New file to create:** `.github/workflows/render-keepalive.yml`

```yaml
name: Render Keep-Alive Ping

on:
  schedule:
    # Every 14 minutes around the clock — keeps Render free-tier instance warm
    - cron: '0/14 * * * *'
  workflow_dispatch:

jobs:
  ping:
    name: Ping Render /health
    runs-on: ubuntu-latest

    steps:
      - name: Ping backend health endpoint
        env:
          WEATHER_INGEST_BASE_URL: ${{ secrets.WEATHER_INGEST_BASE_URL }}
        run: |
          BASE_URL=$(printf '%s' "${WEATHER_INGEST_BASE_URL:-}" | tr -d '\r\n' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
          BASE_URL="${BASE_URL#\"}"
          BASE_URL="${BASE_URL%\"}"
          BASE_URL="${BASE_URL#\'}"
          BASE_URL="${BASE_URL%\'}"
          TARGET_URL="${BASE_URL%/}/health"

          if [ -z "${BASE_URL}" ]; then
            echo "ERROR: WEATHER_INGEST_BASE_URL is empty."
            exit 1
          fi

          echo "Pinging ${TARGET_URL}"
          HTTP_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 90 "${TARGET_URL}") || true
          echo "HTTP status: ${HTTP_STATUS}"

          if [[ "${HTTP_STATUS}" == 2* ]]; then
            echo "SUCCESS: Backend is warm."
            exit 0
          else
            echo "WARN: Unexpected status ${HTTP_STATUS} — Render may be cold-starting; next ping will retry."
            exit 0
          fi
```

> **Note:** The workflow uses `WEATHER_INGEST_BASE_URL` which is already a repository secret (reuse, do not add a new secret). Exit 0 even on non-2xx — the point is to send traffic, not to assert success. A missed ping is not a failure.

**Verify:**
1. Enable the workflow and trigger via `workflow_dispatch`.
2. Check Actions log — should show a 200 response from `/health`.
3. Wait 20+ minutes (to let Render normally go cold) — then open the dashboard and check that it loads without the cold-start delay.

**Docs to update after this fix:**
- `docs/ARCHITECTURE.md` — "Scheduled Jobs (GitHub Actions)" section: add `render-keepalive.yml` to the job list alongside `weather-ingest.yml`. Document: trigger `cron: '0/14 * * * *'`, purpose is to prevent Render free-tier cold starts, uses `WEATHER_INGEST_BASE_URL` secret (already present), always exits 0.

---

## Post-Implementation Doc Audit Checklist

After all fixes are implemented, verify the following docs are consistent with the new behavior:

| Doc | What to verify |
|---|---|
| `docs/ARCHITECTURE.md` | All "15-second timeout" references replaced with "55-second timeout". `maxDuration = 60` mentioned in Route Handler infra section. Keep-alive workflow in Scheduled Jobs. Lifespan cleanup mentioned in Render Setup and Analytics Snapshot Architecture. |
| `docs/ANALYTICS.md` | Snapshot/Recompute Strategy section mentions 30-minute staleness cutoff, `asyncio.to_thread` for model fitting, and startup cleanup of orphaned runs. |

Do not append new implementation tasks here; preserve this file as historical record only.
Track active work in `docs/workboard.json`.

---

## Implementation Order

1. **RB01** then **RB02** together — deploy frontend. Verify cold-start loads within 55s.
2. **RB03** then **RB04** together — deploy backend. Verify stuck-run self-heal and startup cleanup.
3. **RB05** alone — deploy backend. Verify event loop stays responsive during recompute.
4. **RB06** alone — merge workflow file. Trigger manually to verify ping works.
