import { createHash, randomUUID } from 'node:crypto';
import { classifyStudent, discoverNutritionPlanColumns } from './diagnose-premium-nutrition-plan-candidates.mjs';

const AUDIT_DDL = [
  `CREATE TABLE IF NOT EXISTS premium_nutrition_plan_association_operations (operation_id TEXT PRIMARY KEY, mode TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS premium_nutrition_plan_association_records (operation_id TEXT NOT NULL, plan_id TEXT NOT NULL, previous_student_id TEXT, new_student_id TEXT NOT NULL, plan_fingerprint TEXT NOT NULL, applied_at TEXT, rolled_back_at TEXT, status TEXT NOT NULL CHECK(status IN ('PENDING', 'APPLIED', 'COMPENSATED', 'ROLLED_BACK', 'FAILED')), PRIMARY KEY(operation_id, plan_id), FOREIGN KEY(operation_id) REFERENCES premium_nutrition_plan_association_operations(operation_id))`,
  `CREATE INDEX IF NOT EXISTS idx_premium_nutrition_plan_association_records_operation_status ON premium_nutrition_plan_association_records(operation_id, status)`,
];
const REQUIRED_COLUMNS = ['id', 'student_id', 'student_email', 'status'];
const now = () => new Date().toISOString();
const fingerprint = (plan) => createHash('sha256').update(JSON.stringify([plan.id, String(plan.student_email ?? '').trim().toLowerCase(), plan.status ?? null, plan.updated_at ?? null, plan.created_at ?? null])).digest('hex');
const rows = (value) => Array.isArray(value) ? value : [];
const changedExactlyOne = (result) => result?.meta?.changes === 1;
const fatal = (code) => { const error = new Error(code); error.fatal = true; return error; };

export function sanitizedReport({ mode, operationId = null, applied = 0, rolledBack = 0, blocked = 0, candidates = 0 } = {}) {
  return { mode, operation_id: operationId, summary: { candidates, applied, rolled_back: rolledBack, blocked } };
}
export async function ensureAuditSchema(client) { for (const sql of AUDIT_DDL) await client.execute(sql); }
export async function nutritionPlanColumns(client) {
  const schema = rows(await client.all("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'nutrition_plans'"))[0]?.sql;
  const columns = discoverNutritionPlanColumns(schema);
  if (!REQUIRED_COLUMNS.every((column) => columns.includes(column))) throw new Error('NUTRITION_PLANS_SCHEMA_INCOMPLETE');
  return columns;
}
async function revalidateCandidate(client, candidate) {
  const active = rows(await client.all("SELECT student_id, email FROM premium_students WHERE student_id = ? AND access_status = 'ACTIVE'", [candidate.student_id]));
  if (active.length !== 1) throw new Error('CANDIDATE_NOT_ACTIVE');
  const identities = rows(await client.all('SELECT student_id, email FROM premium_students WHERE lower(email) = lower(?)', [candidate.email]));
  if (identities.length !== 1 || identities[0].student_id !== candidate.student_id) throw new Error('CANDIDATE_EMAIL_NOT_UNIQUE');
  const plans = rows(await client.all('SELECT id, student_id, student_email, status, created_at, updated_at FROM nutrition_plans WHERE lower(student_email) = lower(?)', [candidate.email]));
  if (plans.length !== 1) throw new Error('CANDIDATE_PLAN_NOT_UNIQUE');
  if (rows(await client.all('SELECT id FROM nutrition_plans WHERE student_id = ?', [candidate.student_id])).length !== 0) throw new Error('CANDIDATE_STUDENT_ALREADY_ASSOCIATED');
  const plan = plans[0];
  if (plan.student_id != null || plan.status != null) throw new Error('CANDIDATE_MODERN_LIFECYCLE');
  if (classifyStudent({ student: candidate, plans }).category !== 'SINGLE_LEGACY_CANDIDATE') throw new Error('CANDIDATE_NO_LONGER_SINGLE_LEGACY');
  return { student: active[0], plan };
}
async function candidates(client) {
  const students = rows(await client.all("SELECT student_id, email FROM premium_students WHERE access_status = 'ACTIVE'"));
  const output = [];
  for (const student of students) {
    const plans = rows(await client.all('SELECT id, student_id, student_email, status, created_at, updated_at FROM nutrition_plans WHERE lower(student_email) = lower(?)', [student.email]));
    if (classifyStudent({ student, plans }).category === 'SINGLE_LEGACY_CANDIDATE') output.push(student);
  }
  return output;
}
async function transitionAudit(client, sql, params, failureCode) {
  if (!changedExactlyOne(await client.execute(sql, params))) throw fatal(failureCode);
}
async function compensateApply(client, { operationId, plan, student, clock }) {
  if (!changedExactlyOne(await client.execute('UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id = ?', [plan.student_id, plan.id, student.student_id]))) throw fatal('ASSOCIATION_COMPENSATION_FAILED');
  const after = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [plan.id]));
  if (after.length !== 1 || after[0].student_id !== plan.student_id) throw fatal('ASSOCIATION_COMPENSATION_VERIFICATION_FAILED');
  await transitionAudit(client, "UPDATE premium_nutrition_plan_association_records SET status = 'COMPENSATED', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), operationId, plan.id], 'ASSOCIATION_COMPENSATION_AUDIT_FAILED');
}
async function failPendingAudit(client, { operationId, plan, clock }) {
  await transitionAudit(client, "UPDATE premium_nutrition_plan_association_records SET status = 'FAILED', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), operationId, plan.id], 'ASSOCIATION_FAILED_AUDIT_UPDATE_FAILED');
}
async function restoreRollback(client, { record, plan }) {
  if (!changedExactlyOne(await client.execute('UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id IS NULL AND lower(student_email) = lower(?) AND status IS NULL', [record.new_student_id, record.plan_id, plan.student_email]))) throw fatal('ASSOCIATION_ROLLBACK_RESTORE_FAILED');
  const after = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [record.plan_id]));
  if (after.length !== 1 || after[0].student_id !== record.new_student_id) throw fatal('ASSOCIATION_ROLLBACK_RESTORE_VERIFICATION_FAILED');
}

