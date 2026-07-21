import { createHash } from 'node:crypto';

const READ_PREFIX = /^(SELECT|WITH)\b/i;
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|VACUUM|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|PRAGMA)\b/i;
const HASH_DOMAIN = 'portal-lm:premium-nutrition-plan-candidate-discovery:v1:';
const CANDIDATE_COLUMNS = ['id', 'student_id', 'student_email', 'status', 'is_active', 'created_at', 'updated_at', 'published_at', 'version_number'];
const TIMESTAMP_COLUMNS = ['published_at', 'updated_at', 'created_at'];

export function assertReadOnlySql(sql) {
  const value = String(sql ?? '').trim();
  const normalized = value.replace(/;\s*$/, '');
  if (!value || (value !== normalized && /;\s*\S/.test(value)) || normalized.includes(';') || !READ_PREFIX.test(normalized) || FORBIDDEN.test(normalized)) throw new Error('DIAGNOSTIC_WRITE_SQL_BLOCKED');
  return normalized;
}
export function stableEmailHash(email) { return createHash('sha256').update(`${HASH_DOMAIN}${String(email ?? '').trim().toLowerCase()}`).digest('hex'); }
export function opaquePlanId(id) { return createHash('sha256').update(`${HASH_DOMAIN}plan:${String(id ?? '')}`).digest('hex').slice(0, 16); }

