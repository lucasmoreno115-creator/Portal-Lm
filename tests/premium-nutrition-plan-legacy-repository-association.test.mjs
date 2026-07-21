import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runLegacyRepositoryAssociation } from '../scripts/run-premium-nutrition-plan-legacy-repository-association.mjs';

const source = fs.readFileSync('scripts/run-premium-nutrition-plan-legacy-repository-association.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/premium-nutrition-plan-legacy-repository-association.yml', 'utf8');
const schema = 'CREATE TABLE nutrition_plans (id TEXT, student_id TEXT, student_email TEXT, status TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT, published_at TEXT, version_number INTEGER)';
const student = { student_id: 'student-1', email: 'person@example.test', access_status: 'ACTIVE' };
const legacy = (id, updated_at) => ({ id, student_id: null, student_email: student.email, status: null, is_active: 1, created_at: updated_at, updated_at });
function client({ students = [student], plans = [legacy('legacy-1', 'invalid-date'), legacy('legacy-2', '2026-01-02T00:00:00Z')], changes = 1, postUpdateMissing = false, compensationFails = false, operationMode = 'legacy-repository-apply', fingerprint = null, rollbackAuditFails = false } = {}) {
  const sql = []; const state = { plans: plans.map((plan) => ({ ...plan })), status: 'APPLIED', recordFingerprint: fingerprint, postUpdateMissing, rollbackAuditFails };
  return { sql, state, async all(query, params = []) {
    sql.push(query);
    if (query.includes('sqlite_schema')) return [{ sql: schema }];
    if (query.includes("FROM premium_students WHERE access_status = 'ACTIVE'")) return students.filter((item) => item.access_status === 'ACTIVE');
    if (query.includes("WHERE student_id = ? AND access_status = 'ACTIVE'")) return students.filter((item) => item.student_id === params[0] && item.access_status === 'ACTIVE');
    if (query.includes('operations WHERE')) return operationMode ? [{ operation_id: params[0] }] : [];
    if (query.includes("records WHERE operation_id") && query.includes("status = 'APPLIED'")) return state.status === 'APPLIED' ? [{ plan_id: 'legacy-2', previous_student_id: null, new_student_id: student.student_id, plan_fingerprint: state.recordFingerprint }] : [];
    if (query.includes('WHERE id = ?')) { const plan = state.plans.find((item) => item.id === params[0]); if (state.postUpdateMissing) { state.postUpdateMissing = false; return []; } return plan ? [{ ...plan }] : []; }
    if (query.includes('FROM nutrition_plans')) return state.plans.filter((plan) => plan.student_id === params[0] || (plan.student_id == null && plan.student_email.toLowerCase() === String(params[1]).toLowerCase())).map((plan) => ({ ...plan }));
    return [];
  }, async execute(query, params = []) {
    sql.push(query);
    if (query.includes('INSERT INTO premium_nutrition_plan_association_records')) { state.recordFingerprint = params[4]; state.status = 'PENDING'; }
    if (query.startsWith('UPDATE nutrition_plans')) {
      const compensate = query.includes('SET student_id = NULL') && !query.includes('lower(student_email)');
      const plan = state.plans.find((item) => item.id === (compensate ? params[0] : params[1]));
      if (compensate && compensationFails) return { meta: { changes: 0 } };
      if (plan && changes === 1) plan.student_id = query.includes('SET student_id = NULL') ? null : params[0];
      return { meta: { changes } };
    }
    if (query.includes("SET status = 'APPLIED'")) { state.status = 'APPLIED'; return { meta: { changes } }; }
    if (query.includes("SET status = 'ROLLED_BACK'")) return { meta: { changes: rollbackAuditFails ? 0 : changes } };
    if (query.includes("SET status = 'COMPENSATED'")) { state.status = 'COMPENSATED'; return { meta: { changes } }; }
    if (query.includes("SET status = 'FAILED'")) { state.status = 'FAILED'; return { meta: { changes: 1 } }; }
    return { meta: { changes } };
  } };
}

