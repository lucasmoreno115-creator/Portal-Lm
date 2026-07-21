import { createHash, randomUUID } from 'node:crypto';
import { opaquePlanId, reviewStudent } from './diagnose-premium-nutrition-plan-blocked-review.mjs';
import { ensureAuditSchema, nutritionPlanColumns, sanitizedReport as phase1SanitizedReport, createD1Client } from './run-premium-nutrition-plan-association-phase1.mjs';

const PLAN_COLUMNS = ['id', 'student_id', 'student_email', 'status', 'is_active', 'version_number', 'created_at', 'updated_at', 'published_at', 'meals_json', 'title', 'goal', 'strategy', 'substitutions_json', 'adherence_rules_json', 'notes', 'private_notes', 'whatsapp_message'];
const CONFIRMATION = 'APPLY_PREMIUM_NUTRITION_PLAN_LEGACY_REPOSITORY_ASSOCIATION';
const rows = (value) => Array.isArray(value) ? value : [];
const now = () => new Date().toISOString();
const changedExactlyOne = (result) => result?.meta?.changes === 1;
const fingerprint = (plan) => createHash('sha256').update(JSON.stringify([plan.id, String(plan.student_email ?? '').trim().toLowerCase(), plan.status ?? null, plan.is_active ?? null, plan.updated_at ?? null, plan.created_at ?? null])).digest('hex');
const fatal = (code) => { const error = new Error(code); error.fatal = true; return error; };
const sanitizedReport = ({ errors = 0, ...report } = {}) => ({ ...phase1SanitizedReport(report), summary: { ...phase1SanitizedReport(report).summary, errors } });

function selectedCandidate(student, plans, columns) {
  const review = reviewStudent({ student, plans, columns });
  if (review?.decision_suggested !== 'LEGACY_EMAIL_SELECTION_REVIEW') return null;
  const selected = review.plans.filter((plan) => plan.legacy_repository_selected_candidate);
  if (selected.length !== 1) return null;
  const selectedPlan = plans.find((item) => opaquePlanId(item.id) === selected[0].opaque_plan_id);
  if (!selectedPlan) return null;
  const modern = plans.filter((item) => item.student_id === student.student_id);
  if (selectedPlan.student_id != null || Number(selectedPlan.is_active) !== 1 || modern.length !== 0) return null;
  return selectedPlan;
}

async function plansForStudent(client, student, columns) {
  const selected = PLAN_COLUMNS.filter((column) => columns.includes(column)).join(', ');
  return rows(await client.all(`SELECT ${selected} FROM nutrition_plans WHERE student_id = ? OR (student_id IS NULL AND lower(student_email) = lower(?))`, [student.student_id, student.email]));
}
async function candidates(client, columns) {
  const students = rows(await client.all("SELECT student_id, email, access_status FROM premium_students WHERE access_status = 'ACTIVE'"));
  const found = [];
  for (const student of students) {
    const plan = selectedCandidate(student, await plansForStudent(client, student, columns), columns);
    if (plan) found.push({ student, plan });
  }
  return found;
}
async function revalidateCandidate(client, candidate, columns) {
  const active = rows(await client.all("SELECT student_id, email, access_status FROM premium_students WHERE student_id = ? AND access_status = 'ACTIVE'", [candidate.student.student_id]));
  if (active.length !== 1 || String(active[0].email).toLowerCase() !== String(candidate.student.email).toLowerCase()) throw new Error('LEGACY_REPOSITORY_CANDIDATE_NOT_ACTIVE');
  const plan = selectedCandidate(active[0], await plansForStudent(client, active[0], columns), columns);
  if (!plan || plan.id !== candidate.plan.id) throw new Error('LEGACY_REPOSITORY_CANDIDATE_DIVERGED');
  return { student: active[0], plan };
}
async function auditTransition(client, sql, params, code) { if (!changedExactlyOne(await client.execute(sql, params))) throw fatal(code); }

