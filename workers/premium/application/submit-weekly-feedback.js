import { createPremiumUseCase } from './create-use-case.js';
import { resolvePremiumIdentityForLegacyEmail } from './dual-write-helpers.js';

export function createSubmitWeeklyFeedbackUseCase(depsOrHandler) {
  if (typeof depsOrHandler === 'function') return createPremiumUseCase('submit-weekly-feedback', depsOrHandler);
  const deps = depsOrHandler;
  return createPremiumUseCase('submit-weekly-feedback', async ({ feedback, route, method }) => {
    const identity = await resolvePremiumIdentityForLegacyEmail({ identityService: deps.identityService, email: feedback.student_email, log: deps.log, area: 'premium_weekly_feedback', route, method });
    const saved = await deps.weeklyFeedbackRepository.create({ ...feedback, student_id: identity.student_id });
    await deps.eventRepository?.append?.({ id: deps.randomUUID(), student_id: identity.student_id, student_email: feedback.student_email, event_type: 'FEEDBACK_RECEIVED', source: 'portal', title: 'Check-in enviado', metadata: { checkin_id: feedback.id, week_ref: feedback.week_ref }, created_at: feedback.created_at });
    return { saved, identity };
  });
}
