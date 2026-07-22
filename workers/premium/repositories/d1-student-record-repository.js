import { isAnalyzedCoachStatus } from '../domain/feedback-status.js';
function rows(result) { return result?.results ?? []; }
function parseJson(value, fallback) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
export function createD1StudentRecordRepository(db) {
  return Object.freeze({
    async getStudentHeader(studentId) {
      const student = await db.prepare(`SELECT ps.student_id, ps.email, ps.display_name, ps.consultation_status, ps.access_status, ps.created_at, ps.updated_at, sa.name, sa.whatsapp, sa.status AS portal_access_status FROM premium_students ps LEFT JOIN student_access sa ON sa.student_id=ps.student_id WHERE ps.student_id=? LIMIT 1`).bind(studentId).first();
      if (!student) return null;
      const last = await db.prepare(`SELECT MAX(created_at) AS last_activity_at FROM (SELECT created_at FROM premium_anamnesis WHERE student_id=? UNION ALL SELECT created_at FROM student_checkins WHERE student_id=? UNION ALL SELECT updated_at AS created_at FROM nutrition_plans WHERE student_id=? UNION ALL SELECT created_at FROM premium_followup_entries WHERE student_id=?)`).bind(studentId, studentId, studentId, studentId).first();
      return { ...student, name: student.display_name || student.name || '', phone: student.whatsapp || null, last_activity_at: last?.last_activity_at || null };
    },
    async getAnamnesis(studentId) { const row = await db.prepare(`SELECT id, student_id, student_name, student_email, student_phone, status, answers_json, created_at, updated_at FROM premium_anamnesis WHERE student_id=? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`).bind(studentId).first(); return row ? { ...row, answers: parseJson(row.answers_json, {}) } : null; },
    async getNutritionPlanWorkflow(studentId) { const result = await db.prepare(`SELECT id, student_id, student_email, title, goal, strategy, status, version_number, published_at, updated_at, created_at FROM nutrition_plans WHERE student_id=? AND (status='DRAFT' OR (status='PUBLISHED' AND is_active=1)) ORDER BY CASE status WHEN 'DRAFT' THEN 0 ELSE 1 END, datetime(updated_at) DESC LIMIT 2`).bind(studentId).all(); const plans = rows(result); const legacy = await db.prepare("SELECT id FROM nutrition_plans WHERE status IS NULL AND is_active=1 AND (student_id=? OR (student_id IS NULL AND lower(trim(student_email))=(SELECT lower(trim(email)) FROM premium_students WHERE student_id=?))) LIMIT 1").bind(studentId, studentId).first(); return { current: plans.find((plan) => plan.status === 'PUBLISHED') || null, draft: plans.find((plan) => plan.status === 'DRAFT') || null, legacy_available: Boolean(legacy) }; },
    async getCurrentNutritionPlan(studentId) { return (await this.getNutritionPlanWorkflow(studentId)).current; },
    async listRecentFeedbacks(studentId, { limit = 12, offset = 0 } = {}) { return rows(await db.prepare(`SELECT id, student_id, student_email, week_ref, training_adherence, nutrition_adherence, cardio_adherence, sleep_quality, energy_level, stress_level, weekly_weight, waist, main_difficulty, support_needed, coach_status, coach_reply, coach_reply_at, reviewed_at, reviewed_by, created_at FROM student_checkins WHERE student_id=? ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?`).bind(studentId, limit, offset).all()); },
    async listFollowupEntries(studentId, { limit = 50, offset = 0 } = {}) { return rows(await db.prepare(`SELECT * FROM premium_followup_entries WHERE student_id=? ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?`).bind(studentId, limit, offset).all()); },
    async listPendingItems(studentId, { status = 'OPEN', limit = 100 } = {}) { return rows(await db.prepare(`SELECT * FROM premium_pending_items WHERE student_id=? AND status=? ORDER BY CASE priority WHEN 'HIGH' THEN 0 ELSE 1 END, datetime(created_at) DESC LIMIT ?`).bind(studentId, status, limit).all()); },
    async getCurrentSummary(studentId) {
      const [student, anamnesis, workflow, feedbacks, pending, decision] = await Promise.all([this.getStudentHeader(studentId), this.getAnamnesis(studentId), this.getNutritionPlanWorkflow(studentId), this.listRecentFeedbacks(studentId, { limit: 12 }), this.listPendingItems(studentId), db.prepare(`SELECT * FROM premium_followup_entries WHERE student_id=? AND entry_type='PROFESSIONAL_DECISION' ORDER BY datetime(created_at) DESC LIMIT 1`).bind(studentId).first()]); const plan = workflow.current;
      const unanalyzed = feedbacks.filter((f) => !isAnalyzedCoachStatus(f.coach_status)).length;
      let next = 'Nenhuma ação imediata';
      if (anamnesis && !['ANALISADA', 'ANALYZED'].includes(String(anamnesis.status || '').toUpperCase())) next = 'Anamnese aguardando análise';
      else if (unanalyzed > 0) next = 'Feedback semanal aguardando resposta';
      else if (student?.consultation_status === 'ACTIVE' && !plan) next = 'Plano alimentar ainda não criado';
      else if (pending.length > 0) next = 'Pendência aberta';
      return { consultation_status: student?.consultation_status || null, anamnesis_status: anamnesis?.status || 'NOT_SUBMITTED', has_current_nutrition_plan: Boolean(plan), nutrition_plan_updated_at: plan?.updated_at || null, last_feedback_at: feedbacks[0]?.created_at || null, unanalyzed_feedbacks_count: unanalyzed, open_pending_items_count: pending.length, last_professional_decision: decision || null, next_operational_action: next };
    },
  });
}