export async function runAssociation({ client, mode = 'dry-run', operationId = null, confirmation = false, clock = now } = {}) {
  if (!['dry-run', 'apply', 'rollback'].includes(mode)) throw new Error('ASSOCIATION_MODE_INVALID');
  if (confirmation !== true) throw new Error('ASSOCIATION_CONFIRMATION_REQUIRED');
  await nutritionPlanColumns(client);
  if (mode === 'dry-run') {
    const found = await candidates(client);
    return sanitizedReport({ mode, candidates: found.length });
  }
  await ensureAuditSchema(client);
  if (mode === 'apply') {
    const id = operationId || randomUUID();
    const found = await candidates(client);
    await client.execute('INSERT INTO premium_nutrition_plan_association_operations (operation_id, mode, created_at) VALUES (?, ?, ?)', [id, 'apply', clock()]);
    let applied = 0; let blocked = 0;
    for (const candidate of found) {
      let association = null; let auditPending = false; let planUpdated = false;
      try {
        const { student, plan } = await revalidateCandidate(client, candidate);
        association = { student, plan };
        await client.execute('INSERT INTO premium_nutrition_plan_association_records (operation_id, plan_id, previous_student_id, new_student_id, plan_fingerprint, status) VALUES (?, ?, ?, ?, ?, ?)', [id, plan.id, plan.student_id, student.student_id, fingerprint(plan), 'PENDING']);
        auditPending = true;
        const result = await client.execute('UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id IS NULL AND lower(student_email) = lower(?) AND status IS NULL', [student.student_id, plan.id, student.email]);
        if (!changedExactlyOne(result)) { await failPendingAudit(client, { operationId: id, plan, clock }); blocked++; continue; }
        planUpdated = true;
        const after = rows(await client.all('SELECT id, student_id, student_email, status, created_at, updated_at FROM nutrition_plans WHERE id = ?', [plan.id]));
        if (after.length !== 1 || after[0].student_id !== student.student_id) throw new Error('ASSOCIATION_POST_UPDATE_VERIFICATION_FAILED');
        await transitionAudit(client, "UPDATE premium_nutrition_plan_association_records SET status = 'APPLIED', applied_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), id, plan.id], 'ASSOCIATION_APPLIED_AUDIT_UPDATE_FAILED');
        applied++;
      } catch (error) {
        try {
          if (planUpdated) await compensateApply(client, { operationId: id, ...association, clock });
          else if (auditPending) await failPendingAudit(client, { operationId: id, plan: association.plan, clock });
          else if (error?.fatal) throw error;
        } catch (cleanupError) { throw cleanupError?.fatal ? cleanupError : fatal('ASSOCIATION_CLEANUP_FAILED'); }
        blocked++;
      }
    }
    return sanitizedReport({ mode, operationId: id, candidates: found.length, applied, blocked });
  }
  if (!operationId) throw new Error('ASSOCIATION_OPERATION_ID_REQUIRED');
  const operation = rows(await client.all('SELECT operation_id FROM premium_nutrition_plan_association_operations WHERE operation_id = ?', [operationId]));
  if (operation.length !== 1) throw new Error('ASSOCIATION_OPERATION_NOT_FOUND');
  const records = rows(await client.all("SELECT operation_id, plan_id, previous_student_id, new_student_id, plan_fingerprint FROM premium_nutrition_plan_association_records WHERE operation_id = ? AND status = 'APPLIED'", [operationId]));
  if (!records.length) throw new Error('ASSOCIATION_NOTHING_TO_ROLLBACK');
  let rolledBack = 0; let blocked = 0;
  for (const record of records) {
    const plan = rows(await client.all('SELECT id, student_id, student_email, status, created_at, updated_at FROM nutrition_plans WHERE id = ?', [record.plan_id]))[0];
    if (!plan || plan.student_id !== record.new_student_id || plan.status != null || fingerprint(plan) !== record.plan_fingerprint) { blocked++; continue; }
    const result = await client.execute('UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id = ? AND lower(student_email) = lower(?) AND status IS NULL', [record.previous_student_id, record.plan_id, record.new_student_id, plan.student_email]);
    if (result?.meta?.changes !== 1) { blocked++; continue; }
    const after = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [record.plan_id]));
    if (after.length !== 1 || after[0].student_id !== record.previous_student_id) { await restoreRollback(client, { record, plan }); blocked++; continue; }
    try { await transitionAudit(client, "UPDATE premium_nutrition_plan_association_records SET status = 'ROLLED_BACK', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'APPLIED'", [clock(), operationId, record.plan_id], 'ASSOCIATION_ROLLED_BACK_AUDIT_UPDATE_FAILED'); }
    catch (error) { await restoreRollback(client, { record, plan }); blocked++; continue; }
    rolledBack++;
  }
  return sanitizedReport({ mode, operationId, rolledBack, blocked });
}
export function createD1Client({ token, accountId, databaseId, fetchImpl = globalThis.fetch } = {}) {
  if (!token || !accountId || !databaseId) throw new Error('CLOUDFLARE_D1_CONFIGURATION_MISSING');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  async function query(sql, params = []) { const response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) }); const body = await response.json(); if (!response.ok || body.success === false) throw new Error('CLOUDFLARE_D1_QUERY_FAILED'); return (Array.isArray(body.result) ? body.result[0] : body.result) ?? {}; }
  return Object.freeze({ async all(sql, params) { return (await query(sql, params)).results ?? []; }, async execute(sql, params) { return query(sql, params); } });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  try { const report = await runAssociation({ client: createD1Client({ token: process.env.CLOUDFLARE_D1_API_TOKEN, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID }), mode: process.env.ASSOCIATION_MODE, operationId: process.env.ASSOCIATION_OPERATION_ID || null, confirmation: process.env.ASSOCIATION_CONFIRMATION === 'APPLY_PREMIUM_NUTRITION_PLAN_ASSOCIATION_PHASE1' }); process.stdout.write(`${JSON.stringify(report)}\n`); } catch { process.stderr.write('PREMIUM_NUTRITION_PLAN_ASSOCIATION_PHASE1_FAILED\n'); process.exitCode = 1; }
}
