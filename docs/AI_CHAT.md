# AI_CHAT.md — RA Data Chatbot

> **Status:** Deterministic substrate shipped; agentic coordinator loop landed (T1826); remaining model-layer phases planned.
> The authenticated backend route was implemented in T1818, with scoped aggregate
> data tools added in T1819 and bounded anonymous participant/session summaries
> added in T1820. The same-origin `POST /api/ra/chat` proxy and typed
> `postRaChat()` wrapper were added in T1821. The dedicated RA `/chat` UI surface
> (page, `RaChatPanel`, and floating-dock entry) was added in T1822.
>
> The server-only OpenRouter client wrapper (tool-calling support, privacy
> fail-closed config, and the optional non-ZDR availability fallback) was added
> in T1823 (`backend/app/services/openrouter_client.py`); it owns the secret
> boundary and exposes no business logic or tool execution yet.
>
> The **tool dispatch registry** (`backend/app/services/chat_tool_registry.py`)
> was added in T1824. It exposes each approved read-only tool as an individually
> invocable unit with a typed JSON input schema (for model tool-calling) and a
> dispatch function that validates params and injects the authenticated lab scope
> server-side; the model never supplies `lab_id`/`lab_name`. Unknown/disallowed
> tool names are rejected without DB access, and the existing status taxonomy is
> preserved.
>
> The **agentic model layer** that connects OpenRouter on top of these tools is
> delivered in five phases: (1) the agentic coordinator loop — **landed in
> T1826** (`backend/app/services/chat_service.py`), (2) SSE streaming, (3) the
> tool-call audit table — **landed in T1829**
> (`backend/app/models/chat_tool_invocation.py`, migration `20260620_000001`),
> (4) the doc-grounded methodology explainer, and
> (5) privacy-sanitized web research. With the coordinator loop landed,
> `coordinate_ra_chat` now drives a bounded model-driven tool-calling loop:
> OpenRouter selects which approved tools to call (or none), FastAPI injects the
> authenticated lab scope and executes them through the registry, and the model
> narrates the results. Phases 2, 4, and 5 remain planned. This is the canonical
> platform-level design for an RA-facing LLM chatbot over lab data, and it covers
> both Weather-Wellness components (`weather/` and `misokinesia/`).

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

The agentic coordinator loop does not weaken this boundary. The model chooses
*which* approved tools to call and *with what parameters*, but it never controls
*whose* data it sees: FastAPI injects the authenticated `lab_name`/scope into
every tool call on the server. The model cannot run SQL, name tables, select
scope, write, export, or call Supabase. Tool selection is agency over an
allowlist, not over the database.

The `POST /chat` backend route runs the agentic coordinator loop
(`coordinate_ra_chat`). The disallowed-raw-SQL/table gate still short-circuits
before any model call, and a privacy-incomplete model configuration returns a
user-safe unavailable response (`blocked_reason="model_unavailable"`) before any
tool runs.

External research/search is also mediated by FastAPI. The LLM may request an
approved web research tool for public research context, but it must not send
participant-level rows, participant identifiers, private lab-sensitive content,
Supabase/JWT data, or direct database output to an external search provider.

---

## Coordinator Loop (Agentic Tool Selection)

The coordinator runs a bounded **agentic tool-calling loop** server-side in
FastAPI. OpenRouter is given the system prompt, the conversation, and the typed
schemas of the approved tools. Per turn:

