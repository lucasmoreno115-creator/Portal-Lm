# Build 6.5 — Database Baseline & Deployment

Build 6.5 is database/deployment infrastructure only. It does not change Workers, APIs, HTML, CSS, JS, LM Premium behaviour, or Projeto LM behaviour.

## Production baseline vs migration-derived expected schema

### Production baseline

The production baseline is the real schema captured from `lmsystemv2-db` by authenticated, read-only D1 introspection. It must use `sqlite_schema`, `PRAGMA table_info`, `PRAGMA index_list`, `PRAGMA index_info`, triggers, views, and available constraints.

It is generated only with:

```bash
node scripts/db-tool.mjs capture-baseline --environment production --confirm-read-only-production
```

The placeholder `database/baseline-manifest.json` records that this capture is still pending. Codex did not generate or version a fake production schema from migrations.

### Migration-derived expected schema

The migration-derived expected schema is generated separately from versioned migrations:

```bash
npm run db:expected
```

When replay succeeds, it writes `database/expected/migration-schema.sql` and `database/expected/migration-schema.json`. Replay is strict: any migration error is `BLOCKING`, includes the migration and statement context, exits non-zero, and does not update existing expected-schema files.

## Schema drift and migration history

Audit output separates two independent results:

```json
{
  "schemaDrift": {},
  "migrationHistory": {}
}
```

Schema drift compares structural schema objects: tables, columns, column order, types, NOT NULL, defaults, primary keys, indexes, uniqueness, partial indexes, triggers, and views. Cosmetic whitespace differences do not count as drift.

Migration history compares `d1_migrations`. Missing historical rows are classified as `HISTORY_DIVERGENCE`. By default this is `WARNING`; set `MIGRATION_HISTORY_POLICY=blocking` to make it `BLOCKING`. A history divergence is never reported as a missing table, column, or index.

## Staging provisioning

A disposable/empty staging database must be provisioned before equality audit:

```bash
node scripts/db-tool.mjs provision-staging \
  --database lmsystemv2-staging-db \
  --database-id <staging-id> \
  --confirm-empty-or-disposable
```

Provisioning blocks the production database name and the production database ID, applies migrations in deterministic order, and writes evidence.

## Backup and restore

Backups write metadata only after the export file exists and include SHA-256, size, timestamp, database name, database ID, environment, and sanitized checks. Backup files are ignored by Git via `backups/`.

Restore is implemented for staging only:

```bash
node scripts/db-tool.mjs restore \
  --environment staging \
  --database lmsystemv2-staging-db \
  --database-id <staging-id> \
  --file backups/file.sql \
  --confirm-restore
```

Production restore is prohibited in this PR.

## Smoke, verify, and release evidence

Smoke cannot be synthetic. If smoke is not executed, evidence status is `NOT_EXECUTED` with `smokeExecuted=false`, and deployment is blocked. The only passing smoke gate is a real `scripts/smoke-lm-premium-rc1.mjs` result with `smokeExecuted=true`, `ok=true`, and `failed=0`.

Evidence files include command, timestamps, exit code, source, environment, database name, database ID, status, checks, errors, and artifact hashes. Evidence is not a self-approval; each command records the validated result of an external check or artifact.

## Production protections

There is no simple `deploy:production` write command. Production is plan-only in this phase:

```bash
npm run deploy:production:plan -- --confirm-production
```

The plan remains `BLOCKING` unless all gates are present:

- `ALLOW_PRODUCTION_DEPLOY=true`
- `CONFIRM_PRODUCTION_DATABASE_ID=1de90532-157b-473e-8e7a-655ca9e0953d`
- `CONFIRM_RELEASE_VERSION=<resolved release version>`
- `--confirm-production`
- approved backup, audit, smoke, verify, and migration plan evidence

Without every gate, exit code is `2` and no write command is executed.

## Commands requiring authenticated Wrangler

Operators with Cloudflare credentials must still run the remote commands: production baseline capture, staging provisioning, remote audits, D1 backup/export, and staging restore. Codex did not execute production writes or migrations.
