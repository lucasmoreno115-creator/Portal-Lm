import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { replayMigrations } from '../scripts/db-tool.mjs';
import { auditProductionMigrationBaseline } from '../scripts/audit-production-migration-baseline.mjs';

function fixture() {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'portal-lm-baseline-test-'));
  const replay = replayMigrations();
  try {
    const schema = execFileSync('sqlite3', [replay.database, '.schema'], { encoding: 'utf8' });
    const schemaPath = path.join(temp, 'schema.sql');
    writeFileSync(schemaPath, schema);
    return { temp, schemaPath, dispose: () => { rmSync(path.dirname(replay.database), { recursive: true, force: true }); rmSync(temp, { recursive: true, force: true }); } };
  } catch (error) {
    rmSync(path.dirname(replay.database), { recursive: true, force: true });
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

test('classifies the official replay schema as structurally satisfied where data checks are not required', () => {
  const sample = fixture();
  try {
    const report = auditProductionMigrationBaseline({ schemaPath: sample.schemaPath, outputDir: path.join(sample.temp, 'release') });
    assert.equal(report.results.find(result => result.file.startsWith('0007_')).classification, 'SATISFIED');
    assert.equal(report.results.find(result => result.file.startsWith('0024_')).classification, 'DATA_CHECK_REQUIRED');
  } finally { sample.dispose(); }
});

test('reports a missing structural requirement as PARTIAL when another requirement remains', () => {
  const sample = fixture();
  try {
    const schema = readFileSync(sample.schemaPath, 'utf8').replace(/CREATE INDEX idx_project_lm_daily_actions_student_date[\s\S]*?;\n/g, '');
    writeFileSync(sample.schemaPath, schema);
    const report = auditProductionMigrationBaseline({ schemaPath: sample.schemaPath, outputDir: path.join(sample.temp, 'release') });
    assert.equal(report.results.find(result => result.file.startsWith('0009_')).classification, 'PARTIAL');
  } finally { sample.dispose(); }
});

test('reconciliation SQL excludes data-check, partial, and missing migrations', () => {
  const sample = fixture();
  try {
    const outputDir = path.join(sample.temp, 'release');
    auditProductionMigrationBaseline({ schemaPath: sample.schemaPath, outputDir });
    const sql = readFileSync(path.join(outputDir, 'reconcile-d1-migration-history.sql'), 'utf8');
    assert.match(sql, /INSERT OR IGNORE INTO d1_migrations/);
    assert.doesNotMatch(sql, /0024_project_lm_training_model_refinement/);
    assert.doesNotMatch(sql, /0032_finalize_nutrition_plan_lifecycle/);
  } finally { sample.dispose(); }
});

test('audit script contains no remote client or Wrangler invocation', () => {
  const source = readFileSync('scripts/audit-production-migration-baseline.mjs', 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|\bwrangler\b|cloudflare\.com/i);
});
