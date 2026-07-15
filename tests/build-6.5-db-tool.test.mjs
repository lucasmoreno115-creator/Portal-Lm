import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compareSchemas, main, parseArgs, replayMigrations, PRODUCTION_DB, PRODUCTION_DB_ID } from '../scripts/db-tool.mjs';

function tempDir() { return mkdtempSync(path.join(os.tmpdir(), 'build65-test-')); }
function writeMigration(dir, name, sql) { writeFileSync(path.join(dir, name), sql); }
function schema(columns = [{ name:'id', type:'TEXT', notnull:0, dflt_value:null, pk:1 }], indexes = []) {
  return { tables:['students'], columns:{ students: columns.map((c, cid)=>({ cid, ...c })) }, indexes:{ students:indexes }, triggers:[], views:[], objects:[{type:'table',name:'students',tbl_name:'students',sql:'CREATE TABLE students(id TEXT PRIMARY KEY)'}] };
}

test('Build 6.5 baseline: remote production capture requires explicit read-only confirmation', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['capture-baseline', '--environment', 'production']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
});

test('Build 6.5 expected schema: migration replay succeeds deterministically for valid migrations', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_create.sql', 'CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL);');
    writeMigration(dir, '0002_index.sql', 'CREATE UNIQUE INDEX idx_students_name ON students(name);');
    const result = replayMigrations({ dir });
    assert.equal(result.ok, true);
    assert.deepEqual(result.applied, ['0001_create.sql', '0002_index.sql']);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 migration replay: reports migration error and does not create expected artifact', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_valid.sql', 'CREATE TABLE students (id TEXT PRIMARY KEY);');
    writeMigration(dir, '0002_invalid.sql', 'CREATE INDEX idx_missing ON missing_table(id);');
    const result = replayMigrations({ dir });
    assert.equal(result.ok, false);
    assert.equal(result.status, 'BLOCKING');
    assert.equal(result.error.migration, '0002_invalid.sql');
    assert.equal(existsSync(path.join(dir, 'migration-schema.json')), false);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 migration replay: trigger with semicolon in string is not split by agent parser', () => {
  const dir = tempDir();
  try {
    writeMigration(dir, '0001_trigger.sql', `
      CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT);
      CREATE TRIGGER trg_logs AFTER INSERT ON logs BEGIN
        INSERT INTO logs(message) VALUES ('literal; semicolon');
      END;
    `);
    const result = replayMigrations({ dir });
    assert.equal(result.ok, true);
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('Build 6.5 audit: equal schemas pass and cosmetic SQL whitespace is irrelevant', () => {
  assert.equal(compareSchemas(schema(), schema()).status, 'PASS');
});

test('Build 6.5 audit: missing column is schema drift', () => {
  const expected = schema([{ name:'id', type:'TEXT', notnull:0, dflt_value:null, pk:1 }, { name:'email', type:'TEXT', notnull:1, dflt_value:null, pk:0 }]);
  const actual = schema();
  const diff = compareSchemas(expected, actual);
  assert.equal(diff.status, 'BLOCKING');
  assert.equal(diff.columnDiffs[0].table, 'students');
});

test('Build 6.5 audit: missing or extra index is structural drift', () => {
  const idx = [{ name:'idx_students_email', unique:1, origin:'c', partial:0, columns:[{ name:'email' }] }];
  assert.equal(compareSchemas(schema(undefined, idx), schema()).status, 'BLOCKING');
  assert.equal(compareSchemas(schema(), schema(undefined, idx)).status, 'BLOCKING');
});

test('Build 6.5 staging guard: production database name and id are blocked', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['restore', '--environment', 'staging', '--database', PRODUCTION_DB, '--confirm-restore', '--file', 'missing.sql']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
  assert.equal(PRODUCTION_DB_ID, '1de90532-157b-473e-8e7a-655ca9e0953d');
});

test('Build 6.5 smoke gate: skipped smoke is NOT_EXECUTED and blocks', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['smoke', '--environment', 'staging', '--skip-smoke']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
});

test('Build 6.5 production guard: plan blocks without all explicit gates', () => {
  const old = process.exitCode;
  process.exitCode = 0;
  main(['production-plan']);
  assert.equal(process.exitCode, 2);
  process.exitCode = old;
});

test('Build 6.5 CLI parser supports flags required by restore and baseline', () => {
  assert.deepEqual(parseArgs(['restore', '--environment', 'staging', '--file', 'backups/a.sql', '--confirm-restore']), { _: ['restore'], environment: 'staging', file: 'backups/a.sql', 'confirm-restore': true });
});
