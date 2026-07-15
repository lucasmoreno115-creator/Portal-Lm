# Build 6.5 — Database Baseline & Deployment

Build 6.5 freezes the current D1 schema as an official, versioned database baseline without changing Workers, UI assets, APIs, or business rules.

## Official baseline

The official baseline lives in `database/baseline/`:

- `production-schema.sql` — tables and additive schema statements from the current migration snapshot.
- `production-indexes.sql` — all index and unique-index statements from the current migration snapshot.
- `production-triggers.sql` — trigger snapshot, if present.
- `production-views.sql` — view snapshot, if present.
- `0000_production_baseline.sql` — single-file bootstrap baseline for new environments.
- `baseline.json` — machine-readable schema catalog used by audit and drift checks.

Do not backfill or invent rows in production `d1_migrations`. New environments should start from `0000_production_baseline.sql`, then apply migrations added after this baseline.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run db:baseline` | Regenerates the official baseline files from the repository migration snapshot. |
| `npm run db:catalog` | Regenerates `DATABASE_CATALOG.md` from the executable schema. |
| `npm run db:audit -- staging` | Compares expected schema with remote D1 schema and writes `artifacts/db-audit-staging.json`. |
| `npm run db:backup -- staging` | Exports the remote D1 database and writes release backup evidence. |
| `npm run db:restore` | Prints the explicit operator restore command; restore remains manual by design. |
| `npm run db:verify -- staging` | Runs the schema verification gate and writes release verify evidence. |
| `npm run deploy:staging` | Runs audit → backup → migrations → smoke evidence → verify → deploy evidence → release evidence for `lmsystemv2-staging-db`. |
| `npm run deploy:production` | Runs the same guarded pipeline for `lmsystemv2-db`. |

Set `DB_NAME=<d1-name>` to override the default database name. Set `RELEASE_VERSION=<version>` to choose the release evidence directory; otherwise the value in `VERSION` is used.

## Drift policy

The audit returns `PASS` only when the expected schema and remote schema have identical tables, indexes, triggers, views, primary-key definitions, constraints, and unique indexes as represented by SQLite/D1 DDL. Missing, extra, or changed objects are `BLOCKING` and stop deployment before backup or migrations are attempted.

## Release evidence

Each guarded run writes JSON evidence under `release/<version>/`:

- `audit.json` / `verify.json` for schema checks.
- `backup.json` for D1 export evidence.
- `smoke.json` for the DB-only smoke marker.
- `deploy.json` for deployment step state.
- `release.json` for the release gate.

## Staging recreation

To recreate staging from zero:

1. Create or select `lmsystemv2-staging-db` in Cloudflare D1.
2. Apply `database/baseline/0000_production_baseline.sql` to the empty database.
3. Apply migrations created after this Build 6.5 baseline.
4. Run `npm run db:verify -- staging` and require `PASS` before release.
