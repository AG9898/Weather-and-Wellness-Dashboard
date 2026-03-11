# TESTING.md — Test Suite Reference

> Canonical source for how to run tests, what is covered, and how to write new tests.
> Read before adding any new test file or modifying an existing one.
> Code conventions that affect test structure are in `docs/CONVENTIONS.md`.

---

## Quick Start

```bash
# Backend (from project root)
cd backend
PYTHONPATH=. .venv/bin/pytest tests/ -v

# Frontend (from project root)
cd frontend
npm test
```

---

## Backend Tests

### Setup

The backend uses a Python virtual environment at `backend/.venv`.

```bash
cd backend
PYTHONPATH=. .venv/bin/pytest tests/           # all tests
PYTHONPATH=. .venv/bin/pytest tests/ -v        # verbose output
PYTHONPATH=. .venv/bin/pytest tests/test_analytics_modeling.py -v  # single file
```

`PYTHONPATH=.` is required because tests import from `app.*` and the project does not
install itself as a package. Always set it when running pytest directly.

### Framework

| Tool | Version | Role |
|---|---|---|
| `pytest` | 9.x | Test runner and assertion framework |
| `pytest-anyio` | — | Async test support |
| `unittest.IsolatedAsyncioTestCase` | stdlib | Used for async tests that need class-based setup |
| `unittest.mock` | stdlib | `AsyncMock`, `patch` for service/router isolation |

### Test File Inventory

| File | Domain | What It Covers |
|---|---|---|
| `test_scoring_digitspan.py` | Scoring | `score()` pure function for digit span totals |
| `test_scoring_uls8.py` | Scoring | `score()` for ULS-8 computed mean |
| `test_scoring_cesd10.py` | Scoring | `score()` for CES-D 10 total and reverse scoring |
| `test_scoring_gad7.py` | Scoring | `score()` for GAD-7 total and severity bands |
| `test_scoring_cogfunc8a.py` | Scoring | `score()` for CogFunc 8a mean score |
| `test_health_routes.py` | Router | `GET /health` liveness check |
| `test_legacy_import_cogfunc.py` | Import | Legacy CogFunc 8a import mapping and row creation |
| `test_export_service_cogfunc.py` | Export | CogFunc 8a serialization in CSV/XLSX export |
| `test_clear_participant_domain_data.py` | Admin | Participant domain data deletion script |
| `test_analytics_schema.py` | Analytics | Pydantic response schema validation and field constraints |
| `test_analytics_storage_models.py` | Analytics | SQLAlchemy `AnalyticsRun` and `AnalyticsSnapshot` model fields |
| `test_analytics_dataset.py` | Analytics | Canonical dataset builder: native/imported precedence, exclusion metadata, date-bin derivation |
| `test_analytics_modeling.py` | Analytics | Mixed-model fitting: status flows, REML mode, z-score sample isolation, term output |
| `test_analytics_service.py` | Analytics | Snapshot orchestration: snapshot reads, live recompute, stale fallback, failure preservation |
| `test_dashboard_analytics_router.py` | Analytics | Endpoint: auth dependency, date-range validation, snapshot and live mode delegation |
| `test_analytics_parity.py` | Analytics | R-script parity: formula structure, field naming, z-score convention, complete-case inclusion, end-to-end term parity with `reference/Weather_MLM.R` |

### Conventions

**Naming**
- Test files: `test_<domain>_<layer>.py` (e.g. `test_analytics_modeling.py`)
- Test functions: `test_<what_it_verifies>()` — full sentence in snake_case
- Test classes: `<Domain><Layer>Tests` when grouping async tests under `IsolatedAsyncioTestCase`

**Fixtures and fakes**
- Prefer simple fake objects (`SimpleNamespace`, `_FakeAsyncSession`) over full mock hierarchies
- Keep fake objects adjacent to the test file that uses them — do not create shared fixture modules unless multiple files need the same helper
- Dataset row fixtures should use deterministic, index-derived values rather than constants to avoid zero-variance failures (see `_make_row` in `test_analytics_parity.py`)

**Isolation**
- Scoring tests: pure function inputs only — no DB, no mocks
- Dataset tests: fake `AsyncSession` returning `SimpleNamespace` rows — no live DB connection
- Service tests: `unittest.mock.patch` the service's imported functions; fake DB session records only `add()` and `commit()` calls
- Router tests: `AsyncMock` the service call and assert call arguments; validate exceptions directly from the route handler function

**What to test per layer**

| Layer | Must cover |
|---|---|
| Scoring module | All score boundary conditions: all-zero, all-max, reverse-scored items, mixed |
| Dataset builder | Native vs imported source precedence for each logical field; exclusion reasons for each missing-data case |
| Modeling service | Ready, insufficient_data, single-outcome-skipped, and REML mode; per-outcome z-score sample independence |
| Snapshot service | Snapshot read without recompute; live recompute success + persistence; stale-snapshot preservation on failure; insufficient_data without snapshot write; recomputing status passthrough |
| Router/endpoint | Auth dependency registration; invalid parameter rejection; correct service delegation per mode |
| Parity fixture | At least one end-to-end test that maps Python formulas and field names back to the reference R script |

