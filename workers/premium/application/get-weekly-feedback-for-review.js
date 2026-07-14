export function createGetWeeklyFeedbackForReviewUseCase({ weeklyFeedbackRepository, pendingItemRepository, followupEntryRepository, scheduleService }) {
  return async ({ id }) => {
    const feedback = await weeklyFeedbackRepository.findById(id);
    if (!feedback?.student_id) return { ok: false, status: 404, error: 'Feedback não encontrado.' };
    const pending = await pendingItemRepository.listOpenByStudentId(feedback.student_id, { limit: 50 });
    const entries = await followupEntryRepository.listByStudentId(feedback.student_id, { limit: 10 });
    return { ok: true, data: { feedback, isLate: scheduleService.isSubmittedLate(feedback.submitted_at ?? feedback.created_at, new Date(feedback.submitted_at ?? feedback.created_at)), pending: pending.filter((p) => p.related_entity_id === id), previousDecision: entries.find((e) => e.entry_type === 'PROFESSIONAL_DECISION') ?? null } };
  };
}
