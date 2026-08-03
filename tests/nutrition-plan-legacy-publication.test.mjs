import assert from 'node:assert/strict';
import { executeSql, SqliteD1 } from './helpers/sqlite-d1.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createD1NutritionPlanRepository } from '../workers/premium/repositories/d1-nutrition-plan-repository.js';

function sqlValue(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function withDatabase(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'nutrition-plan-legacy-publication-'));
  const file = path.join(dir, 'test.sqlite');
  try {
    executeSql(file, `
      CREATE TABLE nutrition_plans (
        id TEXT PRIMARY KEY, student_id TEXT, student_email TEXT, title TEXT, goal TEXT,
        strategy TEXT, meals_json TEXT, substitutions_json TEXT, adherence_rules_json TEXT,
        notes TEXT, whatsapp_message TEXT, status TEXT, version_number INTEGER,
        published_at TEXT, published_by TEXT, archived_at TEXT, supersedes_plan_id TEXT,
        source_feedback_id TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT
      );
      CREATE UNIQUE INDEX idx_nutrition_plans_single_published_student
        ON nutrition_plans(student_id) WHERE status='PUBLISHED' AND student_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_nutrition_plans_student_version_unique
        ON nutrition_plans(student_id,version_number) WHERE student_id IS NOT NULL AND version_number IS NOT NULL;
      CREATE TABLE premium_followup_entries (
        id TEXT PRIMARY KEY, student_id TEXT, entry_type TEXT, title TEXT, content TEXT,
        source TEXT, related_entity_type TEXT, related_entity_id TEXT, created_by TEXT,
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE premium_pending_items (
        id TEXT PRIMARY KEY, student_id TEXT, type TEXT, status TEXT, related_entity_id TEXT,
        resolved_at TEXT, updated_at TEXT
      );
    `);
    const db = new SqliteD1(file);
    let testError;
    try {
      await run({ db, file });
    } catch (error) {
      testError = error;
      throw error;
    } finally {
      try { db.close(); } catch (closeError) { if (!testError) throw closeError; }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('publishing archives an associated active legacy plan without touching ineligible records', async () => {
  await withDatabase(async ({ db, file }) => {
    const meal = JSON.stringify([{ name: 'Café', items: [{ food: 'Ovos', quantity: '2' }] }]);
    executeSql(file, `
      INSERT INTO nutrition_plans (id,student_id,student_email,title,meals_json,status,version_number,is_active,created_at,updated_at)
        VALUES ('previous','student-1','ana@example.com','Anterior',${sqlValue(meal)},NULL,NULL,1,'old','old');
      INSERT INTO nutrition_plans (id,student_id,student_email,title,meals_json,status,is_active,created_at,updated_at)
        VALUES ('draft','student-1','ana@example.com','Novo',${sqlValue(meal)},'DRAFT',0,'draft','draft');
      INSERT INTO nutrition_plans (id,student_id,student_email,title,meals_json,status,is_active,created_at,updated_at)
        VALUES ('inactive-legacy','student-1','ana@example.com','Inativo',${sqlValue(meal)},NULL,0,'old','old');
      INSERT INTO nutrition_plans (id,student_id,student_email,title,meals_json,status,is_active,created_at,updated_at)
        VALUES ('other-student','student-2','other@example.com','Outro',${sqlValue(meal)},NULL,1,'old','old');
      INSERT INTO nutrition_plans (id,student_id,student_email,title,meals_json,status,is_active,created_at,updated_at)
        VALUES ('unassociated',NULL,'ana@example.com','Sem associação',${sqlValue(meal)},NULL,1,'old','old');
    `);

    const published = await createD1NutritionPlanRepository(db).publish('draft', { published_by: 'admin', now: '2026-07-26T12:00:00.000Z' });

    assert.equal(published.status, 'PUBLISHED');
    assert.equal(published.is_active, 1);
    assert.equal(published.supersedes_plan_id, 'previous');
    const rows = (await db.prepare("SELECT id,status,is_active,archived_at FROM nutrition_plans ORDER BY id").all()).results;
    assert.deepEqual(rows.find(({ id }) => id === 'previous'), { id: 'previous', status: 'ARCHIVED', is_active: 0, archived_at: '2026-07-26T12:00:00.000Z' });
    assert.deepEqual(rows.find(({ id }) => id === 'inactive-legacy'), { id: 'inactive-legacy', status: null, is_active: 0, archived_at: null });
    assert.deepEqual(rows.find(({ id }) => id === 'other-student'), { id: 'other-student', status: null, is_active: 1, archived_at: null });
    assert.deepEqual(rows.find(({ id }) => id === 'unassociated'), { id: 'unassociated', status: null, is_active: 1, archived_at: null });
  });
});
