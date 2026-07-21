import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { assertMode, eligibility, run, apply, rollback } from '../scripts/run-premium-nutrition-plan-association-phase1.mjs';

const columns = ['id', 'student_id', 'student_email', 'status', 'is_active', 'created_at', 'updated_at', 'published_at', 'version_number'];
const student = { student_id: 'student-1', email: 'private@example.test', access_status: 'ACTIVE' };
const legacy = { id: 'raw-plan-id', student_id: null, student_email: student.email, status: null, is_active: 1 };
const eligible = (overrides = {}) => eligibility({ student: { ...student, ...overrides.student }, plans: overrides.plans ?? [legacy], columns, matchingStudents: overrides.matchingStudents ?? [{ student_id: student.student_id }] });

test('allows exactly one active legacy plan and blocks required non-eligible states', () => {
  assert.equal(eligible().eligible, true);
  assert.equal(eligible({ plans: [legacy, { ...legacy, id: 'second' }] }).reason, 'AMBIGUOUS_MULTIPLE_PLANS');
  assert.equal(eligible({ plans: [{ ...legacy, status: 'DRAFT' }] }).reason, 'MODERN_DRAFT_ONLY');
  assert.equal(eligible({ plans: [legacy, { ...legacy, id: 'draft', status: 'DRAFT' }] }).reason, 'MODERN_DRAFT_CONFLICT');
  assert.equal(eligible({ plans: [{ ...legacy, student_id: student.student_id }] }).reason, 'ALREADY_ASSOCIATED');
  assert.equal(eligible({ student: { access_status: 'INACTIVE' } }).reason, 'INACTIVE_STUDENT');
});
test('requires exact explicit confirmation for apply and rollback', () => {
  assert.throws(() => assertMode({ mode: 'apply', confirmation: 'wrong' }), /ASSOCIATION_APPLY_CONFIRMATION_REQUIRED/);
  assert.throws(() => assertMode({ mode: 'rollback', confirmation: 'wrong' }), /ASSOCIATION_ROLLBACK_CONFIRMATION_REQUIRED/);
});
test('dry-run performs no writes and redacts PII and plan content', async () => {
  let writes = 0;
  const client = fakeClient({ associate: async () => { writes++; }, rollback: async () => { writes++; } });
  const result = await run({ client, mode: 'dry-run' });
  assert.equal(writes, 0); assert.equal(result.summary.eligible, 1); assert.doesNotMatch(JSON.stringify(result), /private@example\.test|raw-plan-id|meals/i);
});
test('apply changes exactly one row and fails closed for a zero-row update', async () => {
  const success = await apply({ client: fakeClient({ associate: async () => ({ meta: { changes: 1 } }) }) });
  assert.equal(success.summary.applied, 1); assert.equal(success.rollback_manifest.records.length, 1);
  const failed = await apply({ client: fakeClient({ associate: async () => ({ meta: { changes: 0 } }) }) });
  assert.equal(failed.summary.applied, 0); assert.equal(failed.blocked.at(-1).reason, 'UPDATE_NOT_EXACTLY_ONE');
});
test('rollback restores only the exact still-applied association and preserves later changes', async () => {
  const opaquePlanId = (await import('../scripts/diagnose-premium-nutrition-plan-candidates.mjs')).opaquePlanId;
  const manifest = JSON.stringify({ operation_id: 'op-1', records: [{ operation_id: 'op-1', student_id: student.student_id, opaque_plan_id: opaquePlanId('real'), previous_student_id: null, new_student_id: student.student_id, timestamp: 'now' }] });
  const valid = await rollback({ client: { all: async () => [{ id: 'real', student_id: student.student_id }], rollback: async () => ({ meta: { changes: 1 } }) }, manifest });
  assert.equal(valid.summary.rolled_back, 1);
  const changed = await rollback({ client: { all: async () => [{ id: 'real', student_id: 'manual-change' }], rollback: async () => { throw new Error('must not write'); } }, manifest });
  assert.equal(changed.summary.blocked, 1); assert.equal(changed.records[0].result, 'POST_OPERATION_CHANGE_OR_MISSING');
});
test('workflow limits production operations to main and retains a sanitized artifact', () => {
  const workflow = fs.readFileSync('.github/workflows/premium-nutrition-plan-association-phase1.yml', 'utf8');
  assert.match(workflow, /^on:\n  workflow_dispatch:/m); assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/); assert.match(workflow, /environment: production/); assert.match(workflow, /CLOUDFLARE_D1_API_TOKEN/); assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN/); assert.match(workflow, /retention-days: 1/); assert.match(workflow, /Object\.entries\(summary\)/);
});
test('association workflow YAML is parseable', () => {
  const result = spawnSync('ruby', ['-e', "require 'yaml'; YAML.load_file('.github/workflows/premium-nutrition-plan-association-phase1.yml')"], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
function fakeClient({ associate = async () => ({ meta: { changes: 1 } }), rollback = async () => ({ meta: { changes: 1 } }) } = {}) { return { associate, rollback, all: async (sql) => { if (sql.includes('sqlite_schema')) return [{ sql: 'CREATE TABLE nutrition_plans (id TEXT, student_id TEXT, student_email TEXT, status TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT, published_at TEXT, version_number INTEGER)' }]; if (sql.includes('FROM premium_students WHERE lower')) return [{ student_id: student.student_id }]; if (sql.includes('FROM premium_students')) return [student]; if (sql.includes('FROM nutrition_plans')) return [legacy]; return []; } }; }
