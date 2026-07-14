import { FeedbackStatus, isFeedbackAnalyzed } from '../domain/feedback-status.js';
export function createGetCurrentWeeklyFeedbackUseCase({ identityService, weeklyFeedbackRepository, scheduleService }) {
  return async function getCurrentWeeklyFeedback({ email, now = new Date() }) {
    const identity = await identityService.resolve({ email });
    if (!identity.ok) return { blocked: true, reason: identity.error };
    const availability = scheduleService.getAvailability(now);
    const existing = await weeklyFeedbackRepository.findByStudentAndWeek(identity.student_id, availability.weekRef);
    const status = !scheduleService.isAvailable(now) && !existing ? FeedbackStatus.NOT_AVAILABLE : isFeedbackAnalyzed(existing?.coach_status) ? FeedbackStatus.ANALYZED : existing?.submitted_at || existing?.created_at ? FeedbackStatus.RESPONDED : FeedbackStatus.AVAILABLE;
    return { ok: true, data: { ...availability, status, submittedAt: existing?.submitted_at ?? existing?.created_at ?? null, isLate: existing ? scheduleService.isSubmittedLate(existing.submitted_at ?? existing.created_at, now) : scheduleService.isAfterRecommendedDeadline(now), feedback: existing ?? null } };
  };
}
