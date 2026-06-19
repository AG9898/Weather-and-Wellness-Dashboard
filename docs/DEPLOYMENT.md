# Production Deployment

Production is released through GitHub Actions so the frontend cannot go live
before the backend routes and database migrations it depends on.

## Workflow

Canonical workflow: `.github/workflows/production-release.yml`.

On a push to `main` that changes `backend/**` or `frontend/**`, or on manual
`workflow_dispatch`, the workflow runs validation first. Push releases deploy
only the changed service surfaces; manual releases force the full backend,
migration, smoke-test, and frontend sequence.

For a full release, the workflow runs in this order:

1. Validate backend tests and frontend type-check/build.
2. Deploy the Railway backend service.
3. Run `scripts/alembic-upgrade-head.sh` with Railway production backend
   environment variables.
4. Smoke test the live backend:
   - `GET /health` returns 2xx.
   - `GET /openapi.json` contains required production routes.
   - Protected RA routes return `401` without auth, proving the route exists
     and auth is enforced.
5. Build and deploy the Vercel production frontend.

If a push changes only `frontend/**`, the Railway deploy, production migration,
and backend smoke-test job is skipped; Vercel deploys only after validation and
the skipped backend job gate have completed. If a push changes only
`backend/**`, the workflow deploys Railway, runs migrations, and smoke tests the
backend without redeploying Vercel.

The workflow uses `concurrency: production-release` with
`cancel-in-progress: false` so production releases run one at a time.

## Required GitHub Secrets

Set these under GitHub repository settings:

| Secret | Purpose |
|---|---|
| `RAILWAY_TOKEN` | Railway token with access to project `ubcpsych` and service `backend`. Used by `railway up` and `railway run`. |
| `VERCEL_TOKEN` | Vercel token with deploy access to the frontend project. |

The workflow stores non-secret project IDs directly in YAML:

| Setting | Value |
|---|---|
| Railway project | `b5bcf140-8336-4284-bb6f-4ede7fae9772` |
| Railway backend service | `a16226f5-dc23-45a3-ab7b-3d2aaa5a3b99` |
| Railway backend service name | `backend` |
| Railway production environment | `f0268bd1-5c6e-4b3c-9b4c-f94d92b0a1b2` |
| Vercel org | `team_plJ8tyDQ3UkNMadXHldcwyea` |
| Vercel project | `prj_XVvJfNLoaUOoRyMgGKDwmKhJYSVT` |

## Platform Settings

Disable independent production Git autodeploys after the workflow secrets are
configured and the workflow has been tested manually once.

- Railway backend: turn off automatic production deploys from GitHub, or keep
  them limited to preview/non-production. Keep the GitHub source connection in
  place; the GitHub Actions workflow deploys the latest source with
  `railway deployment redeploy --from-source`.
- Vercel frontend: turn off automatic production deploys from GitHub. The
  GitHub Actions workflow builds and deploys production with `vercel deploy`.

This prevents the Vercel frontend from racing ahead of the Railway backend, and
keeps Alembic migrations in the same production gate as the backend deploy.

## Manual Release

Use GitHub Actions, select `Production Release`, then select `Run workflow`.

Manual releases follow the same ordering and gates as push releases.

## Backend Dependency Pinning

The backend is deployed by Railway's **railpack** builder, which installs from
`backend/requirements.txt`. CI (`Validate Build`) installs from the same file on
Python 3.13. Both paths must resolve to an identical, reproducible set, so the
following rules apply:

- **All pins live inline in `backend/requirements.txt` as exact `==` versions**,
  including transitive dependencies. Do **not** split pins into a separate
  `constraints.txt` referenced with `-c`. Railpack copies only the detected
  dependency file (`requirements.txt`) into its cached pip-install layer; a
  `-c constraints.txt` reference points at a file that is not present in that
  layer, so `pip install -r requirements.txt` fails the build immediately.
- **The Python version is pinned in `backend/.python-version` (`3.13`).** The
  inlined pins were frozen against the Python 3.13 CI resolver and rely on
  `cp313` wheels. Pinning the interpreter keeps railpack on the same version its
  wheels target; without it, a future railpack default (e.g. 3.14) could force
  source builds or fail to find matching wheels. Keep this in sync with the
  `python-version` used in `.github/workflows/production-release.yml`.
- **Regenerate the whole pin block at once** when bumping any package: install
  into a fresh Python 3.13 environment, run the backend suite, then capture the
  full set with `pip freeze`. Do not hand-edit individual transitive lines.

### Background: the June 2026 dependency-drift incident

Recorded so the failure modes are not rediscovered:

1. `backend/requirements.txt` originally used loose `>=` ranges, so every CI run
   resolved the newest releases. A FastAPI/Starlette release drifted the route
   API and broke `tests/test_chat_router.py`, which asserted against framework
   route internals (`APIRoute.methods`, `route.response_model`). `Validate Build`
   started failing.
2. The first fix rewrote that test to assert against `GET /openapi.json` instead
   of route internals (the durable fix) and pinned dependencies via a separate
   `constraints.txt`. CI went green, but the Railway build began failing fast
   (`BUILDING → FAILED`) because railpack could not see `constraints.txt` in its
   pip-install layer.
3. The second fix inlined every pin directly into `requirements.txt` and deleted
   `constraints.txt`. Railway builds and CI both passed.
4. This `.python-version` pin was added afterward to remove the remaining
   implicit dependency on railpack's default interpreter happening to be 3.13.

## Migration Rules

Migrations remain Alembic-only. Additive, backward-compatible migrations are the
default production strategy:

- Add nullable columns/tables first.
- Deploy backend code that can read/write the new schema.
- Deploy frontend only after backend smoke tests pass.

Avoid destructive or incompatible migrations in the automatic release path
unless a separate maintenance plan exists.

Alembic runs through `scripts/alembic-upgrade-head.sh`. Set
`DATABASE_MIGRATION_URL` on the Railway backend environment to a Supabase
session-pooler or direct database URL. Keep `DATABASE_URL` for app runtime; it
may use the transaction pooler on port `6543`.
