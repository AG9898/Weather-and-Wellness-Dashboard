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
3. Run `alembic upgrade head` with Railway production backend environment
   variables.
4. Smoke test the live backend:
   - `GET /health` returns 2xx.
   - `GET /openapi.json` contains required production routes.
   - Protected RA routes return `401` without auth, proving the route exists
     and auth is enforced.
5. Build and deploy the Vercel production frontend.

If a push changes only `frontend/**`, the Railway deploy step is skipped, but
production migrations and backend smoke tests still run before Vercel deploys.
If a push changes only `backend/**`, the workflow deploys Railway, runs
migrations, and smoke tests the backend without redeploying Vercel.

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

## Migration Rules

Migrations remain Alembic-only. Additive, backward-compatible migrations are the
default production strategy:

- Add nullable columns/tables first.
- Deploy backend code that can read/write the new schema.
- Deploy frontend only after backend smoke tests pass.

Avoid destructive or incompatible migrations in the automatic release path
unless a separate maintenance plan exists.
