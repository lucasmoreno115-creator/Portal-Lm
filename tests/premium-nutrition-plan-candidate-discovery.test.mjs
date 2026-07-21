import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertReadOnlySql, buildReport, classifyStudent, discoverNutritionPlanColumns } from '../scripts/diagnose-premium-nutrition-plan-candidates.mjs';

const columns = ['id', 'student_id', 'student_email', 'status', 'is_active', 'created_at', 'updated_at', 'published_at', 'version_number'];
const student = { student_id: 'canonical-student', email: 'private@example.test' };
const legacy = (id, updated_at) => ({ id, student_email: student.email, is_active: 1, status: null, updated_at });

test('discovers columns from sqlite_schema CREATE TABLE SQL without PRAGMA', () => {
  const found = discoverNutritionPlanColumns('CREATE TABLE nutrition_plans (id TEXT PRIMARY KEY, student_email TEXT, student_id TEXT, created_at TEXT, updated_at TEXT, status TEXT, version_number INTEGER)');
  assert.deepEqual(found, ['id', 'student_id', 'student_email', 'status', 'created_at', 'updated_at', 'version_number']);
});
test('classifies a single legacy plan as a high-confidence candidate', () => {
  const row = classifyStudent({ student, plans: [legacy('legacy-one', null)], columns });
  assert.equal(row.category, 'SINGLE_LEGACY_CANDIDATE'); assert.equal(row.confidence, 'HIGH'); assert.ok(row.candidate_current_plan_id);
});
test('selects multiple legacy plans only with a unique temporal order', () => {
  const row = classifyStudent({ student, plans: [legacy('old', '2026-01-01T00:00:00Z'), legacy('new', '2026-02-01T00:00:00Z')], columns });
  assert.equal(row.category, 'DETERMINISTIC_MULTIPLE_CANDIDATE'); assert.equal(row.confidence, 'MEDIUM'); assert.equal(row.historical_plan_ids.length, 1);
});
test('blocks multiple legacy plans with a timestamp tie or missing timestamps', () => {
  for (const plans of [[legacy('a', '2026-01-01T00:00:00Z'), legacy('b', '2026-01-01T00:00:00Z')], [legacy('a', null), legacy('b', null)]]) {
    const row = classifyStudent({ student, plans, columns }); assert.equal(row.category, 'AMBIGUOUS_MULTIPLE_PLANS'); assert.equal(row.confidence, 'BLOCKED');
  }
});
test('blocks legacy records when a modern DRAFT coexists and does not treat DRAFT as current', () => {
  const row = classifyStudent({ student, plans: [legacy('legacy', '2026-01-01T00:00:00Z'), { id: 'draft', student_id: student.student_id, status: 'DRAFT', is_active: 1 }], columns });
  assert.equal(row.category, 'MODERN_DRAFT_CONFLICT'); assert.equal(row.candidate_current_plan_id, null); assert.equal(row.modern_draft_conflict, true);
});
test('classifies an isolated modern DRAFT and no plan without candidate selection', () => {
  assert.equal(classifyStudent({ student, plans: [{ id: 'draft', student_id: student.student_id, status: 'DRAFT' }], columns }).category, 'MODERN_DRAFT_ONLY');
  assert.equal(classifyStudent({ student, plans: [], columns }).category, 'NO_PLAN');
});
test('read-only SQL guard blocks writes, PRAGMA, and multiple statements', () => {
  assert.equal(assertReadOnlySql('SELECT sql FROM sqlite_schema'), 'SELECT sql FROM sqlite_schema');
  for (const sql of ['INSERT INTO x VALUES(1)', 'UPDATE x SET value=1', 'DELETE FROM x', 'PRAGMA table_info(nutrition_plans)', 'SELECT 1; SELECT 2']) assert.throws(() => assertReadOnlySql(sql), /DIAGNOSTIC_WRITE_SQL_BLOCKED/);
});
test('report contains no input email or plan IDs and summary counts safe and blocked outcomes', () => {
  const report = buildReport({ students: [student], plansByStudent: new Map([[student.student_id, [legacy('raw-plan-id', null)]]]), columns });
  const output = JSON.stringify(report);
  assert.doesNotMatch(output, /private@example\.test|raw-plan-id/i); assert.equal(report.summary.single_legacy_candidate, 1); assert.equal(report.summary.eligible_for_safe_association, 1); assert.equal(report.summary.blocked, 0);
});
test('candidate workflow is manually dispatched, production-scoped, and publishes only aggregate summary', () => {
  const workflow = fs.readFileSync('.github/workflows/premium-nutrition-plan-candidate-discovery.yml', 'utf8');
  assert.match(workflow, /^on:\n  workflow_dispatch:/m); assert.match(workflow, /discover:\n    if: github\.ref == 'refs\/heads\/main'\n    environment: production/); assert.match(workflow, /CLOUDFLARE_D1_API_TOKEN/); assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN/); assert.match(workflow, /retention-days: 1/); assert.match(workflow, /upload-artifact/); assert.match(workflow, /Object\.entries\(summary\)/); assert.doesNotMatch(workflow, /nutrition_plans.*(?:UPDATE|INSERT|DELETE)/i);
});