1. The model decides whether it needs data at all. Ordinary conversational or
   informational questions (e.g. "help me word this", "what does a high GAD-7
   suggest in general") are answered directly with **no tool call**.
2. When the model does call a tool, FastAPI validates the call against the
   allowlist, **injects the authenticated lab scope** (the model never supplies
   `lab_id`/`lab_name`), executes the tool, and returns the typed result.
3. The loop is capped at a small maximum number of tool-call rounds per turn
   (`MAX_TOOL_CALL_ROUNDS`, currently 4) to bound latency and cost. On reaching
   the cap, FastAPI issues one final completion with `tool_choice="none"` so the
   model must answer from what it gathered; that response is tagged
   `blocked_reason="tool_round_cap_reached"`.
4. The model narrates the results into report-style prose, keeping retrieved
   data, interpretation, and cited context visually distinct.

**Implementation notes.** The coordinator is non-streaming internally and returns
the existing `RAChatResponse` shape (`conversation_id`, `message`, `model`,
`tool_results`, `blocked_reason`). The served `model` field carries the
OpenRouter `served_model` slug for the turn. Each executed tool contributes one
compact `RAChatToolResult` (`{tool_name, summary}` where `summary` is the tool's
`status: message` line) for transparency, while the full JSON tool result is fed
back to the model as a `tool`-role message. Tool-call arguments arrive as a
JSON-encoded string; malformed arguments degrade to empty params, which the
registry rejects with a typed `invalid_scope` result rather than crashing. A
model request for an unapproved tool name is caught (`UnknownChatToolError`) and
narrated rather than surfaced as an error. The OpenRouter client is obtained
through an injectable `client_factory` (default `OpenRouterClient.from_env`) so
the loop is unit-testable without env or network.

**Tool statuses are reasoning signal, not user-facing text.** The
`ready` / `insufficient_data` / `permission_denied` / `invalid_scope` statuses
returned by the tool layer are consumed by the model, which turns them into
natural language ("there's no survey data in that range — your data runs
March–June; want the full window?"). Raw `status: message` lines are never
surfaced directly to the RA.

**Data orientation before blind windows.** The model should call the data
orientation tool (see Backend Tool Contract) before guessing date ranges, so it
anchors queries to where data actually exists instead of a fixed default window
that can land on an empty slice.

## Access Model

- All authenticated `ra` and `admin` users may use the chatbot.
- Non-admin RAs are limited to their own `lab_name`.
- Admin users have whole-DB access: they bypass the per-lab allowlist and the
  data tools read across all lab tables. This mirrors the existing
  `get_current_ra_for_lab` admin bypass in `backend/app/auth.py`. Admin access is
  driven by the verified `app_metadata.role` claim, not by model prompting, so it
  is explicit rather than accidental. Tool results flag cross-lab reads with
  `admin_all_labs: true` in their scope metadata.
- Each backend data tool must apply the same lab/study scoping rules as existing
  RA endpoints, including the admin bypass.
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
- The client supports passing tool/function schemas and returns any tool-call
  requests the model makes, so the agentic coordinator can drive the
  tool-calling loop. The client itself executes no tools and runs no business
  logic; it only relays tool schemas and tool-call requests.
- Every chat result records the served route (`primary` ZDR vs. non-ZDR
  `fallback`) and the served model slug so the coordinator/audit can observe
  which path answered, without exposing the API key or other secrets.

### Availability fallback (deliberate non-ZDR)

On the free tier, Venice is effectively the only OpenRouter provider offering a
ZDR `:free` endpoint, so a ZDR-required primary model has a single point of
failure and observed free-tier uptime is unreliable (~70%). To keep the RA
chatbot answering when the primary ZDR provider is down, an **optional**
availability fallback is supported:

- `OPENROUTER_FALLBACK_MODEL` (optional, default unset) names a non-ZDR model
  used **only** when the primary ZDR-required request fails due to provider
  unavailability/upstream error — never on misconfiguration, which still fails
  closed. Recommended slug: `nvidia/nemotron-3-super-120b-a12b:free` (free,
  tool-calling, 1M context); lighter secondary: `nvidia/nemotron-3-nano-30b-a3b:free`.
- `OPENROUTER_FALLBACK_PROVIDER_ALLOWLIST` (optional) may scope the fallback;
  leave unset to let OpenRouter route freely for maximum availability.
- When the fallback fires, ZDR routing is **intentionally relaxed** for that
  retry. This is an explicit, owner-approved trade (2026-06-19): availability is
  preferred over ZDR for the fallback request only. The primary path keeps ZDR
  enforced; when `OPENROUTER_FALLBACK_MODEL` is unset, behavior is unchanged and
  the client fails closed.
- The served route (primary ZDR vs. non-ZDR fallback) must be observable for
  auditing without exposing secrets.

See `docs/DECISIONS.md` for the decision record.

Operational references:

- OpenRouter provider logging/privacy: `https://openrouter.ai/docs/guides/privacy/provider-logging`
- OpenRouter ZDR: `https://openrouter.ai/docs/guides/features/zdr`
- OpenRouter guardrails: `https://openrouter.ai/docs/guides/features/guardrails/overview`
- OpenRouter provider routing: `https://openrouter.ai/docs/guides/routing/provider-selection`

---

## Backend Tool Contract

The approved tools are exposed through a dispatch registry
(`backend/app/services/chat_tool_registry.py`). Each registry entry pairs a fixed
tool name with a typed Pydantic params model (serialized to JSON Schema /
OpenRouter function specs via `chat_tool_specs()`) and a dispatch coroutine.
`dispatch_tool(db, lab_member=..., tool_name=..., params=...)` validates the
model-supplied params, injects the authenticated lab scope server-side (the
params models expose no lab identity field, so model-supplied scope is
structurally impossible), and delegates to the existing `chat_tools` query
functions. Unknown tool names raise `UnknownChatToolError` without DB access;
param-validation failures return a typed `invalid_scope` result.

Each chatbot data tool should be a narrow backend function with:

- a fixed name and typed input schema
- explicit date/range limits where relevant
- explicit lab/study scope from the authenticated `LabMember`
- bounded result sizes
- a typed, JSON-serializable response
- user-safe errors for unavailable data or insufficient permissions
- tests for lab scoping and blocked/disallowed access

Initial tool categories include implemented aggregate and participant/session
tools plus planned orientation, methodology, and research-context tools:

- dashboard analytics summary for a bounded date range
- study-window and linked session-count summaries
- survey and digit span aggregate score summaries
- weather/study-day summaries
- implemented: anonymous participant/session summaries by participant number or
  bounded date filters, including demographics, survey scores, and digit span
  summaries; normal outputs use `participant_number` and omit raw UUIDs
- **implemented data orientation/availability tool** (`get_data_coverage`):
  cheap, summary-only orientation tool that returns the total participant count,
  the count of participants with study-day-linked sessions, the linked session
  count, and the real `earliest_data_date` / `latest_data_date` (min/max
  study-day date over linked sessions) for the authenticated scope. Unlike the
  windowed aggregate tools it imposes no default 30-day window — its purpose is
  to expose where data actually exists so the model anchors subsequent windows
  to real data instead of a blind default. Its params model exposes only an
  optional `study_slug` (no date window, no lab identity). It returns
  `insufficient_data` when no participants or linked sessions exist, and a
  `ready` result with null date bounds when participants exist but no sessions
  are linked to study days yet. No row dumps.
- **planned methodology explainer tool** (e.g. `explain_methodology`):
  doc-grounded retrieval over the canonical scoring/design docs to answer
  "how is X scored / how does the Y section work" questions. See
  *Methodology Explainer* below.
- report formatter over previously retrieved scoped results
- public web research search/fetch for literature-backed context and citations

### Methodology Explainer (doc-grounded)

The methodology explainer answers platform-knowledge questions about *how the
platform scores and runs its instruments* — for example "how is GAD-7 scored?"
or "how does the misokinesia section work?".

- **Source of truth is the canonical docs, never the scoring source code.** The
  canonical scoring rules, design specs, and derived-field definitions live under
  `docs/labs/weather-wellness/weather/**` and
  `docs/labs/weather-wellness/misokinesia/**`. The tool must not read or
  introspect server-side scoring functions at runtime.
- **Runtime corpus is bundled into the backend, generated from those canonical
  docs.** The Railway backend deploys only `backend/` (root directory `backend/`),
  so the repo-root `docs/` tree is not on the runtime filesystem. The methodology
  tool therefore retrieves from a backend-bundled corpus (e.g.
  `backend/app/methodology/`) that is **generated from** the canonical docs by a
  sync step, with a drift check (script + CI) that fails if the bundled copy falls
  out of sync with `docs/`. The canonical `docs/` remain the single source of
  truth; the bundled copy is a deployment artifact, not a second source. The
  model never reads files — it only receives the tool's bounded, cited excerpts.
- The model summarizes the retrieved sections and **cites the source doc**
  (path/heading) so the RA can verify. Answers that the corpus cannot support
  must say so rather than inventing scoring logic.
- **v1 coverage is scoring + instruments only**, spanning both Weather-Wellness
  components: survey scoring (GAD-7, CES-D-10, ULS-8, Cognitive Function 8a),
  digit span and the cognitive battery, the misokinesia instruments
  (MKAQ/MAQ/GAD-7), and documented study-day/derived fields. Broader
  "how the platform works" topics (session/consent flow, timezone semantics,
  weather linking, import/export) are out of scope for v1.
- Because this depends on the docs being complete, a doc-gap check of the
  scoring/design corpus is a prerequisite for the explainer to be reliable.
- This stays within RESOLVED-20: it is read-only, sends no credentials, and
  exposes no DB rows — only curated documentation context.

### Tool-Call Audit

Every tool invocation in the agentic loop is persisted to the
`chat_tool_invocations` table (see `docs/SCHEMA.md`) for research-ethics review
and debugging: `conversation_id`, `lab_name`, `tool_name`, `params` (JSONB),
`status`, and `created_at`. The audit row stores tool inputs and status, not raw
participant data, and is inspectable in Supabase Studio. Methodology and web
research tool calls are logged the same way.

**Implemented (T1829).** `coordinate_ra_chat` writes one audit row per tool
invocation via `_audit_tool_invocation` (`backend/app/services/chat_service.py`)
using the `ChatToolInvocation` model. The row records the model-supplied params
and the tool's resulting `status`, never the returned tool payload. Rejected
unknown tool names are still audited (`status="invalid_scope"`). `lab_name`
mirrors the coordinator's scope: a non-admin caller's `lab_name`, or the
`admin:all` marker for admin (cross-lab) callers. The write is best-effort and
session-injected, so the coordinator stays unit-testable when no database
session is supplied.

Tool outputs should be compact. The model should receive summaries and selected
rows, not entire tables.

Implemented aggregate and participant/session tools are capped at 400 local
study days per request. Participant/session summaries are additionally capped
at 20 session rows per tool call. When no explicit dates are supplied, tools use
the latest available study day and a 30-day window. For non-admin callers they
enforce the authenticated `lab_name="ww"` scope because the Weather-Wellness
schema has not yet gained persistent `lab_id` / `study_id` columns; unsupported
non-admin lab scopes return typed user-safe `permission_denied` tool results
rather than falling back to broad reads. Admin callers (verified
`app_metadata.role="admin"`) bypass this allowlist and read the whole DB; because
no `lab_id` columns exist yet, the underlying queries are already unscoped, so the
practical effect today is that admins are simply permitted to run the existing
reads regardless of their `lab_name`. When OPEN-05 introduces real lab columns,
the admin path is the seam where cross-lab reads will be widened explicitly.

Web research tool outputs should include source titles, URLs, retrieval dates
where available, and compact excerpts or summaries. The tool must enforce query
sanitization and should reject searches that appear to include participant
identifiers, raw data rows, credentials, or private lab-sensitive content.

---

## Frontend UX

The first UI is the dedicated RA-authenticated `/chat` page
(`frontend/src/app/(ra)/chat/page.tsx`), reachable from the RA bottom
dock/navigation. It is available to all authenticated RA and admin users (the
dock `Chat` entry is not admin-only) and is guarded by both the RA middleware
matcher (`/chat/:path*`) and the `(ra)/layout.tsx` auth guard, so it is never
exposed to participant routes.

The page renders the `RaChatPanel` component
(`frontend/src/lib/components/RaChatPanel.tsx`), a simple chat-first layout
inspired by Claude.ai's minimal conversation experience, adapted to this
project's color system and without third-party branding. It supports:

- plain-language questions
- formatted, report-style assistant text (paragraph and bullet structure) via a
  small dependency-free formatter, instead of an external markdown/HTML pipeline
- **streamed assistant output (SSE):** tokens render incrementally and in-flight
  tool calls surface as transient "running <tool>…" affordances that resolve
  when the tool returns, so the panel feels live rather than batch
- loading, empty, error, and privacy-unavailable states
- clear distinction between retrieved data (compact backend tool summaries),
  model interpretation, and **doc-cited methodology answers**
- source links or citations when responses include public web research URLs, and
  source-doc citations when responses include methodology explanations
- no export/download action in v1

Streaming preserves the same auth, privacy, and tool boundaries: the SSE stream
flows backend → same-origin `POST /api/ra/chat` proxy → `RaChatPanel`, and the
browser still never talks to OpenRouter directly.

All frontend API calls must go through typed wrappers in `src/lib/api/`. Browser
code must not call OpenRouter directly.

The browser-reachable entry point is the same-origin Next.js Route Handler
`POST /api/ra/chat` (`frontend/src/app/api/ra/chat/route.ts`). It verifies the RA
Supabase JWT before proxying the JSON body to the backend `POST /chat`
coordinator; it never exposes OpenRouter credentials or a direct browser-to-model
path. The typed wrapper is `postRaChat()` in `frontend/src/lib/api/index.ts`,
which posts to the relative `/api/ra/chat` path so it resolves in both local dev
and Vercel production.

---

## Related Docs

- `docs/ARCHITECTURE.md` — request flow and deployment boundaries
- `docs/ENV_VARS.md` — OpenRouter environment variables
- `docs/MULTI_LAB.md` — lab scoping model
- `docs/DECISIONS.md` — LLM access boundary and open multi-lab schema decision
- `docs/labs/weather-wellness/weather/API.md` — planned FastAPI contract
- `docs/labs/weather-wellness/weather/DESIGN_SPEC.md` — RA UX placement
