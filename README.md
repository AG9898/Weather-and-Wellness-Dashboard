<p align="center">
  <img src="reference/UI%20Reference/Logo/logo.png" alt="UBC Psychology Lab Platform" width="120" />
</p>

<h1 align="center">UBC Psychology Lab Research Platform</h1>

<p align="center">
  Multi-lab research platform for UBC Psychology labs to run validated tasks and surveys,
  with server-side scoring and per-lab data isolation.
</p>

---

Agents and contributors: start with `AGENTS.md` (auto-loaded as `CLAUDE.md` by the Claude CLI)
for all operational detail.

## Who Uses This Platform

- Lab members (RAs/admins): start participant sessions, run studies, and access lab data.
- Participants: complete unauthenticated study sessions linked to participant UUID + session ID.

## Quickstart

```bash
cd backend && uvicorn app.main:app --reload   # start backend
cd frontend && npm run dev                    # start frontend
cd backend && alembic upgrade head            # apply migrations
```

Copy `.env.example` to `.env`, set required variables, and never commit `.env`.
For complete setup, conventions, architecture, and workflow guidance, use `AGENTS.md` and the
`docs/` references it points to.