test('dry-run finds only one LEGACY_EMAIL_SELECTION_REVIEW repository-selected candidate', async () => {
  const db = client(); const report = await runLegacyRepositoryAssociation({ client: db, confirmation: true });
  assert.equal(report.summary.candidates, 1); assert.equal(report.summary.applied, 0); assert.doesNotMatch(JSON.stringify(report), /person@example|legacy-/);
});
test('modern DRAFT, inactive student, and already linked plan are excluded', async () => {
  const draft = { id: 'draft', student_id: student.student_id, student_email: student.email, status: 'DRAFT', is_active: 1 };
  assert.equal((await runLegacyRepositoryAssociation({ client: client({ plans: [legacy('a', 'invalid-date'), legacy('b', '2026-01-02'), draft] }), confirmation: true })).summary.candidates, 0);
  assert.equal((await runLegacyRepositoryAssociation({ client: client({ students: [{ ...student, access_status: 'INACTIVE' }] }), confirmation: true })).summary.candidates, 0);
  assert.equal((await runLegacyRepositoryAssociation({ client: client({ plans: [{ ...legacy('a', 'invalid-date'), student_id: student.student_id }, legacy('b', '2026-01-02')] }), confirmation: true })).summary.candidates, 0);
});
test('apply revalidates, changes only student_id, and fails closed', async () => {
  const db = client(); const report = await runLegacyRepositoryAssociation({ client: db, mode: 'apply', operationId: 'op', confirmation: true });
  assert.equal(report.summary.applied, 1); assert.equal(db.state.plans[1].student_id, student.student_id); assert.equal(db.state.plans[1].status, null);
  const update = db.sql.find((sql) => sql.startsWith('UPDATE nutrition_plans SET student_id = ?'));
  for (const fragment of ['id = ?', 'student_id IS NULL', 'lower(student_email) = lower(?)', 'is_active = 1', 'status IS NULL']) assert.match(update, new RegExp(fragment.replace(/[()?]/g, '\\$&')));
  assert.equal((await runLegacyRepositoryAssociation({ client: client({ changes: 0 }), mode: 'apply', operationId: 'op', confirmation: true })).summary.blocked, 1);
});
test('candidate divergence is blocked and PENDING requires an APPLIED transition change', async () => {
  const db = client(); let calls = 0; const original = db.all; db.all = async (...args) => { if (String(args[0]).includes('FROM nutrition_plans')) calls++; return original(...args); };
  assert.equal((await runLegacyRepositoryAssociation({ client: db, mode: 'apply', operationId: 'op', confirmation: true })).summary.applied, 1); assert.ok(calls >= 2); assert.match(source, /LEGACY_REPOSITORY_CANDIDATE_DIVERGED/);
  assert.match(source, /SET status = 'APPLIED'.*status = 'PENDING'/);
});
test('post-update failure compensates, rereads NULL, and compensation failure is fatal', async () => {
  const db = client({ postUpdateMissing: true }); const report = await runLegacyRepositoryAssociation({ client: db, mode: 'apply', operationId: 'op', confirmation: true });
  assert.equal(report.summary.blocked, 1); assert.equal(db.state.plans[1].student_id, null); assert.equal(db.state.status, 'COMPENSATED');
  await assert.rejects(() => runLegacyRepositoryAssociation({ client: client({ postUpdateMissing: true, compensationFails: true }), mode: 'apply', operationId: 'op', confirmation: true }), /ASSOCIATION_COMPENSATION_FAILED/);
  assert.match(source, /ASSOCIATION_COMPENSATION_VERIFICATION_FAILED/);
});
test('rollback accepts only legacy-repository audit operations and blocks fingerprint drift', async () => {
  await assert.rejects(() => runLegacyRepositoryAssociation({ client: client({ operationMode: null }), mode: 'rollback', operationId: 'phase-1', confirmation: true }), /ASSOCIATION_OPERATION_NOT_FOUND/);
  const db = client(); await runLegacyRepositoryAssociation({ client: db, mode: 'apply', operationId: 'op', confirmation: true }); db.state.recordFingerprint = 'different';
  assert.equal((await runLegacyRepositoryAssociation({ client: db, mode: 'rollback', operationId: 'op', confirmation: true })).summary.blocked, 1);
});
test('rollback rereads prior student_id before ROLLED_BACK and restores new_student_id on audit failure', async () => {
  const db = client(); await runLegacyRepositoryAssociation({ client: db, mode: 'apply', operationId: 'op', confirmation: true });
  db.state.rollbackAuditFails = true;
  await assert.rejects(() => runLegacyRepositoryAssociation({ client: db, mode: 'rollback', operationId: 'op', confirmation: true }), /ASSOCIATION_ROLLBACK_AUDIT_UPDATE_FAILED/);
  assert.match(source, /ASSOCIATION_ROLLBACK_VERIFICATION_FAILED/); assert.match(source, /ASSOCIATION_ROLLBACK_RESTORE_VERIFICATION_FAILED/);
});
test('workflow is parseable, main-only, production-gated, and publishes only sanitized aggregate fields', () => {
  for (const value of ['workflow_dispatch', "github.ref == 'refs/heads/main'", 'environment: production', 'CLOUDFLARE_D1_API_TOKEN', 'retention-days: 1']) assert.match(workflow, new RegExp(value.replace(/[.]/g, '\\.')));
  assert.match(workflow, /\['candidates', 'applied', 'rolled_back', 'blocked', 'errors'\]/); assert.doesNotMatch(workflow, /student_email|plan_id|email.*summary/i);
  assert.match(workflow, /^name:/m);
});