---

## Frontend Tests

### Setup

The frontend uses [vitest](https://vitest.dev/) v4. No browser or React DOM runtime is
required for the current test suite — tests cover pure utility functions only.

```bash
cd frontend
npm test           # vitest run (single pass, CI-friendly)
```

Config: `frontend/vitest.config.ts`
- `environment: "node"` — no jsdom needed for current tests
- `include: ["src/**/*.test.ts"]` — `.test.ts` files only; `.tsx` not included yet
- `@` alias resolves to `src/` (mirrors `tsconfig.json` path alias)

### Test File Inventory

| File | Domain | What It Covers |
|---|---|---|
| `src/lib/analytics/ui-utils.test.ts` | Analytics UI | All 5 analytics status states (`ready`, `stale`, `recomputing`, `insufficient_data`, `failed`); all error message branches (401, 404, 5xx, other API, non-ApiError); term/outcome formatting; effect ordering |

### Testable utility modules

Pure utility modules that hold logic extracted from components for testability:

| Module | Exports |
|---|---|
| `src/lib/analytics/ui-utils.ts` | `getStatusPanel`, `getAnalyticsErrorMessage`, `formatTermLabel`, `formatOutcomeLabel`, `formatTermPart`, `formatSigned`, `formatPValue`, `compareEffectsByStrength`, `timeAgo` |

### Conventions

**What to test in the frontend**
- Pure utility functions that determine UI state or format display values
- Any function that branches on analytics status, API error codes, or model data fields

**What not to test here (yet)**
- React component rendering — this requires `@testing-library/react` + jsdom, which is not
  currently installed. If component-level tests are added in a future task, update this doc
  and switch the vitest environment to `jsdom` or `happy-dom`.

**Naming**
- Test files: `<module-name>.test.ts` co-located next to the module under test
- `describe` blocks: function or feature name
- `it` descriptions: full sentence describing the expected behavior

**Fixture shape**
- Construct minimal typed objects that satisfy the interface — use `as` casts or helper
  factories rather than over-specifying unused fields
- For `DashboardAnalyticsResponse` fixtures, use a `makeAnalytics(status)` factory pattern
  (see `ui-utils.test.ts`) so status variants are easy to enumerate

---

## Analytics Parity Tests

The file `backend/tests/test_analytics_parity.py` is specifically designed to catch regressions
against the reference R analysis script at `reference/Weather_MLM.R`.

It verifies:

1. **Formula parity** — both Python model formula strings contain every term from the R `lmer()` calls, including all interaction terms and the random effect `(1 | date_bin)`
2. **Field naming parity** — `AnalyticsDatasetRow` uses the same raw column names as R's `ww_data` frame (`temperature`, `precipitation`, `daylight_hours`, `anxiety`, `depression`, `loneliness`, `self_report`, `digit_span_score`)
3. **Z-score naming parity** — after standardization, the z-scored columns use the same `_z` suffix convention as R's `mutate(temperature_z = scale(temperature))` calls
4. **Complete-case parity** — each model builds its own complete-case sample independently, matching R's implicit NA-row dropping per `lmer()` call
5. **End-to-end term parity** — after a full model fit, every non-intercept term from the R `lmer()` summary is present in the serialized Python `effects` list

If any of these tests fail after editing the analytics pipeline, it means the Python
implementation has drifted from the R reference design. Treat parity test failures as
blocking before merging analytics changes.

---

## Adding New Tests

**Backend**

1. Create `backend/tests/test_<domain>_<layer>.py`
2. Always set `PYTHONPATH=.` when running locally
3. Follow the isolation pattern for the layer (see table above)
4. For analytics additions, add a parity assertion to `test_analytics_parity.py` if the
   change affects formula structure, field names, or inclusion logic

**Frontend**

1. Extract pure logic into a standalone `.ts` module (not inside a `"use client"` component)
2. Create a co-located `<module>.test.ts` file
3. Import from `@/lib/...` using the `@` alias — do not use relative `../../` paths in tests
4. Run `npm test` to confirm; TypeScript errors in test files will also show via `npx tsc --noEmit`

---

## Cross-References

| Topic | Document |
|---|---|
| Analytics pipeline design | `docs/ANALYTICS.md` |
| API endpoint contracts | `docs/API.md` |
| Scoring formulas | `docs/SCORING.md` |
| Database schema | `docs/SCHEMA.md` |
| Code style and patterns | `docs/CONVENTIONS.md` |
| Reference R analysis | `reference/Weather_MLM.R` |
| Current task queue | `docs/kanban.md` |