export async function runLegacyRepositoryAssociation({ client, mode = 'dry-run', operationId = null, confirmation = false, clock = now } = {}) {
  if (!['dry-run', 'apply', 'rollback'].includes(mode)) throw new Error('ASSOCIATION_MODE_INVALID');
  if (confirmation !== true) throw new Error('ASSOCIATION_CONFIRMATION_REQUIRED');
  const columns = await nutritionPlanColumns(client);
  if (!columns.includes('is_active')) throw new Error('NUTRITION_PLANS_SCHEMA_INCOMPLETE');
  if (mode === 'dry-run') { const found = await candidates(client, columns); return sanitizedReport({ mode, candidates: found.length }); }
  await ensureAuditSchema(client);
  if (mode === 'apply') {
    const id = operationId || randomUUID(); const found = await candidates(client, columns); let applied = 0; let blocked = 0; let errors = 0;
    await client.execute('INSERT INTO premium_nutrition_plan_association_operations (operation_id, mode, created_at) VALUES (?, ?, ?)', [id, 'legacy-repository-apply', clock()]);
    for (const candidate of found) {
      let association; let pending = false; let updated = false;
      try {
        association = await revalidateCandidate(client, candidate, columns);
        await client.execute('INSERT INTO premium_nutrition_plan_association_records (operation_id, plan_id, previous_student_id, new_student_id, plan_fingerprint, status) VALUES (?, ?, ?, ?, ?, ?)', [id, association.plan.id, null, association.student.student_id, fingerprint(association.plan), 'PENDING']); pending = true;
        if (!changedExactlyOne(await client.execute('UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id IS NULL AND lower(student_email) = lower(?) AND is_active = 1 AND status IS NULL', [association.student.student_id, association.plan.id, association.student.email]))) { await auditTransition(client, "UPDATE premium_nutrition_plan_association_records SET status = 'FAILED', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), id, association.plan.id], 'ASSOCIATION_FAILED_AUDIT_UPDATE_FAILED'); blocked++; continue; }
        updated = true;
        const after = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [association.plan.id]));
        if (after.length !== 1 || after[0].student_id !== association.student.student_id) throw new Error('ASSOCIATION_POST_UPDATE_VERIFICATION_FAILED');
        await auditTransition(client, "UPDATE premium_nutrition_plan_association_records SET status = 'APPLIED', applied_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), id, association.plan.id], 'ASSOCIATION_APPLIED_AUDIT_UPDATE_FAILED'); applied++;
      } catch (error) {
        try {
          if (updated) {
            if (!changedExactlyOne(await client.execute('UPDATE nutrition_plans SET student_id = NULL WHERE id = ? AND student_id = ?', [association.plan.id, association.student.student_id]))) throw fatal('ASSOCIATION_COMPENSATION_FAILED');
            const compensated = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [association.plan.id]));
            if (compensated.length !== 1 || compensated[0].student_id !== null) throw fatal('ASSOCIATION_COMPENSATION_VERIFICATION_FAILED');
            await auditTransition(client, "UPDATE premium_nutrition_plan_association_records SET status = 'COMPENSATED', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), id, association.plan.id], 'ASSOCIATION_COMPENSATION_AUDIT_FAILED');
          } else if (pending) await auditTransition(client, "UPDATE premium_nutrition_plan_association_records SET status = 'FAILED', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'PENDING'", [clock(), id, association.plan.id], 'ASSOCIATION_FAILED_AUDIT_UPDATE_FAILED');
          else if (error?.fatal) throw error;
        } catch (cleanup) { throw cleanup?.fatal ? cleanup : fatal('ASSOCIATION_CLEANUP_FAILED'); }
        if (error?.fatal) throw error; blocked++;
      }
    }
    return sanitizedReport({ mode, operationId: id, candidates: found.length, applied, blocked, errors });
  }
  if (!operationId) throw new Error('ASSOCIATION_OPERATION_ID_REQUIRED');
  if (rows(await client.all("SELECT operation_id FROM premium_nutrition_plan_association_operations WHERE operation_id = ? AND mode = 'legacy-repository-apply'", [operationId])).length !== 1) throw new Error('ASSOCIATION_OPERATION_NOT_FOUND');
  const records = rows(await client.all("SELECT operation_id, plan_id, previous_student_id, new_student_id, plan_fingerprint FROM premium_nutrition_plan_association_records WHERE operation_id = ? AND status = 'APPLIED'", [operationId]));
  if (!records.length) throw new Error('ASSOCIATION_NOTHING_TO_ROLLBACK');
  let rolledBack = 0; let blocked = 0;
  for (const record of records) {
    const plan = rows(await client.all('SELECT id, student_id, student_email, status, is_active, created_at, updated_at FROM nutrition_plans WHERE id = ?', [record.plan_id]))[0];
    if (!plan || plan.student_id !== record.new_student_id || plan.status != null || Number(plan.is_active) !== 1 || fingerprint(plan) !== record.plan_fingerprint) { blocked++; continue; }
    if (!changedExactlyOne(await client.execute('UPDATE nutrition_plans SET student_id = NULL WHERE id = ? AND student_id = ? AND lower(student_email) = lower(?) AND is_active = 1 AND status IS NULL', [record.plan_id, record.new_student_id, plan.student_email]))) { blocked++; continue; }
    const reverted = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [record.plan_id]));
    try {
      if (reverted.length !== 1 || reverted[0].student_id !== record.previous_student_id) throw new Error('ASSOCIATION_ROLLBACK_VERIFICATION_FAILED');
      await auditTransition(client, "UPDATE premium_nutrition_plan_association_records SET status = 'ROLLED_BACK', rolled_back_at = ? WHERE operation_id = ? AND plan_id = ? AND status = 'APPLIED'", [clock(), operationId, record.plan_id], 'ASSOCIATION_ROLLED_BACK_AUDIT_UPDATE_FAILED'); rolledBack++;
    }
    catch (error) {
      if (!changedExactlyOne(await client.execute('UPDATE nutrition_plans SET student_id = ? WHERE id = ? AND student_id IS NULL', [record.new_student_id, record.plan_id]))) throw fatal('ASSOCIATION_ROLLBACK_RESTORE_FAILED');
      const restored = rows(await client.all('SELECT student_id FROM nutrition_plans WHERE id = ?', [record.plan_id]));
      if (restored.length !== 1 || restored[0].student_id !== record.new_student_id) throw fatal('ASSOCIATION_ROLLBACK_RESTORE_VERIFICATION_FAILED');
      throw error?.fatal ? error : fatal('ASSOCIATION_ROLLBACK_AUDIT_UPDATE_FAILED');
    }
  }
  return sanitizedReport({ mode, operationId, rolledBack, blocked });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { process.stdout.write(`${JSON.stringify(await runLegacyRepositoryAssociation({ client: createD1Client({ token: process.env.CLOUDFLARE_D1_API_TOKEN, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID }), mode: process.env.ASSOCIATION_MODE, operationId: process.env.ASSOCIATION_OPERATION_ID || null, confirmation: process.env.ASSOCIATION_CONFIRMATION === CONFIRMATION }))}\n`); }
  catch { process.stderr.write('PREMIUM_NUTRITION_PLAN_LEGACY_REPOSITORY_ASSOCIATION_FAILED\n'); process.exitCode = 1; }
}
