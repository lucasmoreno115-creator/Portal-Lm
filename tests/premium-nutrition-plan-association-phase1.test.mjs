import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runAssociation, sanitizedReport } from '../scripts/run-premium-nutrition-plan-association-phase1.mjs';

const schema = 'CREATE TABLE nutrition_plans (id TEXT PRIMARY KEY, student_id TEXT, student_email TEXT, status TEXT, created_at TEXT, updated_at TEXT)';
const candidate = { student_id: 'student-1', email: 'person@example.test' };
const plan = { id: 'plan-1', student_id: null, student_email: candidate.email, status: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
function client({ changes = 1, audit = true, mutate = true, altered = false, failPostUpdate = false, failApplied = false, failCompensate = false, failRolledBack = false, failRestore = false } = {}) {
  const sql = []; const state = { plan: { ...plan }, recordStatus: audit ? 'APPLIED' : null, recordFingerprint: null, failPostUpdate };
  return { sql, state, async all(query, params = []) {
    sql.push(query);
    if (query.includes('sqlite_schema')) return [{ sql: schema }];
    if (query.includes("FROM premium_students WHERE access_status = 'ACTIVE'")) return [candidate];
    if (query.includes("WHERE student_id = ? AND access_status")) return [candidate];
    if (query.includes('WHERE lower(email)')) return [candidate];
    if (query.includes('WHERE student_id = ?')) return state.plan.student_id ? [{ id: state.plan.id }] : [];
    if (query.includes('WHERE lower(student_email)')) return [{ ...state.plan }];
    if (query.includes('operations WHERE')) return audit ? [{ operation_id: params[0] }] : [];
    if (query.includes("records WHERE operation_id") && query.includes("status = 'APPLIED'")) return state.recordStatus === 'APPLIED' ? [{ operation_id: params[0], plan_id: state.plan.id, previous_student_id: null, new_student_id: 'student-1', plan_fingerprint: altered ? 'different' : state.recordFingerprint }] : [];
    if (query.includes('WHERE id = ?')) { if (state.failPostUpdate && state.plan.student_id) { state.failPostUpdate = false; return []; } return [{ ...state.plan }]; }
    return [];
  }, async execute(query, params = []) {
    sql.push(query);
    if (query.includes('INSERT INTO premium_nutrition_plan_association_records')) { state.recordFingerprint = params[4]; state.recordStatus = 'PENDING'; }
    if (query.startsWith('UPDATE nutrition_plans')) {
      const isCompensation = !query.includes('lower(student_email)');
      const isRestore = !isCompensation && !query.includes('WHERE id = ? AND student_id = ?') && state.recordStatus === 'APPLIED';
      const failure = isCompensation ? failCompensate : (isRestore ? failRestore : false);
      const writeChanges = failure ? 0 : changes; if (mutate && writeChanges === 1) state.plan.student_id = params[0]; return { meta: { changes: writeChanges } };
    }
    if (query.includes("SET status = 'APPLIED'")) { if (!failApplied) state.recordStatus = 'APPLIED'; return { meta: { changes: failApplied ? 0 : 1 } }; }
    if (query.includes("SET status = 'COMPENSATED'")) { state.recordStatus = 'COMPENSATED'; return { meta: { changes: 1 } }; }
    if (query.includes("SET status = 'ROLLED_BACK'")) { if (!failRolledBack) state.recordStatus = 'ROLLED_BACK'; return { meta: { changes: failRolledBack ? 0 : 1 } }; }
    return { meta: { changes: 1 } };
  } };
}
test('dry-run makes no writes and reports only sanitized aggregates', async () => {
  const db = client(); const report = await runAssociation({ client: db, mode: 'dry-run', confirmation: true });
  assert.equal(report.summary.candidates, 1); assert.equal(db.sql.some((sql) => /^(CREATE|INSERT|UPDATE)/.test(sql)), false); assert.doesNotMatch(JSON.stringify(report), /person@example|plan-1|student-1/);
});
test('apply immediately revalidates, uses a defensive update, checks changes, and verifies afterward', async () => {
  const db = client(); const report = await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  assert.equal(report.summary.applied, 1);
  const update = db.sql.find((sql) => sql.startsWith('UPDATE nutrition_plans SET student_id'));
  assert.match(update, /student_id IS NULL/); assert.match(update, /lower\(student_email\) = lower\(\?\)/); assert.match(update, /status IS NULL/);
  const updateAt = db.sql.indexOf(update); assert.ok(db.sql.slice(0, updateAt).some((sql) => sql.includes("access_status = 'ACTIVE'"))); assert.ok(db.sql.slice(updateAt + 1).some((sql) => sql.includes('WHERE id = ?')));
});
test('apply fails closed when UPDATE changes is not exactly one', async () => {
  const db = client({ changes: 0 }); const report = await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  assert.equal(report.summary.applied, 0); assert.equal(report.summary.blocked, 1);
});
test('apply compensates a post-update verification failure and never leaves PENDING linked', async () => {
  const db = client({ failPostUpdate: true }); const report = await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  assert.equal(report.summary.applied, 0); assert.equal(report.summary.blocked, 1); assert.equal(db.state.plan.student_id, null); assert.equal(db.state.recordStatus, 'COMPENSATED');
});
test('apply compensates when APPLIED audit transition does not change exactly one record', async () => {
  const db = client({ failApplied: true }); const report = await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  assert.equal(report.summary.applied, 0); assert.equal(db.state.plan.student_id, null); assert.equal(db.state.recordStatus, 'COMPENSATED');
});
test('a failed apply compensation is fatal rather than returning an inconsistent success', async () => {
  const db = client({ failApplied: true, failCompensate: true }); await assert.rejects(() => runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true }), /ASSOCIATION_COMPENSATION_FAILED/);
});
test('rollback uses persisted audit rather than a manifest, blocks unknown and already reverted operations', async () => {
  await assert.rejects(() => runAssociation({ client: client({ audit: false }), mode: 'rollback', operationId: 'forged-manifest-id', confirmation: true }), /ASSOCIATION_OPERATION_NOT_FOUND/);
  const db = client(); db.state.recordStatus = 'ROLLED_BACK'; await assert.rejects(() => runAssociation({ client: db, mode: 'rollback', operationId: 'operation-1', confirmation: true }), /ASSOCIATION_NOTHING_TO_ROLLBACK/);
});
test('rollback refuses an incompatible later plan alteration instead of overwriting it', async () => {
  const db = client({ altered: true }); const report = await runAssociation({ client: db, mode: 'rollback', operationId: 'operation-1', confirmation: true }); assert.equal(report.summary.rolled_back, 0); assert.equal(report.summary.blocked, 1);
});
test('successful rollback requires persisted applied audit and marks it rolled back', async () => {
  const db = client(); await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  const report = await runAssociation({ client: db, mode: 'rollback', operationId: 'operation-1', confirmation: true });
  assert.equal(report.summary.rolled_back, 1); assert.equal(db.state.plan.student_id, null); assert.equal(db.state.recordStatus, 'ROLLED_BACK');
});
test('rollback restores the new student ID when its final audit transition fails', async () => {
  const db = client({ failRolledBack: true }); await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  const report = await runAssociation({ client: db, mode: 'rollback', operationId: 'operation-1', confirmation: true });
  assert.equal(report.summary.rolled_back, 0); assert.equal(db.state.plan.student_id, 'student-1'); assert.equal(db.state.recordStatus, 'APPLIED');
});
test('a failed rollback restoration is fatal rather than returning an inconsistent success', async () => {
  const db = client({ failRolledBack: true, failRestore: true }); await runAssociation({ client: db, mode: 'apply', operationId: 'operation-1', confirmation: true });
  await assert.rejects(() => runAssociation({ client: db, mode: 'rollback', operationId: 'operation-1', confirmation: true }), /ASSOCIATION_ROLLBACK_RESTORE_FAILED/);
});
test('workflow is main-only, production-gated, parseable, confirmed, and retains a sanitized artifact for one day', () => {
  const workflow = fs.readFileSync('.github/workflows/premium-nutrition-plan-association-phase1.yml', 'utf8');
  assert.match(workflow, /^on:\n  workflow_dispatch:/m); assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/); assert.match(workflow, /environment: production/); assert.match(workflow, /CLOUDFLARE_D1_API_TOKEN/); assert.match(workflow, /retention-days: 1/); assert.match(workflow, /ASSOCIATION_CONFIRMATION/);
  assert.doesNotMatch(workflow, /student_email|plan_id|email.*summary/i);
});
test('phase 1 changes only its four approved files', () => {
  const allowed = new Set(['.github/workflows/premium-nutrition-plan-association-phase1.yml', 'docs/premium-nutrition-plan-association-phase1.md', 'scripts/run-premium-nutrition-plan-association-phase1.mjs', 'tests/premium-nutrition-plan-association-phase1.test.mjs']);
  const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); assert.ok(changed.every((file) => allowed.has(file)));
});
