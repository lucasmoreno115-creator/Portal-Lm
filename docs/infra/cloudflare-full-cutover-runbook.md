# Cloudflare full frontend cutover runbook

## Scope and ownership

This runbook covers the production hostname `portal.lucasmorenopersonal.com.br`. The release owner owns the GitHub Actions deployment; the Cloudflare zone owner owns DNS and route verification. No database migration, application data change, or manual deployment is part of this cutover.

The Worker owns `/api/*` and the `/admin` redirect. Cloudflare Static Assets owns all existing frontend files from `public/`, including HTML entrypoints, `/assets/*`, and `/projeto-lm/*`.

## Preconditions

1. Confirm `wrangler.toml` has one global route for `portal.lucasmorenopersonal.com.br/*` in the `lucasmorenopersonal.com.br` zone.
2. Confirm the hostname remains DNS-compatible with the existing Cloudflare zone. Do not change DNS as part of this release.
3. Confirm `public/` contains the critical files checked by `tests/infra-cloudflare-full-cutover.test.mjs`.
4. Confirm the main branch quality workflow is green and the Cloudflare API token can deploy the existing Worker.
5. Review the manual checklist: home, login, Premium portal, Projeto LM, `/admin`, workspace, record, nutrition editor, draft/publish/return flow, logout, API and both 404 paths.

## Cutover and validation

1. Merge the reviewed change to `main`; do not run Wrangler manually.
2. Confirm the `Deploy Cloudflare Worker` workflow completes `quality`, `wrangler deploy`, and the production smoke step.
3. The smoke records status, content type, `cache-control`, `etag`, `last-modified`, and `cf-cache-status` for the health endpoint and critical assets. It must return 200 for valid paths, JSON 404 for an unknown API path, and static HTML 404 for an unknown frontend path.
4. Confirm the active deployment in Cloudflare Workers using the deployment timestamp/version shown by the workflow, then manually validate the critical URLs listed above on desktop and mobile.

## Failure signals

Stop the release and roll back if any static route is non-200, returns API JSON, has missing JavaScript/CSS, `/admin` no longer redirects correctly, the API health payload changes, or the two 404 contracts are not distinct. Cached stale HTML is a signal to inspect the recorded cache headers and deployment version; do not perform a global purge automatically.

## Rollback

1. Revert this cutover PR, restoring the Worker route to `portal.lucasmorenopersonal.com.br/api/*`.
2. Merge the revert and let the normal `main` workflow redeploy the Worker.
3. Revalidate `/api/health` and the API JSON 404.
4. Restore the previous static origin only if frontend availability requires it; this may require a separately reviewed temporary Pages/origin restoration. No database rollback is required.

## Critical URLs

- `https://portal.lucasmorenopersonal.com.br/`
- `https://portal.lucasmorenopersonal.com.br/portal.html`
- `https://portal.lucasmorenopersonal.com.br/admin`
- `https://portal.lucasmorenopersonal.com.br/admin-premium-workspace.html`
- `https://portal.lucasmorenopersonal.com.br/admin-premium-student-record.html`
- `https://portal.lucasmorenopersonal.com.br/admin-premium-nutrition-plan.html`
- `https://portal.lucasmorenopersonal.com.br/projeto-lm/`
- `https://portal.lucasmorenopersonal.com.br/api/health`
