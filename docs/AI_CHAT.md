# AI_CHAT.md — RA Data Chatbot

> **Status:** Planned overall; authenticated backend route implemented in
> T1818, with scoped aggregate data tools added in T1819. This is the canonical
> platform-level design for an RA-facing LLM chatbot over lab data.

---

## Purpose

The RA data chatbot lets authenticated lab members ask natural-language questions
about their lab's research data, request statistical summaries, and generate
clean report-style narrative output for on-screen review.

The assistant is specifically meant to help RAs chat about and work with their
data. It should support exploratory analysis, interpretation, report drafting,
and practical next-step recommendations, while making clear what is retrieved
data, what is model interpretation, and what is sourced research context.

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

The initial `POST /chat` backend route now runs approved read-only aggregate
tools for authenticated Weather-Wellness lab scope and returns bounded tool
summaries. It still does not send ungrounded study-data questions to OpenRouter;
the narrative model layer remains separate from the deterministic aggregate
tool layer.

External research/search is also mediated by FastAPI. The LLM may request an
approved web research tool for public research context, but it must not send
participant-level rows, participant identifiers, private lab-sensitive content,
Supabase/JWT data, or direct database output to an external search provider.

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

## Assistant Behavior and System Prompt Contract

The backend coordinator should build a stable system prompt from this contract
rather than relying on ad hoc route-level wording.

The assistant should be framed as:

- an RA-facing research data assistant for UBC Psychology lab workflows
- helpful for chatting about lab data, understanding patterns, drafting concise
  report-style summaries, and suggesting reasonable next analysis steps
- careful to separate retrieved study data, statistical summaries, model
  interpretation, and public research context
- explicit about uncertainty, small sample sizes, missing data, and analysis
  limitations

The assistant may give opinions, interpretations, and recommendations when they
are grounded in either:

- scoped backend tool results from the authenticated user's lab data
- documented platform/lab scoring and analysis rules
- public research sources retrieved through an approved web research tool

When a recommendation depends on external literature or current public guidance,
the assistant should use the web research tool or ask the RA whether to search.
Research-backed recommendations must cite or summarize the public sources used.
The assistant should not present unsupported opinions as research conclusions.

The system prompt must require the assistant to:

- use only approved tools exposed by the backend coordinator
- answer from scoped tool results when discussing lab data
- prefer anonymous RA-facing identifiers such as `participant_number`
- avoid raw UUIDs unless the RA is troubleshooting and the backend supplied them
- refuse requests that require disallowed writes, exports, credentials, PII, or
  unbounded table dumps
- avoid clinical, causal, or policy claims beyond the retrieved data and cited
  research
- state when an answer is based on insufficient data or unavailable tools

The prompt should also tell the model that web search is for public research
context only. Search queries must be generalized and privacy-preserving; they
must not include participant rows, participant/session identifiers, private lab
notes, credentials, JWTs, or sensitive database output.

---

## OpenRouter Configuration

OpenRouter is the planned model gateway for this feature. Model and provider
selection must be configuration-driven so the app can start with a current free
model and change models without a migration.

Required behavior:

- `OPENROUTER_API_KEY` is server-only.
- `OPENROUTER_MODEL` selects the model at runtime.
- FastAPI parses OpenRouter configuration only from backend environment
  variables; there is no `NEXT_PUBLIC_*` or browser-visible OpenRouter secret
  path.
- Privacy controls must be enforced where possible, including provider training
  opt-out, disabled input/output logging, provider restrictions, and Zero Data
  Retention (ZDR) routing when available.
- When `OPENROUTER_REQUIRE_ZDR=true`, `OPENROUTER_PROVIDER_ALLOWLIST` is required
  until provider metadata checks are implemented. Missing or invalid privacy
  configuration returns a generic unavailable state instead of exposing provider
  details or silently relaxing privacy.
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

Initial tool categories include implemented aggregate tools plus planned
participant/session and research-context tools:

- dashboard analytics summary for a bounded date range
- study-window and linked session-count summaries
- survey and digit span aggregate score summaries
- weather/study-day summaries
- participant/session lookup by anonymous participant number or bounded filters
- report formatter over previously retrieved scoped results
- public web research search/fetch for literature-backed context and citations

Tool outputs should be compact. The model should receive summaries and selected
rows, not entire tables.

Implemented aggregate tools are capped at 400 local study days per request.
When no explicit dates are supplied, they use the latest available study day and
a 30-day window. They currently enforce the authenticated `lab_name="ww"` scope
because the Weather-Wellness schema has not yet gained persistent `lab_id` /
`study_id` columns; unsupported lab scopes return typed user-safe
`permission_denied` tool results rather than falling back to broad reads.

Web research tool outputs should include source titles, URLs, retrieval dates
where available, and compact excerpts or summaries. The tool must enforce query
sanitization and should reject searches that appear to include participant
identifiers, raw data rows, credentials, or private lab-sensitive content.

---

## Frontend UX

The first UI should be a dedicated RA-authenticated `/chat` page reachable from
the RA bottom dock/navigation. It should be available to all authenticated RA
and admin users and must not be exposed to participant routes.

The page should use a very simple chat-first layout inspired by Claude.ai's
minimal conversation experience, adapted to this project's color system and
without third-party branding. It should support:

- plain-language questions
- formatted markdown-like responses for readable statistical summaries and
  report-style text
- loading, empty, error, and privacy-unavailable states
- clear distinction between retrieved data and model interpretation
- source links or citations when responses rely on public web research
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
