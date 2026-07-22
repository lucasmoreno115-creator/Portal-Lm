import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const migration = 'migrations/0036_scope_legacy_active_nutrition_plan_email_unique.sql';

function withDatabase(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'nutrition-plan-index-'));
  const database = path.join(dir, 'test.sqlite');
  try {
    execFileSync('sqlite3', [database], { input: `
      CREATE TABLE nutrition_plans (
        id TEXT PRIMARY KEY,
        student_id TEXT,
        student_email TEXT NOT NULL,
        status TEXT,
        version_number INTEGER,
        is_active INTEGER,
        published_at TEXT,
        published_by TEXT,
        supersedes_plan_id TEXT,
        archived_at TEXT,
        updated_at TEXT
      );
      CREATE UNIQUE INDEX idx_nutrition_plans_single_active
        ON nutrition_plans(student_email) WHERE is_active = 1;
      CREATE UNIQUE INDEX idx_nutrition_plans_single_published_student
        ON nutrition_plans(student_id) WHERE status = 'PUBLISHED' AND student_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_nutrition_plans_single_open_draft_student
        ON nutrition_plans(student_id) WHERE status = 'DRAFT' AND student_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_nutrition_plans_student_version_unique
        ON nutrition_plans(student_id, version_number) WHERE student_id IS NOT NULL AND version_number IS NOT NULL;
    ` });
    execFileSync('sqlite3', [database], { input: readFileSync(migration, 'utf8') });
    run(database);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function execute(database, sql) { return execFileSync('sqlite3', [database], { input: sql, encoding: 'utf8' }); }
function query(database, sql) { return JSON.parse(execFileSync('sqlite3', ['-json', database, sql], { encoding: 'utf8' })); }
function mustFail(database, sql, message) { assert.throws(() => execute(database, sql), /UNIQUE constraint failed/, message); }

test('migration documents the legacy conflict audit before replacing the index', () => {
  const sql = readFileSync(migration, 'utf8');
  assert.match(sql, /SELECT lower\(trim\(student_email\)\), COUNT\(\*\)/);
  assert.match(sql, /DROP INDEX IF EXISTS idx_nutrition_plans_single_active/);
  assert.match(sql, /idx_nutrition_plans_single_active_legacy_email/);
  assert.match(sql, /WHERE is_active = 1\s+AND student_id IS NULL/);
});

test('allows an active legacy plan and an active modern plan with the same email', () => withDatabase((database) => {
  execute(database, `
    INSERT INTO nutrition_plans VALUES ('legacy',NULL,'ana@example.com',NULL,NULL,1,NULL,NULL,NULL,NULL,'old');
    INSERT INTO nutrition_plans VALUES ('modern','student-1','ana@example.com','PUBLISHED',1,1,'now','admin',NULL,NULL,'now');
  `);
}));

test('continues to block two active unassociated legacy plans with the same email', () => withDatabase((database) => {
  execute(database, "INSERT INTO nutrition_plans VALUES ('legacy-1',NULL,'ana@example.com',NULL,NULL,1,NULL,NULL,NULL,NULL,'old');");
  mustFail(database, "INSERT INTO nutrition_plans VALUES ('legacy-2',NULL,'ana@example.com',NULL,NULL,1,NULL,NULL,NULL,NULL,'new');");
}));

test('preserves modern published and version uniqueness by student_id', () => withDatabase((database) => {
  execute(database, "INSERT INTO nutrition_plans VALUES ('published-1','student-1','ana@example.com','PUBLISHED',1,1,'now','admin',NULL,NULL,'now');");
  mustFail(database, "INSERT INTO nutrition_plans VALUES ('published-2','student-1','other@example.com','PUBLISHED',2,1,'now','admin',NULL,NULL,'now');");
  mustFail(database, "INSERT INTO nutrition_plans VALUES ('archived-duplicate-version','student-1','other@example.com','ARCHIVED',1,0,'now','admin',NULL,'now','now');");
}));

test('publishes a modern draft beside a legacy active plan and preserves the previous version', () => withDatabase((database) => {
  execute(database, `
    INSERT INTO nutrition_plans VALUES ('legacy',NULL,'ana@example.com',NULL,NULL,1,NULL,NULL,NULL,NULL,'old');
    INSERT INTO nutrition_plans VALUES ('previous','student-1','ana@example.com','PUBLISHED',1,1,'old','admin',NULL,NULL,'old');
    INSERT INTO nutrition_plans VALUES ('draft','student-1','ana@example.com','DRAFT',NULL,0,NULL,NULL,NULL,NULL,'draft');
    UPDATE nutrition_plans
      SET status = CASE WHEN id = 'draft' THEN 'PUBLISHED' ELSE 'ARCHIVED' END,
          is_active = CASE WHEN id = 'draft' THEN 1 ELSE 0 END,
          version_number = CASE WHEN id = 'draft' THEN 2 ELSE version_number END,
          published_at = CASE WHEN id = 'draft' THEN 'now' ELSE published_at END,
          published_by = CASE WHEN id = 'draft' THEN 'admin' ELSE published_by END,
          supersedes_plan_id = CASE WHEN id = 'draft' THEN 'previous' ELSE supersedes_plan_id END,
          archived_at = CASE WHEN id <> 'draft' THEN 'now' ELSE archived_at END,
          updated_at = 'now'
      WHERE student_id = 'student-1'
        AND (id = 'draft' OR status = 'PUBLISHED')
        AND EXISTS (SELECT 1 FROM nutrition_plans WHERE id = 'draft' AND student_id = 'student-1' AND status = 'DRAFT');
  `);
  const rows = query(database, "SELECT id,status,is_active,version_number FROM nutrition_plans WHERE id IN ('previous','draft') ORDER BY id;");
  assert.deepEqual(rows, [
    { id: 'draft', status: 'PUBLISHED', is_active: 1, version_number: 2 },
    { id: 'previous', status: 'ARCHIVED', is_active: 0, version_number: 1 },
  ]);
}));
