import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportSchemaSql, replayMigrations } from '../scripts/db-tool.mjs';
import { auditProductionMigrationBaseline } from '../scripts/audit-production-migration-baseline.mjs';

const dataCheckMigrations = [
  '0010_project_lm_library.sql',
  '0011_project_lm_weekly_missions.sql',
  '0018_project_lm_v5_foundation.sql',
  '0023_project_lm_training_plans.sql',
  '0024_project_lm_training_model_refinement.sql',
  '0029_add_weekly_feedback_operational_fields.sql',
  '0032_finalize_nutrition_plan_lifecycle.sql',
  '0035_add_ready_to_release_consultation_status.sql',
];

function fixture() {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'portal-lm-baseline-test-'));
  const replay = replayMigrations();
  try {
    const schema = exportSchemaSql(replay.database);
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
    assert.deepEqual(
      report.results.filter(result => result.classification === 'DATA_CHECK_REQUIRED').map(result => result.file),
      dataCheckMigrations
    );
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

test('runs from the CLI and generates the audit artifacts', () => {
  const sample = fixture();
  const outputDir = path.resolve('release');
  const outputFiles = [
    'migration-baseline-audit.json',
    'migration-baseline-audit.md',
    'reconcile-d1-migration-history.sql',
    'production-migration-data-checks.sql',
  ];
  try {
    const stdout = execFileSync(
      process.execPath,
      [path.resolve('scripts/audit-production-migration-baseline.mjs'), sample.schemaPath],
      { encoding: 'utf8' }
    );
    assert.match(stdout, /"generated": true/);
    for (const file of outputFiles) assert.equal(existsSync(path.join(outputDir, file)), true, `${file} should be generated`);
    const generated = JSON.parse(stdout);
    assert.deepEqual(generated.results.filter(result => result.classification === 'DATA_CHECK_REQUIRED').map(result => result.file), dataCheckMigrations);
    const reconciliation = readFileSync(path.join(outputDir, 'reconcile-d1-migration-history.sql'), 'utf8');
    for (const file of dataCheckMigrations) assert.doesNotMatch(reconciliation, new RegExp(file));
    assert.match(reconciliation, /0007_student_access_plan\.sql/);
  } finally {
    for (const file of outputFiles) rmSync(path.join(outputDir, file), { force: true });
    sample.dispose();
  }
});

test('audit stays offline and contains no sqlite3 CLI dependency', () => {
  const source = readFileSync('scripts/audit-production-migration-baseline.mjs', 'utf8');
  const dbToolSource = readFileSync('scripts/db-tool.mjs', 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|\bwrangler\b|cloudflare\.com|execFileSync\s*\(\s*['"]sqlite3['"]/i);
  assert.doesNotMatch(dbToolSource, /(?:execFileSync|spawn|exec)\s*\(\s*['"]sqlite3['"]/i);
});
