import { createHash } from 'node:crypto';

const READ_PREFIX = /^(SELECT|WITH|PRAGMA)\b/i;
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|VACUUM|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH)\b/i;
const HASH_DOMAIN = 'portal-lm:premium-nutrition-plan-discovery:v1:';

export const SOURCES = Object.freeze({
  student_portal: { endpoint: '/api/portal/premium/nutrition-plan/current', handler: 'workers/api.js route handler', service: 'createGetNutritionPlanUseCase', repository: 'createD1NutritionPlanRepository', tables: ['premium_students', 'nutrition_plans'], lookup_keys: ['premium_students.email -> student_id', 'nutrition_plans.student_id', 'fallback nutrition_plans.student_email'], status_rule: "is_active=1 AND (status='PUBLISHED' OR status IS NULL)", fallback: 'Only if identity cannot be resolved; Premium identities use student_id and do not fall back.' },
  workspace: { endpoint: '/api/admin/premium/students/:identifier/nutrition-plan', handler: 'workers/api.js adminNutritionStudentMatch', service: 'createGetCurrentNutritionPlanUseCase', repository: 'createD1NutritionPlanRepository', tables: ['premium_students', 'nutrition_plans'], lookup_keys: ['identifier -> premium_students.student_id', 'nutrition_plans.student_id'], status_rule: "is_active=1 AND (status='PUBLISHED' OR status IS NULL)", fallback: 'None.' },
});

export function assertReadOnlySql(sql) {
  const value = String(sql ?? '').trim();
  const withoutTrailing = value.replace(/;\s*$/, '');
  if (!value || value !== withoutTrailing && /;\s*\S/.test(value) || withoutTrailing.includes(';') || !READ_PREFIX.test(withoutTrailing) || FORBIDDEN.test(withoutTrailing)) throw new Error('DIAGNOSTIC_WRITE_SQL_BLOCKED');
  return withoutTrailing;
}
export function stableEmailHash(email) { return createHash('sha256').update(`${HASH_DOMAIN}${String(email || '').trim().toLowerCase()}`).digest('hex'); }
export function redactReport(report) { return JSON.stringify(report); }

export function classifyStudent({ student, plans = [], profile = null } = {}) {
  const email = String(student.email || '').toLowerCase();
  const byStudentId = plans.filter((p) => p.student_id === student.student_id);
  const byEmailId = plans.filter((p) => String(p.student_id || '').toLowerCase() === email);
  const byEmail = plans.filter((p) => !p.student_id && String(p.student_email || '').toLowerCase() === email);
  const profilePlan = profile?.nutrition_plan_id ? [profile.nutrition_plan_id] : [];
  const all = [...new Map([...byStudentId, ...byEmailId, ...byEmail].map((p) => [p.id, p])).values()];
  let category = 'NO_PLAN_FOUND';
  if (all.length > 1) category = 'MULTIPLE_PLANS';
  else if (byStudentId.length) category = 'WORKSPACE_PLAN_FOUND';
  else if (byEmailId.length) category = 'LEGACY_PLAN_EMAIL_AS_STUDENT_ID';
  else if (byEmail.length) category = 'LEGACY_PLAN_FOUND_BY_EMAIL';
  else if (profilePlan.length) category = 'PROFILE_REFERENCES_PLAN';
  const portalVisible = byStudentId.concat(byEmail).some((p) => Number(p.is_active) === 1 && (p.status === 'PUBLISHED' || p.status == null));
  const workspaceFound = byStudentId.some((p) => Number(p.is_active) === 1 && (p.status === 'PUBLISHED' || p.status == null));
  return { student_id: student.student_id, stable_email_hash: stableEmailHash(email), category, plan_ids: all.map((p) => p.id), tables_found: all.length ? ['nutrition_plans'] : profilePlan.length ? ['lm2_profiles'] : [], association_fields: all.map((p) => ({ student_id: p.student_id || null, student_email: p.student_email ? 'present' : null })), plan_statuses: all.map((p) => p.status ?? 'LEGACY_NULL_STATUS'), schema_versions: all.map((p) => p.status == null ? 'legacy-pre-lifecycle' : 'workspace-lifecycle'), recommended_action: category === 'WORKSPACE_PLAN_FOUND' ? 'NONE' : 'Review-only: confirm a future migration strategy; do not modify this record.', _metrics: { portalVisible, workspaceFound, missingStudentId: byEmail.length > 0, emailAsStudentId: byEmailId.length > 0, profilePlan: profilePlan.length > 0, schemaMismatch: all.some((p) => p.status == null) } };
}