/** Parses only column declarations from the CREATE TABLE SQL returned by sqlite_schema. */
export function discoverNutritionPlanColumns(createSql) {
  const body = String(createSql ?? '').match(/CREATE\s+TABLE[^(]*\(([\s\S]*)\)\s*$/i)?.[1] ?? '';
  const columns = new Set();
  for (const part of body.split(/,(?![^()]*\))/)) {
    const name = part.trim().match(/^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w]*))/)?.slice(1).find(Boolean);
    if (name && !/^(PRIMARY|UNIQUE|CONSTRAINT|FOREIGN|CHECK)$/i.test(name)) columns.add(name);
  }
  return CANDIDATE_COLUMNS.filter((column) => columns.has(column));
}
function dateValue(value) { const time = Date.parse(String(value ?? '')); return Number.isFinite(time) ? time : null; }
function planView(plan, columns) {
  const timestamps = Object.fromEntries(TIMESTAMP_COLUMNS.filter((key) => columns.includes(key) && plan[key] != null).map((key) => [key, plan[key]]));
  return { opaque_plan_id: opaquePlanId(plan.id), status: columns.includes('status') ? (plan.status ?? 'LEGACY_NULL_STATUS') : 'LEGACY_NO_STATUS_COLUMN', is_active: columns.includes('is_active') ? (plan.is_active ?? null) : null, timestamps, version: columns.includes('version_number') ? (plan.version_number ?? null) : null, current_link: plan.student_id ? 'student_id' : plan.student_email ? 'student_email' : 'unlinked' };
}
function newestLegacy(legacy, columns) {
  for (const column of TIMESTAMP_COLUMNS) {
    if (!columns.includes(column)) continue;
    const dated = legacy.map((plan) => ({ plan, time: dateValue(plan[column]) }));
    if (dated.every(({ time }) => time !== null)) {
      const latest = Math.max(...dated.map(({ time }) => time));
      const winners = dated.filter(({ time }) => time === latest);
      if (winners.length === 1) return { plan: winners[0].plan, column };
      return null;
    }
  }
  return null;
}
export function classifyStudent({ student, plans = [], columns = CANDIDATE_COLUMNS } = {}) {
  const legacy = plans.filter((plan) => !columns.includes('status') || plan.status == null);
  const modern = plans.filter((plan) => columns.includes('status') && plan.status != null);
  const drafts = modern.filter((plan) => plan.status === 'DRAFT');
  const base = { student_id: student.student_id, stable_email_hash: stableEmailHash(student.email), total_plans: plans.length, legacy_plans: legacy.length, workspace_lifecycle_plans: modern.length, opaque_plan_ids: plans.map((plan) => opaquePlanId(plan.id)), plans: plans.map((plan) => planView(plan, columns)), candidate_current_plan_id: null, selection_reason: null, confidence: 'BLOCKED', historical_plan_ids: [], modern_draft_conflict: legacy.length > 0 && drafts.length > 0, recommended_action: 'No association; review-only.' };
  if (!plans.length) return { ...base, category: 'NO_PLAN', selection_reason: 'No nutrition_plans record matched this canonical student.', recommended_action: 'No association needed; investigate only if a plan is expected.' };
  if (legacy.length && drafts.length) return { ...base, category: 'MODERN_DRAFT_CONFLICT', selection_reason: 'Legacy plan(s) and modern DRAFT record(s) coexist; DRAFT is not treated as published.', recommended_action: 'Manual review required; do not choose a prevailing plan automatically.' };
  if (!legacy.length && drafts.length === modern.length) return { ...base, category: 'MODERN_DRAFT_ONLY', selection_reason: 'Only modern DRAFT record(s) matched; DRAFT is not a published current plan.', recommended_action: 'No legacy association candidate; continue workspace review.' };
  if (legacy.length === 1 && plans.length === 1) return { ...base, category: 'SINGLE_LEGACY_CANDIDATE', candidate_current_plan_id: opaquePlanId(legacy[0].id), selection_reason: 'Exactly one legacy plan matched.', confidence: 'HIGH', recommended_action: 'Eligible for future safe association after separate approval.' };
  if (legacy.length > 1) {
    const selected = newestLegacy(legacy, columns);
    if (selected) return { ...base, category: 'DETERMINISTIC_MULTIPLE_CANDIDATE', candidate_current_plan_id: opaquePlanId(selected.plan.id), selection_reason: `Unique latest legacy ${selected.column} selected; all legacy timestamps were valid.`, confidence: 'MEDIUM', historical_plan_ids: legacy.filter((plan) => plan !== selected.plan).map((plan) => opaquePlanId(plan.id)), recommended_action: 'Eligible for future association only after review of historical records.' };
    return { ...base, category: 'AMBIGUOUS_MULTIPLE_PLANS', selection_reason: 'Multiple legacy plans lack a complete, unique reliable temporal order.', historical_plan_ids: legacy.map((plan) => opaquePlanId(plan.id)), recommended_action: 'Manual review required; do not associate automatically.' };
  }
  return { ...base, category: 'AMBIGUOUS_MULTIPLE_PLANS', selection_reason: 'Legacy and non-DRAFT lifecycle records cannot be safely compared.', historical_plan_ids: legacy.map((plan) => opaquePlanId(plan.id)), recommended_action: 'Manual review required; do not associate automatically.' };
}
export function buildReport({ students = [], plansByStudent = new Map(), columns = CANDIDATE_COLUMNS, errors = [] } = {}) {
  const students_report = students.map((student) => classifyStudent({ student, plans: plansByStudent.get(student.student_id) ?? [], columns }));
  const summary = { premium_students: students.length, single_legacy_candidate: 0, deterministic_multiple_candidate: 0, ambiguous_multiple_plans: 0, modern_draft_only: 0, modern_draft_conflict: 0, no_plan: 0, total_legacy_plans: 0, total_modern_drafts: 0, eligible_for_safe_association: 0, blocked: 0, errors: errors.length };
  for (const row of students_report) { summary.total_legacy_plans += row.legacy_plans; summary.total_modern_drafts += row.plans.filter((plan) => plan.status === 'DRAFT').length; const key = row.category.toLowerCase(); if (key in summary) summary[key]++; if (row.confidence !== 'BLOCKED') summary.eligible_for_safe_association++; else summary.blocked++; }
  return { summary, schema: { nutrition_plans_columns: columns }, students: students_report, findings: errors.map(() => ({ type: 'READ_ERROR', recommended_action: 'Retry this read-only diagnostic.' })) };
}
export function createReadOnlyD1Client({ token, accountId, databaseId, fetchImpl = globalThis.fetch } = {}) { if (!token || !accountId || !databaseId) throw new Error('CLOUDFLARE_D1_CONFIGURATION_MISSING'); const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`; return Object.freeze({ async all(sql, params = []) { assertReadOnlySql(sql); const response = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) }); const body = await response.json(); if (!response.ok || body.success === false) throw new Error('CLOUDFLARE_D1_READ_FAILED'); return (Array.isArray(body.result) ? body.result[0] : body.result)?.results ?? []; } }); }
export async function runDiscovery({ client }) {
  const schemaRows = await client.all("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'nutrition_plans'");
  const columns = discoverNutritionPlanColumns(schemaRows[0]?.sql);
  for (const required of ['id', 'student_id', 'student_email']) if (!columns.includes(required)) throw new Error('NUTRITION_PLANS_SCHEMA_INCOMPLETE');
  const students = await client.all("SELECT student_id, email FROM premium_students WHERE access_status = 'ACTIVE'");
  const selected = CANDIDATE_COLUMNS.filter((column) => columns.includes(column)).join(', ');
  const plansByStudent = new Map();
  for (const student of students) plansByStudent.set(student.student_id, await client.all(`SELECT ${selected} FROM nutrition_plans WHERE student_id = ? OR lower(student_id) = lower(?) OR (student_id IS NULL AND lower(student_email) = lower(?))`, [student.student_id, student.email, student.email]));
  return buildReport({ students, plansByStudent, columns });
}
if (import.meta.url === `file://${process.argv[1]}`) { try { process.stdout.write(`${JSON.stringify(await runDiscovery({ client: createReadOnlyD1Client({ token: process.env.CLOUDFLARE_D1_API_TOKEN, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID }) }), null, 2)}\n`); } catch (error) { process.stderr.write(`${error?.message === 'DIAGNOSTIC_WRITE_SQL_BLOCKED' ? error.message : 'PREMIUM_NUTRITION_CANDIDATE_DISCOVERY_FAILED'}\n`); process.exitCode = 1; } }
