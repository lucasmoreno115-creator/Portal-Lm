#!/usr/bin/env node
import fs from 'node:fs';
const input = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : [];
function add(map, key, value) { if (!key) return; map.set(key, [...(map.get(key) || []), value]); }
export function auditNutritionPlanLifecycle({ nutrition_plans = [], premium_students = [], student_access = [] } = {}) {
  const conflicts = [];
  const premiumIds = new Set(premium_students.map((s) => s.student_id).filter(Boolean));
  const activeByStudent = new Map();
  const publishedByStudent = new Map();
  const draftByStudent = new Map();
  const emailToIds = new Map();
  for (const plan of nutrition_plans) {
    const isActive = Number(plan.is_active) === 1;
    if (isActive && plan.student_id) add(activeByStudent, plan.student_id, plan.id);
    if (plan.status === 'PUBLISHED') add(publishedByStudent, plan.student_id, plan.id);
    if (plan.status === 'DRAFT') add(draftByStudent, plan.student_id, plan.id);
    if (isActive && !plan.student_id) conflicts.push({ type: 'ACTIVE_WITHOUT_STUDENT_ID', plan_id: plan.id, student_email: plan.student_email });
    if (plan.status === 'DRAFT' && !plan.student_id) conflicts.push({ type: 'DRAFT_WITHOUT_STUDENT_ID', plan_id: plan.id, student_email: plan.student_email });
    if (plan.student_email && plan.student_id) emailToIds.set(plan.student_email.toLowerCase(), new Set([...(emailToIds.get(plan.student_email.toLowerCase()) || []), plan.student_id]));
    if (isActive && plan.student_id && premiumIds.size && !premiumIds.has(plan.student_id)) conflicts.push({ type: 'ACTIVE_NON_PREMIUM_STUDENT', plan_id: plan.id, student_id: plan.student_id });
    if ((plan.status === 'ARCHIVED' || plan.status === 'DRAFT') && isActive) conflicts.push({ type: 'STATUS_IS_ACTIVE_MISMATCH', plan_id: plan.id, status: plan.status, is_active: plan.is_active });
    if (plan.status === 'PUBLISHED' && !isActive) conflicts.push({ type: 'STATUS_IS_ACTIVE_MISMATCH', plan_id: plan.id, status: plan.status, is_active: plan.is_active });
  }
  for (const [student_id, ids] of activeByStudent) if (ids.length > 1) conflicts.push({ type: 'MULTIPLE_ACTIVE_BY_STUDENT_ID', student_id, plan_ids: ids });
  for (const [student_id, ids] of publishedByStudent) if (!student_id || ids.length > 1) conflicts.push({ type: 'MULTIPLE_PUBLISHED_BY_STUDENT_ID', student_id, plan_ids: ids });
  for (const [student_id, ids] of draftByStudent) if (!student_id || ids.length > 1) conflicts.push({ type: 'MULTIPLE_DRAFTS_BY_STUDENT_ID', student_id, plan_ids: ids });
  for (const [email, ids] of emailToIds) if (ids.size > 1) conflicts.push({ type: 'EMAIL_DIVERGENT_STUDENT_IDS', student_email: email, student_ids: [...ids] });
  const projectEmails = new Set(student_access.filter((a) => /projeto|project|lm2/i.test(`${a.plan || ''} ${a.plan_type || ''}`)).map((a) => String(a.email || '').toLowerCase()));
  for (const plan of nutrition_plans) if (Number(plan.is_active) === 1 && projectEmails.has(String(plan.student_email || '').toLowerCase())) conflicts.push({ type: 'ACTIVE_PROJECT_LM_ACCESS', plan_id: plan.id, student_email: plan.student_email });
  return { ok: conflicts.length === 0, blocking_conflicts: conflicts.length, conflicts };
}
if (import.meta.url === `file://${process.argv[1]}`) { const report = auditNutritionPlanLifecycle(Array.isArray(input) ? { nutrition_plans: input } : input); console.log(JSON.stringify(report, null, 2)); process.exit(report.ok ? 0 : 1); }
