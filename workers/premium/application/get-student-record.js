export function createGetStudentRecordUseCase({ studentRepository, studentRecordRepository, identityService }) {
  return async function getStudentRecord({ student_id }) {
    if (!student_id) return { ok: false, error: 'student_id é obrigatório.', status: 400 };
    const fallbackStudent = identityService ? null : await studentRepository.findByStudentId(student_id);
    const identity = identityService ? await identityService.resolveIdentifier(student_id) : { ok: Boolean(fallbackStudent), student: fallbackStudent };
    if (!identity.ok) return { ok: false, error: 'Aluno Premium não encontrado.', status: 404 };
    const canonicalStudentId = identity.student.student_id;
    const [student, anamnesis, nutrition_plan, feedbacks, followup_entries] = await Promise.all([studentRecordRepository.getStudentHeader(canonicalStudentId), studentRecordRepository.getAnamnesis(canonicalStudentId), studentRecordRepository.getNutritionPlanWorkflow(canonicalStudentId), studentRecordRepository.listRecentFeedbacks(canonicalStudentId, { limit: 12 }), studentRecordRepository.listFollowupEntries(canonicalStudentId, { limit: 50 })]);
    const [summary, pending_items] = await Promise.all([studentRecordRepository.getCurrentSummary(canonicalStudentId), studentRecordRepository.listPendingItems(canonicalStudentId)]);
    return { ok: true, data: { student, summary, anamnesis, nutrition_plan, feedbacks, followup_entries, pending_items } };
  };
}
