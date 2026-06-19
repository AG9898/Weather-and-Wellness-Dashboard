# Multi-Lab Platform Model

> **Status: Authoritative.** This is the canonical multi-lab schema reference for the current platform.
> For lab onboarding steps and required lab doc structure, see [`docs/labs/README.md`](labs/README.md).

---

## Purpose

This platform serves multiple independent UBC Psychology labs. Each lab runs one or more
studies. Lab data is isolated — a LabMember from one lab cannot read or write another lab's
participants or sessions.

---

## Known Primitives

### Auth Scoping (already implemented)
- `app_metadata.lab` on the Supabase Auth user record holds the lab's slug (e.g. `weather-wellness`)
- `app_metadata.role` holds `ra` or `admin`
- All RA endpoints resolve the caller's lab from JWT claims via `get_current_lab_member`

### RA Chatbot Scoping

The RA data chatbot follows the same auth boundary. The LLM must not connect to
Supabase directly or choose tables dynamically. FastAPI resolves the
authenticated `LabMember`, applies lab/study scope inside approved read-only
tools, and sends only scoped tool results to the model gateway. Current
aggregate and anonymous participant/session tools enforce the authenticated
`lab_name="ww"` Weather-Wellness scope until persistent `lab_id` / `study_id`
columns exist on all relevant study tables; unsupported lab scopes return
typed `permission_denied` tool results without querying data. This does not
resolve OPEN-05; it is compatible with the current app-layer scoping and with a
future row-level or study-level database isolation strategy.

### Planned Data Model

```
labs     (lab_id PK, slug UNIQUE, name, created_at)
studies  (study_id PK, lab_id FK, slug, name, active, created_at)
```

Existing tables (`participants`, `sessions`, results) will add a `study_id` FK.
Backfill value for existing rows: study slug `weather-wellness`.

See `docs/DECISIONS.md` OPEN-03 for the open decision on finalizing this model.

---

## Open Questions

- [ ] Will labs share a single deployment or have separate deployments?
- [ ] What instruments/tasks will new labs require? Are they shared with existing labs?
- [ ] What are the timezone requirements for each lab?
- [ ] What are the demographic fields for new lab sessions?
- [ ] Do new labs need weather data linking, or is that Weather & Wellness specific?
- [ ] Should each lab have its own Postgres schema (schema-level isolation) or use row-level isolation?
- [ ] What is the admin model — one platform admin, or per-lab admins?

---

## Onboarding a New Lab (Placeholder)

When a new lab is confirmed, this section will document:

1. How to register the lab (`labs` table entry, `app_metadata.lab` slug)
2. How to create the study (`studies` table entry)
3. Which instruments/tasks are needed (create `docs/labs/<slug>/` folder with specs)
4. Schema migration for any new tables or columns
5. RA user invitation flow
6. Reference materials location (`reference/labs/<slug>/`)

---

## Related Documents

- `docs/DECISIONS.md` — OPEN-03 (multi-lab schema scoping)
- `docs/ARCHITECTURE.md` — deployment topology
- `docs/SCHEMA.md` — base schema with `labs` and `studies` table definitions
- `docs/AI_CHAT.md` — planned RA chatbot data-access boundary
- `docs/labs/weather-wellness/README.md` — first lab, reference implementation
