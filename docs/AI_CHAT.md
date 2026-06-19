# AI_CHAT.md — RA Data Chatbot

> **Status:** Planned. This is the canonical platform-level design for an RA-facing
> LLM chatbot over lab data.

---

## Purpose

The RA data chatbot lets authenticated lab members ask natural-language questions
about their lab's research data, request statistical summaries, and generate
clean report-style narrative output for on-screen review.

The chatbot is an internal RA workflow. It is never participant-facing and does
not replace canonical scoring, analytics snapshots, imports, exports, or
Supabase Studio.

---

## Security Boundary

The LLM must never receive direct database credentials or direct Supabase access.
All data access is mediated by FastAPI:

1. The browser sends the RA's Supabase JWT to the app-owned API path.
2. FastAPI validates the JWT with `Depends(get_current_lab_member)`.
3. FastAPI resolves `role` and `lab_name` from Supabase `app_metadata`.
4. FastAPI runs only approved read-only data tools using the resolved lab scope.
5. FastAPI sends the minimum necessary scoped tool results to OpenRouter.
6. FastAPI returns the assistant response to the browser.

The LLM may request approved tools, but it must not execute arbitrary SQL, select
tables dynamically, call Supabase directly, trigger writes, import data, export
files, or bypass server-side authorization.

---

## Access Model

- All authenticated `ra` and `admin` users may use the chatbot.
- Non-admin RAs are limited to their own `lab_name`.
- Admin behavior must still be explicit: admin users may access the feature, but
  broad cross-lab access must not happen accidentally through model prompting.
- Each backend data tool must apply the same lab/study scoping rules as existing
  RA endpoints.
- Chat access does not resolve `docs/DECISIONS.md` OPEN-05. The first version
  should work with current app-layer scoping and later benefit from row-level or
  study-level schema isolation when that decision is resolved.

---

## Allowed Data Modes

The chatbot may use both data modes below when the authenticated user is allowed
to see the data:

- **Aggregate/statistical summaries:** counts, descriptive statistics, date
  ranges, dashboard analytics summaries, weather-linked summaries, and
  report-style interpretations of existing analytic results.
- **Anonymous participant/session-level reads:** scoped rows using anonymous
  identifiers such as `participant_number`, session dates/status, survey scores,
  digit span summaries, demographics, and weather/study-day context.

Prefer RA-facing anonymous IDs in responses. Raw UUIDs should be omitted from
normal answers unless a troubleshooting workflow specifically requires them.

---

## Disallowed Behavior

The chatbot must not:

- write to research tables
- start participant sessions
- import files
- export downloadable files
- generate CSV/XLSX/ZIP downloads
- expose service keys, JWTs, invite tokens, or raw credentials
- return unbounded table dumps
- infer direct identifiers or ask RAs to enter participant PII
- present model-generated scores as canonical scoring
- claim causal or clinical conclusions beyond the documented analysis methods

Report-like responses are allowed only as formatted on-screen text. Downloadable
or bulk export behavior remains out of scope for v1.

---

## OpenRouter Configuration

OpenRouter is the planned model gateway for this feature. Model and provider
selection must be configuration-driven so the app can start with a current free
model and change models without a migration.

Required behavior:

- `OPENROUTER_API_KEY` is server-only.
- `OPENROUTER_MODEL` selects the model at runtime.
- Privacy controls must be enforced where possible, including provider training
  opt-out, disabled input/output logging, provider restrictions, and Zero Data
  Retention (ZDR) routing when available.
- If the configured free model cannot satisfy required privacy constraints, the
  feature should fail closed or show a clear unavailable state instead of
  silently relaxing privacy.
- Requests should include application attribution headers only when they do not
  expose participant or lab-sensitive data.

Operational references:

- OpenRouter provider logging/privacy: `https://openrouter.ai/docs/guides/privacy/provider-logging`
- OpenRouter ZDR: `https://openrouter.ai/docs/guides/features/zdr`
- OpenRouter guardrails: `https://openrouter.ai/docs/guides/features/guardrails/overview`
- OpenRouter provider routing: `https://openrouter.ai/docs/guides/routing/provider-selection`

---

## Backend Tool Contract

Each chatbot data tool should be a narrow backend function with:

- a fixed name and typed input schema
- explicit date/range limits where relevant
- explicit lab/study scope from the authenticated `LabMember`
- bounded result sizes
- a typed, JSON-serializable response
- user-safe errors for unavailable data or insufficient permissions
- tests for lab scoping and blocked/disallowed access

Initial tool categories may include:

- dashboard analytics summary for a date range
- study-window and session-count summaries
- participant/session lookup by anonymous participant number or bounded filters
- survey and digit span score summaries
- weather/study-day summaries
- report formatter over previously retrieved scoped results

Tool outputs should be compact. The model should receive summaries and selected
rows, not entire tables.

---

## Frontend UX

The first UI should be an RA-authenticated chat surface reachable from the RA
dashboard/navigation. It should support:

- plain-language questions
- formatted markdown-like responses for readable statistical summaries and
  report-style text
- loading, empty, error, and privacy-unavailable states
- clear distinction between retrieved data and model interpretation
- no export/download action in v1

All frontend API calls must go through typed wrappers in `src/lib/api/`. Browser
code must not call OpenRouter directly.

---

## Related Docs

- `docs/ARCHITECTURE.md` — request flow and deployment boundaries
- `docs/ENV_VARS.md` — OpenRouter environment variables
- `docs/MULTI_LAB.md` — lab scoping model
- `docs/DECISIONS.md` — LLM access boundary and open multi-lab schema decision
- `docs/labs/weather-wellness/weather/API.md` — planned FastAPI contract
- `docs/labs/weather-wellness/weather/DESIGN_SPEC.md` — RA UX placement
