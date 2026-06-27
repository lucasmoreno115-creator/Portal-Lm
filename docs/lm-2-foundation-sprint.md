# LM 2.0 — Foundation Sprint

## Scope

This sprint creates the safe structural base for LM 2.0 without replacing any production flow.

## Included

- New static page: `public/project-lm-2.html`.
- New isolated JS and CSS assets under `public/assets`.
- Initial state layer.
- Minimal internal router.
- Foundation documentation.
- Automated foundation test coverage.

## Explicitly Excluded

- Database creation.
- API creation.
- `wrangler.toml` changes.
- Deploy or routing changes.
- V5 changes.
- Premium changes.
- Admin changes.
- `lm-access.js` changes.

## Acceptance Statement

LM 2.0 is born isolated, existing experiences remain untouched, and this PR is safe to merge as a foundation scaffold.
