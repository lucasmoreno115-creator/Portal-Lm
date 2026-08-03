import assert from 'node:assert/strict';
import { SqliteD1 } from './helpers/sqlite-d1.mjs';
import test from 'node:test';
import { initializeSchemaForTests } from '../workers/api.js';
import { replayMigrations } from '../scripts/db-tool.mjs';

test('ensureSchema preserves migration 0036 legacy-only active email uniqueness', async () => {
  const replay = replayMigrations();
  assert.equal(replay.ok, true);
  assert.ok(replay.applied.includes('0036_scope_legacy_active_nutrition_plan_email_unique.sql'));
  const db = new SqliteD1(replay.database);
  let testError;
  try {
    await initializeSchemaForTests(db);

    const indexes = await db.prepare("SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name='nutrition_plans' AND name IN ('idx_nutrition_plans_single_active', 'idx_nutrition_plans_single_active_legacy_email') ORDER BY name").all();
    assert.deepEqual(indexes.results, [{ name: 'idx_nutrition_plans_single_active_legacy_email' }]);

    await db.prepare("INSERT INTO nutrition_plans (id,student_id,student_email,meals_json,is_active,status,version_number,created_at,updated_at) VALUES ('legacy-active',NULL,'ana@example.com','[]',1,NULL,NULL,'now','now')").run();
    await db.prepare("INSERT INTO nutrition_plans (id,student_id,student_email,meals_json,is_active,status,version_number,created_at,updated_at) VALUES ('modern-active','student-1','ana@example.com','[]',1,'PUBLISHED',1,'now','now')").run();
  } catch (error) {
    testError = error;
    throw error;
  } finally {
    try { db.close(); } catch (closeError) { if (!testError) throw closeError; }
  }
});
