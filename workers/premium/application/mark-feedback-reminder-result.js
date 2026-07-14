export function createMarkFeedbackReminderResultUseCase({ reminderRepository }) {
  return ({ id, status, sent_at = null, failure_reason = null }) => reminderRepository.markResult(id, { status, sent_at, failure_reason });
}
