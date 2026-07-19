import { isAnalyzedCoachStatus } from '../domain/feedback-status.js';
export function createGetStudentRecordUseCase({ studentRepository, studentRecordRepository, pendingItemRepository, randomUUID = crypto.randomUUID }) {
  async function createAutomaticPendingItems(student_id, record) {
    const tasks = [];
    const anamnesisStatus = String(record.anamnesis?.status || '').toUpperCase();
    if (record.anamnesis && !['ANALISADA', 'ANALYZED'].includes(anamnesisStatus)) tasks.push({ type: 'ANALYZE_ANAMNESIS', title: 'Anamnese aguardando análise', related_entity_type: 'premium_anamnesis', related_entity_id: record.anamnesis.id });
    for (const feedback of record.feedbacks || []) {
      if (!isAnalyzedCoachStatus(feedback.coach_status)) tasks.push({ type: 'ANALYZE_WEEKLY_FEEDBACK', title: 'Feedback semanal aguardando análise', related_entity_type: 'student_checkins', related_entity_id: feedback.id });
    }
    if (record.student?.consultation_status === 'ACTIVE' && !record.nutrition_plan) tasks.push({ type: 'CREATE_NUTRITION_PLAN', title: 'Plano alimentar ainda não criado', related_entity_type: 'premium_students', related_entity_id: student_id });
    for (const task of tasks) await pendingItemRepository.create({ id: randomUUID(), student_id, ...task, priority: 'NORMAL', source: 'automatic' });
  }
  return async function getStudentRecord({ student_id }) {
    if (!student_id) return { ok: false, error: 'student_id é obrigatório.', status: 400 };
    const premium = await studentRepository.findByStudentId(student_id); if (!premium) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    const [student, anamnesis, nutrition_plan, feedbacks, followup_entries] = await Promise.all([studentRecordRepository.getStudentHeader(student_id), studentRecordRepository.getAnamnesis(student_id), studentRecordRepository.getNutritionPlanWorkflow(student_id), studentRecordRepository.listRecentFeedbacks(student_id, { limit: 12 }), studentRecordRepository.listFollowupEntries(student_id, { limit: 50 })]);
    const initial = { student, anamnesis, nutrition_plan: nutrition_plan.current, feedbacks, followup_entries };
    await createAutomaticPendingItems(student_id, initial);
    const [summary, pending_items] = await Promise.all([studentRecordRepository.getCurrentSummary(student_id), studentRecordRepository.listPendingItems(student_id)]);
    return { ok: true, data: { student, summary, anamnesis, nutrition_plan, feedbacks, followup_entries, pending_items } };
  };
}
