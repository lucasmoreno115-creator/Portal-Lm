# Database Catalog

Build 6.5 database catalog is pending because `database/expected/migration-schema.json` does not exist.

Run `npm run db:expected` after the migration history is replayable from zero, then rerun `npm run db:catalog`.

Production baseline remains separate and must be captured by authenticated read-only D1 introspection.