export function buildReport({ students = [], plansByStudent = new Map(), profilesByStudent = new Map(), errors = [] } = {}) {
  const classifications = students.map((student) => classifyStudent({ student, plans: plansByStudent.get(student.student_id) || [], profile: profilesByStudent.get(student.student_id) }));
  const summary = { premium_students: students.length, student_portal_plan_visible: 0, workspace_plan_found: 0, same_plan_source: 0, legacy_plan_without_student_id: 0, legacy_plan_with_email_student_id: 0, legacy_plan_with_student_email: 0, profile_with_nutrition_plan_id: 0, workspace_plan_missing: 0, schema_mismatch: 0, errors: errors.length };
  for (const row of classifications) { const m = row._metrics; summary.student_portal_plan_visible += +m.portalVisible; summary.workspace_plan_found += +m.workspaceFound; summary.same_plan_source += +(m.portalVisible && m.workspaceFound); summary.legacy_plan_without_student_id += +m.missingStudentId; summary.legacy_plan_with_email_student_id += +m.emailAsStudentId; summary.legacy_plan_with_student_email += +m.missingStudentId; summary.profile_with_nutrition_plan_id += +m.profilePlan; summary.workspace_plan_missing += +(m.portalVisible && !m.workspaceFound); summary.schema_mismatch += +m.schemaMismatch; delete row._metrics; }
  return { summary, sources: SOURCES, classifications, findings: errors.map(() => ({ type: 'READ_ERROR', recommended_action: 'Retry the read-only diagnostic.' })) };
}

export function createReadOnlyD1Client({ token, accountId, databaseId, fetchImpl = globalThis.fetch } = {}) {
  if (!token || !accountId || !databaseId) throw new Error('CLOUDFLARE_D1_CONFIGURATION_MISSING');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
  return Object.freeze({ async all(sql, params = []) { assertReadOnlySql(sql); const response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) }); const body = await response.json(); if (!response.ok || body.success === false) throw new Error('CLOUDFLARE_D1_READ_FAILED'); const result = Array.isArray(body.result) ? body.result[0] : body.result; return result?.results || []; } });
}

export async function runDiscovery({ client }) {
  const students = await client.all("SELECT student_id, email FROM premium_students WHERE access_status = 'ACTIVE'");
  const plansByStudent = new Map(), profilesByStudent = new Map();
  for (const student of students) {
    const plans = await client.all('SELECT id, student_id, student_email, status, is_active FROM nutrition_plans WHERE student_id = ? OR lower(student_id) = lower(?) OR (student_id IS NULL AND lower(student_email) = lower(?))', [student.student_id, student.email, student.email]);
    const profiles = await client.all('SELECT student_id, nutrition_plan_id FROM lm2_profiles WHERE student_id = ?', [student.student_id]);
    plansByStudent.set(student.student_id, plans); profilesByStudent.set(student.student_id, profiles[0] || null);
  }
  return buildReport({ students, plansByStudent, profilesByStudent });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { const report = await runDiscovery({ client: createReadOnlyD1Client({ token: process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID }) }); process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); } catch (error) { process.stderr.write(`${error?.message === 'DIAGNOSTIC_WRITE_SQL_BLOCKED' ? 'DIAGNOSTIC_WRITE_SQL_BLOCKED' : 'PREMIUM_NUTRITION_DISCOVERY_FAILED'}\n`); process.exitCode = 1; }
}
