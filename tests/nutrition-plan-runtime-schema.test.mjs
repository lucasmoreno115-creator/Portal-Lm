import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { initializeSchemaForTests } from '../workers/api.js';
import { replayMigrations } from '../scripts/db-tool.mjs';

class SqliteD1 {
  constructor(file) { this.file = file; }
  prepare(sql) { return new Statement(this.file, sql); }
}

class Statement {
  constructor(file, sql, params = []) { this.file = file; this.sql = sql; this.params = params; }
  bind(...params) { return new Statement(this.file, this.sql, params); }
  sqlWithParams() { let index = 0; return this.sql.replace(/\?/g, () => sqlValue(this.params[index++])); }
  async run() { execFileSync('sqlite3', [this.file], { input: `${this.sqlWithParams()};` }); return { meta: { changes: 1 } }; }
  async all() { const output = execFileSync('sqlite3', ['-json', this.file, this.sqlWithParams()], { encoding: 'utf8' }).trim(); return { results: output ? JSON.parse(output) : [] }; }
  async first() { return (await this.all()).results[0] ?? null; }
}

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

test('ensureSchema preserves migration 0036 legacy-only active email uniqueness', async () => {
  const replay = replayMigrations();
  assert.equal(replay.ok, true);
  assert.ok(replay.applied.includes('0036_scope_legacy_active_nutrition_plan_email_unique.sql'));
  const db = new SqliteD1(replay.database);

  await initializeSchemaForTests(db);

  const indexes = await db.prepare("SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name='nutrition_plans' AND name IN ('idx_nutrition_plans_single_active', 'idx_nutrition_plans_single_active_legacy_email') ORDER BY name").all();
  assert.deepEqual(indexes.results, [{ name: 'idx_nutrition_plans_single_active_legacy_email' }]);

  await db.prepare("INSERT INTO nutrition_plans (id,student_id,student_email,meals_json,is_active,status,version_number,created_at,updated_at) VALUES ('legacy-active',NULL,'ana@example.com','[]',1,NULL,NULL,'now','now')").run();
  await db.prepare("INSERT INTO nutrition_plans (id,student_id,student_email,meals_json,is_active,status,version_number,created_at,updated_at) VALUES ('modern-active','student-1','ana@example.com','[]',1,'PUBLISHED',1,'now','now')").run();
});
