import { FeedbackStatus, isFeedbackAnalyzed } from '../domain/feedback-status.js';

export const PUBLIC_WEEKLY_FEEDBACK_ANSWER_FIELDS = Object.freeze([
  'training_adherence',
  'nutrition_adherence',
  'cardio_adherence',
  'free_meals',
  'hunger_level',
  'binge_or_snacking',
  'sleep_quality',
  'energy_level',
  'stress_level',
  'weekly_weight',
  'waist',
  'strength_status',
  'main_difficulty',
  'routine_context',
  'weekly_score',
  'support_needed',
]);

function presentAnswers(row) {
  return Object.fromEntries(PUBLIC_WEEKLY_FEEDBACK_ANSWER_FIELDS.map((field) => [field, row?.[field] ?? null]));
}

function presentProfessionalResponse(row) {
  const message = typeof row?.coach_reply === 'string' ? row.coach_reply.trim() : '';
  if (!message) return null;
  return { message, respondedAt: row.coach_reply_at ?? null };
}

function publicStatus(row, requestedStatus, professionalResponse) {
  if (professionalResponse || isFeedbackAnalyzed(row?.coach_status)) return FeedbackStatus.ANALYZED;
  return requestedStatus ?? (row ? FeedbackStatus.RESPONDED : FeedbackStatus.AVAILABLE);
}

/** Maps an internal Premium check-in to the stable student-facing contract. */
export function presentPublicWeeklyFeedback(row, context = {}) {
  const professionalResponse = presentProfessionalResponse(row);
  return {
    id: row?.id ?? null,
    weekRef: context.weekRef ?? row?.week_ref ?? null,
    status: publicStatus(row, context.status, professionalResponse),
    availableAt: context.availableAt ?? row?.available_at ?? null,
    recommendedDeadline: context.recommendedDeadline ?? null,
    submittedAt: row?.submitted_at ?? null,
    isLate: context.isLate ?? false,
    questions: presentAnswers(row),
    professionalResponse,
  };
}
